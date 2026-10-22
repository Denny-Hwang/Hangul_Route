import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CellBestSchema,
  DAY_LOG_DAYS,
  DAY_LOG_INSTALL_KEYS_MAX,
  DayLogSchema,
  GOALS_CLOCK_SKEW_MS,
  GoalsSchema,
  PROGRESS_RECORD_MAX,
  LatchRecordSchema,
  StreakLocalSchema,
  boundToNow,
  compareIsoInstant,
  dayLogPoints,
  earlierInstant,
  latestLocalDay,
  mergeCellBest,
  mergeDayLog,
  mergeEarliest,
  mergeGoals,
  mergeLatchRecord,
  mergeStreakBest,
  mergeStreakLocal,
  type CellLevel,
  type DayLog,
  type Goals,
  type StreakLocal,
} from '../index';

/*
 * F-CURR-002 section 14 "Merge": commutative and idempotent for cellBest,
 * dayLog (summed per install key), streakLocal, streakBest, stamps, testedOut,
 * cellCheckAt and stageCheckAt; goals and memSeededAt too. Associativity is
 * checked as well, so three devices agree whatever order they sync in.
 */

const RUNS = { numRuns: 300 };
type Merge<T> = (a: T | undefined, b: T | undefined) => T | undefined;

/** The three laws, on values that went through the lenient read like every real input. */
function laws<T>(name: string, arb: fc.Arbitrary<T | undefined>, merge: Merge<T>): void {
  describe(name, () => {
    it('is commutative', () => {
      fc.assert(fc.property(arb, arb, (a, b) => {
        expect(merge(a, b)).toEqual(merge(b, a));
      }), RUNS);
    });
    it('is idempotent', () => {
      fc.assert(
        fc.property(arb, arb, (a, b) => {
          expect(merge(a, a)).toEqual(merge(a, undefined));
          const once = merge(a, b);
          expect(merge(once, b)).toEqual(once);
          expect(merge(once, once)).toEqual(once);
        }),
        RUNS,
      );
    });
    it('is associative', () => {
      fc.assert(fc.property(arb, arb, arb, (a, b, c) => {
        expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
      }), RUNS);
    });
    it('is undefined only when both sides are', () => {
      fc.assert(
        fc.property(arb, arb, (a, b) => {
          expect(merge(a, b) === undefined).toBe(a === undefined && b === undefined);
        }),
        RUNS,
      );
    });
  });
}

/** Few keys, so the generated sides overlap often. */
const key = fc.constantFrom('letters-s2', 'life-s3', 'pack:numbers-time:1', 'stage2', 'b', 'B', 'a-1');
/** Instants in several spellings of the same moment, plus a text that does not parse. */
const instant = fc.oneof(
  fc.integer({ min: 0, max: 5 }).map((n) => new Date(Date.UTC(2026, 9, 20 + n)).toISOString()),
  fc.integer({ min: 0, max: 5 }).map((n) => `2026-10-${String(20 + n).padStart(2, '0')}T09:00:00+09:00`),
  fc.integer({ min: 0, max: 5 }).map((n) => `2026-10-${String(20 + n).padStart(2, '0')}T00:00:00Z`),
  fc.constantFrom('not-a-time', 'zzz'),
);
const optional = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> => fc.option(arb, { nil: undefined, freq: 5 });
const read = <T>(schema: { parse: (v: unknown) => T }) => (v: unknown): T => schema.parse(v);

const cellBest = optional(fc.dictionary(key, fc.integer({ min: 0, max: 3 }))).map((v) => (v === undefined ? undefined : read(CellBestSchema)(v)));
const latch = optional(fc.dictionary(key, instant)).map((v) => (v === undefined ? undefined : read(LatchRecordSchema)(v)));
const goals = optional(
  fc.record({ daily: fc.constantFrom(3, 6, 10), weeklyDays: fc.constantFrom(3, 5, 7), setAt: instant }),
).map((v) => (v === undefined ? undefined : read(GoalsSchema)(v)));
const day = fc.integer({ min: 0, max: 150 }).map((n) => new Date(Date.UTC(2026, 3, 1) + n * 86_400_000).toISOString().slice(0, 10));
const dayLog = optional(fc.dictionary(day, fc.dictionary(fc.constantFrom('install-a', 'install-b', 'install-c'), fc.integer({ min: 0, max: 40 })), { maxKeys: 8 })).map((v) =>
  v === undefined ? undefined : read(DayLogSchema)(v),
);
const streakLocal = optional(fc.record({ run: fc.integer({ min: 0, max: 30 }), lastDay: day })).map((v) => (v === undefined ? undefined : read(StreakLocalSchema)(v)));
const streakBest = optional(fc.integer({ min: 0, max: 400 }));
const seededAt = optional(instant);

