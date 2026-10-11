// Turns the owner's recordings into app clips (F-AUDIO-004 §3.11). Needs ffmpeg
// and ffprobe on the PATH; runs locally, never in CI.
//
//   node scripts/audio/process-recordings.mjs <folder> [--group jamo|vocab] [--out <dir>]
//
// Each file is named by its file id from docs/launch/audio-recording-script.md
// (giyeok.m4a) and holds two takes with a pause between them. The first take is
// used, or the take the owner marked in the name (giyeok.2.m4a = take 2). Per
// clip: cut the take, trim silence, add 0.3 s of silence each side,
// loudness-normalise to -16 LUFS, mono, 44.1 kHz, 64 kbps CBR MP3, no metadata.
// loudnorm needs about 3 s of audio, so a short syllable is then topped up
// (gain behind a peak limiter at -2 dBFS, at 4x oversampling) until it is
// within 0.5 dB of -16 LUFS; audio:check confirms every limit.
// Output: assets/audio/<group>/<id>.mp3. Then run audio:check and audio:map.
import { mkdtempSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appRoot, readJamo, readVocabTopics } from './content-sources.mjs';
import { ffmpeg, ffprobeDuration } from './ffmpeg.mjs';
import { correctionGain, parseEbur128, parseSilences, parseTakeFile, recordingRows, takeSegments, vocabRecordingRows } from './lib.mjs';

/** The §3.11 filter chain (verified on a synthesized sample). */
export const CLIP_FILTER =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,' +
  'adelay=300:all=1,apad=pad_dur=0.3,loudnorm=I=-16:TP=-1.5:LRA=11';

/** Gain stage of the top-up pass: limit at -2 dBFS (0.794) on a 4x-oversampled signal so true peaks stay under -1.5 dBTP. */
const topUpFilter = (gainDb) =>
  `aresample=176400,volume=${gainDb}dB,alimiter=limit=0.7943:attack=1:release=40:level=false,aresample=44100`;
const MAX_TOP_UPS = 10;

const measure = (file) =>
  parseEbur128(ffmpeg(['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'])).integratedLufs;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const input = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
if (!input) {
  process.stderr.write('usage: node scripts/audio/process-recordings.mjs <folder> [--group jamo|vocab] [--out <dir>]\n');
  process.exit(2);
}
const group = flag('--group', 'jamo');
if (!['jamo', 'vocab'].includes(group)) {
  process.stderr.write(`--group must be jamo or vocab, not ${group}\n`);
  process.exit(2);
}
const outDir = resolve(flag('--out', join(appRoot, 'assets/audio', group)));
const expected = new Set(
  group === 'jamo' ? recordingRows(readJamo()).map((r) => r.fileId) : vocabRecordingRows(readVocabTopics()).map((r) => r.fileId),
);

const errors = [];
const warnings = [];
const chosen = new Map(); // fileId -> { name, take }
for (const name of readdirSync(input).sort()) {
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
  if (!expected.has(parsed.fileId)) warnings.push(`${name}: ${parsed.fileId} is not in the ${group} recording script`);
  chosen.set(parsed.fileId, { name, take: parsed.take });
}

mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'hr-audio-'));
let made = 0;
for (const [fileId, { name, take }] of chosen) {
  const src = join(input, name);
  const durationS = ffprobeDuration(src);
  const log = ffmpeg(['-hide_banner', '-nostats', '-i', src, '-af', 'silencedetect=noise=-40dB:d=0.3', '-f', 'null', '-']);
  const segments = takeSegments(parseSilences(log, durationS), durationS);
  const seg = segments[take - 1];
  if (!seg) {
    errors.push(`${name}: take ${take} not found (${segments.length} take(s) heard); record again or change the mark`);
    continue;
  }
  const start = Math.max(0, seg.start - 0.05);
  const end = Math.min(durationS, seg.end + 0.05);
  const out = join(outDir, `${fileId}.mp3`);
  const wav = join(work, `${fileId}.wav`);
  const next = join(work, `${fileId}.next.wav`);
  ffmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', src,
    '-af', CLIP_FILTER, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav,
  ]);
  let topUps = 0;
  for (; topUps < MAX_TOP_UPS; topUps += 1) {
    const gain = correctionGain(measure(wav));
    if (gain === 0) break;
    ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', topUpFilter(gain), '-c:a', 'pcm_s16le', next]);
    renameSync(next, wav);
  }
  ffmpeg([
    '-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k',
    '-map_metadata', '-1', '-id3v2_version', '0', out,
  ]);
  made += 1;
  process.stdout.write(`${name} -> ${out} (take ${take} of ${segments.length}, ${topUps} top-up pass(es))\n`);
}
rmSync(work, { recursive: true, force: true });

for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
for (const e of errors) process.stderr.write(`error: ${e}\n`);
const missing = [...expected].filter((id) => !chosen.has(id));
process.stdout.write(`${made} clip(s) written to ${outDir}; ${missing.length} of ${expected.size} still to record\n`);
process.stdout.write('next: pnpm --filter @hangul-route/mobile audio:check, then audio:map\n');
if (errors.length > 0) process.exit(1);
