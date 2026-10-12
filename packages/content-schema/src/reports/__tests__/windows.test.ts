import { describe, expect, it } from 'vitest';
import type { ActivityDay, ActivitySummary } from '../../schemas/report';
import {
  clampAt,
  firstDayOf,
  horizonOf,
  lettersIn,
  localRunEndingAt,
  monthOf,
  practiceDaysIn,
  rowsFromOf,
  shownFromOf,
  stepOf,
  sumDays,
  todayFor,
  windowOf,
} from '../windows';

/**
 * F-REPORT-001 section 3.2 (RP-2a): learner-local days, the four periods (OD-1 rolling week, OD-2 calendar month to
 * date), looking back within the saved 35 days and 24 months (OD-18), the data horizon at `asOf` and the report's
 * own "days in a row" (OD-12).
 */
const day = (d: string, over: Partial<ActivityDay> = {}): ActivityDay => ({ d, min: 0, q: 0, c: 0, w: 0, j: [], ...over });

function activity(over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    v: 1,
    tz: 0,
    asOf: '2026-10-15',
    days: [],
    months: [],
    // A family or device copy knows the first practice day; a class copy (RP-W2) has none.
    total: { since: '2026-01-04', min: 5, q: 0, c: 0, w: 0, days: 1 },
    milestones: [],
    ...over,
  };
}

describe('todayFor: the learner-local day of the viewer clock', () => {
  it('shifts by the offset, minutes east of UTC', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    expect(todayFor(now, 0)).toBe('2026-10-15');
    expect(todayFor(now, 540)).toBe('2026-10-15');
    expect(todayFor(now, 720)).toBe('2026-10-16');
    expect(todayFor(now, -720)).toBe('2026-10-15');
    expect(todayFor(now, -721)).toBe('2026-10-14');
  });

  it('covers every offset the schema allows, -840 to 840', () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    for (let tz = -840; tz <= 840; tz += 15) {
      expect(todayFor(now, tz)).toBe(tz < 0 ? '2026-10-14' : '2026-10-15');
    }
    const late = new Date('2026-10-15T23:59:59.999Z');
    for (let tz = -840; tz <= 840; tz += 15) {
      expect(todayFor(late, tz)).toBe(tz > 0 ? '2026-10-16' : '2026-10-15');
    }
  });

  it('turns over at local midnight, not before', () => {
    // Seoul, UTC+9: local midnight of 16 October is 15:00 UTC on the 15th.
    expect(todayFor(new Date('2026-10-15T14:59:59.999Z'), 540)).toBe('2026-10-15');
    expect(todayFor(new Date('2026-10-15T15:00:00.000Z'), 540)).toBe('2026-10-16');
    // Los Angeles in daylight time, UTC-7.
    expect(todayFor(new Date('2026-10-16T06:59:59.999Z'), -420)).toBe('2026-10-15');
    expect(todayFor(new Date('2026-10-16T07:00:00.000Z'), -420)).toBe('2026-10-16');
    // Across a year end.
    expect(todayFor(new Date('2026-12-31T20:00:00.000Z'), 300)).toBe('2027-01-01');
  });

  it('throws on an invalid Date: a caller checks an untrusted clock first (learnerReport does)', () => {
    expect(() => todayFor(new Date(Number.NaN), 0)).toThrow(RangeError);
    expect(() => todayFor(new Date('not a time'), 540)).toThrow(RangeError);
  });
});

describe('monthOf and rowsFromOf', () => {
  it('names the month of a day', () => {
    expect(monthOf('2026-10-15')).toBe('2026-10');
    expect(monthOf('2027-01-01')).toBe('2027-01');
  });

  it('gives the first of the 35 days that end at asOf', () => {
    expect(rowsFromOf('2026-10-15')).toBe('2026-09-11');
    expect(rowsFromOf('2026-03-01')).toBe('2026-01-26');
  });
});

