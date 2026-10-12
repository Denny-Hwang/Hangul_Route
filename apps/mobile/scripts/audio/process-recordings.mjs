// Turns the owner's recordings into app clips (F-AUDIO-004 §3.11). Needs ffmpeg
// and ffprobe on the PATH; runs locally, never in CI.
//
//   node scripts/audio/process-recordings.mjs <folder> [--group jamo|vocab] [--out <dir>] [--names] [--allow-extra]
//
// The raw recordings and the speaker's signed voice-use release stay OUTSIDE the
// repo (it is public): the folder must be outside it, or in the gitignored
// apps/mobile/recordings/. Only the processed MP3s are committed.
//
// Each file is named by its file id from docs/launch/audio-recording-script.md
// (giyeok.m4a) and holds two takes with a pause between them. The first take is
// used, or the take the owner marked in the name (giyeok.2.m4a = take 2). Per
// clip: cut the take, trim silence, add 0.3 s of silence each side,
// loudness-normalise to -16 LUFS, mono, 44.1 kHz, 64 kbps CBR MP3, no metadata.
// loudnorm needs about 3 s of audio, so a short syllable is then topped up
// (gain behind a peak limiter at -2 dBFS, at 4x oversampling), at most
// MAX_TOP_UP_PASSES passes and MAX_TOP_UP_DB in all. A clip that still misses
// the acceptance loudness is not written (record that take again); one that
// needed more than LIMITING_WARN_DB is flagged for a listen.
//
// A file the script does not name is skipped (--allow-extra keeps it). Batch 2
// name clips (giyeok-name) are skipped until --names, which is run once jamo.ts
// carries their nameAudioRef (A-10); otherwise audio:map would list clips no
// content refers to. One bad file is reported and the rest still run.
// Output: assets/audio/<group>/<id>.mp3 (git shows every overwrite). Then run
// audio:check and audio:map, and play the six final-consonant clips back to back.
import { mkdtempSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appRoot, readJamo, readVocabTopics, repoRoot } from './content-sources.mjs';
import { ffmpeg, ffprobeDuration } from './ffmpeg.mjs';
import {
  LIMITING_WARN_DB,
  MAX_TOP_UP_DB,
  MAX_TOP_UP_PASSES,
  isInsideDir,
  nameRows,
  nextTopUp,
  parseEbur128,
  parseSilences,
  parseTakeFile,
  planRecording,
  recordingRows,
  takeSegments,
  topUpOutcome,
  vocabRecordingRows,
} from './lib.mjs';

/** The §3.11 filter chain (verified on a synthesized sample). */
export const CLIP_FILTER =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,' +
  'adelay=300:all=1,apad=pad_dur=0.3,loudnorm=I=-16:TP=-1.5:LRA=11';

/** Gain stage of the top-up pass: limit at -2 dBFS (0.794) on a 4x-oversampled signal so true peaks stay under -1.5 dBTP. */
const topUpFilter = (gainDb) =>
  `aresample=176400,volume=${gainDb}dB,alimiter=limit=0.7943:attack=1:release=40:level=false,aresample=44100`;

const measure = (file) =>
  parseEbur128(ffmpeg(['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'])).integratedLufs;

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--group', '--out'];
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const input = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1] ?? ''));
if (!input) {
  process.stderr.write(
    'usage: node scripts/audio/process-recordings.mjs <folder> [--group jamo|vocab] [--out <dir>] [--names] [--allow-extra]\n',
  );
  process.exit(2);
}
const group = flag('--group', 'jamo');
if (!['jamo', 'vocab'].includes(group)) {
  process.stderr.write(`--group must be jamo or vocab, not ${group}\n`);
  process.exit(2);
}
const opts = { names: args.includes('--names'), allowExtra: args.includes('--allow-extra') };

/** Raw recordings must never be committable: outside the repo, or in a gitignored folder inside it. */
const inputDir = resolve(input);
if (isInsideDir(inputDir, resolve(repoRoot))) {
  const ignored = spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', inputDir]).status === 0;
  if (!ignored) {
    process.stderr.write(
      `error: ${inputDir} is inside the repo and not gitignored. The repo is public: keep raw recordings outside it ` +
        '(your own drive) or in apps/mobile/recordings/, which is gitignored.\n',
    );
    process.exit(2);
  }
}

