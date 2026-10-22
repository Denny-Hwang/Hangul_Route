import { BackupFileSchema, ProgressSnapshotSchema, type ProgressSnapshot, type SessionLog } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mergeSnapshots } from '../../sync/merge';
import { withPoints } from '../points';
import { latchSteadyWeeks, steadyWeekCount, weeklyTarget, type LatchInput } from '../steady-weeks';

/*
 * The steady-weeks latch (F-CURR-002 sections 4.8 and 7.4, OD-6, row CM-17; the CM-17 tests listed in
 * design/wireframes/home/goal-ring-weekly-dots.md "Data needs"). The suite runs under TZ=UTC.
 */

const MON = '2026-10-19';
const day = (offset: number, from = MON) => new Date(Date.parse(`${from}T00:00:00.000Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const AT = '2026-10-25T12:00:00.000Z';

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}
const logOf = (days: string[], key = 'ik-a') => days.reduce((log, d) => withPoints(log, d, key, 3), {} as NonNullable<ProgressSnapshot['dayLog']>);
const input = (snap: ProgressSnapshot, today: string, over: Partial<LatchInput> = {}): LatchInput => ({
  snapshot: snap,
  today,
  at: AT,
  goalsSetDay: snap.goals ? snap.goals.setAt.slice(0, 10) : undefined,
  planDays: null,
  ...over,
});
const goals = (weeklyDays: 3 | 5 | 7, setAt = '2026-09-01T00:00:00.000Z') => ({ daily: 3 as const, weeklyDays, setAt });

describe('latchSteadyWeeks', () => {
  it('latches the current week when its learned days reach 3 (the default), once', () => {
    const two = snapshot({ dayLog: logOf([day(0), day(2)]) });
    expect(latchSteadyWeeks(input(two, day(2))).added).toEqual([]);
    const three = snapshot({ dayLog: logOf([day(0), day(2), day(4)]) });
    const first = latchSteadyWeeks(input(three, day(4)));
    expect(first.added).toEqual([{ week: MON, days: 3, target: 3 }]);
    expect(first.steadyWeeks).toEqual({ [MON]: AT });
    // Idempotent: a second run adds nothing and returns the stored record itself.
    const again = latchSteadyWeeks(input({ ...three, steadyWeeks: first.steadyWeeks }, day(5)));
    expect(again.added).toEqual([]);
    expect(again.steadyWeeks).toBe(first.steadyWeeks);
  });

  it('counts session days too (a day another device logged)', () => {
    const quest = (d: string): SessionLog => ({ id: `session:${d}T09:00:00.000Z`, profileId: 'p1', startedAt: `${d}T09:00:00.000Z`, episodesTouched: [], localDay: d });
    const snap = snapshot({ sessions: [quest(day(0)), quest(day(1))], dayLog: logOf([day(3)]) });
    expect(latchSteadyWeeks(input(snap, day(3))).added).toHaveLength(1);
  });

  it('a steady week 71 days old still counts: the latch is kept after dayLog drops the week', () => {
    let snap = snapshot({ goals: goals(3), dayLog: logOf([day(0), day(1), day(2)]) });
    snap = { ...snap, steadyWeeks: latchSteadyWeeks(input(snap, day(2))).steadyWeeks };
    // 75 more learned days push the week out of the 70-day log.
    const later = Array.from({ length: 75 }, (_, i) => day(7 + i));
    snap = { ...snap, dayLog: logOf(later) };
    expect(Object.keys(snap.dayLog ?? {})).not.toContain(day(0));
    const result = latchSteadyWeeks(input(snap, later[later.length - 1] as string));
    expect(result.steadyWeeks?.[MON]).toBe(AT);
    expect(steadyWeekCount({ steadyWeeks: result.steadyWeeks })).toBeGreaterThanOrEqual(11);
  });

  it('raising weeklyDays from 3 to 7 keeps every latched week; the current week is judged at 7 from then on', () => {
    const latched = { [day(-14)]: AT, [day(-7)]: AT };
    const snap = snapshot({ goals: goals(7, '2026-10-19T08:00:00.000Z'), steadyWeeks: latched, dayLog: logOf([day(-14), day(-13), day(-12), day(0), day(1), day(2)]) });
    const result = latchSteadyWeeks(input(snap, day(2)));
    expect(result.added).toEqual([]);
    expect(result.steadyWeeks).toBe(latched);
    expect(steadyWeekCount({ steadyWeeks: result.steadyWeeks })).toBe(2);
  });

  it('lowering the weekly days to the days already learned latches the week when the goal is saved', () => {
    const snap = snapshot({ goals: goals(5), dayLog: logOf([day(0), day(1), day(2)]) });
    expect(latchSteadyWeeks(input(snap, day(3))).added).toEqual([]);
    const lowered = { ...snap, goals: goals(3, '2026-10-22T09:00:00.000Z') };
    expect(latchSteadyWeeks(input(lowered, day(3))).added).toEqual([{ week: MON, days: 3, target: 3 }]);
  });

  it('an earlier week is judged only against goals set before it ended; otherwise it is never judged late', () => {
    // Last week had 3 learned days and was never latched (another device added them).
    const days = [day(-7), day(-6), day(-5)];
    const before = snapshot({ goals: goals(3, '2026-10-01T00:00:00.000Z'), dayLog: logOf(days) });
    expect(latchSteadyWeeks(input(before, day(1))).added).toEqual([{ week: day(-7), days: 3, target: 3 }]);
    const setAfter = snapshot({ goals: goals(3, '2026-10-20T00:00:00.000Z'), dayLog: logOf(days) });
    expect(latchSteadyWeeks(input(setAfter, day(1))).added).toEqual([]);
    const none = snapshot({ dayLog: logOf(days) });
    expect(latchSteadyWeeks(input(none, day(1))).added).toEqual([]);
  });

  it("with a weekly plan on, the plan's days are the target of the current week", () => {
    const snap = snapshot({ goals: goals(3), dayLog: logOf([day(0), day(1), day(2)]) });
    expect(latchSteadyWeeks(input(snap, day(3), { planDays: 4 })).added).toEqual([]);
    expect(latchSteadyWeeks(input(snap, day(3), { planDays: 2 })).added).toEqual([{ week: MON, days: 3, target: 2 }]);
    expect(weeklyTarget(goals(5), null)).toBe(5);
    expect(weeklyTarget(undefined, null)).toBe(3);
    expect(weeklyTarget(goals(5), 4)).toBe(4);
    expect(weeklyTarget(goals(5), 0)).toBe(5);
  });

  it('a day later than today (a wrong clock) never counts, and a future week is never judged', () => {
    const snap = snapshot({ dayLog: logOf([day(0), day(1), day(9), day(10), day(11)]) });
    expect(latchSteadyWeeks(input(snap, day(2))).added).toEqual([]);
  });
});

describe('the count never drops (merge, restore, a device that never latched)', () => {
  it('two devices with 2 learned days each and a 3-day goal latch the week after they sync, and the count rises by exactly 1', () => {
    const phone = snapshot({ goals: goals(3), dayLog: logOf([day(0), day(1)], 'ik-phone'), steadyWeeks: { [day(-7)]: AT } });
    const tablet = snapshot({ goals: goals(3), dayLog: logOf([day(2), day(3)], 'ik-tablet') });
    expect(latchSteadyWeeks(input(phone, day(3))).added).toEqual([]);
    expect(latchSteadyWeeks(input(tablet, day(3))).added).toEqual([]);
    const merged = mergeSnapshots(phone, tablet, { now: new Date(AT), today: day(3) });
    const result = latchSteadyWeeks(input(merged, day(3)));
    expect(result.added).toEqual([{ week: MON, days: 4, target: 3 }]);
    expect(steadyWeekCount({ steadyWeeks: result.steadyWeeks }) - steadyWeekCount(phone)).toBe(1);
  });

  it('a sync from a device that never latched a week keeps it', () => {
    const mine = snapshot({ steadyWeeks: { [day(-7)]: AT, [MON]: AT } });
    const other = snapshot({ dayLog: logOf([day(0)]) });
    expect(steadyWeekCount(mergeSnapshots(mine, other, { now: new Date(AT), today: day(3) }))).toBe(2);
    expect(steadyWeekCount(mergeSnapshots(other, mine, { now: new Date(AT), today: day(3) }))).toBe(2);
  });

  it('a restore from a backup keeps the count', () => {
    const snap = snapshot({ profileId: 'profile:one', steadyWeeks: { [day(-14)]: AT, [day(-7)]: AT, [MON]: AT } });
    const file = BackupFileSchema.parse({
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: AT,
      profile: { id: 'profile:one', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', createdAt: '2026-09-01T00:00:00.000Z' },
      snapshot: JSON.parse(JSON.stringify(snap)),
    });
    expect(steadyWeekCount(file.snapshot)).toBe(3);
    expect(steadyWeekCount(ProgressSnapshotSchema.parse(JSON.parse(JSON.stringify(snap))))).toBe(3);
  });

  it('running the latch after any merge order gives the same weeks (fast-check)', () => {
    const daysArb = fc.uniqueArray(fc.integer({ min: -20, max: 6 }), { maxLength: 12 }).map((ns) => ns.map((n) => day(n)));
    fc.assert(
      fc.property(daysArb, daysArb, (a, b) => {
        const today = day(6);
        const latch = (s: ProgressSnapshot) => ({ ...s, steadyWeeks: latchSteadyWeeks(input(s, today)).steadyWeeks });
        const pa = latch(snapshot({ goals: goals(3), dayLog: logOf(a, 'ik-a') }));
        const pb = latch(snapshot({ goals: goals(3), dayLog: logOf(b, 'ik-b') }));
        const ab = latch(mergeSnapshots(pa, pb, { now: new Date(AT), today }));
        const ba = latch(mergeSnapshots(pb, pa, { now: new Date(AT), today }));
        expect(Object.keys(ab.steadyWeeks ?? {}).sort()).toEqual(Object.keys(ba.steadyWeeks ?? {}).sort());
        for (const side of [pa, pb]) for (const week of Object.keys(side.steadyWeeks ?? {})) expect(ab.steadyWeeks?.[week]).toBeDefined();
      }),
      { numRuns: 200 },
    );
  });
});