laws<Record<string, CellLevel>>('mergeCellBest', cellBest, mergeCellBest);
laws<Record<string, string>>('mergeLatchRecord (cellCheckAt, stageCheckAt, testedOut, stamps)', latch, mergeLatchRecord);
laws<Goals>('mergeGoals', goals, mergeGoals);
laws<DayLog>('mergeDayLog', dayLog, mergeDayLog);
/** Logs longer than DAY_LOG_DAYS, with empty days and a far-future day, so the count trim is exercised. */
const longDay = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 120 }).map((n) => new Date(Date.UTC(2026, 3, 1) + n * 86_400_000).toISOString().slice(0, 10)), weight: 20 },
  { arbitrary: fc.constant('2099-01-01'), weight: 1 },
);
const longDayLog = optional(fc.dictionary(longDay, fc.dictionary(fc.constantFrom('install-a', 'install-b'), fc.integer({ min: 0, max: 9 }), { maxKeys: 2 }), { minKeys: 40, maxKeys: 90 })).map((v) =>
  v === undefined ? undefined : read(DayLogSchema)(v),
);
laws<DayLog>('mergeDayLog (logs longer than DAY_LOG_DAYS)', longDayLog, mergeDayLog);
/*
 * At the caps: records with more keys than PROGRESS_RECORD_MAX and days with
 * more install keys than DAY_LOG_INSTALL_KEYS_MAX, so the laws are checked
 * where the merge cuts entries, not only below the caps.
 */
const CAPS = { numRuns: 15 };
const bigKey = (n: number) => `c${String(n).padStart(5, '0')}`;
const bigRecord = <V>(value: fc.Arbitrary<V>) =>
  fc.uniqueArray(fc.integer({ min: 0, max: PROGRESS_RECORD_MAX + 400 }), { minLength: PROGRESS_RECORD_MAX - 300, maxLength: PROGRESS_RECORD_MAX + 200 }).chain((ids) =>
    fc.array(value, { minLength: ids.length, maxLength: ids.length }).map((values) => Object.fromEntries(ids.map((id, i) => [bigKey(id), values[i]]))),
  );
const bigCellBest = bigRecord(fc.integer({ min: 0, max: 3 })).map(read(CellBestSchema));
const bigLatch = bigRecord(instant).map(read(LatchRecordSchema));
const manyInstalls = fc.dictionary(fc.integer({ min: 0, max: DAY_LOG_INSTALL_KEYS_MAX + 20 }).map((n) => `install-${String(n).padStart(3, '0')}`), fc.integer({ min: 0, max: 9 }), {
  minKeys: DAY_LOG_INSTALL_KEYS_MAX - 5,
  maxKeys: DAY_LOG_INSTALL_KEYS_MAX + 15,
});
const wideDayLog = fc.dictionary(day, manyInstalls, { minKeys: 1, maxKeys: 4 }).map(read(DayLogSchema));
function lawsAtCaps<T>(name: string, arb: fc.Arbitrary<T | undefined>, merge: Merge<T>): void {
  it(`${name}: commutative, idempotent and associative at the caps`, () => {
    fc.assert(
      fc.property(arb, arb, arb, (a, b, c) => {
        const ab = merge(a, b);
        expect(ab).toEqual(merge(b, a));
        expect(merge(ab, b)).toEqual(ab);
        expect(merge(ab, c)).toEqual(merge(a, merge(b, c)));
      }),
      CAPS,
    );
  });
}
describe('the merge laws hold where the caps cut entries', () => {
  lawsAtCaps<Record<string, CellLevel>>('mergeCellBest', bigCellBest, mergeCellBest);
  lawsAtCaps<Record<string, string>>('mergeLatchRecord', bigLatch, mergeLatchRecord);
  lawsAtCaps<DayLog>('mergeDayLog', wideDayLog, mergeDayLog);
  it('the caps hold on the merged result', () => {
    fc.assert(
      fc.property(bigCellBest, bigCellBest, wideDayLog, wideDayLog, (a, b, x, y) => {
        expect(Object.keys(mergeCellBest(a, b) ?? {}).length).toBeLessThanOrEqual(PROGRESS_RECORD_MAX);
        for (const keys of Object.values(mergeDayLog(x, y) ?? {})) expect(Object.keys(keys).length).toBeLessThanOrEqual(DAY_LOG_INSTALL_KEYS_MAX);
      }),
      CAPS,
    );
  });
});

