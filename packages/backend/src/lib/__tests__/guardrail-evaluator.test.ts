import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDb, type RemoteConfigRow, type RollupRow } from '../../db';
import {
  D1_FREE_ROWS_WRITTEN_PER_DAY,
  GUARDRAIL_FAMILY_ALPHA,
  GUARDRAIL_MAX_STEP_AGE_DAYS,
  GUARDRAIL_METRICS,
  GUARDRAIL_REASON_MAX,
  MAX_GUARDRAIL_LOWERS,
  MIN_COHORT_SESSIONS,
  RAMP_STEPS,
  addDays,
  baseDayOf,
  cohortDays,
  familyZ,
  guardrailBreaches,
  guardrailCheck,
  guardrailDisabledLog,
  guardrailEvaluatorEnabled,
  guardrailReason,
  guardrailRunLog,
  minutesQuantile,
  normalQuantile,
  previousRampStep,
  riseZ,
  runGuardrailEvaluator,
  shorterZ,
  stepDayOf,
} from '../guardrail-evaluator';
import { MIN_GROUP_EVENTS, ROLLUP_BUDGET_METRIC, ROLLUP_GLOBAL_ROWS_PER_DAY, ROLLUP_READ_LIMIT } from '../learning-rollups';

/**
 * F-CURR-002 section 12.3 (row CM-70b), guardrails of section 3.3, "remote can only reduce" of section 12.2. The
 * run of 2026-10-21 for a flag stepped on 2026-10-10 compares the after window 2026-10-14..20 (the last 7 full days)
 * with the before window 2026-10-03..09 (the 7 days before the step day). 2026-10-21 is a Wednesday.
 */
const NOW = new Date('2026-10-21T11:17:00.000Z');
const STEP_AT = '2026-10-10T09:00:00.000Z';
const BEFORE_DAYS = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
const AFTER_DAYS = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'];
const BEFORE = { fromDay: '2026-10-03', toDay: '2026-10-09' };
const AFTER = { fromDay: '2026-10-14', toDay: '2026-10-20' };
const KIND = 'match-shape';

const row = (day: string, metric: string, dim: string, bucket: string, events: number): RollupRow => ({ day, metric, dim, bucket, events });

/**
 * `q` of `sessions` reporting sessions ended mid-quest on `kind`, as the rollups write them: the '' cells (buckets 0
 * and 1) and, for the quits only, the kind's bucket 1 (a kind is written only for a quit).
 */
function quits(day: string, kind: string, q: number, sessions: number): RollupRow[] {
  return [row(day, 'session.end.questLeft', '', '0', sessions - q), row(day, 'session.end.questLeft', '', '1', q), row(day, 'session.end.questLeft', kind, '1', q)];
}

/** `sessions` reporting sessions of a day, with `perKind` quits at each kind (the rest finished their quest). */
function mixed(day: string, sessions: number, perKind: Readonly<Record<string, number>>): RollupRow[] {
  const q = Object.values(perKind).reduce((a, b) => a + b, 0);
  return [row(day, 'session.end.questLeft', '', '0', sessions - q), row(day, 'session.end.questLeft', '', '1', q), ...Object.entries(perKind).map(([kind, n]) => row(day, 'session.end.questLeft', kind, '1', n))];
}

/** Session lengths: bucket -> events. */
const minutes = (day: string, dist: Record<string, number>): RollupRow[] => Object.entries(dist).map(([b, n]) => row(day, 'session.end.minutes', '', b, n));

/** The streak cells of the mid-quest quits of a day. */
const streaks = (day: string, s0: number, s1: number, s2: number): RollupRow[] => [
  row(day, 'session.end.leftAfterWrongStreak', '', '0', s0),
  row(day, 'session.end.leftAfterWrongStreak', '', '1', s1),
  row(day, 'session.end.leftAfterWrongStreak', '', '2', s2),
];

const each = (days: readonly string[], f: (day: string) => RollupRow[]): RollupRow[] => days.flatMap(f);

/** A healthy week: 20% of 100 sessions a day quit on KIND (20 quits, so the kind's group is kept) and a 6-minute median. */
const healthy = (days: readonly string[]): RollupRow[] => each(days, (d) => [...quits(d, KIND, 20, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })]);

const flag = (over: Partial<RemoteConfigRow> = {}): RemoteConfigRow => ({ flag: 'dailyReview', on: true, pct: 50, updatedAt: STEP_AT, reason: 'owner ramp 50', ...over });

let db: MemoryDb;
let rows: RollupRow[];
beforeEach(() => {
  db = new MemoryDb();
  rows = [];
  vi.spyOn(db, 'rollupRowsOf').mockImplementation(async (from, to, metrics) => rows.filter((r) => r.day >= from && r.day <= to && metrics.includes(r.metric)));
});

/** A seeded generator (mulberry32), so the noise tests are the same on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = ['listen-pick', 'match-shape', 'build-letter', 'cloze-pick', 'dictation', 'syllable-build', 'story-order', 'role-play', 'my-story', 'yut-review', 'k10', 'k11', 'k12', 'k13', 'k14', 'k15', 'k16', 'k17', 'k18', 'k19', 'k20'];
/** Session length shares (bucket -> weight): a median near 6 minutes and a p90 near 12. */
const LENGTHS: ReadonlyArray<readonly [string, number]> = [
  ['1', 4], ['2', 6], ['3', 8], ['4', 10], ['5', 12], ['6', 12], ['7', 10], ['8', 9], ['9', 8], ['10', 6], ['12', 5], ['15', 4], ['18', 3], ['25', 2], ['30-59', 1],
];

/**
 * One simulated day as POST /api/telemetry rolls it up: `perKind` quest sessions on each of `kinds` game kinds, each
 * left mid-quest with probability `quit` (`quitOn` overrides it per kind), a wrong streak before 30% of the quits, and
 * a session length drawn from LENGTHS.
 */
