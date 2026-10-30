#!/usr/bin/env node
// WAV masters or processed MP3s -> the two-pass QA report (AMENDMENTS-AUDIO-CLIPS section 9, G4; row AC-4).
//
//   pnpm --filter @hangul-route/mobile audio:tts:qa --engine polly --voice Seoyeon --pilot
//   pnpm --filter @hangul-route/mobile audio:tts:qa --engine polly --voice Seoyeon --pack jamo-s1,jamo-wb
//   ... --dir apps/mobile/assets/audio/jamo        the processed MP3s instead of the masters
//
// Input: the clips of apps/mobile/recordings/tts/<engine>/<voice>/ (gitignored; `<key>.wav` or `<key>.mp3`), the
// committed manifest, pronunciation overrides (`accept` variants) and lock. Output: qa-report.json and qa-report.md
// in that same gitignored folder; the Markdown table is what the content PR body pastes, with two empty MAR columns.
//
// Both recognizers run on this machine only, with no network and no vendor speech-to-text, and never in CI (refused
// there): Pass 1 whisper.cpp large-v3, Pass 2 a local wav2vec2 CTC model. Setup: docs/launch/tts-qa-setup.md.
// The rules are in qa-lib.mjs and qa-report.mjs, the flow in qa-run.mjs; all three are tested with mocked recognizers.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registerTsLoader, repoRoot } from '../content-sources.mjs';

function writeAtomic(path, data) {
  const tmp = join(dirname(path), `.${Date.now()}-${process.pid}.tmp`);
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

function isIgnored(dir) {
  return spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', dir]).status === 0;
}

async function main(argv) {
  // qa-run.mjs reads the pack list and the say key from packages/content-schema (TypeScript).
  await registerTsLoader();
  const { DEFAULT_CTC_MODEL_DIR, DEFAULT_PYTHON, DEFAULT_WHISPER_MODEL, runQa } = await import('./qa-run.mjs');
  const { createCtc, createWhisper, sha256File } = await import('./recognizers.mjs');
  const { measureArgs, probeArgs } = await import('./qa-report.mjs');
  const { ffmpeg, ffprobe } = await import('../ffmpeg.mjs');
  const { sayKey, sayRef } = await import('@hangul-route/content-schema');
  const abs = (p) => resolve(repoRoot, p);
  return runQa(argv, process.env, {
    repoRoot,
    readText: (p) => readFileSync(p, 'utf8'),
    exists: existsSync,
    listDir: (dir) => readdirSync(dir).sort(),
    sha256File,
    writeAtomic,
    isIgnored,
    keys: { sayKey, sayRef },
    createRecognizers: async (opts) => {
      const python = opts.python ?? (existsSync(abs(DEFAULT_PYTHON)) ? abs(DEFAULT_PYTHON) : 'python3');
      return {
        pass1: createWhisper({ whisperCli: opts.whisperCli ?? 'whisper-cli', model: abs(opts.whisperModel ?? DEFAULT_WHISPER_MODEL), grammarPenalty: opts.grammarPenalty }),
        pass2: createCtc({ modelDir: abs(opts.ctcModel ?? DEFAULT_CTC_MODEL_DIR), modelId: opts.ctcModelId, licence: opts.ctcLicence, python, threshold: opts.threshold }),
      };
    },
    measure: async (path) => ({ probeJson: ffprobe(probeArgs(path)), log: ffmpeg(measureArgs(path)) }),
    now: () => new Date(),
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  });
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`audio:tts:qa: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