const outDir = resolve(flag('--out', join(appRoot, 'assets/audio', group)));
const jamo = group === 'jamo' ? readJamo() : [];
const sets = {
  expected: new Set(
    group === 'jamo' ? recordingRows(jamo).map((r) => r.fileId) : vocabRecordingRows(readVocabTopics()).map((r) => r.fileId),
  ),
  names: new Set(group === 'jamo' ? nameRows(jamo).map((r) => r.fileId) : []),
};

const errors = [];
const warnings = [];
const chosen = new Map(); // fileId -> { name, take }
for (const name of readdirSync(inputDir).sort()) {
  let parsed;
  try {
    parsed = parseTakeFile(name);
  } catch (e) {
    errors.push(e.message);
    continue;
  }
  if (!parsed) continue;
  if (chosen.has(parsed.fileId)) {
    errors.push(`${name}: a second file for ${parsed.fileId} (${chosen.get(parsed.fileId).name}); keep one and mark the take in its name`);
    continue;
  }
  const plan = planRecording(parsed.fileId, sets, opts);
  if (plan.action === 'skip') {
    warnings.push(`${name}: skipped, ${plan.reason}`);
    continue;
  }
  chosen.set(parsed.fileId, { name, take: parsed.take });
}

/** Cuts, normalises and encodes one file; returns a summary line, or throws with the reason. */
function processOne(work, fileId, name, take) {
  const src = join(inputDir, name);
  const durationS = ffprobeDuration(src);
  const log = ffmpeg(['-hide_banner', '-nostats', '-i', src, '-af', 'silencedetect=noise=-40dB:d=0.3', '-f', 'null', '-']);
  const segments = takeSegments(parseSilences(log, durationS), durationS);
  const seg = segments[take - 1];
  if (!seg) throw new Error(`take ${take} not found (${segments.length} take(s) heard); record again or change the mark`);
  const start = Math.max(0, seg.start - 0.05);
  const end = Math.min(durationS, seg.end + 0.05);
  const wav = join(work, `${fileId}.wav`);
  const next = join(work, `${fileId}.next.wav`);
  ffmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', src,
    '-af', CLIP_FILTER, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav,
  ]);
  let passes = 0;
  let appliedDb = 0;
  let lufs = measure(wav);
  for (;;) {
    const gain = nextTopUp(lufs, { passes, appliedDb });
    if (gain === 0) break;
    ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', topUpFilter(gain), '-c:a', 'pcm_s16le', next]);
    renameSync(next, wav);
    passes += 1;
    if (gain > 0) appliedDb += gain;
    lufs = measure(wav);
  }
  const outcome = topUpOutcome(lufs);
  const summary = `${passes} top-up pass(es), +${appliedDb.toFixed(1)} dB, ${lufs} LUFS`;
  if (outcome === 'rejected') {
    throw new Error(
      `loudness did not settle (${summary}; limits ${MAX_TOP_UP_PASSES} passes, ${MAX_TOP_UP_DB} dB). ` +
        'The take is too quiet or too uneven: record it again a little closer to the phone. Not written.',
    );
  }
  if (appliedDb > LIMITING_WARN_DB) {
    warnings.push(`${name}: heavily limited (+${appliedDb.toFixed(1)} dB of top-up); listen to it, and record it again if the ending sounds smeared`);
  }
  if (outcome === 'accepted') warnings.push(`${name}: loudness ${lufs} LUFS is inside the limit but did not settle within 0.5 dB (${summary})`);
  const out = join(outDir, `${fileId}.mp3`);
  ffmpeg([
    '-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k',
    '-map_metadata', '-1', '-id3v2_version', '0', out,
  ]);
  return `${name} -> ${out} (take ${take} of ${segments.length}, ${summary})`;
}

mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'hr-audio-'));
let made = 0;
try {
  for (const [fileId, { name, take }] of chosen) {
    try {
      process.stdout.write(`${processOne(work, fileId, name, take)}\n`);
      made += 1;
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
for (const e of errors) process.stderr.write(`error: ${e}\n`);
const missing = [...sets.expected].filter((id) => !chosen.has(id));
process.stdout.write(`${made} clip(s) written to ${outDir}; ${missing.length} of ${sets.expected.size} still to record\n`);
process.stdout.write(
  'next: pnpm --filter @hangul-route/mobile audio:check, then audio:map; play the six final-consonant clips ' +
    '(giyeok-batchim ... ieung-batchim) back to back before committing\n',
);
if (errors.length > 0) process.exit(1);
