import { BackupFileSchema, ProgressSnapshotSchema, type ProgressSnapshot } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeBackup } from '../backup';
import { isSubsetOf, mergeSession, mergeSnapshots } from '../merge';

/*
 * F-CURR-002 section 4.8 in the app's merge: the new snapshot fields merge by
 * the rules the Worker applies too, a key neither side holds stays absent, and
 * an older copy never lowers the best run.
 */

const NOW = new Date('2026-10-21T12:00:00.000Z');
const base = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: '2026-10-20T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  ...over,
});
const NEW_KEYS = ['cellBest', 'cellCheckAt', 'stageCheckAt', 'testedOut', 'goals', 'dayLog', 'streakLocal', 'streakBest', 'stamps', 'memSeededAt'] as const;
const phone: Partial<ProgressSnapshot> = {
  cellBest: { 'letters-s2': 2, 'life-s3': 1 },
  cellCheckAt: { 'letters-s2': '2026-10-20T09:00:00.000Z' },
  stageCheckAt: { stage2: '2026-10-21T09:00:00.000Z' },
  testedOut: { 'life-s3': '2026-10-19T09:00:00.000Z' },
  goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-18T09:00:00.000Z' },
  dayLog: { '2026-10-21': { 'install-a': 6 } },
  streakLocal: { run: 4, lastDay: '2026-10-21' },
  streakBest: 9,
  stamps: { 'first-cell': '2026-10-15T09:00:00.000Z' },
  memSeededAt: '2026-10-14T09:00:00.000Z',
};
const tablet: Partial<ProgressSnapshot> = {
  cellBest: { 'letters-s2': 1, 'nature-s2': 3 },
  cellCheckAt: { 'letters-s2': '2026-10-19T09:00:00.000Z' },
  goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-20T09:00:00.000Z' },
  dayLog: { '2026-10-21': { 'install-b': 3 } },
  streakLocal: { run: 6, lastDay: '2026-10-21' },
  streakBest: 6,
  memSeededAt: '2026-10-16T09:00:00.000Z',
};

describe('mergeSnapshots, F-CURR-002 section 4.8 fields', () => {
  it('merges each field by its rule', () => {
    const m = mergeSnapshots(base(phone), base(tablet), { now: NOW });
    expect(m.cellBest).toEqual({ 'letters-s2': 2, 'life-s3': 1, 'nature-s2': 3 });
    expect(m.cellCheckAt).toEqual({ 'letters-s2': '2026-10-19T09:00:00.000Z' });
    expect(m.stageCheckAt).toEqual(phone.stageCheckAt);
    expect(m.testedOut).toEqual(phone.testedOut);
    expect(m.goals).toEqual(tablet.goals);
    expect(m.dayLog).toEqual({ '2026-10-21': { 'install-a': 6, 'install-b': 3 } });
    expect(m.streakLocal).toEqual({ run: 6, lastDay: '2026-10-21' });
    expect(m.streakBest).toBe(9);
    expect(m.stamps).toEqual(phone.stamps);
    expect(m.memSeededAt).toBe('2026-10-14T09:00:00.000Z');
  });

  it('is commutative and idempotent on the new fields', () => {
    const pick = (s: ProgressSnapshot) => Object.fromEntries(NEW_KEYS.map((k) => [k, s[k]]));
    const ab = mergeSnapshots(base(phone), base(tablet), { now: NOW });
    const ba = mergeSnapshots(base(tablet), base(phone), { now: NOW });
    expect(pick(ab)).toEqual(pick(ba));
    expect(pick(mergeSnapshots(ab, base(tablet), { now: NOW }))).toEqual(pick(ab));
    expect(pick(mergeSnapshots(ab, ab, { now: NOW }))).toEqual(pick(ab));
  });

  it('keeps a snapshot that predates the keys in its shape, and keeps one side when the other has none', () => {
    const m = mergeSnapshots(base(), base(), { now: NOW });
    for (const key of NEW_KEYS) expect(m).not.toHaveProperty(key);
    const one = mergeSnapshots(base(), base(phone), { now: NOW });
    for (const key of NEW_KEYS) expect(one[key]).toEqual(phone[key]);
  });

  it('a sync with an older build never lowers streakBest or a cell level', () => {
    const older = base({ streakDays: 2 });
    expect(mergeSnapshots(base(phone), older, { now: NOW }).streakBest).toBe(9);
    expect(mergeSnapshots(older, base(phone), { now: NOW }).streakBest).toBe(9);
    expect(mergeSnapshots(base(phone), base({ streakBest: 3, cellBest: { 'letters-s2': 0 } }), { now: NOW })).toMatchObject({ streakBest: 9, cellBest: { 'letters-s2': 2 } });
  });

  it('round-trips an older-client snapshot through the schema and the merge unchanged', () => {
    const old = base({ reviews: [{ id: 'review:a', kind: 'daily', generatedAt: 't', scope: 'stage1', itemIds: [] }] });
    const parsed = ProgressSnapshotSchema.parse(JSON.parse(JSON.stringify(old)));
    const m = mergeSnapshots(parsed, parsed, { now: NOW });
    expect(m.reviews).toEqual(old.reviews);
    for (const key of NEW_KEYS) expect(m).not.toHaveProperty(key);
  });
});

