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
  it('builds a safe file name', () => {
    expect(backupFileName('Su Ni!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-su-ni-2026-09-21.hangulroute.json');
    expect(backupFileName('!!!', new Date('2026-09-21T05:00:00Z'))).toBe('hangul-route-learner-2026-09-21.hangulroute.json');
  });
});