describe('windowOf: the four periods', () => {
  const today = '2026-10-15';

  it('day: the day itself, no previous window', () => {
    expect(windowOf('day', today)).toEqual({ period: 'day', from: today, to: today, totalsOnly: false });
    expect(windowOf('day', today, '2026-10-14')).toEqual({ period: 'day', from: '2026-10-14', to: '2026-10-14', totalsOnly: false });
  });

  it('week: the 7 days ending today, rolling (OD-1), with the 7 before as the previous window', () => {
    expect(windowOf('week', today)).toEqual({
      period: 'week',
      from: '2026-10-09',
      to: '2026-10-15',
      prevFrom: '2026-10-02',
      prevTo: '2026-10-08',
      totalsOnly: false,
    });
    expect(windowOf('week', today, '2026-10-08')).toMatchObject({ from: '2026-10-02', to: '2026-10-08', prevFrom: '2026-09-25', prevTo: '2026-10-01' });
  });

  it('month: the calendar month to date (OD-2), the whole previous month as the previous window', () => {
    expect(windowOf('month', today)).toEqual({
      period: 'month',
      from: '2026-10-01',
      to: '2026-10-15',
      prevFrom: '2026-09-01',
      prevTo: '2026-09-30',
      totalsOnly: false,
    });
  });

  it('month in the past: the whole month; totals only once it starts before the day rows', () => {
    expect(windowOf('month', today, '2026-09-20')).toEqual({
      period: 'month',
      from: '2026-09-01',
      to: '2026-09-30',
      prevFrom: '2026-08-01',
      prevTo: '2026-08-31',
      totalsOnly: true,
    });
    // The day rows of a device whose last day is 2 October reach back to 29 August: September is drawn day by day.
    expect(windowOf('month', today, '2026-09-20', activity({ asOf: '2026-10-02' })).totalsOnly).toBe(false);
    expect(windowOf('month', '2026-10-05', '2026-09-03').totalsOnly).toBe(false);
  });

  it('month boundaries: January reaches back to December, February ends on its last day', () => {
    expect(windowOf('month', '2027-01-10')).toMatchObject({ from: '2027-01-01', to: '2027-01-10', prevFrom: '2026-12-01', prevTo: '2026-12-31' });
    expect(windowOf('month', '2027-03-31', '2027-02-14')).toMatchObject({ from: '2027-02-01', to: '2027-02-28', prevFrom: '2027-01-01', prevTo: '2027-01-31' });
  });

  it('leap day: February 2028 has 29 days, and a week can straddle it', () => {
    expect(windowOf('month', '2028-03-10', '2028-02-29')).toMatchObject({ from: '2028-02-01', to: '2028-02-29' });
    expect(windowOf('week', '2028-03-02')).toMatchObject({ from: '2028-02-25', to: '2028-03-02' });
    expect(windowOf('day', '2028-03-02', '2028-02-29')).toMatchObject({ from: '2028-02-29', to: '2028-02-29' });
  });

  it('all: from the first day the report holds to today; today when there is none', () => {
    const since = (day: string | null): ActivitySummary => activity({ total: { since: day, min: 5, q: 0, c: 0, w: 0, days: 1 } });
    expect(windowOf('all', today, undefined, since('2026-03-04'))).toEqual({ period: 'all', from: '2026-03-04', to: today, totalsOnly: false });
    expect(windowOf('all', today, '2026-09-01', since(null))).toEqual({ period: 'all', from: today, to: today, totalsOnly: false });
    expect(windowOf('all', today).from).toBe(today);
    // A class view: the first day its copy holds anything, never since (it may lie before the learner joined).
    expect(windowOf('all', today, undefined, activity({ days: [day('2026-10-12')], total: { since: null, min: 5, q: 0, c: 0, w: 0, days: 9 } }), true).from).toBe('2026-10-12');
    expect(windowOf('all', today, undefined, activity({ days: [day('2026-10-12')], total: { since: '2026-03-04', min: 5, q: 0, c: 0, w: 0, days: 9 } }), true).from).toBe('2026-10-12');
    expect(windowOf('all', today, undefined, since('2026-03-04'), true).from).toBe(today);
    // A first day after today (a device clock ahead) never makes the window run backwards.
    expect(windowOf('all', today, undefined, since('2026-10-20')).from).toBe(today);
  });

  it('month: a class draws the month it joined in day by day while the rows cover the days it sees', () => {
    // A class that sees the learner from 10 October; on 3 November the rows reach back to 30 September.
    const joined = activity({ asOf: '2026-11-03', days: [day('2026-10-12'), day('2026-11-02')], total: { since: null, min: 9, q: 1, c: 0, w: 0, days: 30 } });
    expect(windowOf('month', '2026-11-03', '2026-10-15', joined, true).totalsOnly).toBe(false);
    // On 20 November the rows start on 17 October, after the first day the class sees: totals only (and no row).
    const later = { ...joined, asOf: '2026-11-20' };
    expect(windowOf('month', '2026-11-20', '2026-10-15', later, true).totalsOnly).toBe(true);
  });

  it('an at that is malformed, not a real day or after today reads as the current window', () => {
    for (const at of ['2026-10-16', '2026-02-30', 'yesterday', '', '2026-1-05', null, undefined]) {
      expect(windowOf('week', today, at)).toEqual(windowOf('week', today));
    }
  });
});

