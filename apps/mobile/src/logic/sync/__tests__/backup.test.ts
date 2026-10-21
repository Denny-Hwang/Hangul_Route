import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
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
    const legacy: Profile = { ...profile, learnerType: 'self', lastActiveAt: 'u', parentPinHash: 'salt:digest' };
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
  it('builds a safe file name', () => {
    expect(backupFileName('Su Ni!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-su-ni-2026-09-21.hangulroute.json');
    expect(backupFileName('!!!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-learner-2026-09-21.hangulroute.json');
  });
});