laws<StreakLocal>('mergeStreakLocal', streakLocal, mergeStreakLocal);
laws<number>('mergeStreakBest', streakBest, mergeStreakBest);
laws<string>('mergeEarliest (memSeededAt)', seededAt, mergeEarliest);

describe('the rules each merge keeps', () => {
  it('cellBest: the higher level per key, every key of either side, never lower than a side', () => {
    expect(mergeCellBest({ a: 1, b: 3 }, { a: 2, c: 0 })).toEqual({ a: 2, b: 3, c: 0 });
    fc.assert(
      fc.property(cellBest, cellBest, (a, b) => {
        const m = mergeCellBest(a, b) ?? {};
        for (const side of [a ?? {}, b ?? {}]) for (const [k, v] of Object.entries(side)) expect(m[k]).toBeGreaterThanOrEqual(v);
      }),
      RUNS,
    );
  });

  it('latches: the earliest instant per key, compared as instants', () => {
    expect(mergeLatchRecord({ s: '2026-10-21T00:00:00.000Z' }, { s: '2026-10-21T08:00:00+09:00', t: 'x' })).toEqual({ s: '2026-10-21T08:00:00+09:00', t: 'x' });
    expect(mergeLatchRecord(undefined, { s: 'x' })).toEqual({ s: 'x' });
    expect(mergeLatchRecord(undefined, undefined)).toBeUndefined();
  });

  it('earlierInstant: a parseable time beats one that does not parse; equal instants fall back to the text', () => {
    expect(earlierInstant('x', '2026-10-21T00:00:00.000Z')).toBe('2026-10-21T00:00:00.000Z');
    expect(earlierInstant('2026-10-21T00:00:00.000Z', 'x')).toBe('2026-10-21T00:00:00.000Z');
    expect(earlierInstant('b', 'a')).toBe('a');
    expect(earlierInstant('2026-10-21T00:00:00Z', '2026-10-21T00:00:00.000Z')).toBe('2026-10-21T00:00:00.000Z');
    expect(compareIsoInstant('x', '2026-10-21T00:00:00Z')).toBe(-1);
    expect(compareIsoInstant('2026-10-21T00:00:00Z', 'x')).toBe(1);
    expect(compareIsoInstant('a', 'a')).toBe(0);
  });

  it('goals: the later setAt wins whatever the values, ties go to the larger goal', () => {
    const early = { daily: 10 as const, weeklyDays: 7 as const, setAt: '2026-10-20T00:00:00.000Z' };
    const late = { daily: 3 as const, weeklyDays: 3 as const, setAt: '2026-10-21T00:00:00.000Z' };
    expect(mergeGoals(early, late)).toEqual(late);
    expect(mergeGoals({ ...late, daily: 6 }, late)).toEqual({ ...late, daily: 6 });
    expect(mergeGoals(late, { ...late, weeklyDays: 5 })).toEqual({ ...late, weeklyDays: 5 });
    expect(mergeGoals(undefined, late)).toEqual(late);
    expect(mergeGoals(undefined, late)).not.toBe(late);
  });

  it('streakLocal: the later lastDay wins even with a lower run; the same day takes the higher run', () => {
    expect(mergeStreakLocal({ run: 9, lastDay: '2026-10-20' }, { run: 1, lastDay: '2026-10-21' })).toEqual({ run: 1, lastDay: '2026-10-21' });
    expect(mergeStreakLocal({ run: 2, lastDay: '2026-10-21' }, { run: 5, lastDay: '2026-10-21' })).toEqual({ run: 5, lastDay: '2026-10-21' });
    expect(mergeStreakLocal({ run: 2, lastDay: '2026-10-21' }, undefined)).toEqual({ run: 2, lastDay: '2026-10-21' });
  });

  it('streakBest: an older copy never lowers it', () => {
    fc.assert(
      fc.property(streakBest, streakBest, (a, b) => {
        const m = mergeStreakBest(a, b);
        if (a !== undefined) expect(m).toBeGreaterThanOrEqual(a);
        if (b !== undefined) expect(m).toBeGreaterThanOrEqual(b);
      }),
      RUNS,
    );
    expect(mergeStreakBest(12, undefined)).toBe(12);
    expect(mergeStreakBest(5, 12)).toBe(12);
  });

  it('dayLog: max per day and install key, read as the sum over install keys', () => {
    const phone = { '2026-10-21': { 'install-a': 6 } };
    const tablet = { '2026-10-21': { 'install-b': 3 }, '2026-10-20': { 'install-b': 2 } };
    const merged = mergeDayLog(phone, tablet);
    expect(merged).toEqual({ '2026-10-20': { 'install-b': 2 }, '2026-10-21': { 'install-a': 6, 'install-b': 3 } });
    expect(dayLogPoints(merged, '2026-10-21')).toBe(9);
    // The same device synced twice during the day: its later, higher count wins and nothing is counted twice.
    expect(dayLogPoints(mergeDayLog(merged, { '2026-10-21': { 'install-a': 9 } }), '2026-10-21')).toBe(12);
    expect(dayLogPoints(mergeDayLog(merged, { '2026-10-21': { 'install-a': 3 } }), '2026-10-21')).toBe(9);
    expect(dayLogPoints(merged, '2026-10-19')).toBe(0);
    expect(dayLogPoints(undefined, '2026-10-19')).toBe(0);
  });

  it('dayLog: the summed points of a day never fall below either side, and the log stays within 70 days', () => {
    fc.assert(
      fc.property(dayLog, dayLog, (a, b) => {
        const m = mergeDayLog(a, b) ?? {};
        const days = Object.keys(m);
        expect(days.length).toBeLessThanOrEqual(DAY_LOG_DAYS);
        for (const d of days) {
          expect(dayLogPoints(m, d)).toBeGreaterThanOrEqual(dayLogPoints(a, d));
          expect(dayLogPoints(m, d)).toBeGreaterThanOrEqual(dayLogPoints(b, d));
        }
      }),
      RUNS,
    );
  });
});