function simulatedDay(rand: () => number, day: string, kinds: readonly string[], perKind: number, quit: number, quitOn: Readonly<Record<string, number>> = {}): RollupRow[] {
  const cells = new Map<string, RollupRow>();
  const add = (metric: string, dim: string, bucket: string): void => {
    const key = `${metric}\n${dim}\n${bucket}`;
    const cell = cells.get(key) ?? row(day, metric, dim, bucket, 0);
    cell.events += 1;
    cells.set(key, cell);
  };
  const totalWeight = LENGTHS.reduce((s, [, w]) => s + w, 0);
  for (const kind of kinds) {
    for (let i = 0; i < perKind; i += 1) {
      const left = rand() < (quitOn[kind] ?? quit) ? '1' : '0';
      add('session.end.questLeft', '', left);
      if (left === '1') add('session.end.questLeft', kind, left);
      if (left === '1') add('session.end.leftAfterWrongStreak', '', rand() < 0.3 ? '2' : rand() < 0.5 ? '1' : '0');
      let pick = rand() * totalWeight;
      const bucket = LENGTHS.find(([, w]) => (pick -= w) < 0)?.[0] ?? '30-59';
      add('session.end.minutes', '', bucket);
    }
  }
  return [...cells.values()];
}

/** The share of `runs` seeded before/after pairs with no real change that `guardrailBreaches` would lower. */
function falseBreachRate(kinds: readonly string[], perKind: number, runs: number, seed: number): number {
  const rand = seeded(seed);
  let breached = 0;
  for (let i = 0; i < runs; i += 1) {
    const sample = [...each(BEFORE_DAYS, (d) => simulatedDay(rand, d, kinds, perKind, 0.1)), ...each(AFTER_DAYS, (d) => simulatedDay(rand, d, kinds, perKind, 0.1))];
    if (guardrailBreaches(sample, BEFORE, AFTER).length > 0) breached += 1;
  }
  return breached / runs;
}

describe('ramp steps', () => {
  it('lowers 100 -> 50 -> 10 -> 0; a percentage between steps goes to the step below it', () => {
    expect(RAMP_STEPS).toEqual([0, 10, 50, 100]);
    expect([100, 75, 50, 25, 10, 5, 1].map(previousRampStep)).toEqual([50, 50, 10, 10, 0, 0, 0]);
  });
});

describe('days', () => {
  it('reads the step day of updated_at, ISO or console text, and refuses a value that is not a real day', () => {
    expect(stepDayOf(STEP_AT)).toBe('2026-10-10');
    expect(stepDayOf('2026-10-10 09:00:00')).toBe('2026-10-10');
    expect(stepDayOf('2026-02-30T00:00:00Z')).toBeNull();
    expect(stepDayOf('yesterday')).toBeNull();
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('keeps the base of its own lowering only while the row is as the evaluator left it', () => {
    const reason = 'guardrail 2026-10-14 base 2026-10-07 pct 50->10: quitRate:match-shape 10.0%->20.0%';
    expect(baseDayOf({ pct: 10, reason }, '2026-10-14')).toBe('2026-10-07');
    // the owner raised pct, or re-ran K-1 on another day, without touching reason: a new baseline
    expect(baseDayOf({ pct: 50, reason }, '2026-10-14')).toBe('2026-10-14');
    expect(baseDayOf({ pct: 10, reason }, '2026-10-16')).toBe('2026-10-16');
    // the owner's own note, no note, or a base that is not a real earlier day
    expect(baseDayOf({ pct: 10, reason: 'owner ramp 10' }, '2026-10-14')).toBe('2026-10-14');
    expect(baseDayOf({ pct: 10, reason: null }, '2026-10-14')).toBe('2026-10-14');
    expect(baseDayOf({ pct: 10, reason: reason.replace('base 2026-10-07', 'base 2026-02-30') }, '2026-10-14')).toBe('2026-10-14');
    expect(baseDayOf({ pct: 10, reason: reason.replace('base 2026-10-07', 'base 2026-10-15') }, '2026-10-14')).toBe('2026-10-14');
  });
});

describe('minutesQuantile', () => {
  it('interpolates inside whole-minute buckets, spans 30-59, and treats 60+ as 60', () => {
    expect(minutesQuantile(new Map([['5', 10]]), 0.5)).toBe(5.5);
    expect(minutesQuantile(new Map([['2', 50], ['8', 50]]), 0.5)).toBe(3);
    expect(minutesQuantile(new Map([['30-59', 10]]), 0.5)).toBe(45);
    expect(minutesQuantile(new Map([['1', 1], ['60+', 9]]), 0.9)).toBe(60);
    expect(minutesQuantile(new Map([['10', 9], ['25', 1]]), 0.9)).toBe(11);
  });

  it('ignores a bucket code it does not know and answers null with no sessions', () => {
    expect(minutesQuantile(new Map([['30', 5], ['x', 5], ['-1', 5]]), 0.5)).toBeNull();
    expect(minutesQuantile(new Map(), 0.5)).toBeNull();
    expect(minutesQuantile(new Map([['3', 0]]), 0.5)).toBeNull();
  });
});

describe('cohort days, groups and the tests', () => {
  it('compares the same weekdays on both sides: a Friday-to-Sunday after window reads Friday to Sunday before the step', () => {
    // a step on Thursday 2026-10-15, compared on Monday 2026-10-19
    const days = cohortDays([], { fromDay: '2026-10-08', toDay: '2026-10-14' }, { fromDay: '2026-10-16', toDay: '2026-10-18' });
    expect([...days.before]).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect([...days.after]).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    const full = cohortDays([], BEFORE, AFTER);
    expect([...full.before]).toEqual(BEFORE_DAYS);
    expect([...full.after]).toEqual(AFTER_DAYS);
  });

  it(`leaves out a day the rollups stopped at their cap (${ROLLUP_GLOBAL_ROWS_PER_DAY} rows), and the same weekday on the other side`, () => {
    const capped = [row('2026-10-20', ROLLUP_BUDGET_METRIC, '', '', ROLLUP_GLOBAL_ROWS_PER_DAY), row('2026-10-15', ROLLUP_BUDGET_METRIC, '', '', ROLLUP_GLOBAL_ROWS_PER_DAY - 1)];
    const days = cohortDays(capped, BEFORE, AFTER);
    expect(days.after.has('2026-10-20')).toBe(false); // a Tuesday
    expect(days.before.has('2026-10-06')).toBe(false); // the Tuesday before the step
    expect(days.after.has('2026-10-15')).toBe(true);
    expect([days.before.size, days.after.size]).toEqual([6, 6]);
  });

  it('applies the 20-event threshold to the group a comparison uses, summed over the cohort: an after group under 20 is never compared', () => {
    expect(MIN_GROUP_EVENTS).toBe(20);
    // 19 quits at a new kind in the whole after window: not compared, and the '' cells did not move
    const nineteen = [...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), row('2026-10-14', 'session.end.questLeft', 'build-letter', '1', 19)];
    const twenty = [...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), row('2026-10-14', 'session.end.questLeft', 'build-letter', '1', 20)];
    expect(guardrailCheck(nineteen, BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 4, days: 7 }); // all kinds, KIND, median, p90
    expect(guardrailCheck(twenty, BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 5, days: 7 });
  });

  it('reads a before group under 20 as its upper bound (19), so the rise is understated and the reason says so', () => {
    // 2 quits at KIND a day before (14 in the window), 10 a day after
    const rows = [...each(BEFORE_DAYS, (d) => quits(d, KIND, 2, 100)), ...each(AFTER_DAYS, (d) => quits(d, KIND, 10, 100))];
    expect(guardrailBreaches(rows, BEFORE, AFTER)).toEqual(['quitRate 2.0%->10.0%', `quitRate:${KIND} <=2.7%->10.0%`]);
  });

  it('riseZ is 0 when nobody (or everybody) quit in either cohort, and carries the continuity correction', () => {
    expect(riseZ({ num: 0, den: 100 }, { num: 0, den: 100 })).toBe(0);
    expect(riseZ({ num: 100, den: 100 }, { num: 100, den: 100 })).toBe(0);
    expect(riseZ({ num: 20, den: 1000 }, { num: 45, den: 1000 })).toBeGreaterThan(2.5);
    // one more quit of 100 is within the correction: no rise at all
    expect(riseZ({ num: 10, den: 100 }, { num: 10.5, den: 100 })).toBe(0);
    expect(riseZ({ num: 20, den: 100 }, { num: 10, den: 100 })).toBeLessThan(0);
  });

  it('normalQuantile matches the standard normal table, and familyZ shares the alpha across comparisons', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.95)).toBeCloseTo(1.6449, 4);
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 4);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.3263, 4);
    expect(normalQuantile(0.999)).toBeCloseTo(3.0902, 4);
    expect(() => normalQuantile(0)).toThrow(RangeError);
    expect(() => normalQuantile(1)).toThrow(RangeError);
    expect(GUARDRAIL_FAMILY_ALPHA).toBe(0.02);
    expect(familyZ(0)).toBeCloseTo(normalQuantile(0.98), 9);
    expect(familyZ(1)).toBeCloseTo(2.0537, 4);
    expect(familyZ(24)).toBeCloseTo(normalQuantile(1 - 0.02 / 24), 9); // 21 game kinds and the 3 other rules
    expect(familyZ(24)).toBeGreaterThan(3.1);
  });

  it('shorterZ is large when sessions got shorter, about 0 when nothing changed, negative when they got longer', () => {
    const six = new Map([['4', 300], ['6', 400], ['9', 300]]);
    expect(shorterZ(six, new Map([['2', 300], ['4', 400], ['6', 300]]))).toBeGreaterThan(10);
    expect(shorterZ(six, six)).toBeCloseTo(0, 9);
    expect(shorterZ(six, new Map([['9', 600], ['12', 400]]))).toBeLessThan(-10);
    expect(shorterZ(six, new Map())).toBe(0);
    expect(shorterZ(new Map([['5', 50]]), new Map([['5', 50]]))).toBe(0); // every session ties
  });
});