describe('sessions[].localDay', () => {
  const session = (localDay?: string) => ({ id: 's1', profileId: 'profile:a', startedAt: '2026-10-21T23:30:00.000Z', episodesTouched: [], ...(localDay ? { localDay } : {}) });

  it('a copy an older build stripped takes the other copy\'s day, whichever side it is on', () => {
    expect(mergeSession(session(), session('2026-10-22')).localDay).toBe('2026-10-22');
    expect(mergeSession(session('2026-10-22'), session()).localDay).toBe('2026-10-22');
    const kept = session('2026-10-22');
    expect(mergeSession(kept, session('2026-10-22'))).toBe(kept);
    expect(mergeSnapshots(base({ sessions: [session()] }), base({ sessions: [session('2026-10-22')] }), { now: NOW }).sessions[0]?.localDay).toBe('2026-10-22');
  });

  it('isSubsetOf uploads a day the server copy lacks', () => {
    expect(isSubsetOf(base({ sessions: [session('2026-10-22')] }), base({ sessions: [session()] }))).toBe(false);
    expect(isSubsetOf(base({ sessions: [session('2026-10-22')] }), base({ sessions: [session('2026-10-22')] }))).toBe(true);
    expect(isSubsetOf(base({ sessions: [session()] }), base({ sessions: [session('2026-10-22')] }))).toBe(true);
  });
});

describe('isSubsetOf, F-CURR-002 section 4.8 fields', () => {
  it('needs an upload when the server would gain anything from the local copy', () => {
    for (const key of NEW_KEYS) {
      expect(isSubsetOf(base({ [key]: phone[key] }), base())).toBe(false);
    }
    expect(isSubsetOf(base({ cellBest: { 'letters-s2': 3 } }), base({ cellBest: { 'letters-s2': 2 } }))).toBe(false);
    expect(isSubsetOf(base({ dayLog: { '2026-10-21': { 'install-a': 7 } } }), base(phone))).toBe(false);
  });

  it('needs none when the server already holds the local values or better', () => {
    expect(isSubsetOf(base(phone), base(phone))).toBe(true);
    expect(isSubsetOf(base(), base(phone))).toBe(true);
    expect(isSubsetOf(base({ cellBest: { 'letters-s2': 1 }, streakBest: 2, memSeededAt: '2026-10-20T00:00:00.000Z' }), base(phone))).toBe(true);
  });
});

describe('backup restore, F-CURR-002 section 4.8', () => {
  const file = (snapshot: unknown, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: '2026-10-21T00:00:00.000Z',
      profile: { id: 'profile:a', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' },
      snapshot,
      ...extra,
    });

  it('drops a review of an unknown kind per entry and keeps the new fields', () => {
    const snapshot = { ...base(phone), reviews: [{ id: 'review:a', kind: 'warmup', generatedAt: 't', scope: 's', itemIds: [] }, { id: 'review:b', kind: 'pack-check', generatedAt: 't', scope: 's', itemIds: [] }] };
    const decoded = decodeBackup(file(snapshot, { memory: 'unreadable' }));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.file.snapshot.reviews.map((r) => r.id)).toEqual(['review:a']);
      expect(decoded.file.snapshot).toMatchObject(phone);
      expect(decoded.file.memory).toBeUndefined();
    }
    expect(BackupFileSchema.safeParse(JSON.parse(file(base()))).success).toBe(true);
  });
});