describe('a wrong clock never wipes real days (F-CURR-002 section 4.8)', () => {
  const realDay = (n: number) => new Date(Date.UTC(2026, 7, 1) + n * 86_400_000).toISOString().slice(0, 10);
  const real = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [realDay(i), { 'install-a': i + 1 }]));

  it('a far-future day merged in keeps every real day while the log holds fewer than DAY_LOG_DAYS of them', () => {
    const merged = mergeDayLog({ '2026-10-20': { a: 5 }, '2026-10-21': { a: 7 } }, { '2099-01-01': { b: 1 } });
    expect(merged).toEqual({ '2026-10-20': { a: 5 }, '2026-10-21': { a: 7 }, '2099-01-01': { b: 1 } });
    expect(mergeDayLog(real, { '2099-01-01': { 'install-b': 1 } })).toMatchObject(real);
  });

  it('a day with 0 points never takes a place, so it never evicts a day that holds points', () => {
    const full = Object.fromEntries(Array.from({ length: DAY_LOG_DAYS }, (_, i) => [realDay(i), { 'install-a': i + 1 }]));
    const zeros = { '2099-01-01': { 'install-z': 0 }, '2099-01-02': { 'install-z': 0, 'install-y': 0 } };
    expect(mergeDayLog(full, zeros)).toEqual(full);
    expect(mergeDayLog({ [realDay(1)]: { a: 0, b: 2 } }, undefined)).toEqual({ [realDay(1)]: { b: 2 } });
    fc.assert(
      fc.property(longDayLog, fc.dictionary(longDay, fc.constant({ 'install-z': 0 }), { maxKeys: 90 }), (log, zeroDays) => {
        const merged = mergeDayLog(log, zeroDays);
        expect(merged).toEqual(mergeDayLog(log, log === undefined ? {} : undefined));
        for (const keys of Object.values(merged ?? {})) for (const points of Object.values(keys)) expect(points).toBeGreaterThan(0);
      }),
      RUNS,
    );
  });

  it('one far-future day evicts at most one real day, whatever the log', () => {
    fc.assert(
      fc.property(longDayLog, (log) => {
        const realDays = Object.keys(log ?? {}).filter((d) => d < '2099-01-01');
        const kept = Object.keys(mergeDayLog(log, { '2099-01-01': { 'install-z': 1 } }) ?? {}).filter((d) => d < '2099-01-01');
        expect(kept.length).toBeGreaterThanOrEqual(realDays.length - 1);
      }),
      RUNS,
    );
  });
});