describe('guardrailBreaches (section 3.3)', () => {
  it('finds nothing in two healthy weeks', () => {
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS)], BEFORE, AFTER)).toEqual([]);
  });

  it('quit rate per game kind: a significant rise of more than 2 pp is a breach, exactly 2 pp is not', () => {
    const week = (days: readonly string[], q: number): RollupRow[] => each(days, (d) => [...quits(d, KIND, q, 1000), ...minutes(d, { '4': 30, '6': 40, '9': 30 })]);
    expect(guardrailBreaches([...week(BEFORE_DAYS, 100), ...week(AFTER_DAYS, 120)], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...week(BEFORE_DAYS, 100), ...week(AFTER_DAYS, 130)], BEFORE, AFTER)).toEqual(['quitRate 10.0%->13.0%', `quitRate:${KIND} 10.0%->13.0%`]);
  });

  it('quit rate: a rise of more than 2 pp that the cohort size cannot tell from noise is not a breach', () => {
    // 20% -> 27% of 100 sessions a day: z = 2.9, over the 2.58 of 4 comparisons (all kinds, KIND, median, p90)
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 27, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })])], BEFORE, AFTER)).toHaveLength(2);
    // 20% -> 24% of 100 sessions a day: z = 1.7, noise at this size
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 24, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })])], BEFORE, AFTER)).toEqual([]);
  });

  it('quit rate per game kind: the share of all reporting sessions that quit at the kind, so a rise diluted across many kinds stays under the line', () => {
    // 1,600 reporting sessions a day: 20 -> 32 quits at KIND is 1.25% -> 2.0% (0.75 pp), however significant
    const day = (d: string, q: number): RollupRow[] => [...quits(d, KIND, q, 1600), ...minutes(d, { '4': 30, '6': 40, '9': 30 })];
    expect(guardrailBreaches([...each(BEFORE_DAYS, (d) => day(d, 20)), ...each(AFTER_DAYS, (d) => day(d, 32))], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...each(BEFORE_DAYS, (d) => day(d, 20)), ...each(AFTER_DAYS, (d) => day(d, 60))], BEFORE, AFTER)).toEqual(['quitRate 1.3%->3.8%', `quitRate:${KIND} 1.3%->3.8%`]);
  });

  it(`quit rate: fewer than ${MIN_COHORT_SESSIONS} sessions in a cohort triggers nothing, and nothing is compared`, () => {
    // 24 sessions a day on 4 days is 96 sessions, under the cohort minimum, though every one of them quit at KIND
    const rows = [...each(BEFORE_DAYS, (d) => quits(d, KIND, 20, 100)), ...each(AFTER_DAYS.slice(0, 4), (d) => quits(d, KIND, 24, 24))];
    expect(guardrailCheck(rows, BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 0, days: 7 });
  });

  it('quit rate: under 20 quits a kind a day still counts, because the threshold applies to the whole cohort (19 a day is 133)', () => {
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...each(AFTER_DAYS, (d) => quits(d, KIND, 19, 40))], BEFORE, AFTER)).toEqual(['quitRate 20.0%->47.5%', `quitRate:${KIND} 20.0%->47.5%`]);
  });

  it('quit rate: a game kind that did not exist before the step (a game.<kind> ramp) moves both quit lines', () => {
    // 30 new sessions a day, every one left mid-quest on the new kind
    const rows = [...each(BEFORE_DAYS, (d) => mixed(d, 100, { [KIND]: 20 })), ...each(AFTER_DAYS, (d) => mixed(d, 130, { [KIND]: 20, 'build-letter': 30 }))];
    expect(guardrailBreaches(rows, BEFORE, AFTER)).toEqual(['quitRate 20.0%->38.5%', 'quitRate:build-letter <=2.7%->23.1%']);
  });

  it('quit rate: a kind suppressed before the step and at 100 quits a day after it is a breach', () => {
    const rows = [...each(BEFORE_DAYS, (d) => mixed(d, 1000, { [KIND]: 2 })), ...each(AFTER_DAYS, (d) => mixed(d, 1000, { [KIND]: 100 }))];
    expect(guardrailBreaches(rows, BEFORE, AFTER)).toEqual(['quitRate 0.2%->10.0%', `quitRate:${KIND} <=0.3%->10.0%`]);
  });

  it('quits after a wrong streak: a significant rise per quest session is a breach, noise is not', () => {
    const week = (days: readonly string[], s2: number): RollupRow[] => each(days, (d) => [...quits(d, KIND, 30, 1000), ...streaks(d, 5, 5, s2)]);
    // 2.0% -> 2.2% of quest sessions: well inside the noise
    expect(guardrailBreaches([...week(BEFORE_DAYS, 20), ...week(AFTER_DAYS, 22)], BEFORE, AFTER)).toEqual([]);
    // 2.0% -> 3.0%: z is about 3.8
    expect(guardrailBreaches([...week(BEFORE_DAYS, 20), ...week(AFTER_DAYS, 30)], BEFORE, AFTER)).toEqual(['wrongStreakQuits 2.0%->3.0%']);
  });

  it('quits after a wrong streak: an after group under 20 events in the window is never compared; a before group under 20 is read as 19', () => {
    const qs = (days: readonly string[]): RollupRow[] => each(days, (d) => quits(d, KIND, 30, 1000));
    const before = [...qs(BEFORE_DAYS), ...streaks('2026-10-05', 0, 0, 5)];
    expect(guardrailBreaches([...before, ...qs(AFTER_DAYS), ...streaks('2026-10-15', 0, 0, 19)], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...before, ...qs(AFTER_DAYS), ...streaks('2026-10-15', 0, 0, 60)], BEFORE, AFTER)).toEqual(['wrongStreakQuits <=0.3%->0.9%']);
  });

  it('median session length: a significant fall of more than 10% is a breach, 5% is not', () => {
    const qs = (days: readonly string[]): RollupRow[] => each(days, (d) => quits(d, KIND, 10, 100));
    const before = [...qs(BEFORE_DAYS), ...each(BEFORE_DAYS, (d) => minutes(d, { '9': 100 }))]; // median 9.5
    const down5 = [...qs(AFTER_DAYS), ...each(AFTER_DAYS, (d) => minutes(d, { '8': 10, '9': 90 }))]; // median 9.44
    const down20 = [...qs(AFTER_DAYS), ...each(AFTER_DAYS, (d) => minutes(d, { '7': 100 }))]; // median 7.5
    expect(guardrailBreaches([...before, ...down5], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...before, ...down20], BEFORE, AFTER)).toEqual(['medianMinutes 9.5->7.5']);
  });

  it('median session length: a fall of the point estimate that the sessions do not support is not a breach', () => {
    // the median moves from 6.6 to 5.9 (10.6%) though almost every session is as long as before
    const before = each(BEFORE_DAYS, (d) => minutes(d, { '2': 48, '6': 4, '20': 48 }));
    const after = each(AFTER_DAYS, (d) => minutes(d, { '2': 50, '6': 2, '20': 48 }));
    expect(minutesQuantile(new Map([['2', 48], ['6', 4], ['20', 48]]), 0.5)).toBeCloseTo(6.5, 1);
    expect(guardrailBreaches([...before, ...after], BEFORE, AFTER)).toEqual([]);
  });

  it('p90 session length: reaching 20 minutes is a breach only when the cohort before was under it', () => {
    const under = each(BEFORE_DAYS, (d) => minutes(d, { '6': 80, '15': 20 }));
    const over = each(AFTER_DAYS, (d) => minutes(d, { '6': 80, '30-59': 20 }));
    expect(guardrailBreaches([...under, ...over], BEFORE, AFTER)).toEqual(['p90Minutes 15.5->45.0']);
    const alreadyOver = each(BEFORE_DAYS, (d) => minutes(d, { '6': 80, '30-59': 20 }));
    expect(guardrailBreaches([...alreadyOver, ...over], BEFORE, AFTER)).toEqual([]);
  });

  it('p90 session length: just over the line, with a share of long sessions the cohort cannot tell from 10%, is not a breach', () => {
    const under = each(BEFORE_DAYS, (d) => minutes(d, { '6': 80, '15': 20 }));
    const edge = each(AFTER_DAYS, (d) => minutes(d, { '6': 89, '25': 11 })); // p90 is 25.1, 11% of sessions are long
    expect(guardrailBreaches([...under, ...edge], BEFORE, AFTER)).toEqual([]);
  });

  it(`session length: a cohort under ${MIN_COHORT_SESSIONS} sessions triggers nothing; 19 sessions a day on 7 days is 133 and is compared (half the sessions got shorter and half longer: no median breach)`, () => {
    const after = each(AFTER_DAYS, (d) => minutes(d, { '1': 9, '40': 1, '30-59': 9 }));
    expect(guardrailCheck([...each(BEFORE_DAYS.slice(0, 5), (d) => minutes(d, { '9': 19 })), ...after], BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 0, days: 7 });
    expect(guardrailBreaches([...each(BEFORE_DAYS, (d) => minutes(d, { '9': 19 })), ...after], BEFORE, AFTER)).toEqual(['p90Minutes 9.9->54.0']);
  });

  it('session length: a weekend rhythm is not a breach when the after window holds only Friday to Sunday', () => {
    // weekdays: 9-minute sessions and 10% quits; weekends: 6-minute sessions and 15% quits; nothing changed with the step
    const day = (d: string, short: string): RollupRow[] => {
      const weekend = [0, 6].includes(new Date(`${d}T00:00:00.000Z`).getUTCDay());
      return [...quits(d, KIND, weekend ? 45 : 30, 300), ...minutes(d, { [weekend ? short : '9']: 300 })];
    };
    const before = { fromDay: '2026-10-08', toDay: '2026-10-14' };
    const after = { fromDay: '2026-10-16', toDay: '2026-10-18' };
    const beforeRows = each(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'], (d) => day(d, '6'));
    expect(guardrailBreaches([...beforeRows, ...each(['2026-10-16', '2026-10-17', '2026-10-18'], (d) => day(d, '6'))], before, after)).toEqual([]);
    // the same rhythm, with weekend sessions after the step really shorter: a breach
    expect(guardrailBreaches([...beforeRows, ...each(['2026-10-16', '2026-10-17', '2026-10-18'], (d) => day(d, '3'))], before, after)).toEqual(['medianMinutes 6.8->3.8']);
  });

  it("D1 rows written: a day of the rollup sink's counter at 50% or more of the free-tier quota is a breach when the cohort before stayed under (only once the sink's cap is raised)", () => {
    const line = D1_FREE_ROWS_WRITTEN_PER_DAY / 2;
    expect(line).toBe(50_000);
    const writes = (day: string, n: number): RollupRow => row(day, ROLLUP_BUDGET_METRIC, '', '', n);
    const before = BEFORE_DAYS.map((d) => writes(d, line - 1));
    expect(guardrailBreaches([...before, ...AFTER_DAYS.map((d) => writes(d, line - 1))], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...before, writes('2026-10-20', line)], BEFORE, AFTER)).toEqual(['d1RowsWritten 50000/day of 100000']);
    expect(guardrailBreaches([writes('2026-10-05', line), writes('2026-10-20', line + 5)], BEFORE, AFTER)).toEqual([]);
    // events of other metrics are learner counts, not the sink's writes
    expect(guardrailBreaches([row('2026-10-20', 'session.end.minutes', '', '5', line)], BEFORE, AFTER)).toEqual([]);
    // the sink counts the rows it wrote and stops at its cap, so at the cap this line is far from 50%
    expect(ROLLUP_GLOBAL_ROWS_PER_DAY).toBeLessThan(line);
    expect(guardrailBreaches([...BEFORE_DAYS.map((d) => writes(d, 1_000)), ...AFTER_DAYS.map((d) => writes(d, ROLLUP_GLOBAL_ROWS_PER_DAY + 40))], BEFORE, AFTER)).toEqual([]);
  });

  it('a capped day is left out of the learner comparisons; when every day is capped nothing is compared', () => {
    const cap = (d: string): RollupRow => row(d, ROLLUP_BUDGET_METRIC, '', '', ROLLUP_GLOBAL_ROWS_PER_DAY);
    // a spike on the capped Tuesday after the step is not read
    const rows = [...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS.slice(0, 6)), ...quits('2026-10-20', KIND, 90, 100), cap('2026-10-20')];
    expect(guardrailCheck(rows, BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 4, days: 6 });
    expect(guardrailCheck([...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), ...AFTER_DAYS.map(cap)], BEFORE, AFTER)).toEqual({ breaches: [], comparisons: 0, days: 0 });
  });

  it('counts only rows inside the windows', () => {
    const stepDay = [...quits('2026-10-10', KIND, 90, 100), row('2026-10-10', ROLLUP_BUDGET_METRIC, '', '', D1_FREE_ROWS_WRITTEN_PER_DAY)];
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), ...stepDay], BEFORE, AFTER)).toEqual([]);
  });
});

