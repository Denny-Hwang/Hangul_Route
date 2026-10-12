import { addDays, isDateKey } from '../curriculum/dates';
import { REPORT_DAYS_MAX, type ActivityDay, type ActivitySummary, type ReportPeriod } from '../schemas/report';

/**
 * Report windows — F-REPORT-001 section 3.2 (RP-2a). Every date here is a learner-local `YYYY-MM-DD` day key as
 * the learner's device saw it (OD-12); the only clock is `now`, passed in. Pure: no locale, no host time zone.
 *
 * - `week` is the 7 days ending today, rolling (OD-1); `month` is the calendar month to date (OD-2).
 * - Looking back (OD-18) stays within the 35 day rows that end at `activity.asOf` and the months in
 *   `activity.months`; an older month shows totals only.
 * - Days after `asOf` are not saved yet: they count nowhere (`horizonOf`).
 */

const MINUTE_MS = 60_000;

/** The learner-local day of `now` for a learner `tz` minutes east of UTC (`activity.tz`). */
export function todayFor(now: Date, tz: number): string {
  return new Date(now.getTime() + tz * MINUTE_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM` of a day key. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** The first of the 35 days the day rows cover: they end at `asOf` (section 3.3.4 step 7). */
export function rowsFromOf(asOf: string): string {
  return addDays(asOf, -(REPORT_DAYS_MAX - 1));
}

const monthStart = (month: string): string => `${month}-01`;
const addMonths = (month: string, n: number): string => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, '0')}-${String(index - year * 12 + 1).padStart(2, '0')}`;
};
const monthEnd = (month: string): string => addDays(monthStart(addMonths(month, 1)), -1);

/** A day key the URL may carry: a real calendar day, never after today. */
const pastOrToday = (at: string | null | undefined, today: string): at is string => typeof at === 'string' && isDateKey(at) && at <= today;

export interface ReportWindow {
  period: ReportPeriod;
  /** First day of the window. */
  from: string;
  /** Last day of the window, included. */
  to: string;
  /** The window the up-only marker compares with (`week`, `month`). */
  prevFrom?: string;
  prevTo?: string;
  /** A month that starts before the day rows: figures from `activity.months` only, no calendar, no letters. */
  totalsOnly: boolean;
}

export interface WindowOptions {
  /** The first day the day rows cover (`rowsFromOf(asOf)`); by default the 35 days ending today. */
  rowsFrom?: string;
  /** `all`: the first practice day; today when there is none. */
  since?: string | null;
}

/**
 * The window of `period` that ends at `at` (`day`, `week`) or holds it (`month`); the current window when `at` is
 * absent, malformed or after today. `at` is trusted otherwise: `clampAt` keeps it within the saved rows first.
 */
export function windowOf(period: ReportPeriod, today: string, at?: string | null, opts: WindowOptions = {}): ReportWindow {
  const target = pastOrToday(at, today) ? at : today;
  if (period === 'day') return { period, from: target, to: target, totalsOnly: false };
  if (period === 'week') {
    const from = addDays(target, -6);
    return { period, from, to: target, prevFrom: addDays(from, -7), prevTo: addDays(from, -1), totalsOnly: false };
  }
  if (period === 'month') {
    const month = monthOf(target);
    const from = monthStart(month);
    const prev = addMonths(month, -1);
    return {
      period,
      from,
      to: month === monthOf(today) ? today : monthEnd(month),
      prevFrom: monthStart(prev),
      prevTo: monthEnd(prev),
      totalsOnly: from < (opts.rowsFrom ?? rowsFromOf(today)),
    };
  }
  const since = opts.since ?? today;
  return { period, from: since < today ? since : today, to: today, totalsOnly: false };
}

/** Months before this one that have activity, ascending (`activity.months` is ascending with no repeats). */
const pastMonths = (activity: ActivitySummary, today: string): string[] => {
  const current = monthOf(today);
  return activity.months.map((row) => row.m).filter((month) => month < current);
};

/**
 * `at` as a URL carries it, within the stepper's limits (OD-18), or null for the current window. `day`: one of the
 * 35 days that end at `asOf`, or an unsaved day after it; `week`: a week whose 7 days are all within the same
 * limits; `month`: a month in `activity.months` before this one, as its first day; `all`: never. Anything else
 * (malformed, out of the limits, the current window itself) is null (section 3.2).
 */
export function clampAt(period: ReportPeriod, today: string, at: string | null | undefined, activity: ActivitySummary): string | null {
  if (!pastOrToday(at, today) || at === today) return null;
  const rowsFrom = rowsFromOf(activity.asOf);
  if (period === 'day') return at >= rowsFrom ? at : null;
  if (period === 'week') return addDays(at, -6) >= rowsFrom ? at : null;
  if (period === 'month') return pastMonths(activity, today).includes(monthOf(at)) ? monthStart(monthOf(at)) : null;
  return null;
}

/** Where a stepper button goes: `at: null` is the current window (no `at` in the URL). */
export interface ReportStep {
  at: string | null;
}

/**
 * Previous / Next from the window at `at` (null: the current window). Null when there is no step that way, so the
 * button is hidden: Next on the current window, Previous past the saved rows or the oldest month with activity.
 */
export function stepOf(period: ReportPeriod, today: string, at: string | null, dir: 'prev' | 'next', activity: ActivitySummary): ReportStep | null {
  if (period === 'all' || (dir === 'next' && at === null)) return null;
  if (period === 'month') {
    const current = at === null ? monthOf(today) : monthOf(at);
    const months = pastMonths(activity, today);
    if (dir === 'prev') {
      const earlier = months.filter((month) => month < current);
      const pick = earlier[earlier.length - 1];
      return pick === undefined ? null : { at: monthStart(pick) };
    }
    const later = months.find((month) => month > current);
    return { at: later === undefined ? null : monthStart(later) };
  }
  const size = period === 'day' ? 1 : 7;
  const end = at ?? today;
  if (dir === 'next') {
    const next = addDays(end, size);
    return { at: next >= today ? null : next };
  }
  const prev = addDays(end, -size);
  return addDays(prev, -(size - 1)) >= rowsFromOf(activity.asOf) ? { at: prev } : null;
}

export interface ReportHorizon {
  /** The device's local today when it last computed the summary. */
  asOf: string;
  /** The window reaches past `asOf`: "Figures up to {date}." */
  partial: boolean;
  /** The last day that counts: the window's end or `asOf`, whichever is earlier. */
  upTo: string;
  /** At least one day of the window is saved; false: "Nothing saved ... yet." */
  saved: boolean;
}

/** The data horizon of a window (section 3.2): days after `asOf` count in no figure, headline or comparison. */
export function horizonOf(window: Pick<ReportWindow, 'from' | 'to'>, asOf: string): ReportHorizon {
  return { asOf, partial: window.to > asOf, upTo: window.to < asOf ? window.to : asOf, saved: window.from <= asOf };
}

export interface DaySums {
  /** Practice days: rows in the window (a row is a day with any activity, minutes may be 0). */
  days: number;
  min: number;
  q: number;
  c: number;
  w: number;
  /** Letters that became strong in the window (`j`). */
  letters: number;
}

const inRange = (row: ActivityDay, from: string, to: string): boolean => row.d >= from && row.d <= to;

/** The day rows of `from`..`to` (both included), summed. */
export function sumDays(days: readonly ActivityDay[], from: string, to: string): DaySums {
  const out: DaySums = { days: 0, min: 0, q: 0, c: 0, w: 0, letters: 0 };
  for (const row of days) {
    if (!inRange(row, from, to)) continue;
    out.days += 1;
    out.min += row.min;
    out.q += row.q;
    out.c += row.c;
    out.w += row.w;
    out.letters += row.j.length;
  }
  return out;
}

/** Practice days in `from`..`to` (section 3.2: a session started, a first finish, a card or a first word). */
export function practiceDaysIn(days: readonly ActivityDay[], from: string, to: string): number {
  return days.filter((row) => inRange(row, from, to)).length;
}

/**
 * The report's "days in a row" (W9, OD-12): consecutive local practice days ending at `asOf`, or at the day before
 * when `asOf` has no practice yet, so it always agrees with the calendar on the same page.
 */
export function localRunEndingAt(days: readonly ActivityDay[], asOf: string): number {
  const practiced = new Set(days.map((row) => row.d));
  let day = practiced.has(asOf) ? asOf : addDays(asOf, -1);
  let run = 0;
  while (practiced.has(day)) {
    run += 1;
    day = addDays(day, -1);
  }
  return run;
}
