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