describe('guardrailBreaches under noise (seeded, no real change)', { timeout: 90_000 }, () => {
  // A healthy ramp must not be walked down by chance: each run's comparisons share a 2% family alpha.
  it.each([
    [8, 25],
    [8, 60],
    [8, 200],
    [1, 25],
    [1, 40],
    [21, 25],
  ])('%i game kinds at %i sessions per kind per day: a false breach in at most 4%% of runs (2%% family alpha, plus the normal approximation on small cohorts)', (kinds, perKind) => {
    expect(falseBreachRate(KINDS.slice(0, kinds), perKind, 200, 7919 * kinds + perKind)).toBeLessThanOrEqual(0.04);
  });

  it.each([
    [8, 60],
    [21, 25],
  ])('%i game kinds at %i sessions per kind per day: a healthy step is lowered on one of its 5 daily runs (3 to 7 days after it) in at most 6%% of steps', (kinds, perKind) => {
    const rand = seeded(104_729 + kinds * perKind);
    let lowered = 0;
    for (let i = 0; i < 200; i += 1) {
      const sample = [...each(BEFORE_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, kinds), perKind, 0.1)), ...each(AFTER_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, kinds), perKind, 0.1))];
      if ([3, 4, 5, 6, 7].some((n) => guardrailBreaches(sample, BEFORE, { fromDay: AFTER.fromDay, toDay: AFTER_DAYS[n - 1]! }).length > 0)) lowered += 1;
    }
    expect(lowered / 200).toBeLessThanOrEqual(0.06);
  });

  it('still finds a real rise: one kind from 10% to 30% of its sessions at 200 sessions a day among 8 kinds (1.25% -> 3.75% of all)', () => {
    const rand = seeded(42);
    let found = 0;
    for (let i = 0; i < 50; i += 1) {
      const sample = [
        ...each(BEFORE_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, 8), 200, 0.1)),
        ...each(AFTER_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, 8), 200, 0.1, { [KIND]: 0.3 })),
      ];
      if (guardrailBreaches(sample, BEFORE, AFTER).some((b) => b.startsWith(`quitRate:${KIND} `))) found += 1;
    }
    expect(found / 50).toBeGreaterThanOrEqual(0.9);
  });
});