describe('mergeSnapshots, F-CURR-002 fields: property tests (fast-check)', () => {
  const key = fc.constantFrom('letters-s2', 'life-s3', 'stage2', 'pack:numbers-time:1');
  const instant = fc.integer({ min: 0, max: 6 }).map((n) => new Date(Date.UTC(2026, 9, 14 + n, 9)).toISOString());
  const day = fc.integer({ min: 0, max: 90 }).map((n) => new Date(Date.UTC(2026, 6, 1) + n * 86_400_000).toISOString().slice(0, 10));
  const opt = <T>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: undefined, freq: 3 });
  const latch = opt(fc.dictionary(key, instant));
  /** Each side as the app holds it: generated, then read through the snapshot schema. */
  const side = fc
    .record({
      cellBest: opt(fc.dictionary(key, fc.integer({ min: 0, max: 3 }))),
      cellCheckAt: latch,
      stageCheckAt: latch,
      testedOut: latch,
      goals: opt(fc.record({ daily: fc.constantFrom(3, 6, 10), weeklyDays: fc.constantFrom(3, 5, 7), setAt: instant })),
      dayLog: opt(fc.dictionary(day, fc.dictionary(fc.constantFrom('install-a', 'install-b'), fc.integer({ min: 0, max: 20 })), { maxKeys: 80 })),
      streakLocal: opt(fc.record({ run: fc.integer({ min: 0, max: 40 }), lastDay: day })),
      streakBest: opt(fc.integer({ min: 0, max: 100 })),
      stamps: latch,
      memSeededAt: opt(instant),
    })
    .map((fields) => ProgressSnapshotSchema.parse(JSON.parse(JSON.stringify(base(fields as Partial<ProgressSnapshot>)))) as ProgressSnapshot);
  const pick = (s: ProgressSnapshot) => Object.fromEntries(NEW_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
  const merge = (a: ProgressSnapshot, b: ProgressSnapshot) => mergeSnapshots(a, b, { now: NOW });
  const RUNS = { numRuns: 200 };

  it('is commutative on every new field', () => {
    fc.assert(fc.property(side, side, (a, b) => {
      expect(pick(merge(a, b))).toEqual(pick(merge(b, a)));
    }), RUNS);
  });

  it('is idempotent: merging a side again, or a merge with itself, changes nothing', () => {
    fc.assert(
      fc.property(side, side, (a, b) => {
        const once = merge(a, b);
        expect(pick(merge(once, b))).toEqual(pick(once));
        expect(pick(merge(once, once))).toEqual(pick(once));
        // A side on its own may gain the streakBest its streakLocal implies (the CM-4 switch-over), so merging it
        // with itself is idempotent after the first merge.
        const self = merge(a, a);
        expect(pick(merge(self, self))).toEqual(pick(self));
      }),
      RUNS,
    );
  });

  it('invents no key and never lowers streakBest; the server copy then holds the merge', () => {
    // The local-day streak (row CM-4) is derived as well: streakBest also appears when a side holds a run of at least
    // 1 (the switch-over), and streakLocal also from a learning day, which these sides, with no session, never hold.
    const derived = (s: ProgressSnapshot) => ({
      streakLocal: s.streakLocal !== undefined,
      streakBest: s.streakBest !== undefined || (s.streakLocal !== undefined && s.streakLocal.run >= 1),
    });
    fc.assert(
      fc.property(side, side, (a, b) => {
        const m = merge(a, b);
        for (const k of NEW_KEYS) {
          const held = k === 'streakLocal' || k === 'streakBest' ? derived(a)[k] || derived(b)[k] : a[k] !== undefined || b[k] !== undefined;
          expect(m[k] !== undefined, k).toBe(held);
        }
        if (a.streakBest !== undefined) expect(m.streakBest).toBeGreaterThanOrEqual(a.streakBest);
        if (b.streakBest !== undefined) expect(m.streakBest).toBeGreaterThanOrEqual(b.streakBest);
        expect(isSubsetOf(a, m) && isSubsetOf(b, m)).toBe(true);
      }),
      RUNS,
    );
  });
});
