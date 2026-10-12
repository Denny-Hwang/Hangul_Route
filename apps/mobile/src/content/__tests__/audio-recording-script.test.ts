import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nameRows, recordingRows, renderRecordingScript, vocabRecordingRows } from '../../../scripts/audio/lib.mjs';
import { jamoAll } from '../jamo';

/**
 * The committed recording script matches the content records (F-AUDIO-004
 * §3.11): regenerate with `pnpm --filter @hangul-route/mobile audio:script`.
 */

const REPO_ROOT = join(__dirname, '../../../../..');
const SCRIPT = join(REPO_ROOT, 'docs/launch/audio-recording-script.md');

function vocabTopics(): Array<{ items?: readonly object[] }> {
  const dir = join(REPO_ROOT, 'content/vocab');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { items?: readonly object[] });
}

describe('docs/launch/audio-recording-script.md', () => {
  const committed = readFileSync(SCRIPT, 'utf8');

  it('is the script the content records generate (run audio:script when it fails)', () => {
    expect(committed).toBe(renderRecordingScript(recordingRows(jamoAll), nameRows(jamoAll), vocabRecordingRows(vocabTopics())));
  });

  it('lists every jamo clip the app refers to, by its file id', () => {
    for (const j of jamoAll) {
      const id = (j.audioRef ?? '').replace(/^audio\/jamo\//, '').replace(/\.mp3$/, '');
      expect(committed).toContain(`| ${id} | ${j.spokenKo} |`);
    }
  });
});
