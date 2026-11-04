import { addDays, weekdayOf } from '@hangul-route/content-schema';

/*
 * The calendar key of "This week in Korea" (F-CURR-002 §5.7 and §14, row CM-48): a drop is keyed by the Monday of the
 * ISO week that holds the learner's local day, Monday to Sunday in every locale, as `steadyWeeks` is (section 4.8), so
 * a UI-language switch or two devices on different locales show one drop. Pure and in the start bundle (Home decides
 * from it whether to load anything); arithmetic is on UTC day keys, so daylight saving and the host time zone never move
 * a day. The local day itself is the caller's (`localDay`, `useToday('local')`).
 */

const BACK = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const;

/** The Monday (`YYYY-MM-DD`) that starts the ISO week holding the local day `day`. */
export function dropWeekOf(day: string): string {
  return addDays(day, -BACK[weekdayOf(day)]);
}

/** The week key of `day` when a drop is bundled for its week, else null (`weeks`: the generated `WEEK_DROP_WEEKS`). */
export function dropWeekFor(weeks: readonly string[], day: string): string | null {
  const week = dropWeekOf(day);
  return weeks.includes(week) ? week : null;
}
