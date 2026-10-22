import { addDays, mergeLatchRecord, type Goals, type ProgressSnapshot } from '@hangul-route/content-schema';
import { goalsInForce } from './points';
import { learnedDays, learnedInWeek, weekMondayOf } from './week';

/*
 * The steady-weeks latch (F-CURR-002 sections 4.8 and 7.4, OD-6; design/wireframes/home/goal-ring-weekly-dots.md).
 * Pure and idempotent: it runs after each finished activity, after each snapshot merge, when Home opens and
 * when goals are saved. Home's headline reads only the key count of `steadyWeeks`, so it never drops:
 * - a week (Monday to Sunday on local days, keyed by its Monday) latches once, when its learned days first
 *   reach the weekly days in force that week, and stays latched after `dayLog` drops the week (70 days),
 *   after a goal change and after a restore;
 * - the current week's target is an active weekly plan's days a week (F-PLAN-002), else `goals.weeklyDays`
 *   (3 by default);
 * - an earlier week whose days are still in `dayLog` is judged only against goals set before that week
 *   ended (`goals.setAt`); otherwise it is never judged late. A week any copy already latched keeps its key;
 * - the merge is a union with the earliest time per week, so running the check again changes nothing.
 */

export interface LatchInput {
  snapshot: Pick<ProgressSnapshot, 'dayLog' | 'sessions' | 'goals' | 'steadyWeeks'>;
  /** The learner's local day. */
  today: string;
  /** The latch time to write (already capped at the server's clock, `server-clock.ts`). */
  at: string;
  /** The local day of `goals.setAt`; undefined when no goals are stored. */
  goalsSetDay: string | undefined;
  /** An active weekly plan's days a week (F-PLAN-002), which comes first; null without one. */
  planDays: number | null;
}

export interface LatchedWeek {
  week: string;
  /** The week's learned days when it latched. */
  days: number;
  /** The weekly days in force that week. */
  target: number;
}

export interface LatchResult {
  /** The new `steadyWeeks`, or the stored record itself when nothing latched. */
  steadyWeeks: ProgressSnapshot['steadyWeeks'];
  /** The weeks this check added, oldest first (for `week.goal_met`). */
  added: LatchedWeek[];
}

/** The weekly days in force on the current week: the plan's, else the goal's (3 by default). */
export function weeklyTarget(goals: Goals | undefined, planDays: number | null): number {
  return planDays !== null && planDays > 0 ? planDays : goalsInForce(goals).weeklyDays;
}

export function latchSteadyWeeks(input: LatchInput): LatchResult {
  const { snapshot, today, at, goalsSetDay, planDays } = input;
  const stored = snapshot.steadyWeeks;
  const learned = learnedDays(snapshot);
  const current = weekMondayOf(today);
  const weeks = new Set<string>([current]);
  for (const day of Object.keys(snapshot.dayLog ?? {})) if (day <= today) weeks.add(weekMondayOf(day));
  const added: LatchedWeek[] = [];
  for (const week of [...weeks].sort()) {
    if (stored?.[week] !== undefined) continue;
    let target: number;
    if (week === current) target = weeklyTarget(snapshot.goals, planDays);
    else if (snapshot.goals !== undefined && goalsSetDay !== undefined && goalsSetDay <= addDays(week, 6)) target = snapshot.goals.weeklyDays;
    else continue;
    const days = learnedInWeek(learned, week, today);
    if (days >= target) added.push({ week, days, target });
  }
  if (added.length === 0) return { steadyWeeks: stored, added };
  return { steadyWeeks: mergeLatchRecord(stored, Object.fromEntries(added.map((w) => [w.week, at]))), added };
}

/** The headline number: the latched weeks, ever. */
export function steadyWeekCount(snapshot: Pick<ProgressSnapshot, 'steadyWeeks'> | undefined): number {
  return Object.keys(snapshot?.steadyWeeks ?? {}).length;
}