describe('guardrailReason and the run log', () => {
  it('names the run, the baseline, the step and the breaches, and is cut to its maximum length', () => {
    expect(guardrailReason('2026-10-21', '2026-10-10', 50, 10, ['a', 'b'])).toBe('guardrail 2026-10-21 base 2026-10-10 pct 50->10: a; b');
    const long = guardrailReason('2026-10-21', '2026-10-10', 50, 10, Array.from({ length: 80 }, (_, i) => `quitRate:kind-${i} 1.0%->9.0%`));
    expect(long).toHaveLength(GUARDRAIL_REASON_MAX);
    expect(long.endsWith('...')).toBe(true);
  });

  it('logs flag names, steps and skip codes only, never the reason text', () => {
    const skipped = [
      { flag: 'goals', why: 'stale-step' },
      { flag: 'mastery', why: 'unchecked' },
      { flag: 'packs', why: 'too-few-days' },
      { flag: 'volumes', why: 'changed-today' },
    ] as const;
    const line = guardrailRunLog({ day: '2026-10-21', ramping: 5, lowered: [{ flag: 'dailyReview', from: 50, to: 10, reason: 'guardrail ... quitRate:match-shape 10.0%->15.0%' }], kept: [], skipped: [...skipped], deferred: [] });
    // unguarded: the stale and the unchecked flag (waiting ends the other two skips)
    expect(JSON.parse(line)).toEqual({ event: 'guardrail.run', day: '2026-10-21', ramping: 5, lowered: [{ flag: 'dailyReview', from: 50, to: 10 }], kept: [], skipped, deferred: [], unguarded: 2 });
    expect(line).not.toContain('quitRate');
  });

  it('the kill switch: on when GUARDRAIL_EVALUATOR is unset, empty or enabled; any other value stops the evaluator', () => {
    expect([undefined, {}, { GUARDRAIL_EVALUATOR: '' }, { GUARDRAIL_EVALUATOR: 'enabled' }].map(guardrailEvaluatorEnabled)).toEqual([true, true, true, true]);
    expect([{ GUARDRAIL_EVALUATOR: 'disabled' }, { GUARDRAIL_EVALUATOR: 'off' }, { GUARDRAIL_EVALUATOR: 'Enabled' }].map(guardrailEvaluatorEnabled)).toEqual([false, false, false]);
    expect(JSON.parse(guardrailDisabledLog(NOW))).toEqual({ event: 'guardrail.run', day: '2026-10-21', disabled: true });
  });
});