describe('boundToNow: the Worker time guard', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const nowIso = now.toISOString();

  it('the latest local day is the UTC day after now (UTC+14 is less than a day ahead)', () => {
    expect(latestLocalDay(now)).toBe('2026-10-22');
    expect(latestLocalDay(new Date('2026-12-31T23:59:59.999Z'))).toBe('2027-01-01');
  });

  it('drops dayLog days after the latest local day and keeps the rest', () => {
    const sent = { dayLog: { '2026-10-21': { a: 5 }, '2026-10-22': { a: 1 }, '2026-10-23': { a: 2 }, '2099-01-01': { b: 1 } } };
    expect(boundToNow(sent, now).dayLog).toEqual({ '2026-10-21': { a: 5 }, '2026-10-22': { a: 1 } });
  });

  it('reads a streakLocal whose lastDay is after the latest local day as absent', () => {
    const out = boundToNow({ streakLocal: { run: 1, lastDay: '2099-01-01' }, streakBest: 30 }, now);
    expect(out).not.toHaveProperty('streakLocal');
    expect(out.streakBest).toBe(30);
    const today = { streakLocal: { run: 30, lastDay: '2026-10-22' } };
    expect(boundToNow(today, now)).toBe(today);
  });

  it('reads a goals.setAt, a latch time or memSeededAt after now as now, so a later real change still wins', () => {
    const out = boundToNow(
      {
        goals: { daily: 10 as const, weeklyDays: 7 as const, setAt: '2099-01-01T00:00:00.000Z' },
        stamps: { s1: '2099-01-01T00:00:00.000Z', s2: '2026-10-01T00:00:00.000Z' },
        cellCheckAt: { c: '2026-10-21T12:00:00.001Z' },
        stageCheckAt: { s: '2026-10-20T00:00:00.000Z' },
        testedOut: { t: '2027-01-01T00:00:00+09:00' },
        memSeededAt: '2030-01-01T00:00:00Z',
      },
      now,
    );
    expect(out.goals).toEqual({ daily: 10, weeklyDays: 7, setAt: nowIso });
    expect(out.stamps).toEqual({ s1: nowIso, s2: '2026-10-01T00:00:00.000Z' });
    expect(out.cellCheckAt).toEqual({ c: nowIso });
    expect(out.stageCheckAt).toEqual({ s: '2026-10-20T00:00:00.000Z' });
    expect(out.testedOut).toEqual({ t: nowIso });
    expect(out.memSeededAt).toBe(nowIso);
    const later = { daily: 3 as const, weeklyDays: 3 as const, setAt: '2026-10-22T00:00:00.000Z' };
    expect(mergeGoals(out.goals, later)).toEqual(later);
  });

  it('goals: a fast clock within GOALS_CLOCK_SKEW_MS reads as now; further ahead it never replaces stored goals', () => {
    const goalsAt = (ms: number) => ({ goals: { daily: 10 as const, weeklyDays: 7 as const, setAt: new Date(now.getTime() + ms).toISOString() } });
    const stored = { goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-20T00:00:00.000Z' } };
    // A little fast: a real change made now, also over stored goals.
    expect(boundToNow(goalsAt(GOALS_CLOCK_SKEW_MS), now, stored).goals).toEqual({ daily: 10, weeklyDays: 7, setAt: nowIso });
    // Far ahead with goals stored: absent, so the Worker keeps the stored goals.
    const far = boundToNow({ profileId: 'p1', ...goalsAt(GOALS_CLOCK_SKEW_MS + 1) }, now, stored);
    expect(far).toEqual({ profileId: 'p1' });
    // Far ahead with nothing (or nothing readable) stored: read as now.
    for (const none of [undefined, null, 'x', {}, { goals: { daily: 4 } }]) {
      expect(boundToNow(goalsAt(GOALS_CLOCK_SKEW_MS + 1), now, none).goals).toEqual({ daily: 10, weeklyDays: 7, setAt: nowIso });
    }
    const fine = goalsAt(0);
    expect(boundToNow(fine, now, stored)).toBe(fine);
  });

  it('returns the snapshot itself when nothing is out of bounds, and keeps every other key', () => {
    const fine = {
      profileId: 'p1',
      goals: { daily: 6 as const, weeklyDays: 5 as const, setAt: nowIso },
      dayLog: { '2026-10-22': { a: 1 } },
      stamps: { s1: '2026-10-01T00:00:00.000Z' },
      memSeededAt: '2026-10-01T00:00:00.000Z',
    };
    expect(boundToNow(fine, now)).toBe(fine);
    const bare: { profileId: string; memSeededAt?: string } = { profileId: 'p1' };
    expect(boundToNow(bare, now)).toBe(bare);
    const mixed = boundToNow({ profileId: 'p1', memSeededAt: '2099-01-01T00:00:00Z', reviews: [] }, now);
    expect(mixed).toEqual({ profileId: 'p1', memSeededAt: nowIso, reviews: [] });
  });
});
