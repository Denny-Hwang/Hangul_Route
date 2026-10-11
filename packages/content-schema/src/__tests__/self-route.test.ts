import { describe, expect, it } from 'vitest';
import {
  BackupFileSchema,
  CURRICULUM_MAX_ITEMS,
  ProgressSnapshotSchema,
  ProgressSummarySchema,
  SelfRouteSchema,
  SelfRouteSummarySchema,
  SnapshotPutSchema,
  generateCurriculum,
  toMeta,
  toPlanItems,
  type ProgressSnapshot,
  type SelfRoute,
} from '../index';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/** F-PLAN-002 section 3.5: the self-route rides the progress snapshot; its counts ride the summary (PR P2-4). */

const draft = generateCurriculum(
  {
    audience: 'self',
    level: { stage: 'stage1', band: 3 },
    startDate: '2026-10-12',
    weeks: 26,
    sessionsPerWeek: 3,
    sessionDays: ['mon', 'wed', 'fri'],
    minutesPerSession: 15,
    goals: { focus: 'balanced', motivation: 'kculture' },
    unlockedStages: ['stage1'],
    reviewEvery: 4,
  },
  CATALOG_2026_10,
);
const route: SelfRoute = {
  id: 'route:abc-1',
  createdAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-10-12T08:00:00.000Z',
  archivedAt: null,
  meta: toMeta(draft),
  items: toPlanItems(draft),
};
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
  stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const counts = { done: 7, total: 9, notReady: 0, weeks: 26, endsOn: '2027-04-11' };

describe('SelfRouteSchema', () => {
  it('round-trips a generated route', () => {
    expect(SelfRouteSchema.parse(route)).toEqual(route);
    expect(SelfRouteSchema.parse({ ...route, archivedAt: '2026-11-01T00:00:00.000Z' }).archivedAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('takes ids of the form route:<slug>', () => {
    for (const id of ['route:', 'plan:abc', 'route:ABC', 'route:a b']) expect(SelfRouteSchema.safeParse({ ...route, id }).success).toBe(false);
  });

  it('holds at most 260 items and requires a curriculum meta', () => {
    const many = Array.from({ length: CURRICULUM_MAX_ITEMS + 1 }, (_, i) => ({ kind: 'quest' as const, id: `quest:q${i}` }));
    expect(SelfRouteSchema.safeParse({ ...route, items: many }).success).toBe(false);
    expect(SelfRouteSchema.safeParse({ ...route, items: many.slice(0, CURRICULUM_MAX_ITEMS) }).success).toBe(true);
    expect(SelfRouteSchema.safeParse({ ...route, meta: null }).success).toBe(false);
  });
});

describe('ProgressSnapshotSchema.selfRoute', () => {
  it('defaults to null for a snapshot stored before the field', () => {
    expect(ProgressSnapshotSchema.parse(legacy).selfRoute).toBeNull();
  });

  it('round-trips a route, archived or live', () => {
    expect(ProgressSnapshotSchema.parse({ ...legacy, selfRoute: route }).selfRoute).toEqual(route);
  });

  it('drops a malformed or newer-shaped route to null and keeps the rest of the snapshot', () => {
    for (const bad of [{ ...route, items: 'none' }, { ...route, id: 'plan:x' }, { ...route, items: [{ kind: 'quest', id: 'quest:a', week: 53 }] }, 'oops']) {
      const parsed = ProgressSnapshotSchema.safeParse({ ...legacy, streakDays: 4, selfRoute: bad });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.selfRoute).toBeNull();
      expect(parsed.data?.streakDays).toBe(4);
    }
  });

  it('is optional in the legacy-tolerant ProgressSnapshot type', () => {
    const old: ProgressSnapshot = legacy;
    const next: ProgressSnapshot = { ...legacy, selfRoute: route };
    expect(old.selfRoute ?? null).toBeNull();
    expect(next.selfRoute?.id).toBe('route:abc-1');
  });

  it('rides the upload body and the backup file', () => {
    expect(SnapshotPutSchema.parse({ baseRev: 0, snapshot: { ...legacy, selfRoute: route }, summary: { ...summary, selfRoute: counts }, schemaVer: 1, contentVer: '2026.10' }).snapshot.selfRoute).toEqual(route);
    const file = {
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: '2026-10-11T00:00:00.000Z',
      profile: { id: 'profile:one', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: '2026-09-01T00:00:00.000Z' },
      snapshot: { ...legacy, selfRoute: route },
    };
    expect(BackupFileSchema.parse(file).snapshot.selfRoute).toEqual(route);
    expect(BackupFileSchema.parse({ ...file, snapshot: legacy }).snapshot.selfRoute).toBeNull();
    // A bad route never fails the restore of everything else.
    expect(BackupFileSchema.parse({ ...file, snapshot: { ...legacy, selfRoute: { ...route, meta: null } } }).snapshot.selfRoute).toBeNull();
  });
});

describe('ProgressSummarySchema.selfRoute', () => {
  it('is optional and absent from an old summary (schemaVersion stays 1)', () => {
    const parsed = ProgressSummarySchema.parse(summary);
    expect(parsed).not.toHaveProperty('selfRoute');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('carries counts, weeks and the end day only', () => {
    expect(ProgressSummarySchema.parse({ ...summary, selfRoute: counts }).selfRoute).toEqual(counts);
    expect(SelfRouteSummarySchema.parse({ ...counts, items: ['quest:a'] })).toEqual(counts);
  });

  it('drops malformed counts from the summary and keeps the rest', () => {
    const parsed = ProgressSummarySchema.parse({ ...summary, streakDays: 3, selfRoute: { ...counts, weeks: 0 } });
    expect(parsed.selfRoute).toBeUndefined();
    expect(parsed.streakDays).toBe(3);
  });

  it('rejects negative counts, a week count off the plan range and a malformed day', () => {
    for (const bad of [{ done: -1 }, { total: 1.5 }, { notReady: -2 }, { weeks: 0 }, { weeks: 53 }, { endsOn: 'April' }]) {
      expect(SelfRouteSummarySchema.safeParse({ ...counts, ...bad }).success).toBe(false);
    }
  });
});
