import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_POINTS, pointsOn, ringOf, withPoints } from '../points';
import { latchSteadyWeeks } from '../steady-weeks';
import { learnedDays, weekDots, weekMondayOf } from '../week';

/*
 * Fixed clocks in four time zones (F-CURR-002 section 14; row CM-17): goals, points, the week and rest days
 * follow the learner's local day. The suite runs under TZ=UTC; each case names its zone and its clock, and turns
 * an instant into the local day the way a device there names it.
 */

function zoned(timeZone: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (iso) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

/** A learner in `zone` who finishes a quest at each instant: the dayLog their device writes. */
function played(zone: string, instants: string[]): NonNullable<ProgressSnapshot['dayLog']> {
  const dayOf = zoned(zone);
  return instants.reduce((log, at) => withPoints(log, dayOf(at), 'ik-a', ACTIVITY_POINTS.quest), {} as NonNullable<ProgressSnapshot['dayLog']>);
}

describe('fixed clocks in four time zones (the suite runs under TZ=UTC)', () => {
  it('UTC+14 (Pacific/Kiritimati): a Sunday evening in UTC is already Monday, the first day of a new week', () => {
    const at = '2026-10-25T11:00:00.000Z';
    const today = zoned('Pacific/Kiritimati')(at);
    expect(today).toBe('2026-10-26');
    const log = played('Pacific/Kiritimati', [at]);
    expect(pointsOn(log, today)).toBe(3);
    expect(ringOf(pointsOn(log, today), 3).state).toBe('met');
    expect(weekMondayOf(today)).toBe('2026-10-26');
    expect(weekDots(learnedDays(snapshot({ dayLog: log })), today).map((d) => d.state)).toEqual(['learned', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain']);
  });

  it('UTC-12 (Etc/GMT+12): a Monday morning in UTC is still Sunday, the last day of the week before', () => {
    const at = '2026-10-26T11:00:00.000Z';
    const today = zoned('Etc/GMT+12')(at);
    expect(today).toBe('2026-10-25');
    const log = played('Etc/GMT+12', ['2026-10-21T20:00:00.000Z', '2026-10-23T20:00:00.000Z', at]);
    // Wednesday, Friday and Sunday local: the week of 19 October latches at 3 days, not the UTC week of the 26th.
    const result = latchSteadyWeeks({ snapshot: snapshot({ dayLog: log }), today, at, goalsSetDay: undefined, planDays: null });
    expect(result.added).toEqual([{ week: '2026-10-19', days: 3, target: 3 }]);
  });

  it('Asia/Seoul: a learner every morning at 08:00 learns on each local day, though each is the UTC day before', () => {
    const instants = ['2026-10-18T23:00:00.000Z', '2026-10-19T23:00:00.000Z', '2026-10-20T23:00:00.000Z'];
    const log = played('Asia/Seoul', instants);
    expect(Object.keys(log)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    const today = zoned('Asia/Seoul')('2026-10-21T01:00:00.000Z');
    expect(weekDots(learnedDays(snapshot({ dayLog: log })), today).map((d) => d.state).slice(0, 3)).toEqual(['learned', 'learned', 'learned']);
    // The goal set at 08:00 Seoul on Monday is set on Monday's local day.
    expect(zoned('Asia/Seoul')('2026-10-18T23:00:00.000Z')).toBe('2026-10-19');
  });

  it('America/Los_Angeles across the end of daylight time (1 November 2026, a 25-hour day)', () => {
    const dayOf = zoned('America/Los_Angeles');
    // 20:00 local each evening: PDT before, PST after.
    const instants = ['2026-10-31T03:00:00.000Z', '2026-11-01T03:00:00.000Z', '2026-11-02T04:00:00.000Z', '2026-11-03T04:00:00.000Z'];
    expect(instants.map(dayOf)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    const log = played('America/Los_Angeles', instants);
    const today = dayOf('2026-11-03T04:30:00.000Z');
    expect(today).toBe('2026-11-02');
    const dots = weekDots(learnedDays(snapshot({ dayLog: log })), today);
    // Monday 2 November starts a new week; the week before kept Friday, Saturday and Sunday (the 25-hour day once).
    expect(dots.map((d) => d.state)).toEqual(['learned', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain']);
    const lastWeek = latchSteadyWeeks({ snapshot: snapshot({ goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' }, dayLog: log }), today, at: '2026-11-03T04:30:00.000Z', goalsSetDay: '2026-09-30', planDays: null });
    expect(lastWeek.added).toEqual([{ week: '2026-10-26', days: 3, target: 3 }]);
  });

  it('America/Los_Angeles across the start of daylight time (8 March 2026, a 23-hour day)', () => {
    const dayOf = zoned('America/Los_Angeles');
    const instants = ['2026-03-08T07:30:00.000Z', '2026-03-09T06:30:00.000Z', '2026-03-10T15:00:00.000Z'];
    expect(instants.map(dayOf)).toEqual(['2026-03-07', '2026-03-08', '2026-03-10']);
    const log = played('America/Los_Angeles', instants);
    const today = dayOf('2026-03-11T16:00:00.000Z');
    // Saturday, Sunday (the 23-hour day), then Monday quiet (a rest day of the run) and Tuesday learned.
    expect(weekDots(learnedDays(snapshot({ dayLog: log })), today).map((d) => d.state)).toEqual(['rest', 'learned', 'today', 'plain', 'plain', 'plain', 'plain']);
  });
});
