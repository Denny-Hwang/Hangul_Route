import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  LearnerRegisterSchema,
  ProgressSummarySchema,
  SnapshotPutSchema,
  SyncInboxSchema,
} from '../index';

const snapshot = {
  profileId: 'profile:abc',
  updatedAt: '2026-09-21T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1 as const,
  lastActiveAt: '2026-09-21T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};

describe('sync schemas (F-SYNC-001)', () => {
  it('accepts a valid summary and rejects more than 3 practice items', () => {
    expect(ProgressSummarySchema.parse(summary)).toEqual(summary);
    expect(ProgressSummarySchema.safeParse({ ...summary, needsPractice: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(ProgressSummarySchema.safeParse({ ...summary, schemaVersion: 2 }).success).toBe(false);
  });

  it('validates the snapshot PUT body', () => {
    const body = { baseRev: 0, snapshot, summary, schemaVer: 1, contentVer: '2026.09' };
    expect(SnapshotPutSchema.parse(body).baseRev).toBe(0);
    expect(SnapshotPutSchema.safeParse({ ...body, baseRev: -1 }).success).toBe(false);
    expect(SnapshotPutSchema.safeParse({ ...body, contentVer: '' }).success).toBe(false);
  });

  it('validates learner registration and the optional client id', () => {
    const ok = LearnerRegisterSchema.parse({
      deviceId: 'device-12345678',
      learner: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
    });
    expect(ok.learner.id).toBe('profile:abc');
    expect(
      LearnerRegisterSchema.safeParse({ deviceId: 'short', learner: { displayName: 'x', ageGroup: '5-7', avatar: 'a' } })
        .success,
    ).toBe(false);
    expect(
      LearnerRegisterSchema.safeParse({
        deviceId: 'device-12345678',
        learner: { id: 'bad id', displayName: 'x', ageGroup: '5-7', avatar: 'a' },
      }).success,
    ).toBe(false);
  });

  it('registers each level id, rejects an unknown one, strips an unknown learnerType (F-LEARN-001 L2)', () => {
    const reg = (ageGroup: string, extra: Record<string, unknown> = {}) =>
      LearnerRegisterSchema.safeParse({
        deviceId: 'device-12345678',
        learner: { displayName: 'Suni', ageGroup, avatar: 'hoya-orange', ...extra },
      });
    for (const id of ['5-7', '8-9', '10-11']) expect(reg(id).success).toBe(true);
    expect(reg('12-14').success).toBe(false);
    const withType = reg('8-9', { learnerType: 'self' });
    expect(withType.success).toBe(true);
    expect(withType.success && 'learnerType' in withType.data.learner).toBe(false);
  });

  it('parses an old backup file and one carrying learnerType', () => {
    const old = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', createdAt: 't' },
      snapshot,
    };
    expect(BackupFileSchema.parse(old).profile.learnerType).toBeUndefined();
    const withType = { ...old, profile: { ...old.profile, learnerType: 'self' } };
    expect(BackupFileSchema.parse(withType).profile.learnerType).toBe('self');
  });

  it('inbox shape and backup file round-trip', () => {
    expect(
      SyncInboxSchema.parse({ rev: 3, plans: [], memberships: [], tier: 'free', serverTime: 't' }).tier,
    ).toBe('free');
    const file = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' },
      snapshot,
    };
    expect(BackupFileSchema.parse(file).profile.displayName).toBe('Suni');
    expect(BackupFileSchema.safeParse({ ...file, version: 2 }).success).toBe(false);
    expect(BackupFileSchema.safeParse({ ...file, format: 'other' }).success).toBe(false);
  });
});

describe('rescue code (F-RESTORE-001)', () => {
  it('normalizes spacing and case, rejects other shapes', async () => {
    const { normalizeRescueCode, RescueClaimSchema } = await import('../index');
    expect(normalizeRescueCode(' tiger moon 4821 ')).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode('Tiger-Moon-4821')).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode('tiger-4821')).toBeNull();
    expect(normalizeRescueCode('tiger-moon-48')).toBeNull();
    expect(normalizeRescueCode('t1ger-moon-4821')).toBeNull();
    expect(RescueClaimSchema.parse({ code: 'tiger moon 4821', deviceId: 'device-12345678' }).code).toBe('TIGER-MOON-4821');
    expect(RescueClaimSchema.safeParse({ code: 'nope', deviceId: 'device-12345678' }).success).toBe(false);
  });

  it('accepts four words + six digits (SEC-5) and keeps accepting codes already issued as two words + four digits', async () => {
    const { normalizeRescueCode, RescueClaimSchema, RESCUE_CODE_RE, RESCUE_CODE_FORMATS } = await import('../index');
    expect(RESCUE_CODE_FORMATS).toEqual([
      { words: 4, digits: 6 },
      { words: 2, digits: 4 },
    ]);
    expect(normalizeRescueCode('tiger moon river apple 482139')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    // digit groups and a missing last separator are forgiven; any whitespace separates
    expect(normalizeRescueCode(' Tiger-Moon-River-Apple-482 139 ')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode('TIGER\nMOON\tRIVER APPLE482139')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode('tiger moon4821')).toBe('TIGER-MOON-4821');
    for (const bad of [
      '',
      '482139',
      'tiger moon river 482139', // three words
      'tiger moon river apple 4821', // new words, old digit count
      'tiger moon 482139', // old words, new digit count
      'tiger moon river apple 482139 cloud', // a word after the number
      'tiger 4821 moon',
      'ab moon 4821', // too short to be a list word
      'tiger moon river apple seal 482139', // five words
      'tiger-moon-river-apple-48213', // five digits
    ]) {
      expect(normalizeRescueCode(bad)).toBeNull();
    }
    expect(RESCUE_CODE_RE.test('TIGER-MOON-RIVER-APPLE-482139')).toBe(true);
    expect(RESCUE_CODE_RE.test('TIGER-MOON-4821')).toBe(true);
    expect(RESCUE_CODE_RE.test('TIGER-MOON-482139')).toBe(false);
    expect(RescueClaimSchema.parse({ code: 'tiger moon river apple 482139', deviceId: 'device-12345678' }).code).toBe('TIGER-MOON-RIVER-APPLE-482139');
  });
});
