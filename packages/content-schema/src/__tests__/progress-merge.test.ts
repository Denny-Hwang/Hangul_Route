import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CellBestSchema,
  DAY_LOG_DAYS,
  DayLogSchema,
  GoalsSchema,
  LatchRecordSchema,
  StreakLocalSchema,
  compareIsoInstant,
  dayLogPoints,
  earlierInstant,
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
