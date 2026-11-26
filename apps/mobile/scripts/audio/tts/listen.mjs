#!/usr/bin/env node
// The optional owner listen (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4): plays the clips back to back on this machine
// (afplay on macOS, else ffplay), printing id, text and romanization, and records the vetoes next to the QA report.
//
//   pnpm audio:tts:listen --pack jamo-s1,jamo-wb --engine polly --voice Seoyeon
//   pnpm audio:tts:listen --pack jamo-s1 --engine polly --voice Seoyeon --dir apps/mobile/assets/audio/jamo --veto giyeok-batchim
//
// The listen is recorded in owner-listen.json next to the QA report, in the gitignored master folder
// (apps/mobile/recordings/tts/<engine>/<voice>/; a folder that is not gitignored is refused), merged with the
// earlier listens. Interactive in a terminal: Enter keeps a clip, v vetoes it (with an optional reason), r plays it
// again, q stops. Without a terminal and without --veto nothing is recorded.
// The rules are in listen-lib.mjs, tested.
//
// The blind listen of the contrast sets (AMENDMENTS-MINIMAL-PAIRS section 3.3, row MP-1a) is a mode of this tool:
//
//   pnpm audio:tts:listen --contrast all --engine polly --voice Seoyeon                   (computer sound)
//   pnpm audio:tts:listen --contrast all --engine polly --voice Seoyeon --speaker phone   (once more, a phone-sized speaker)
//
// It plays each member of a set three times in a shuffled order and asks which one you heard (nothing is shown until the
// set ends), then plays the set side by side with two questions, and records the verdict per set in owner-contrast.json
// next to the QA report. Only a processed MP3 that the clip lock holds is played. It is required for a set to be played.
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { registerTsLoader, repoRoot } from '../content-sources.mjs';

function isIgnored(dir) {
  return spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', dir]).status === 0;
}

function writeAtomic(path, data) {
  const tmp = join(dirname(path), `.${Date.now()}-${process.pid}.tmp`);
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/** afplay (macOS) or ffplay, whichever is on this machine. */
function player() {
  if (spawnSync('afplay', ['-h'], { stdio: 'ignore' }).error === undefined) return (file) => ['afplay', [file]];
  return (file) => ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'error', file]];
}

/** A fair shuffle (Fisher-Yates over crypto.randomInt): the order of the plays must not be guessable. */
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function main(argv) {
  await registerTsLoader();
  const { runListen } = await import('./listen-lib.mjs');
  const { sha256File } = await import('./recognizers.mjs');
  const { romanize, sayKey, sayRef } = await import('@hangul-route/content-schema');
  const command = player();
  const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    return await runListen(argv, process.env, {
      repoRoot,
      readText: (p) => readFileSync(p, 'utf8'),
      exists: existsSync,
      listDir: (dir) => readdirSync(dir).sort(),
      writeAtomic,
      isIgnored,
      sha256File,
      keys: { sayKey, sayRef },
      romanize: (text) => romanize(text).text,
      play: async (file) => {
        const [cmd, args] = command(file);
        const r = spawnSync(cmd, args, { stdio: 'inherit' });
        if (r.error) throw new Error(`${cmd} is not available: install ffmpeg (brew install ffmpeg) for ffplay`);
      },
      ask: rl === null ? null : (question) => rl.question(question),
      shuffle,
      now: () => new Date(),
      out: (line) => process.stdout.write(`${line}\n`),
      err: (line) => process.stderr.write(`${line}\n`),
    });
  } finally {
    rl?.close();
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`audio:tts:listen: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
