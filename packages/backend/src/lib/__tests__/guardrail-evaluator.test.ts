import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDb, type RemoteConfigRow, type RollupRow } from '../../db';
import {
  D1_FREE_ROWS_WRITTEN_PER_DAY,
  GUARDRAIL_REASON_MAX,
  MAX_GUARDRAIL_LOWERS,
  RAMP_STEPS,
  addDays,
  guardrailBreaches,
  guardrailReason,
  minutesQuantile,
  previousRampStep,
  riseZ,
  runGuardrailEvaluator,
  stepDayOf,
  visibleGroups,
} from '../guardrail-evaluator';
import { MIN_GROUP_EVENTS } from '../learning-rollups';

/**
 * F-CURR-002 section 12.3 (row CM-70b), guardrails of section 3.3, "remote can only reduce" of section 12.2. The
 * run of 2026-10-21 for a flag stepped on 2026-10-10 compares the after window 2026-10-14..20 (the last 7 full days)
 * with the before window 2026-10-03..09 (the 7 days before the step day).
 */
const NOW = new Date('2026-10-21T11:17:00.000Z');
const STEP_AT = '2026-10-10T09:00:00.000Z';
const BEFORE_DAYS = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
const AFTER_DAYS = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'];
const BEFORE = { fromDay: '2026-10-03', toDay: '2026-10-09' };
const AFTER = { fromDay: '2026-10-14', toDay: '2026-10-20' };
const KIND = 'match-shape';

const row = (day: string, metric: string, dim: string, bucket: string, events: number): RollupRow => ({ day, metric, dim, bucket, events });

/** `quits` of `sessions` quest sessions ended mid-quest on `kind`, with the overall cells too. */
function quits(day: string, kind: string, q: number, sessions: number): RollupRow[] {
  return [
    row(day, 'session.end.questLeft', '', '0', sessions - q),
    row(day, 'session.end.questLeft', '', '1', q),
    row(day, 'session.end.questLeft', kind, '0', sessions - q),
    row(day, 'session.end.questLeft', kind, '1', q),
  ];
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

/** A healthy week: 10% quits on KIND (of 100 sessions a day) and a 6-minute median. */
const healthy = (days: readonly string[]): RollupRow[] => each(days, (d) => [...quits(d, KIND, 10, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })]);

const flag = (over: Partial<RemoteConfigRow> = {}): RemoteConfigRow => ({ flag: 'dailyReview', on: true, pct: 50, updatedAt: STEP_AT, reason: 'owner ramp 50', ...over });

let db: MemoryDb;
let rows: RollupRow[];
beforeEach(() => {
  db = new MemoryDb();
  rows = [];
  vi.spyOn(db, 'rollupRows').mockImplementation(async (from, to) => rows.filter((r) => r.day >= from && r.day <= to));
});

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

describe('visibleGroups and riseZ', () => {
  it('keeps a (day, metric, dim) group of 20 events or more, whatever its cells hold', () => {
    const kept = visibleGroups([...quits('2026-10-14', KIND, 2, 20), ...quits('2026-10-15', KIND, 2, 19)]);
    expect(kept.every((r) => r.day === '2026-10-14')).toBe(true);
    expect(kept.find((r) => r.dim === KIND && r.bucket === '1')?.events).toBe(2); // a cell under 20 inside a kept group stays
    expect(MIN_GROUP_EVENTS).toBe(20);
  });

  it('is 0 when nobody (or everybody) quit in either cohort', () => {
    expect(riseZ({ num: 0, den: 100 }, { num: 0, den: 100 })).toBe(0);
    expect(riseZ({ num: 100, den: 100 }, { num: 100, den: 100 })).toBe(0);
    expect(riseZ({ num: 20, den: 1000 }, { num: 40, den: 1000 })).toBeGreaterThan(2.5);
  });
});

