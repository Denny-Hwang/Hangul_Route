// Checks processed clips against the acceptance table of F-AUDIO-004 §3.11 and the
// clip classes of AMENDMENTS-AUDIO-CLIPS AC-B6, or lists which content clips are
// still missing (the T-017 to-do list). The limits live in lib.mjs (clipLimitsOf,
// evaluateReport, evaluateSet), unit-tested. A clip the manifest lists
// (content/audio/tts-manifest.json) takes its row's class (a tense letter name the
// word bound, a sentence the per-syllable bound) and its bitrate (jamo 64 kbps,
// generated clips 48 kbps); the jamo set totals are per pack (jamo-s1, jamo-wb).
//
//   node scripts/audio/check-audio.mjs [<dir>] [--kind jamo|word]   default: assets/audio/jamo, jamo
//   node scripts/audio/check-audio.mjs --status                      clips the content refers to that have no file yet
//
// The report needs ffmpeg and ffprobe (local only); --status needs neither.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { appRoot, listFiles, readJamoClipRefs, readVocabTopics, repoRoot } from './content-sources.mjs';
import { ffmpeg, ffprobe } from './ffmpeg.mjs';
import {
  AUDIO_DIR,
  TTS_MANIFEST_FILE,
  clipClassOf,
  clipKbpsOf,
  clipSets,
  clipStatus,
  evaluateReport,
  evaluateSet,
  fileIdOf,
  parseEbur128,
  parseProbe,
  spokenSyllableCount,
  vocabClipRefs,
  vocabRecordingRows,
} from './lib.mjs';

const args = process.argv.slice(2);

if (args.includes('--status')) {
  // Every declared jamo clip (the 65 of AMENDMENTS-AUDIO-CLIPS section 5: sounds and names, Stage 1 and Word
  // Builder) and every word clip; listed, never failed, while the clips are still to come.
  const refs = [
    ...readJamoClipRefs().map((r) => r.ref),
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

const manifestPath = join(repoRoot, TTS_MANIFEST_FILE);
const manifestRows = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).rows ?? [] : [];
const rowByRef = new Map(manifestRows.map((row) => [row.ref, row]));
const audioRoot = join(appRoot, AUDIO_DIR);
/** The clip's ref when the folder is under assets/audio (`audio/jamo/giyeok.mp3`), else its jamo or word ref by file id. */
const refOf = (f) => {
  const rel = relative(audioRoot, join(dir, f)).split('\\').join('/');
  return rel.startsWith('..') ? `audio/${kind === 'jamo' ? 'jamo' : 'vocab'}/${f}` : `audio/${rel}`;
};

let failed = 0;
for (const f of files) {
  const path = join(dir, f);
  const row = rowByRef.get(refOf(f));
  const clipKind = row === undefined ? kind : clipClassOf(row);
  const context = { kbps: clipKbpsOf(refOf(f), { generated: row !== undefined }), syllables: row === undefined ? undefined : spokenSyllableCount(row.text) };
  const probe = parseProbe(
    ffprobe(['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration,size', '-of', 'json', path]),
  );
  const loud = parseEbur128(ffmpeg(['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-']));
  const report = { ...probe, ...loud };
  const failures = evaluateReport(clipKind, report, context);
  const line = `${f}: ${report.durationS} s, ${report.integratedLufs} LUFS, ${report.truePeakDb} dBTP, ${report.bytes} bytes`;
  if (failures.length === 0) process.stdout.write(`ok    ${line}\n`);
  else {
    failed += 1;
    process.stdout.write(`FAIL  ${line}\n${failures.map((x) => `        ${x}\n`).join('')}`);
  }
}
// The set limit applies to each jamo pack (jamo-s1, jamo-wb; AMENDMENTS-AUDIO-CLIPS AC-B6) and to each vocabulary
// topic on its own (§3.11 table).
const sizeById = new Map(files.map((f) => [f.replace(/\.mp3$/, ''), statSync(join(dir, f)).size]));
const sets = clipSets(kind, [...sizeById.keys()], {
  packByFileId: kind === 'jamo' ? new Map(readJamoClipRefs().map((r) => [fileIdOf(r.ref), r.pack])) : new Map(),
  topicByFileId: kind === 'word' ? new Map(vocabRecordingRows(readVocabTopics()).map((r) => [r.fileId, r.topic])) : new Map(),
});
const setFailures = sets.flatMap((set) => evaluateSet(set.pack ?? kind, set.fileIds.map((id) => sizeById.get(id) ?? 0), set.label));
for (const x of setFailures) process.stdout.write(`FAIL  ${x}\n`);
process.stdout.write(`${files.length - failed} of ${files.length} clip(s) pass\n`);
if (failed > 0 || setFailures.length > 0) process.exit(1);
