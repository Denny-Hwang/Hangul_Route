// content/audio/tts-lock.json (AMENDMENTS-AUDIO-CLIPS AC-B5 step 4; row AC-3): the format, the committed file, the
// skip rule's match and the hand-off's processed-MP3 hash. No network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCK_FILE, emptyLock, lockMatches, lockRowOf, parseLock, renderLock, saySha256, sha256Hex, upsertLockRow, withProcessedMp3 } from '../audio/tts/lock-lib.mjs';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const base = { ref: 'audio/jamo/giyeok.mp3', key: 'giyeok', engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-02', saySha256: saySha256('가.'), mp3Sha256: null };

describe('tts-lock.json', () => {
  it('the committed file parses and is exactly what renderLock writes', () => {
    const text = readFileSync(join(REPO_ROOT, LOCK_FILE), 'utf8');
    const lock = parseLock(JSON.parse(text));
    expect(renderLock(lock)).toBe(text);
  });

  it('hashes the exact text sent: "가" and "가." are different inputs', () => {
    expect(saySha256('가.')).toBe(sha256Hex('가.'));
    expect(saySha256('가.')).toMatch(/^[0-9a-f]{64}$/);
    expect(saySha256('가')).not.toBe(saySha256('가.'));
  });

  it('matches a row only on the same say and rate', () => {
    expect(lockMatches(base, { say: '가.', rate: 0.85 })).toBe(true);
    expect(lockMatches(base, { say: '가', rate: 0.85 })).toBe(false);
    expect(lockMatches(base, { say: '가.', rate: 0.9 })).toBe(false);
    expect(lockMatches(undefined, { say: '가.', rate: 0.85 })).toBe(false);
  });

  it('keeps one row per ref, engine and voice, ordered, one per line', () => {
    let lock = upsertLockRow(emptyLock(), base);
    lock = upsertLockRow(lock, { ...base, voice: 'Jihye' });
    lock = upsertLockRow(lock, { ...base, ref: 'audio/jamo/a.mp3', key: 'a', saySha256: saySha256('아.') });
    lock = upsertLockRow(lock, { ...base, generated: '2026-11-03' });
    expect(lock.rows).toHaveLength(3);
    expect(lockRowOf(lock, base).generated).toBe('2026-11-03');
    const text = renderLock(lock);
    expect(text.split('\n').filter((l) => l.startsWith('    {')).map((l) => JSON.parse(l.replace(/,$/, '')).ref + ' ' + JSON.parse(l.replace(/,$/, '')).voice)).toEqual([
      'audio/jamo/a.mp3 Seoyeon',
      'audio/jamo/giyeok.mp3 Jihye',
      'audio/jamo/giyeok.mp3 Seoyeon',
    ]);
    expect(parseLock(JSON.parse(text)).rows).toHaveLength(3);
  });

  it('records the processed MP3 hash of the hand-off step', () => {
    const lock = withProcessedMp3(upsertLockRow(emptyLock(), base), base, 'b'.repeat(64));
    expect(lockRowOf(lock, base).mp3Sha256).toBe('b'.repeat(64));
    expect(() => withProcessedMp3(lock, base, 'nope')).toThrow(/must be a sha256/);
    expect(() => withProcessedMp3(lock, { ...base, voice: 'Jihye' }, 'b'.repeat(64))).toThrow(/is not in content\/audio\/tts-lock.json/);
  });

  it.each([
    [{ schemaVersion: 2, rows: [] }, /schemaVersion must be 1/],
    [{ schemaVersion: 1 }, /rows must be an array/],
    [{ schemaVersion: 1, rows: [{ ...base, secret: 'x' }] }, /unknown fields secret/],
    [{ schemaVersion: 1, rows: [{ ...base, saySha256: 'abc' }] }, /saySha256 must be a sha256/],
    [{ schemaVersion: 1, rows: [{ ...base, generated: '2026-11-2' }] }, /generated must be YYYY-MM-DD/],
    [{ schemaVersion: 1, rows: [{ ...base, mp3Sha256: 'x' }] }, /mp3Sha256 must be a sha256 or null/],
    [{ schemaVersion: 1, rows: [base, base] }, /repeats audio\/jamo\/giyeok.mp3 polly\/Seoyeon/],
  ])('rejects %j', (json, message) => {
    expect(() => parseLock(json)).toThrow(message);
  });
});