describe('guardrailBreaches (section 3.3)', () => {
  it('finds nothing in two healthy weeks', () => {
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS)], BEFORE, AFTER)).toEqual([]);
  });

  it('quit rate per game kind: a rise of more than 2 pp is a breach, exactly 2 pp is not', () => {
    const base = healthy(BEFORE_DAYS);
    const after = (q: number): RollupRow[] => each(AFTER_DAYS, (d) => [...quits(d, KIND, q, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })]);
    expect(guardrailBreaches([...base, ...after(12)], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...base, ...after(13)], BEFORE, AFTER)).toEqual([`quitRate:${KIND} 10.0%->13.0%`]);
  });

  it('quit rate: a kind with no before cohort, or under 20 events a day, triggers nothing', () => {
    const base = healthy(BEFORE_DAYS);
    expect(guardrailBreaches([...base, ...each(AFTER_DAYS, (d) => quits(d, 'build-letter', 50, 100))], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...each(BEFORE_DAYS, (d) => quits(d, KIND, 1, 19)), ...each(AFTER_DAYS, (d) => quits(d, KIND, 18, 19))], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...base, ...each(AFTER_DAYS, (d) => quits(d, KIND, 18, 19))], BEFORE, AFTER)).toEqual([]);
  });

  it('quits after a wrong streak: a significant rise per quest session is a breach, noise is not', () => {
    const week = (days: readonly string[], s2: number): RollupRow[] => each(days, (d) => [...quits(d, KIND, 30, 1000), ...streaks(d, 5, 5, s2)]);
    // 2.0% -> 2.2% of quest sessions: well inside the noise
    expect(guardrailBreaches([...week(BEFORE_DAYS, 20), ...week(AFTER_DAYS, 22)], BEFORE, AFTER)).toEqual([]);
    // 2.0% -> 3.0%: z is about 4
    expect(guardrailBreaches([...week(BEFORE_DAYS, 20), ...week(AFTER_DAYS, 30)], BEFORE, AFTER)).toEqual(['wrongStreakQuits 2.0%->3.0%']);
  });

  it('quits after a wrong streak: a day whose streak group is under 20 leaves that day out of both counts', () => {
    // after: every day's streak group holds 19 events (all after a streak), so nothing is counted
    const before = each(BEFORE_DAYS, (d) => [...quits(d, KIND, 30, 1000), ...streaks(d, 5, 5, 10)]);
    const after = each(AFTER_DAYS, (d) => [...quits(d, KIND, 30, 1000), ...streaks(d, 0, 0, 19)]);
    expect(guardrailBreaches([...before, ...after], BEFORE, AFTER)).toEqual([]);
  });

  it('median session length: down by more than 10% is a breach, 5% is not', () => {
    const qs = (days: readonly string[]): RollupRow[] => each(days, (d) => quits(d, KIND, 10, 100));
    const before = [...qs(BEFORE_DAYS), ...each(BEFORE_DAYS, (d) => minutes(d, { '9': 100 }))]; // median 9.5
    const down5 = [...qs(AFTER_DAYS), ...each(AFTER_DAYS, (d) => minutes(d, { '8': 10, '9': 90 }))]; // median 9.44
    const down20 = [...qs(AFTER_DAYS), ...each(AFTER_DAYS, (d) => minutes(d, { '7': 100 }))]; // median 7.5
    expect(guardrailBreaches([...before, ...down5], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...before, ...down20], BEFORE, AFTER)).toEqual(['medianMinutes 9.5->7.5']);
  });

  it('p90 session length: reaching 20 minutes is a breach only when the cohort before was under it', () => {
    const under = each(BEFORE_DAYS, (d) => minutes(d, { '6': 80, '15': 20 }));
    const over = each(AFTER_DAYS, (d) => minutes(d, { '6': 80, '30-59': 20 }));
    expect(guardrailBreaches([...under, ...over], BEFORE, AFTER)).toEqual(['p90Minutes 15.5->45.0']);
    const alreadyOver = each(BEFORE_DAYS, (d) => minutes(d, { '6': 80, '30-59': 20 }));
    expect(guardrailBreaches([...alreadyOver, ...over], BEFORE, AFTER)).toEqual([]);
  });

  it('session length: a cohort under 20 sessions a day triggers nothing', () => {
    const before = each(BEFORE_DAYS, (d) => minutes(d, { '9': 19 }));
    const after = each(AFTER_DAYS, (d) => minutes(d, { '1': 9, '40': 1, '30-59': 9 }));
    expect(guardrailBreaches([...before, ...after], BEFORE, AFTER)).toEqual([]);
  });

  it('D1 rows written: a day at 50% or more of the free-tier quota is a breach when the cohort before stayed under', () => {
    const line = D1_FREE_ROWS_WRITTEN_PER_DAY / 2;
    expect(line).toBe(50_000);
    const writes = (day: string, n: number): RollupRow => row(day, 'memory.daily.dueVolume', '', '20-29', n);
    const before = BEFORE_DAYS.map((d) => writes(d, line - 1));
    expect(guardrailBreaches([...before, ...AFTER_DAYS.map((d) => writes(d, line - 1))], BEFORE, AFTER)).toEqual([]);
    expect(guardrailBreaches([...before, writes('2026-10-20', line)], BEFORE, AFTER)).toEqual(['d1RowsWritten 50000/day of 100000']);
    expect(guardrailBreaches([writes('2026-10-05', line), writes('2026-10-20', line + 5)], BEFORE, AFTER)).toEqual([]);
  });

  it('counts only rows inside the windows', () => {
    const stepDay = [...quits('2026-10-10', KIND, 90, 100), row('2026-10-10', 'x', '', '', D1_FREE_ROWS_WRITTEN_PER_DAY)];
    expect(guardrailBreaches([...healthy(BEFORE_DAYS), ...healthy(AFTER_DAYS), ...stepDay], BEFORE, AFTER)).toEqual([]);
  });
});

