// Writes docs/launch/audio-recording-script.md from the content records
// (F-AUDIO-004 §3.11, owner task T-017), so the script cannot drift from the
// app. Checked for drift by src/content/__tests__/audio-recording-script.test.ts.
//
//   node scripts/audio/gen-recording-script.mjs           write the script
//   node scripts/audio/gen-recording-script.mjs --check   exit 1 if the committed script is stale
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJamo, readVocabTopics, repoRoot } from './content-sources.mjs';
import { nameRows, recordingRows, renderRecordingScript, vocabRecordingRows } from './lib.mjs';

export const RECORDING_SCRIPT_FILE = 'docs/launch/audio-recording-script.md';

const jamo = readJamo();
const source = renderRecordingScript(recordingRows(jamo), nameRows(jamo), vocabRecordingRows(readVocabTopics()));
const target = join(repoRoot, RECORDING_SCRIPT_FILE);

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== source) {
    process.stderr.write(`${RECORDING_SCRIPT_FILE} is stale: run pnpm --filter @hangul-route/mobile audio:script\n`);
    process.exit(1);
  }
  process.stdout.write(`${RECORDING_SCRIPT_FILE} is up to date\n`);
} else {
  writeFileSync(target, source);
  process.stdout.write(`wrote ${RECORDING_SCRIPT_FILE}\n`);
}