describe('firstDayOf and shownFromOf: where a report may start', () => {
  const today = '2026-10-15';

  it('the first practice day when the activity knows it', () => {
    expect(firstDayOf(activity({ total: { since: '2026-03-04', min: 9, q: 1, c: 0, w: 0, days: 3 } }))).toBe('2026-03-04');
  });

  it('a class copy (no since): the oldest day row, month or milestone it holds', () => {
    const clipped = activity({
      days: [day('2026-10-12')],
      months: [{ m: '2026-10', min: 9, q: 1, c: 0, w: 0, days: 1 }],
      milestones: [{ stage: 'stage1', on: '2026-10-11' }],
      total: { since: null, min: 90, q: 9, c: 3, w: 0, days: 20 },
    });
    expect(firstDayOf(clipped)).toBe('2026-10-01');
    const noSince = { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 };
    expect(firstDayOf(activity({ milestones: [{ stage: 'stage1', on: '2026-10-11' }], total: noSince }))).toBe('2026-10-11');
    expect(firstDayOf(activity({ total: noSince }))).toBeNull();
  });

  it('the first of the 35 day rows, or for a class copy the first day it shows anything', () => {
    expect(shownFromOf(activity({ total: { since: '2026-03-04', min: 9, q: 1, c: 0, w: 0, days: 3 } }), today)).toBe('2026-09-11');
    // A class that sees the learner from 12 October on.
    expect(shownFromOf(activity({ days: [day('2026-10-12')], total: { since: null, min: 90, q: 9, c: 3, w: 0, days: 20 } }), today, true)).toBe('2026-10-12');
    // A class that has seen the learner for months: the day rows bound it.
    expect(shownFromOf(activity({ months: [{ m: '2026-05', min: 9, q: 1, c: 0, w: 0, days: 1 }], total: { since: null, min: 9, q: 1, c: 0, w: 0, days: 1 } }), today, true)).toBe('2026-09-11');
    // A class that sees nothing yet: today.
    expect(shownFromOf(activity({ total: { since: null, min: 90, q: 9, c: 3, w: 0, days: 20 } }), today, true)).toBe(today);
  });

  it('the floor follows who is viewing, never the shape of the data', () => {
    // A class copy that carries since (an older projection): still floored at the first day it holds.
    expect(shownFromOf(activity({ days: [day('2026-10-12')], total: { since: '2026-03-04', min: 90, q: 9, c: 3, w: 0, days: 20 } }), today, true)).toBe('2026-10-12');
    // A family copy without since (a device that never wrote it) but with day rows: never floored.
    expect(shownFromOf(activity({ days: [day('2026-10-12')], total: { since: null, min: 90, q: 9, c: 3, w: 0, days: 20 } }), today)).toBe('2026-09-11');
  });
});

