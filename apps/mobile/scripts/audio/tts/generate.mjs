#!/usr/bin/env node
// content/audio/tts-manifest.json -> WAV masters (AMENDMENTS-AUDIO-CLIPS AC-B5 step 2; row AC-3).
//
//   pnpm --filter @hangul-route/mobile audio:tts:generate --engine polly --pilot --dry-run
//   pnpm --filter @hangul-route/mobile audio:tts:generate --engine google --voice ko-KR-Neural2-A --pack jamo-s1,jamo-wb --dry-run
//
// --dry-run prints every request and the billed character count and sends nothing: it is what CI and agents run.
// A real run happens only in the owner's own terminal, never in CI or a Claude Code session (it refuses when CI,
// CLAUDECODE or CLAUDE_CODE_ENTRYPOINT is set), with the credentials inline for that one command
// (docs/launch/owner-runbook.md section M). Credentials come only from each vendor SDK's default chain (Azure: the
// command's AZURE_SPEECH_KEY and AZURE_SPEECH_REGION); this script never opens a key file, never prints a credential
// and never writes one to the lock.
//
// Output: 24 kHz (Polly, Google) or 48 kHz (Azure) mono WAV masters in apps/mobile/recordings/tts/<engine>/<voice>/
// (gitignored; refused otherwise), and content/audio/tts-lock.json, written after every clip so an interrupted run
// keeps what it paid for. Rows already in the lock with the same say, voice and rate are skipped.
//
// Spend guard: --max-chars defaults to the dry-run count of the same command plus 10 %, and neither the default nor
// an explicit --max-chars can pass the $50 budget ceiling; the run stops before the request that would cross the cap
// (exit 3). --manifest, --lock and --out must stay inside the repository. A real Azure run is refused until its terms
// are read first-hand (engines/azure.mjs). The rules are in generate-lib.mjs and tested there with no network.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { registerTsLoader, repoRoot } from '../content-sources.mjs';

/** Writes through a temporary file in the same folder, so a crash never leaves half a lock or half a WAV. */
function writeAtomic(path, data) {
  const tmp = join(dirname(path), `.${Date.now()}-${process.pid}.tmp`);
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/** Whether git ignores a path in this repository (`git check-ignore`, exit 0). */
function isIgnored(dir) {
  return spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', dir]).status === 0;
}

/** Decodes a vendor's compressed master (Polly's Ogg Vorbis) to a mono 16-bit WAV at the engine's rate (ffmpeg). */
async function toWav(bytes, format, sampleRate) {
  const { ffmpeg } = await import('../ffmpeg.mjs');
  const work = mkdtempSync(join(tmpdir(), 'hr-tts-'));
  try {
    const src = join(work, `in.${format}`);
    const out = join(work, 'out.wav');
    writeFileSync(src, bytes);
    ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', String(sampleRate), '-c:a', 'pcm_s16le', out]);
    return readFileSync(out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(argv) {
  // generate-lib.mjs reads the pack list and the say key from packages/content-schema (TypeScript).
  await registerTsLoader();
  const { runGenerate } = await import('./generate-lib.mjs');
  const { sayKey, sayRef } = await import('@hangul-route/content-schema');
  return runGenerate(argv, process.env, {
    repoRoot,
    readText: (p) => readFileSync(p, 'utf8'),
    exists: existsSync,
    writeAtomic,
    mkdirp: (dir) => mkdirSync(dir, { recursive: true }),
    isIgnored,
    // The vendor SDK is imported only here, on a real run, after every refusal check has passed.
    createClient: (engine, { env }) => engine.createClient({ env }),
    canDecode: () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0,
    toWav,
    now: () => new Date(),
    keys: { sayKey, sayRef },
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  });
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`audio:tts:generate: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
