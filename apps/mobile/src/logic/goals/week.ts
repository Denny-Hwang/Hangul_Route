import { addDays, isDateKey, weekdayOf, type ProgressSnapshot } from '@hangul-route/content-schema';
import { REST_DAYS_PER_WEEK, learningDays } from '../streak';

/*
 * The week strip's days (F-CURR-002 section 7.4, OD-6; design/wireframes/home/goal-ring-weekly-dots.md). Pure.
 *
 * - The week is the ISO week on the learner's local days, Monday to Sunday in every locale, keyed by its
 *   Monday, so a UI-language switch or two devices on different locales see one week.
 * - A learned day is a local day with points in `dayLog` or a session that keeps the run (a quest, a story,
 *   a word set, a review), so a day another device added counts once its copy arrives.
 * - Rest days follow the run Home shows (CM-4, `logic/streak.ts`), so the dots and the streak number always
 *   agree:
 *   - a quiet past day between two learned days is a rest day when the run that reaches the later one holds
 *     it (the longest stretch ending there in which no local week has more than 2 rest days);
 *   - a quiet past day after the last learned day is a rest day while the run still goes on through it: the
 *     first quiet day that would be a third in a week of the run ends it and draws as a plain day, and so
 *     does every quiet day after it until the next learned day;
 *   - never before the first finished activity; never after a run has ended;
 *   - a crescent, once drawn, is never taken back (a later run starting elsewhere does not undo it);
 *   - a rest day keeps the run and adds nothing to its number.
 * - Today is never a rest day (the day is not over); a day to come is plain. A past quiet day that is not a
 *   rest day looks exactly like a day to come: never a mark, a colour or a word for a missed day.
 *
 * Day keys are `YYYY-MM-DD`; all arithmetic is on UTC day keys, so daylight saving and the host time zone
 * never move a day.
 */

/** Five quiet days in a row always put 3 in one week, so a longer gap never holds (as in `logic/streak.ts`). */
const LONGEST_REST = 2 * REST_DAYS_PER_WEEK;

/** Rest days a stretch holds per local week, with the count of weeks over the allowance. */
class WeekCounts {
  private readonly used = new Map<string, number>();
  private over = 0;

  shift(days: readonly string[], sign: 1 | -1): void {
    for (const day of days) {
      const week = weekMondayOf(day);
      const before = this.used.get(week) ?? 0;
      const after = before + sign;
      this.used.set(week, after);
      if (before <= REST_DAYS_PER_WEEK && after > REST_DAYS_PER_WEEK) this.over += 1;
      if (before > REST_DAYS_PER_WEEK && after <= REST_DAYS_PER_WEEK) this.over -= 1;
    }
  }

  holds(): boolean {
    return this.over === 0;
  }

  clear(): void {
    this.used.clear();
    this.over = 0;
  }
}

/** The days strictly between `a` and `b`. */
function between(a: string, b: string): string[] {
  const out: string[] = [];
  for (let day = addDays(a, 1); day < b; day = addDays(day, 1)) out.push(day);
  return out;
}

export type DotState = 'learned' | 'rest' | 'today' | 'plain';

export interface WeekDot {
  day: string;
  state: DotState;
}

/** The Monday that starts the ISO week holding `day`. */
export function weekMondayOf(day: string): string {
  const back = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }[weekdayOf(day)];
  return addDays(day, -back);
}

/** The 7 days of the week that starts on `monday`, Monday first. */
export function weekDaysOf(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Every learned local day of a record: days with points in `dayLog`, and days of sessions that keep the run. */
export function learnedDays(snapshot: Pick<ProgressSnapshot, 'dayLog' | 'sessions'> | undefined): Set<string> {
  const days = new Set<string>(learningDays(snapshot?.sessions ?? []));
  for (const [day, keys] of Object.entries(snapshot?.dayLog ?? {})) {
    if (isDateKey(day) && Object.values(keys).some((points) => points > 0)) days.add(day);
  }
  return days;
}

/**
 * The rest days granted before `today`, by the rule above. `runGoesOn` is whether Home shows a run today
 * (`shownStreak > 0`): a run another copy carried (`streakLocal`) can go on where the days alone would not, and
 * the quiet days since the last learned day then bridge it.
 */
export function restDaysBefore(learned: ReadonlySet<string>, today: string, runGoesOn?: boolean): Set<string> {
  const rest = new Set<string>();
  const days = [...learned].filter((d) => d < today).sort();
  if (days.length === 0) return rest;
  // Two pointers, as the run does: the stretch [days[start], days[end]] is the longest ending at `end` that holds.
  const counts = new WeekCounts();
  /**
   * The quiet days after the stretch's last learned day that the run still went on through: each was a rest day
   * on the day after it (a crescent is never taken back). Five in a row always put a third in one week, so the
   * loop ends by then. `counts` comes back as it was.
   */
  const goesOnThrough = (quiet: readonly string[]): string[] => {
    const tried: string[] = [];
    let held = 0;
    for (const day of quiet) {
      counts.shift([day], 1);
      tried.push(day);
      if (!counts.holds()) break;
      held += 1;
    }
    counts.shift(tried, -1);
    return tried.slice(0, held);
  };
  let start = 0;
  for (let end = 1; end < days.length; end += 1) {
    const gap = between(days[end - 1] as string, days[end] as string);
    for (const day of goesOnThrough(gap)) rest.add(day);
    if (gap.length > LONGEST_REST) {
      counts.clear();
      start = end;
      continue;
    }
    counts.shift(gap, 1);
    while (!counts.holds()) {
      counts.shift(between(days[start] as string, days[start + 1] as string), -1);
      start += 1;
    }
    // The run that reaches days[end] holds this gap: its quiet days are rest days.
    if (start <= end - 1) for (const day of gap) rest.add(day);
  }
  // After the last learned day: rest days while the run still goes on through them.
  const trailing = between(days[days.length - 1] as string, today);
  for (const day of runGoesOn === true ? trailing : goesOnThrough(trailing)) rest.add(day);
  return rest;
}

/** The 7 dots of the week holding `today`. */
export function weekDots(learned: ReadonlySet<string>, today: string, runGoesOn?: boolean): WeekDot[] {
  const rest = restDaysBefore(learned, today, runGoesOn);
  return weekDaysOf(weekMondayOf(today)).map((day): WeekDot => {
    if (learned.has(day) && day <= today) return { day, state: 'learned' };
    if (day === today) return { day, state: 'today' };
    if (rest.has(day)) return { day, state: 'rest' };
    return { day, state: 'plain' };
  });
}

/** How many learned days the week starting on `monday` holds, up to `today`. */
export function learnedInWeek(learned: ReadonlySet<string>, monday: string, today: string): number {
  return weekDaysOf(monday).filter((day) => day <= today && learned.has(day)).length;
}