describe('clampAt: looking back stays within the saved 35 days and 24 months (OD-18)', () => {
  const today = '2026-10-15';
  const a = activity({ asOf: today, months: [{ m: '2026-05', min: 9, q: 1, c: 0, w: 0, days: 2 }, { m: '2026-08', min: 9, q: 1, c: 0, w: 0, days: 2 }, { m: '2026-10', min: 9, q: 1, c: 0, w: 0, days: 2 }] });

  it('day: any of the 35 days ending at asOf; today itself is the current window', () => {
    expect(clampAt('day', today, '2026-10-14', a)).toBe('2026-10-14');
    expect(clampAt('day', today, '2026-09-11', a)).toBe('2026-09-11');
    expect(clampAt('day', today, '2026-09-10', a)).toBeNull();
    expect(clampAt('day', today, today, a)).toBeNull();
    expect(clampAt('day', today, '2026-10-16', a)).toBeNull();
  });

  it('day: a stale device keeps its own 35 days, and the unsaved days after asOf stay reachable', () => {
    const stale = activity({ asOf: '2026-10-11' });
    expect(clampAt('day', today, '2026-10-13', stale)).toBe('2026-10-13');
    expect(clampAt('day', today, '2026-09-07', stale)).toBe('2026-09-07');
    expect(clampAt('day', today, '2026-09-06', stale)).toBeNull();
  });

  it('week: the 7 days ending at at must lie within the same 35 days', () => {
    expect(clampAt('week', today, '2026-10-08', a)).toBe('2026-10-08');
    expect(clampAt('week', today, '2026-09-17', a)).toBe('2026-09-17');
    expect(clampAt('week', today, '2026-09-16', a)).toBeNull();
    expect(clampAt('week', today, today, a)).toBeNull();
  });

  it('month: a month in activity.months before this one, as its first day; anything else is the current month', () => {
    expect(clampAt('month', today, '2026-08-20', a)).toBe('2026-08-01');
    expect(clampAt('month', today, '2026-05-31', a)).toBe('2026-05-01');
    expect(clampAt('month', today, '2026-09-10', a)).toBeNull();
    expect(clampAt('month', today, '2026-10-02', a)).toBeNull();
  });

  it('a class never steps into days before it sees the learner', () => {
    const clipped = activity({ asOf: today, days: [day('2026-10-12')], total: { since: null, min: 90, q: 9, c: 3, w: 0, days: 20 } });
    expect(clampAt('day', today, '2026-10-12', clipped, true)).toBe('2026-10-12');
    expect(clampAt('day', today, '2026-10-11', clipped, true)).toBeNull();
    expect(clampAt('week', today, '2026-10-08', clipped, true)).toBeNull();
    expect(stepOf('day', today, '2026-10-12', 'prev', clipped, true)).toBeNull();
    expect(stepOf('day', today, '2026-10-13', 'prev', clipped, true)).toEqual({ at: '2026-10-12' });
    expect(stepOf('week', today, null, 'prev', clipped, true)).toBeNull();
    // The same copy read by a family (no since, rows): the whole 35 days stay reachable.
    expect(clampAt('day', today, '2026-10-11', clipped)).toBe('2026-10-11');
    expect(clampAt('week', today, '2026-10-08', clipped)).toBe('2026-10-08');
    expect(stepOf('week', today, null, 'prev', clipped)).toEqual({ at: '2026-10-08' });
  });

  it('month: a month with no row is reachable while the day rows draw it whole', () => {
    // A family that did not practice in September; on 3 October the rows reach back to 30 August.
    const quietSeptember = activity({ asOf: '2026-10-03', months: [{ m: '2026-08', min: 9, q: 1, c: 0, w: 0, days: 1 }] });
    expect(stepOf('month', '2026-10-03', null, 'prev', quietSeptember)).toEqual({ at: '2026-09-01' });
    expect(stepOf('month', '2026-10-03', '2026-09-01', 'prev', quietSeptember)).toEqual({ at: '2026-08-01' });
    expect(clampAt('month', '2026-10-03', '2026-09-30', quietSeptember)).toBe('2026-09-01');
    // On 15 October the rows no longer draw September whole, and it has no row: not reachable.
    expect(stepOf('month', today, null, 'prev', { ...quietSeptember, asOf: today })).toEqual({ at: '2026-08-01' });
    expect(clampAt('month', today, '2026-09-30', { ...quietSeptember, asOf: today })).toBeNull();
  });

  it('month: a class reaches the month it joined in while the rows cover it, though the class copy has no row for it', () => {
    const joined = activity({ asOf: '2026-11-03', days: [day('2026-10-12'), day('2026-11-02')], months: [{ m: '2026-11', min: 9, q: 1, c: 0, w: 0, days: 1 }], total: { since: null, min: 9, q: 1, c: 0, w: 0, days: 30 } });
    expect(stepOf('month', '2026-11-03', null, 'prev', joined, true)).toEqual({ at: '2026-10-01' });
    expect(stepOf('month', '2026-11-03', '2026-10-01', 'prev', joined, true)).toBeNull();
    expect(clampAt('month', '2026-11-03', '2026-10-20', joined, true)).toBe('2026-10-01');
  });

  it('all has no stepper; a malformed at is the current window', () => {
    expect(clampAt('all', today, '2026-10-14', a)).toBeNull();
    for (const at of ['2026-02-30', 'x', null, undefined]) expect(clampAt('day', today, at, a)).toBeNull();
  });
});