describe('guardrailReason', () => {
  it('names the run, the step and the breaches, and is cut to its maximum length', () => {
    expect(guardrailReason('2026-10-21', 50, 10, ['a', 'b'])).toBe('guardrail 2026-10-21 pct 50->10: a; b');
    const long = guardrailReason('2026-10-21', 50, 10, Array.from({ length: 80 }, (_, i) => `quitRate:kind-${i} 1.0%->9.0%`));
    expect(long).toHaveLength(GUARDRAIL_REASON_MAX);
    expect(long.endsWith('...')).toBe(true);
  });
});

describe('runGuardrailEvaluator', () => {
  const breached = (): RollupRow[] => [...healthy(BEFORE_DAYS), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 15, 100), ...minutes(d, { '4': 30, '6': 40, '9': 30 })])];

  it('a breach lowers the flag by one step and records the reason with updated_at; on is untouched', async () => {
    await db.putRemoteConfig(flag());
    rows = breached();
    const result = await runGuardrailEvaluator(db, NOW);
    const reason = `guardrail 2026-10-21 pct 50->10: quitRate:${KIND} 10.0%->15.0%`;
    expect(result).toEqual({ day: '2026-10-21', ramping: 1, lowered: [{ flag: 'dailyReview', from: 50, to: 10, reason }], kept: [], skipped: [], deferred: [] });
    expect(await db.remoteConfig()).toEqual([{ flag: 'dailyReview', on: true, pct: 10, updatedAt: NOW.toISOString(), reason }]);
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
    expect(db.rollupRows).not.toHaveBeenCalled();
    expect(await db.remoteConfig()).toEqual([...still].sort((a, b) => (a.flag < b.flag ? -1 : 1)));
  });

  it('the write only lowers: a raise, an equal value or a row that changed since it was read is refused', async () => {
    await db.putRemoteConfig(flag({ pct: 10 }));
    expect(await db.lowerRemoteConfigPct('dailyReview', 10, 50, NOW.toISOString(), 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('dailyReview', 10, 10, NOW.toISOString(), 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('dailyReview', 50, 10, NOW.toISOString(), 'x')).toBe(false);
    expect(await db.lowerRemoteConfigPct('missing', 50, 10, NOW.toISOString(), 'x')).toBe(false);
    expect(await db.remoteConfig()).toEqual([flag({ pct: 10 })]);
  });

  it('suppressed groups are ignored: a big rise in groups under 20 events a day changes nothing', async () => {
    await db.putRemoteConfig(flag());
    rows = [...each(BEFORE_DAYS, (d) => [...quits(d, KIND, 1, 19), ...minutes(d, { '9': 19 })]), ...each(AFTER_DAYS, (d) => [...quits(d, KIND, 15, 19), ...minutes(d, { '1': 10, '30-59': 9 })])];
    const result = await runGuardrailEvaluator(db, NOW);
    expect(result).toMatchObject({ lowered: [], kept: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([flag()]);
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

  it('the next day compares again from the lowering, so a ramp is never lowered twice for the same days', async () => {
    await db.putRemoteConfig(flag({ updatedAt: '2026-10-21T11:17:00.000Z', pct: 10 }));
    rows = breached();
    expect((await runGuardrailEvaluator(db, new Date('2026-10-22T11:17:00.000Z'))).skipped).toEqual([{ flag: 'dailyReview', why: 'no-full-day' }]);
    expect(await db.remoteConfig()).toEqual([flag({ updatedAt: '2026-10-21T11:17:00.000Z', pct: 10 })]);
  });

  it('skips a flag the owner stepped today, or whose updated_at is not a day', async () => {
    await db.putRemoteConfig(flag({ flag: 'goals', updatedAt: '2026-10-21T08:00:00.000Z' }));
    await db.putRemoteConfig(flag({ flag: 'mastery', updatedAt: 'last week' }));
    rows = breached();
    expect((await runGuardrailEvaluator(db, NOW)).skipped).toEqual([
      { flag: 'goals', why: 'changed-today' },
      { flag: 'mastery', why: 'bad-updated-at' },
    ]);
    expect(db.rollupRows).not.toHaveBeenCalled();
  });

  it('reads learning_rollups once, from the earliest before window to yesterday', async () => {
    await db.putRemoteConfig(flag());
    await db.putRemoteConfig(flag({ flag: 'goals', updatedAt: '2026-09-01T00:00:00.000Z', pct: 10 }));
    rows = breached();
    const result = await runGuardrailEvaluator(db, NOW);
    expect(db.rollupRows).toHaveBeenCalledTimes(1);
    expect(db.rollupRows).toHaveBeenCalledWith('2026-08-25', '2026-10-20');
    // goals: before 2026-08-25..31 holds no rows, so there is nothing to compare with
    expect(result).toMatchObject({ ramping: 2, kept: ['goals'], lowered: [{ flag: 'dailyReview' }] });
  });

  it('a recent step compares only the full days since it', async () => {
    // stepped 2026-10-18: after = 2026-10-19..20, before = 2026-10-11..17
    await db.putRemoteConfig(flag({ updatedAt: '2026-10-18T10:00:00.000Z' }));
    rows = [...healthy(['2026-10-11', '2026-10-12']), ...quits('2026-10-18', KIND, 90, 100), ...healthy(['2026-10-19', '2026-10-20'])];
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ kept: ['dailyReview'], lowered: [] });
    rows = [...healthy(['2026-10-11']), ...quits('2026-10-20', KIND, 20, 100)];
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

  it('leaves a row the owner edited during the run as the owner set it', async () => {
    await db.putRemoteConfig(flag());
    rows = breached();
    vi.spyOn(db, 'remoteConfig').mockResolvedValueOnce([flag()]);
    await db.putRemoteConfig(flag({ on: false, pct: 50, updatedAt: '2026-10-21T11:00:00.000Z', reason: 'owner off' }));
    // the evaluator read pct 50 and the owner turned it off: the pct still matches, so on stays false
    expect((await runGuardrailEvaluator(db, NOW)).lowered).toHaveLength(1);
    expect(await db.remoteConfig()).toEqual([expect.objectContaining({ on: false, pct: 10 })]);
    // the owner moved pct (to 10) after the read of pct 50: nothing is written
    await db.putRemoteConfig(flag({ pct: 10, reason: 'owner 10' }));
    vi.spyOn(db, 'remoteConfig').mockResolvedValueOnce([flag()]);
    expect(await runGuardrailEvaluator(db, NOW)).toMatchObject({ lowered: [], deferred: ['dailyReview'] });
    expect(await db.remoteConfig()).toEqual([flag({ pct: 10, reason: 'owner 10' })]);
  });
});
