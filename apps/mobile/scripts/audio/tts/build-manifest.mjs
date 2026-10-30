#!/usr/bin/env node
// content -> content/audio/tts-manifest.json (AMENDMENTS-AUDIO-CLIPS AC-B5 step 1; row AC-2). No network, no audio.
//
// Walks every shipped spoken text (the jamo records through jamoVoice, the Stage 1 quests and their game scopes, the
// placement bank, the lesson cells of Stages 2-7, the vocabulary, the stories, the review items and the heritage
// cards; scripts/audio/content-sources.mjs), applies the AC-B3 normalization and content/audio/pronunciation-overrides.json,
// and writes one row per clip to generate. The audio map generator (gen-audio-map.mjs) reads each clip's pack back from
// the file. The pure rules are in manifest-lib.mjs; the drift test (scripts/__tests__/tts-manifest-drift.test.mjs)
// runs `--check`.
//
//   pnpm --filter @hangul-route/mobile audio:tts:manifest            write the manifest and print the summary
//   node scripts/audio/tts/build-manifest.mjs --check                 exit 1 when the committed manifest is stale
//   node scripts/audio/tts/build-manifest.mjs --skips                 also print every skipped occurrence
//   ... --manifest <path>                                              read or write another file (tests)
//
// Exit 0 when written or up to date, 1 when stale or the content contradicts itself, 2 on a usage error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { readClipSources, registerTsLoader, repoRoot } from '../content-sources.mjs';

const USAGE = 'usage: build-manifest.mjs [--check] [--skips] [--manifest <path>]';

function parseArgs(argv) {
  const opts = { check: false, skips: false, manifest: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--skips') opts.skips = true;
    else if (arg === '--manifest' && argv[i + 1] !== undefined) opts.manifest = argv[(i += 1)];
    else return null;
  }
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts === null) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  // manifest-lib.mjs imports the say key and the pack list from packages/content-schema (TypeScript).
  await registerTsLoader();
  const { MANIFEST_FILE, OVERRIDES_FILE, buildManifest, renderManifest, summarizeManifest } = await import('./manifest-lib.mjs');
  const { parseOverrides } = await import('./overrides-schema.mjs');

  const overridesPath = join(repoRoot, OVERRIDES_FILE);
  const overrides = parseOverrides(JSON.parse(readFileSync(overridesPath, 'utf8')));
  const { jamo, occurrences } = await readClipSources(repoRoot);
  const result = buildManifest({ jamo, occurrences, overrides });
  const source = renderManifest(result.rows);

  const target = opts.manifest === undefined ? join(repoRoot, MANIFEST_FILE) : isAbsolute(opts.manifest) ? opts.manifest : join(process.cwd(), opts.manifest);
  const shown = relative(repoRoot, target).split('\\').join('/');
  if (opts.check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== source) {
      process.stderr.write(`${shown} is stale: the content changed. Run pnpm --filter @hangul-route/mobile audio:tts:manifest and commit the file.\n`);
      return 1;
    }
    process.stdout.write(`audio:tts:manifest up to date (${result.rows.length} clips)\n`);
    return 0;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
  process.stdout.write(`${summarizeManifest(result).join('\n')}\nwrote ${shown}\n`);
  if (opts.skips) {
    for (const s of result.skipped) process.stdout.write(`skip ${s.reason}\t${s.text}\t${s.source}\n`);
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`audio:tts:manifest: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