describe('stepOf: Previous and Next', () => {
  const today = '2026-10-15';
  const a = activity({ asOf: today });

  it('day: back one day at a time to the first saved row; Next returns to the current window', () => {
    expect(stepOf('day', today, null, 'prev', a)).toEqual({ at: '2026-10-14' });
    expect(stepOf('day', today, '2026-10-14', 'prev', a)).toEqual({ at: '2026-10-13' });
    expect(stepOf('day', today, '2026-09-12', 'prev', a)).toEqual({ at: '2026-09-11' });
    expect(stepOf('day', today, '2026-09-11', 'prev', a)).toBeNull();
    expect(stepOf('day', today, '2026-10-13', 'next', a)).toEqual({ at: '2026-10-14' });
    expect(stepOf('day', today, '2026-10-14', 'next', a)).toEqual({ at: null });
  });

  it('Next is hidden on the current window (no step past today)', () => {
    for (const period of ['day', 'week', 'month', 'all'] as const) expect(stepOf(period, today, null, 'next', a)).toBeNull();
  });

  it('week: back 7 days at a time while the whole week is within the 35 days', () => {
    expect(stepOf('week', today, null, 'prev', a)).toEqual({ at: '2026-10-08' });
    expect(stepOf('week', today, '2026-10-08', 'prev', a)).toEqual({ at: '2026-10-01' });
    expect(stepOf('week', today, '2026-09-24', 'prev', a)).toEqual({ at: '2026-09-17' });
    expect(stepOf('week', today, '2026-09-17', 'prev', a)).toBeNull();
    expect(stepOf('week', today, '2026-10-01', 'next', a)).toEqual({ at: '2026-10-08' });
    expect(stepOf('week', today, '2026-10-08', 'next', a)).toEqual({ at: null });
    // An at off the weekly grid steps by 7 too, and a step that would reach today is the current window.
    expect(stepOf('week', today, '2026-10-12', 'next', a)).toEqual({ at: null });
  });

  it('month: to the months that have activity, skipping empty ones; Next back to this month', () => {
    const months = activity({
      asOf: today,
      months: [
        { m: '2026-05', min: 9, q: 1, c: 0, w: 0, days: 2 },
        { m: '2026-08', min: 9, q: 1, c: 0, w: 0, days: 2 },
        { m: '2026-10', min: 9, q: 1, c: 0, w: 0, days: 2 },
      ],
    });
    expect(stepOf('month', today, null, 'prev', months)).toEqual({ at: '2026-08-01' });
    expect(stepOf('month', today, '2026-08-01', 'prev', months)).toEqual({ at: '2026-05-01' });
    expect(stepOf('month', today, '2026-05-01', 'prev', months)).toBeNull();
    expect(stepOf('month', today, '2026-05-01', 'next', months)).toEqual({ at: '2026-08-01' });
    expect(stepOf('month', today, '2026-08-01', 'next', months)).toEqual({ at: null });
    expect(stepOf('month', today, null, 'prev', activity({ asOf: today }))).toBeNull();
  });

  it('month: never further back than the 24 months a device keeps', () => {
    const months = Array.from({ length: 24 }, (_, i) => {
      const index = 2026 * 12 + 9 - 23 + i;
      return { m: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`, min: 5, q: 1, c: 0, w: 0, days: 1 };
    });
    expect(months[0]?.m).toBe('2024-11');
    expect(months[23]?.m).toBe('2026-10');
    const full = activity({ asOf: today, months });
    let at: string | null = null;
    let steps = 0;
    for (let step = stepOf('month', today, at, 'prev', full); step !== null; step = stepOf('month', today, at, 'prev', full)) {
      at = step.at;
      steps += 1;
    }
    expect(steps).toBe(23);
    expect(at).toBe('2024-11-01');
    expect(clampAt('month', today, '2024-10-15', full)).toBeNull();
    expect(clampAt('month', today, '2024-11-15', full)).toBe('2024-11-01');
  });

  it('all has no stepper', () => {
    expect(stepOf('all', today, null, 'prev', a)).toBeNull();
  });
});

describe('horizonOf: the data stop at asOf', () => {
  it('a window that ends by asOf is whole', () => {
    expect(horizonOf(windowOf('week', '2026-10-15'), '2026-10-15')).toEqual({ asOf: '2026-10-15', partial: false, upTo: '2026-10-15', saved: true });
    expect(horizonOf(windowOf('week', '2026-10-15', '2026-10-08'), '2026-10-12')).toEqual({ asOf: '2026-10-12', partial: false, upTo: '2026-10-08', saved: true });
  });

  it('a window that reaches past asOf is partial and counts up to asOf', () => {
    expect(horizonOf(windowOf('week', '2026-10-15'), '2026-10-11')).toEqual({ asOf: '2026-10-11', partial: true, upTo: '2026-10-11', saved: true });
  });

  it('a window wholly after asOf has nothing saved yet', () => {
    expect(horizonOf(windowOf('day', '2026-10-15'), '2026-10-11')).toEqual({ asOf: '2026-10-11', partial: true, upTo: '2026-10-11', saved: false });
  });
});

describe('sumDays, practiceDaysIn and lettersIn', () => {
  const days = [
    day('2026-10-01', { min: 5, q: 1, j: ['ㄱ'] }),
    day('2026-10-09', { min: 12, q: 1, c: 1, w: 2, j: ['ㄴ', 'ㄷ'] }),
    day('2026-10-12', { min: 0 }),
    day('2026-10-15', { min: 15, c: 2 }),
  ];

  it('sums the rows of a window, both ends included', () => {
    expect(sumDays(days, '2026-10-09', '2026-10-15')).toEqual({ days: 3, min: 27, q: 1, c: 3, w: 2 });
    expect(sumDays(days, '2026-10-02', '2026-10-08')).toEqual({ days: 0, min: 0, q: 0, c: 0, w: 0 });
    expect(sumDays([], '2026-10-01', '2026-10-31')).toEqual({ days: 0, min: 0, q: 0, c: 0, w: 0 });
  });

  it('counts a day with a session of 0 minutes as a practice day', () => {
    expect(practiceDaysIn(days, '2026-10-12', '2026-10-12')).toBe(1);
    expect(practiceDaysIn(days, '2026-10-01', '2026-10-31')).toBe(4);
    expect(practiceDaysIn(days, '2026-10-16', '2026-10-31')).toBe(0);
  });

  it('lists the letters that became strong, in the order learned, each once', () => {
    expect(lettersIn(days, '2026-10-01', '2026-10-31')).toEqual(['ㄱ', 'ㄴ', 'ㄷ']);
    expect(lettersIn(days, '2026-10-02', '2026-10-15')).toEqual(['ㄴ', 'ㄷ']);
    expect(lettersIn([day('2026-10-01', { j: ['ㄱ'] }), day('2026-10-02', { j: ['ㄱ', 'ㅏ'] })], '2026-10-01', '2026-10-02')).toEqual(['ㄱ', 'ㅏ']);
    expect(lettersIn(days, '2026-10-16', '2026-10-31')).toEqual([]);
  });
});

describe('localRunEndingAt: the report days in a row (W9), on local days', () => {
  it('counts back from asOf when asOf has practice', () => {
    expect(localRunEndingAt([day('2026-10-13'), day('2026-10-14'), day('2026-10-15')], '2026-10-15')).toBe(3);
  });

  it('counts back from the day before asOf when asOf has no practice yet', () => {
    expect(localRunEndingAt([day('2026-10-12'), day('2026-10-13'), day('2026-10-14')], '2026-10-15')).toBe(3);
  });

  it('stops at the first empty day, and is 0 with no recent practice', () => {
    expect(localRunEndingAt([day('2026-10-10'), day('2026-10-12'), day('2026-10-13'), day('2026-10-15')], '2026-10-15')).toBe(1);
    expect(localRunEndingAt([day('2026-10-10')], '2026-10-15')).toBe(0);
    expect(localRunEndingAt([], '2026-10-15')).toBe(0);
  });

  it('runs across a month end', () => {
    expect(localRunEndingAt([day('2026-09-29'), day('2026-09-30'), day('2026-10-01')], '2026-10-01')).toBe(3);
  });
});
