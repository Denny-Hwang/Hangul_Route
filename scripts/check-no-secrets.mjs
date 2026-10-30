#!/usr/bin/env node
// Rejects files that hold a speech-vendor credential (AMENDMENTS-AUDIO-CLIPS AC-B5 key safety; row AC-3).
//
//   node scripts/check-no-secrets.mjs              the staged files (the pre-commit hook, .githooks/pre-commit)
//   node scripts/check-no-secrets.mjs --all        every tracked file (CI, through `pnpm run test:scripts`)
//   node scripts/check-no-secrets.mjs <file> ...   these files
//
// The patterns are narrow on purpose, so content hashes never trip them:
//   google-service-account  "private_key": "-----BEGIN ... together with "client_email" in the same file
//   aws-access-key-id       AKIA or ASIA followed by 16 characters of [A-Z2-7]
//   aws-secret-access-key   a 40-character secret assigned to aws_secret_access_key (any case, = or :)
//   azure-speech-key        a 32- or 84-character key assigned to an AZURE_SPEECH_KEY name
//   azure-key-84            the 84-character Azure AI services key format (52 characters, JQQJ9, 27 characters)
// There is no bare 32-hex pattern: the sha256 values in content/audio/tts-lock.json and the say keys in the clip map
// are hex too. AWS's documented example key pair (AKIAIOSFODNN7EXAMPLE and its secret) is allowed.
//
// A finding prints the file, the line and the pattern name, never the matched text. Binary files are skipped.
// Exit 0 clean, 1 a finding, 2 a usage or git error. Dependency-free (Node built-ins only).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AWS_EXAMPLES = new Set(['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY']);

/** Each pattern finds candidate matches in one line; `value` is the secret part (checked against the allow list). */
export const LINE_PATTERNS = [
  { name: 'aws-access-key-id', re: /(?<![A-Z0-9])((?:AKIA|ASIA)[A-Z2-7]{16})(?![A-Z0-9])/g },
  { name: 'aws-secret-access-key', re: /aws_secret_access_key["']?\s*[:=]\s*["']?([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+=])/gi },
  { name: 'azure-speech-key', re: /AZURE_SPEECH_KEY["']?\s*[:=]\s*["']?([A-Za-z0-9]{84}|[A-Za-z0-9]{32})(?![A-Za-z0-9])/g },
  { name: 'azure-key-84', re: /(?<![A-Za-z0-9])([A-Za-z0-9]{52}JQQJ9[A-Za-z0-9]{27})(?![A-Za-z0-9])/g },
];
const GOOGLE_PRIVATE_KEY = /"private_key"\s*:\s*"-----BEGIN/;
const GOOGLE_CLIENT_EMAIL = /"client_email"\s*:/;

/** The findings in one file's text: [{ line, pattern }] (1-based lines; never the matched text). */
export function scanText(text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  if (GOOGLE_CLIENT_EMAIL.test(text)) {
    lines.forEach((l, i) => {
      if (GOOGLE_PRIVATE_KEY.test(l)) findings.push({ line: i + 1, pattern: 'google-service-account' });
    });
  }
  lines.forEach((l, i) => {
    for (const { name, re } of LINE_PATTERNS) {
      re.lastIndex = 0;
      for (const m of l.matchAll(re)) {
        if (!AWS_EXAMPLES.has(m[1])) findings.push({ line: i + 1, pattern: name });
      }
    }
  });
  return findings.sort((a, b) => a.line - b.line || (a.pattern < b.pattern ? -1 : 1));
}

/** Whether a buffer looks binary (a NUL byte in its first 8 KB). */
export function isBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

/** Runs git in the current directory's repository (a hook runs at the top of the work tree). */
function git(args) {
  const r = spawnSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(r.stderr).trim()}`);
  return r.stdout;
}

const splitZ = (buf) => String(buf).split('\0').filter((s) => s !== '');

/** The files to scan with a reader for each: staged blobs, tracked working-tree files, or the named files. */
function targets(argv) {
  if (argv.length === 0) {
    const top = String(git(['rev-parse', '--show-toplevel'])).trim();
    const names = splitZ(git(['-C', top, 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']));
    return names.map((name) => ({ name, read: () => git(['-C', top, 'show', `:${name}`]) }));
  }
  if (argv.length === 1 && argv[0] === '--all') {
    const top = String(git(['rev-parse', '--show-toplevel'])).trim();
    return splitZ(git(['-C', top, 'ls-files', '-z'])).map((name) => ({ name, read: () => readFileSync(join(top, name)) }));
  }
  if (argv.some((a) => a.startsWith('--'))) return null;
  return argv.map((name) => ({ name, read: () => readFileSync(resolve(name)) }));
}

export function main(argv, out = (l) => process.stdout.write(`${l}\n`), err = (l) => process.stderr.write(`${l}\n`)) {
  let files;
  try {
    files = targets(argv);
  } catch (e) {
    err(`check-no-secrets: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  if (files === null) {
    err('usage: check-no-secrets.mjs [--all | <file> ...]');
    return 2;
  }
  const findings = [];
  for (const file of files) {
    let buffer;
    try {
      buffer = file.read();
    } catch {
      continue; // a tracked file deleted in the working tree, or a symlink to nowhere
    }
    if (isBinary(buffer)) continue;
    for (const f of scanText(buffer.toString('utf8'))) findings.push({ file: file.name, ...f });
  }
  if (findings.length === 0) {
    out(`check-no-secrets: ${files.length} file(s) clean`);
    return 0;
  }
  for (const f of findings) err(`${f.file}:${f.line}: looks like a credential (${f.pattern})`);
  err(
    'check-no-secrets: remove the credential from the file (and unstage it). Speech-vendor credentials live only on the ' +
      "owner's machine, inline for one command, never in the repository (AMENDMENTS-AUDIO-CLIPS AC-B5).",
  );
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
