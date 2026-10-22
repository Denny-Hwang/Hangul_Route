import { BackupFileSchema, type MemoryBackup, type Profile, type ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { backupFileName, decodeBackup, encodeBackup } from '../backup';

const profile: Profile = { id: 'profile:a', displayName: 'Su Ni!', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' };
const snapshot: ProgressSnapshot = {
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: [],
  cards: [{ cardId: 'card:a', unlockedAt: 't', newSinceLastView: false }],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 1,
};

describe('backup file (F-SYNC-001 §3.6)', () => {
  it('round-trips', () => {
    const text = encodeBackup(profile, snapshot, new Date('2026-09-21T00:00:00Z'));
    const decoded = decodeBackup(text);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.file.profile.displayName).toBe('Su Ni!');
      expect(decoded.file.snapshot.cards).toHaveLength(1);
      expect(decoded.file.exportedAt).toBe('2026-09-21T00:00:00.000Z');
    }
  });
  it('never throws: typed errors for junk, foreign json, wrong version, bad shape', () => {
    expect(decodeBackup('{oops')).toEqual({ ok: false, error: 'not-json' });
    expect(decodeBackup('"str"')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(decodeBackup(JSON.stringify({ format: 'x' }))).toEqual({ ok: false, error: 'not-a-backup' });
    expect(decodeBackup(JSON.stringify({ format: 'hangul-route-backup', version: 9 }))).toEqual({ ok: false, error: 'unsupported-version' });
    expect(decodeBackup(JSON.stringify({ format: 'hangul-route-backup', version: 1, profile: {} }))).toEqual({ ok: false, error: 'invalid' });
  });
  // [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 13.1 (row OA-10): the grown-up PIN lives in `account:parentPinHash`;
  // a legacy profile record that still carries the old per-profile hash never takes it into a backup file, and a file
  // written before this change never brings one back onto the device.
  it('[OA] strips the legacy parentPinHash from the exported profile; every other field is kept', () => {
    // A record an older bundle wrote: the field is no longer in `Profile` (row OA-10), but such a record can still be read.
    const legacy = { ...profile, learnerType: 'self', lastActiveAt: 'u', parentPinHash: 'salt:digest' } as Profile & { parentPinHash: string };
    const text = encodeBackup(legacy, snapshot, new Date('2026-09-21T00:00:00Z'));
    expect(text).not.toContain('parentPinHash');
    expect(text).not.toContain('salt:digest');
    const raw = JSON.parse(text) as { profile: Record<string, unknown> };
    expect(raw.profile).toEqual({ ...profile, learnerType: 'self', lastActiveAt: 'u' });
    // The caller's profile is not changed.
    expect(legacy.parentPinHash).toBe('salt:digest');
  });
  it('[OA] a file that still carries a parentPinHash restores without it', () => {
    const old = JSON.stringify({
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: '2026-09-21T00:00:00.000Z',
      profile: { ...profile, parentPinHash: 'salt:digest' },
      snapshot,
    });
    const decoded = decodeBackup(old);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect('parentPinHash' in decoded.file.profile).toBe(false);
      expect(decoded.file.profile).toEqual(profile);
    }
  });
  // F-CURR-002 section 4.8 (row CM-11): the optional, lenient `memory` key; BACKUP_VERSION stays 1.
  const memory: MemoryBackup = { stage2: { 'lex:sagwa': { b: 3, d: '2026-10-25', c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-10-22T10:00:00.000Z' } } };
  it('round-trips the memory key when the store holds states, and writes none when it holds none', () => {
    const at = new Date('2026-10-22T00:00:00Z');
    const withKey = decodeBackup(encodeBackup(profile, snapshot, at, memory));
    expect(withKey.ok && withKey.file.memory).toEqual(memory);
    expect(withKey.ok && withKey.file.version).toBe(1);
    for (const none of [undefined, {}]) {
      const text = encodeBackup(profile, snapshot, at, none);
      expect(text).not.toContain('"memory"');
      const decoded = decodeBackup(text);
      expect(decoded.ok && decoded.file.memory).toBeUndefined();
    }
  });
  it('an unreadable memory key never fails the file: it reads as absent, or keeps only the states that parse', () => {
    const base = JSON.parse(encodeBackup(profile, snapshot, new Date('2026-10-22T00:00:00Z'))) as Record<string, unknown>;
    for (const junk of ['x', 7, [], null]) {
      const decoded = decodeBackup(JSON.stringify({ ...base, memory: junk }));
      expect(decoded.ok).toBe(true);
      expect(decoded.ok && decoded.file.memory).toBeUndefined();
      expect(decoded.ok && decoded.file.snapshot.cards).toHaveLength(1);
    }
    const partial = decodeBackup(JSON.stringify({ ...base, memory: { ...memory, stage3: 'x', stage4: { 'lex:bad': { b: 'x' } } } }));
    expect(partial.ok && partial.file.memory).toEqual({ ...memory, stage4: {} });
  });
  it('an older app ignores the key: the file still parses as a version 1 backup without it', () => {
    const text = encodeBackup(profile, snapshot, new Date('2026-10-22T00:00:00Z'), memory);
    // The file schema of a build from before the key, which strips keys it does not know.
    const older = BackupFileSchema.omit({ memory: true }).safeParse(JSON.parse(text));
    expect(older.success).toBe(true);
    expect(older.success && 'memory' in older.data).toBe(false);
    expect(JSON.parse(text)).toMatchObject({ format: 'hangul-route-backup', version: 1 });
  });
  it('builds a safe file name', () => {
    expect(backupFileName('Su Ni!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-su-ni-2026-09-21.hangulroute.json');
    expect(backupFileName('!!!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-learner-2026-09-21.hangulroute.json');
  });
});
