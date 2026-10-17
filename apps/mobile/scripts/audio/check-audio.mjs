// Checks processed clips against the acceptance table of F-AUDIO-004 §3.11, or
// lists which content clips are still missing (the T-017 to-do list). The
// limits live in lib.mjs (evaluateReport, evaluateSet), unit-tested.
//
//   node scripts/audio/check-audio.mjs [<dir>] [--kind jamo|word]   default: assets/audio/jamo, jamo
//   node scripts/audio/check-audio.mjs --status                      clips the content refers to that have no file yet
//
// The report needs ffmpeg and ffprobe (local only); --status needs neither.
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appRoot, listFiles, readJamo, readVocabTopics } from './content-sources.mjs';
import { ffmpeg, ffprobe } from './ffmpeg.mjs';
import { AUDIO_DIR, clipSets, clipStatus, evaluateReport, evaluateSet, parseEbur128, parseProbe, recordingRows, vocabClipRefs, vocabRecordingRows } from './lib.mjs';

const args = process.argv.slice(2);

if (args.includes('--status')) {
  const refs = [
    ...readJamo().map((j) => j.audioRef),
    ...vocabClipRefs(readVocabTopics()),
  ];
  const status = clipStatus(refs, listFiles(join(appRoot, AUDIO_DIR)).filter((f) => f.endsWith('.mp3')));
  process.stdout.write(`${status.missing.length} of ${status.total} clips missing (${status.present} recorded)\n`);
  for (const ref of status.missing) process.stdout.write(`  ${ref}\n`);
  process.exit(0);
}

const kindIndex = args.indexOf('--kind');
const kind = kindIndex >= 0 ? args[kindIndex + 1] : 'jamo';
if (kind !== 'jamo' && kind !== 'word') {
  process.stderr.write(`--kind must be jamo or word, not ${kind}\n`);
  process.exit(2);
}
const dirArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--kind');
const dir = resolve(dirArg ?? join(appRoot, AUDIO_DIR, 'jamo'));
const files = listFiles(dir).filter((f) => f.endsWith('.mp3'));
if (files.length === 0) {
  process.stdout.write(`no .mp3 files in ${dir}\n`);
  process.exit(0);
}

let failed = 0;
for (const f of files) {
  const path = join(dir, f);
  const probe = parseProbe(
    ffprobe(['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration,size', '-of', 'json', path]),
  );
  const loud = parseEbur128(ffmpeg(['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-']));
  const report = { ...probe, ...loud };
  const failures = evaluateReport(kind, report);
  const line = `${f}: ${report.durationS} s, ${report.integratedLufs} LUFS, ${report.truePeakDb} dBTP, ${report.bytes} bytes`;
  if (failures.length === 0) process.stdout.write(`ok    ${line}\n`);
  else {
    failed += 1;
    process.stdout.write(`FAIL  ${line}\n${failures.map((x) => `        ${x}\n`).join('')}`);
  }
}
// The set limit applies to the 30 jamo clips of the script (Batch 2 names are
// not part of it) and to each vocabulary topic on its own (§3.11 table).
const sizeById = new Map(files.map((f) => [f.replace(/\.mp3$/, ''), statSync(join(dir, f)).size]));
const sets = clipSets(kind, [...sizeById.keys()], {
  jamoIds: kind === 'jamo' ? recordingRows(readJamo()).map((r) => r.fileId) : [],
  topicByFileId: kind === 'word' ? new Map(vocabRecordingRows(readVocabTopics()).map((r) => [r.fileId, r.topic])) : new Map(),
});
const setFailures = sets.flatMap((set) => evaluateSet(kind, set.fileIds.map((id) => sizeById.get(id) ?? 0), set.label));
for (const x of setFailures) process.stdout.write(`FAIL  ${x}\n`);
process.stdout.write(`${files.length - failed} of ${files.length} clip(s) pass\n`);
if (failed > 0 || setFailures.length > 0) process.exit(1);
