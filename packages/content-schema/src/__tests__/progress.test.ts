import { describe, expect, it } from 'vitest';
import { BackupFileSchema, ProgressSnapshotSchema, SnapshotPutSchema, type ProgressSnapshot } from '../index';

/** A snapshot shaped exactly like the ones stored before `stageDoneAt` existed. */
const legacy = {
  profileId: 'profile:one',
  updatedAt: '2026-10-10T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 8, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const latch = { stage1: '2026-10-11T09:30:00.000Z' };

describe('ProgressSnapshotSchema.stageDoneAt (F-ROUTE-001 section 3.15, additive stage latch)', () => {
  it('parses a snapshot stored before the field without inventing it', () => {
    const parsed = ProgressSnapshotSchema.parse(legacy);
    expect(parsed).not.toHaveProperty('stageDoneAt');
  });

  it('round-trips stage key to ISO time entries, an empty record included', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, stageDoneAt: latch }).stageDoneAt).toEqual(latch);
    expect(ProgressSnapshotSchema.parse({ ...legacy, stageDoneAt: {} }).stageDoneAt).toEqual({});
  });

  it('accepts a stage key from a newer build (keys are not validated on the wire)', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, stageDoneAt: { stage8: '2027-01-01T00:00:00.000Z' } }).stageDoneAt).toEqual({
      stage8: '2027-01-01T00:00:00.000Z',
    });
  });

  it('rejects a malformed value', () => {
    for (const bad of [null, [], 'stage1', { stage1: 1 }, { stage1: null }, { stage1: true }]) {
      expect(ProgressSnapshotSchema.safeParse({ ...legacy, stageDoneAt: bad }).success).toBe(false);
    }
  });

  it('is optional in the legacy-tolerant ProgressSnapshot type', () => {
    const old: ProgressSnapshot = legacy;
    const next: ProgressSnapshot = { ...legacy, stageDoneAt: latch };
    expect(old.stageDoneAt ?? {}).toEqual({});
    expect(next.stageDoneAt).toEqual(latch);
  });
});

describe('old upload bodies and backup files still parse', () => {
  it('an upload body from an old client parses with no stageDoneAt (the Worker preserves against it)', () => {
    const body = SnapshotPutSchema.parse({ baseRev: 0, snapshot: legacy, summary, schemaVer: 1, contentVer: '2026.10' });
    expect(body.snapshot).not.toHaveProperty('stageDoneAt');
  });

  it('an upload body from a new client carries the latch through', () => {
    const body = SnapshotPutSchema.parse({ baseRev: 0, snapshot: { ...legacy, stageDoneAt: latch }, summary, schemaVer: 1, contentVer: '2026.10' });
    expect(body.snapshot.stageDoneAt).toEqual(latch);
  });

  it('a backup file restores with and without the latch', () => {
    const file = {
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: '2026-10-11T00:00:00.000Z',
      profile: { id: 'profile:one', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: '2026-09-01T00:00:00.000Z' },
      snapshot: legacy,
    };
    const old = BackupFileSchema.parse(file);
    expect(old.snapshot).not.toHaveProperty('stageDoneAt');
    expect(BackupFileSchema.parse({ ...file, snapshot: { ...legacy, stageDoneAt: latch } }).snapshot.stageDoneAt).toEqual(latch);
  });
});

describe('ProgressSnapshotSchema.questDoneAt (F-REPORT-001 section 3.3.1, additive quest latch)', () => {
  const quests = { 'letters-q1': '2026-10-11T09:30:00.000Z', 'letters-q2': '2026-10-12T18:05:00.000Z' };

  it('parses a snapshot stored before the field without inventing it', () => {
    expect(ProgressSnapshotSchema.parse(legacy)).not.toHaveProperty('questDoneAt');
  });

  it('round-trips quest id to ISO time entries, an empty record included', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, questDoneAt: quests }).questDoneAt).toEqual(quests);
    expect(ProgressSnapshotSchema.parse({ ...legacy, questDoneAt: {} }).questDoneAt).toEqual({});
  });

  it('rejects a malformed value', () => {
    for (const bad of [null, [], 'letters-q1', { 'letters-q1': 1 }, { 'letters-q1': null }]) {
      expect(ProgressSnapshotSchema.safeParse({ ...legacy, questDoneAt: bad }).success).toBe(false);
    }
  });

  it('is optional in the legacy-tolerant ProgressSnapshot type and carried by an upload body', () => {
    const old: ProgressSnapshot = legacy;
    expect(old.questDoneAt ?? {}).toEqual({});
    const body = SnapshotPutSchema.parse({ baseRev: 0, snapshot: { ...legacy, questDoneAt: quests }, summary, schemaVer: 1, contentVer: '2026.10' });
    expect(body.snapshot.questDoneAt).toEqual(quests);
    expect(SnapshotPutSchema.parse({ baseRev: 0, snapshot: legacy, summary, schemaVer: 1, contentVer: '2026.10' }).snapshot).not.toHaveProperty('questDoneAt');
  });
});