describe('runGuardrailEvaluator', () => {
  const breached = (): RollupRow[] => [...healthy(BEFORE_DAYS), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 28, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })])];
  const REASON = `guardrail 2026-10-21 base 2026-10-10 pct 50->10: quitRate 20.0%->28.0%; quitRate:${KIND} 20.0%->28.0%`;

  it('a breach lowers the flag by one step and records the reason with updated_at; on is untouched', async () => {
    await db.putRemoteConfig(flag());
    rows = breached();
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result).toEqual({ day: '2026-10-21', ramping: 1, lowered: [{ flag: 'dailyReview', from: 50, to: 10, reason: REASON }], kept: [], skipped: [], deferred: [] });
    expect(await db.remoteConfig()).toEqual([{ flag: 'dailyReview', on: true, pct: 10, updatedAt: NOW.toISOString(), reason: REASON }]);
  });

  it('lowers 10 to 0 and 25 to 10, one step per run', async () => {
    await db.putRemoteConfig(flag({ flag: 'goals', pct: 10 }));
    await db.putRemoteConfig(flag({ flag: 'mastery', pct: 25 }));
    rows = breached();
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result.lowered.map((l) => [l.flag, l.from, l.to])).toEqual([
      ['goals', 10, 0],
      ['mastery', 25, 10],
    ]);
    expect((await db.remoteConfig()).map((r) => [r.flag, r.on, r.pct])).toEqual([
      ['goals', true, 0],
      ['mastery', true, 10],
    ]);
  });

  it('two flags ramping at once with windows that show the same breach are both lowered (no per-flag arm, section 12.3)', async () => {
    await db.putRemoteConfig(flag());
    await db.putRemoteConfig(flag({ flag: 'goals', pct: 10, updatedAt: '2026-10-12T08:00:00.000Z' }));
    // goals: before 2026-10-05..11, after 2026-10-14..20
    rows = [...healthy(['2026-10-03', '2026-10-04', ...BEFORE_DAYS, '2026-10-11']), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 28, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })])];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result.lowered.map((l) => [l.flag, l.from, l.to])).toEqual([
      ['dailyReview', 50, 10],
      ['goals', 10, 0],
    ]);
  });

  it('no breach changes nothing', async () => {
    await db.putRemoteConfig(flag());
    rows = [...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS)];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result).toMatchObject({ ramping: 1, lowered: [], kept: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([flag()]);
  });

  it('never raises and never turns a flag on: a flag that is off, at 0 or at 100 is not evaluated', async () => {
    const still = [flag({ flag: 'goals', on: false, pct: 50 }), flag({ flag: 'mastery', pct: 0 }), flag({ flag: 'volumes', pct: 100 }), flag({ flag: 'Bad Name', pct: 50 })];
    for (const r of still) await db.putRemoteConfig(r);
    rows = breached();
    const lower = vi.spyOn(db, 'lowerRemoteConfigPct');
    expect(await runGuardrailEvaluator(db, NOW)).toEqual({ day: '2026-10-21', ramping: 0, lowered: [], kept: [], skipped: [], deferred: [] });
    expect(lower).not.toHaveBeenCalled();
    expect(db.rollupRowsOf).not.toHaveBeenCalled();
    expect(await db.remoteConfig()).toEqual([...still].sort((a, b) => (a.flag < b.flag ? -1 : 1)));
  });

  it('the write only lowers: a raise, an equal value, an off row or a row that changed in any way since it was read is refused', async () => {
    const at = NOW.toISOString();
    await db.putRemoteConfig(flag({ pct: 10 }));
    expect(await db.lowerRemoteConfigPct('dailyReview', 10, STEP_AT, 50, at, 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('dailyReview', 10, STEP_AT, 10, at, 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('dailyReview', 50, STEP_AT, 10, at, 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('dailyReview', 10, '2026-10-11T00:00:00.000Z', 0, at, 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('missing', 50, STEP_AT, 10, at, 'x')).toBe(false);
    await db.putRemoteConfig(flag({ flag: 'goals', on: false, pct: 10 }));
    expect(await db.lowerRemoteConfigPct('goals', 10, STEP_AT, 0, at, 'x')).toBe(false);
    expect(await db.remoteConfig()).toEqual([flag({ pct: 10 }), flag({ flag: 'goals', on: false, pct: 10 })].sort((a, b) => (a.flag < b.flag ? -1 : 1)));
    // a fractional console value (25.5 is read as 25) still lowers
    await db.putRemoteConfig(flag({ flag: 'mastery', pct: 25.5 }));
    expect(await db.lowerRemoteConfigPct('mastery', 25, STEP_AT, 10, at, 'x')).toBe(true);
  });

  it('suppressed groups are ignored: an after group under 20 events at a kind changes nothing', async () => {
    await db.putRemoteConfig(flag());
    rows = [...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), row('2026-10-14', 'session.end.questLeft', 'build-letter', '1', 19)];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result).toMatchObject({ lowered: [], kept: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([flag()]);
  });

  it('a flag with nothing to compare (cohorts too small, or no rollups) is skipped as unchecked, never kept', async () => {
    await db.putRemoteConfig(flag());
    // 13 sessions a day, every one left mid-quest after the step: 91 sessions, under the cohort minimum
    rows = [...each(BEFORE_DAYS, (d) => quits(d, KIND, 1, 13)), ...each(AFTER_DAYS, (d) => quits(d, KIND, 13, 13))];
    expect(await runGuardrailEvaluator(db, NOW)).toEqual({ day: '2026-10-21', ramping: 1, lowered: [], kept: [], skipped: [{ flag: 'dailyReview', why: 'unchecked' }], deferred: [] });
    rows = [];
    expect((await runGuardrailEvaluator(db, NOW)).skipped).toEqual([{ flag: 'dailyReview', why: 'unchecked' }]);
    expect(await db.remoteConfig()).toEqual([flag()]);
  });

  it('25 sessions per kind a day among 8 kinds, one kind from 10% to 60% quits: lowered, never kept', async () => {
    await db.putRemoteConfig(flag());
    const rand = seeded(2026);
    rows = [...each(BEFORE_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, 8), 25, 0.1)), ...each(AFTER_DAYS, (d) => simulatedDay(rand, d, KINDS.slice(0, 8), 25, 0.1, { [KIND]: 0.6 }))];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result.lowered).toEqual([expect.objectContaining({ flag: 'dailyReview', from: 50, to: 10, reason: expect.stringContaining(`quitRate:${KIND} `) })]);
  });

  it('a second run on the same day does nothing more', async () => {
    await db.putRemoteConfig(flag());
    rows = breached();
    expect((await runGuardrailEvaluator(db, NOW)).lowered).toHaveLength(1);
    const after = await db.remoteConfig();
    const again = await runGuardrailEvaluator(db, new Date('2026-10-21T23:59:00.000Z'));
    expect(again).toEqual({ day: '2026-10-21', ramping: 1, lowered: [], kept: [], skipped: [{ flag: 'dailyReview', why: 'changed-today' }], deferred: [] });
    expect(await db.remoteConfig()).toEqual(after);
  });

  it(`waits ${3} full days after a step or a lowering before comparing again`, async () => {
    await db.putRemoteConfig(flag({ updatedAt: '2026-10-21T11:17:00.000Z', pct: 10 }));
    rows = breached();
    for (const day of ['2026-10-22', '2026-10-23', '2026-10-24']) expect((await runGuardrailEvaluator(db, new Date(`${day}T11:17:00.000Z`))).skipped).toEqual([{ flag: 'dailyReview', why: 'too-few-days' }]);
    expect(await db.remoteConfig()).toEqual([flag({ updatedAt: '2026-10-21T11:17:00.000Z', pct: 10 })]);
    // compared now (no rollups after the lowering yet, so nothing to compare)
    expect((await runGuardrailEvaluator(db, new Date('2026-10-25T11:17:00.000Z'))).skipped).toEqual([{ flag: 'dailyReview', why: 'unchecked' }]);
  });

  it('after its own lowering it keeps the baseline from before the ramp, so a lower step that is still worse is lowered again', async () => {
    // owner stepped 10 -> 50 on 2026-10-07; the evaluator lowered 50 -> 10 on 2026-10-14
    const lowered = flag({ pct: 10, updatedAt: '2026-10-14T11:17:00.000Z', reason: `guardrail 2026-10-14 base 2026-10-07 pct 50->10: quitRate:${KIND} 20.0%->35.0%` });
    const fiftyWeek = each(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'], (d) => quits(d, KIND, 35, 100));
    const stillWorse = each(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'], (d) => quits(d, KIND, 28, 100));
    rows = [...healthy(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']), ...fiftyWeek, ...stillWorse];
    await db.putRemoteConfig(lowered);
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result.lowered).toEqual([{ flag: 'dailyReview', from: 10, to: 0, reason: `guardrail 2026-10-21 base 2026-10-07 pct 10->0: quitRate 20.0%->28.0%; quitRate:${KIND} 20.0%->28.0%` }]);
    // the owner touched the row (a new note): the breached week becomes the baseline, and 28% reads as better than 35%
    await db.putRemoteConfig({ ...lowered, reason: 'owner keeps 10' });
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ lowered: [], kept: ['dailyReview'] });
  });

  it(`a kept baseline older than ${GUARDRAIL_MAX_STEP_AGE_DAYS} days is stale, even when the lowering itself is recent`, async () => {
    // owner stepped on 2026-10-06; the evaluator lowered on 2026-10-14 and kept base 2026-10-06
    await db.putRemoteConfig(flag({ pct: 10, updatedAt: '2026-10-14T11:17:00.000Z', reason: `guardrail 2026-10-14 base 2026-10-06 pct 50->10: quitRate 20.0%->35.0%` }));
    rows = breached();
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ lowered: [], skipped: [{ flag: 'dailyReview', why: 'stale-step' }] });
    expect(db.rollupRowsOf).not.toHaveBeenCalled();
    // the same lowering with base 2026-10-07 is still compared
    await db.putRemoteConfig(flag({ pct: 10, updatedAt: '2026-10-14T11:17:00.000Z', reason: `guardrail 2026-10-14 base 2026-10-07 pct 50->10: quitRate 20.0%->35.0%` }));
    expect((await runGuardrailEvaluator(db, NOW)).skipped).toEqual([]);
  });

  it('skips a flag the owner stepped today, a step in the future, a stale step, or an updated_at that is not a day', async () => {
    await db.putRemoteConfig(flag({ flag: 'goals', updatedAt: '2026-10-21T08:00:00.000Z' }));
    await db.putRemoteConfig(flag({ flag: 'mastery', updatedAt: 'last week' }));
    await db.putRemoteConfig(flag({ flag: 'packs', updatedAt: '2026-10-29T08:00:00.000Z' }));
    await db.putRemoteConfig(flag({ flag: 'volumes', updatedAt: '2026-10-06T08:00:00.000Z' }));
    rows = breached();
    expect((await runGuardrailEvaluator(db, NOW)).skipped).toEqual([
      { flag: 'goals', why: 'changed-today' },
      { flag: 'mastery', why: 'bad-updated-at' },
      { flag: 'packs', why: 'future-updated-at' },
      { flag: 'volumes', why: 'stale-step' },
    ]);
    expect(db.rollupRowsOf).not.toHaveBeenCalled();
  });

  it('reads learning_rollups once: the guardrail metrics only, from the earliest before window to yesterday', async () => {
    await db.putRemoteConfig(flag());
    await db.putRemoteConfig(flag({ flag: 'goals', updatedAt: '2026-10-07T00:00:00.000Z', pct: 10 }));
    rows = [...breached(), row('2026-10-15', 'mastery.level_up', 'cell:letters-1', '2', 500)];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(db.rollupRowsOf).toHaveBeenCalledTimes(1);
    expect(db.rollupRowsOf).toHaveBeenCalledWith('2026-09-30', '2026-10-20', GUARDRAIL_METRICS, ROLLUP_READ_LIMIT + 1);
    expect(GUARDRAIL_METRICS).toEqual(['session.end.questLeft', 'session.end.leftAfterWrongStreak', 'session.end.minutes', ROLLUP_BUDGET_METRIC]);
    // the mastery.level_up row is not read at all
    await expect(vi.mocked(db.rollupRowsOf).mock.results[0]?.value).resolves.not.toContainEqual(expect.objectContaining({ metric: 'mastery.level_up' }));
    // goals (base 2026-10-07): its before window holds 4 of the healthy days, still enough to show the rise
    expect(result).toMatchObject({ ramping: 2, kept: [], lowered: [{ flag: 'dailyReview' }, { flag: 'goals', reason: expect.stringContaining('base 2026-10-07') }] });
  });

  it('refuses a read over the rollup read limit instead of judging a partial window', async () => {
    await db.putRemoteConfig(flag());
    vi.mocked(db.rollupRowsOf).mockResolvedValueOnce(Array.from({ length: ROLLUP_READ_LIMIT + 1 }, () => row('2026-10-15', 'session.end.minutes', '', '5', 1)));
    await expect(runGuardrailEvaluator(db, NOW)).rejects.toThrow(RangeError);
    expect(await db.remoteConfig()).toEqual([flag()]);
  });

  it('a recent step compares only the full days since it', async () => {
    // stepped 2026-10-17: after = 2026-10-18..20, before = 2026-10-10..16
    await db.putRemoteConfig(flag({ updatedAt: '2026-10-17T10:00:00.000Z' }));
    rows = [...healthy(['2026-10-10', '2026-10-11']), ...quits('2026-10-17', KIND, 90, 100), ...healthy(['2026-10-18', '2026-10-19', '2026-10-20'])];
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ kept: ['dailyReview'], lowered: [] });
    // Sunday to Tuesday after it, so Sunday to Tuesday before it (2026-10-11..13): the Saturday 2026-10-10 is not read
    rows = [...healthy(['2026-10-10']), ...quits('2026-10-20', KIND, 40, 100)];
    expect((await runGuardrailEvaluator(db, NOW)).skipped).toEqual([{ flag: 'dailyReview', why: 'unchecked' }]);
    rows = [...healthy(['2026-10-11']), ...quits('2026-10-20', KIND, 40, 100)];
    expect((await runGuardrailEvaluator(db, NOW)).lowered).toEqual([expect.objectContaining({ from: 50, to: 10 })]);
  });

  it(`lowers at most ${MAX_GUARDRAIL_LOWERS} flags a run; the rest wait for the next run`, async () => {
    const names = Array.from({ length: MAX_GUARDRAIL_LOWERS + 2 }, (_, i) => `flag${String.fromCharCode(97 + i)}`);
    for (const name of names) await db.putRemoteConfig(flag({ flag: name }));
    rows = breached();
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result.lowered.map((l) => l.flag)).toEqual(names.slice(0, MAX_GUARDRAIL_LOWERS));
    expect(result.deferred).toEqual(names.slice(MAX_GUARDRAIL_LOWERS));
  });

  it(`a refused write counts toward the ${MAX_GUARDRAIL_LOWERS} attempts, so a run never prepares more UPDATEs`, async () => {
    const names = Array.from({ length: MAX_GUARDRAIL_LOWERS + 2 }, (_, i) => `flag${String.fromCharCode(97 + i)}`);
    for (const name of names) await db.putRemoteConfig(flag({ flag: name }));
    rows = breached();
    const write = db.lowerRemoteConfigPct.bind(db);
    const lower = vi.spyOn(db, 'lowerRemoteConfigPct').mockResolvedValueOnce(false).mockImplementation(write);
    const result = await runGuardrailEvaluator(db, NOW);
    expect(lower).toHaveBeenCalledTimes(MAX_GUARDRAIL_LOWERS);
    expect(result.lowered.map((l) => l.flag)).toEqual(names.slice(1, MAX_GUARDRAIL_LOWERS));
    expect(result.deferred).toEqual([names[0], ...names.slice(MAX_GUARDRAIL_LOWERS)]);
  });

  it('leaves a row the owner edited in any way during the run exactly as the owner set it', async () => {
    await db.putRemoteConfig(flag());
    rows = breached();
    // the evaluator read pct 50; the owner then turned it off with a note (same pct): nothing is written
    vi.spyOn(db, 'remoteConfig').mockResolvedValueOnce([flag()]);
    const off = flag({ on: false, updatedAt: '2026-10-21T11:00:00.000Z', reason: 'owner off' });
    await db.putRemoteConfig(off);
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ lowered: [], deferred: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([off]);
    // the owner only wrote a note (same on, pct and updated_at would still match; a new updated_at does not)
    const note = flag({ updatedAt: '2026-10-21T11:00:00.000Z', reason: 'owner note' });
    await db.putRemoteConfig(note);
    vi.spyOn(db, 'remoteConfig').mockResolvedValueOnce([flag()]);
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ lowered: [], deferred: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([note]);
  });
});
