// The committed clip manifest agrees with the content (AMENDMENTS-AUDIO-CLIPS AC-B5 step 1; row AC-2), the same
// pattern as the audio map's drift test: a content edit that adds, changes or removes a spoken text fails here until
// `pnpm --filter @hangul-route/mobile audio:tts:manifest` is run and the file committed. The builder runs as its own
// process (plain node with scripts/ts-loader.mjs), exactly as the package script does.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { clipPacksOf } from '../audio/lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const BUILDER = join(APP_ROOT, 'scripts/audio/tts/build-manifest.mjs');
const MANIFEST = join(REPO_ROOT, 'content/audio/tts-manifest.json');
const TIMEOUT = 120_000;

/** The builder in its own plain-node process, as the package script runs it (without vitest's environment marker). */
function runBuilder(...args) {
  const env = { ...process.env };
  delete env.VITEST;
  return spawnSync(process.execPath, [BUILDER, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env });
}
const tmp = mkdtempSync(join(tmpdir(), 'tts-manifest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('content/audio/tts-manifest.json', () => {
  it('is exactly what the builder writes for the shipped content (run audio:tts:manifest after a content edit)', () => {
    const r = runBuilder('--check');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^audio:tts:manifest up to date \(\d+ clips\)$/m);
  }, TIMEOUT);

  it('fails, naming the file and the command, when the committed rows disagree with the content', () => {
    const stale = join(tmp, 'stale.json');
    const committed = readFileSync(MANIFEST, 'utf8');
    const lines = committed.split('\n');
    const i = lines.findIndex((l) => l.includes('"ref":"audio/say/'));
    lines.splice(i, 1, lines[i].replace(/"say":"([^"]*)"/, '"say":"$1 "'));
    writeFileSync(stale, lines.join('\n'));
    const r = runBuilder('--check', '--manifest', stale);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/is stale: the content changed\. Run pnpm --filter @hangul-route\/mobile audio:tts:manifest/);
  }, TIMEOUT);

  it('refuses unknown arguments', () => {
    const r = runBuilder('--upload');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/^usage: build-manifest\.mjs/);
  });

  it('holds 65 jamo rows and gives every ref one pack, which the audio map reads (AC-B6)', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    expect(manifest.rows.filter((r) => r.ref.startsWith('audio/jamo/'))).toHaveLength(65);
    const packs = clipPacksOf(manifest);
    expect(packs.size).toBe(manifest.rows.length);
    expect(packs.get('audio/jamo/digeut-batchim.mp3')).toBe('jamo-wb');
    expect(() => clipPacksOf({ rows: [{ ref: 'audio/say/0123456789abcdef.mp3', pack: 'stage1' }, { ref: 'audio/say/0123456789abcdef.mp3', pack: 'stage2' }] })).toThrow(/is in packs stage1 and stage2/);
    expect(clipPacksOf(null).size).toBe(0);
  });

  it('sends the engine no lone jamo, no cloze, no Latin letters and no digits', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    for (const row of manifest.rows) {
      expect(row.say, row.ref).not.toMatch(/[ㄱ-ㆎᄀ-ᇿ]|_{2,}|[A-Za-z0-9]/u);
      expect(row.text, row.ref).not.toMatch(/[ㄱ-ㆎᄀ-ᇿ]|_{2,}/u);
    }
  });
});
