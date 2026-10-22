import { dayLogPoints, trimDayLog, type DayLog, type Goals } from '@hangul-route/content-schema';

/*
 * Daily goal points (F-CURR-002 section 7.4, row CM-17). Pure.
 *
 * - Points come from finished activities, never from accuracy: a miss never removes one.
 * - Points are kept per local day and per install key in `dayLog` (section 4.8) and read as the sum over
 *   install keys, so a phone and a tablet on the same day add up after a sync. Each device only ever raises
 *   its own count for a day, which is why the merge's max per key never counts a point twice.
 * - The daily goal is chosen in plain time words (Light, Steady, Strong); points never show on a screen.
 */

/** Every activity that earns points. `packQuest`, `dailyReview`, `keepGoing` and `tryAgain` are called by their rows. */
export type ActivityKind = 'quest' | 'packQuest' | 'dailyReview' | 'keepGoing' | 'tryAgain' | 'story' | 'wordSet';

/** Section 7.4's points table. Review earns as much as a quest: it is the best use of a learner's minutes. */
export const ACTIVITY_POINTS: Readonly<Record<ActivityKind, number>> = {
  quest: 3,
  packQuest: 3,
  dailyReview: 3,
  keepGoing: 2,
  tryAgain: 2,
  story: 2,
  wordSet: 1,
};

export type DailyGoal = Goals['daily'];
export type WeeklyDays = Goals['weeklyDays'];
export type DailyTier = 'light' | 'steady' | 'strong';

/** The daily tiers in their order, with their points: Light about 5 minutes, Steady 10, Strong 15. */
export const DAILY_TIERS: readonly { tier: DailyTier; points: DailyGoal }[] = [
  { tier: 'light', points: 3 },
  { tier: 'steady', points: 6 },
  { tier: 'strong', points: 10 },
];
export const WEEKLY_DAYS: readonly WeeklyDays[] = [3, 5, 7];

/** Light is the default when the learner skips the choice; the weekly goal is 3 days. */
export const DEFAULT_DAILY: DailyGoal = 3;
export const DEFAULT_WEEKLY_DAYS: WeeklyDays = 3;

export function tierOf(points: DailyGoal): DailyTier {
  return DAILY_TIERS.find((t) => t.points === points)?.tier ?? 'light';
}

/** The goals in force: the stored ones, else the defaults. */
export function goalsInForce(goals: Goals | undefined): { daily: DailyGoal; weeklyDays: WeeklyDays } {
  return goals ? { daily: goals.daily, weeklyDays: goals.weeklyDays } : { daily: DEFAULT_DAILY, weeklyDays: DEFAULT_WEEKLY_DAYS };
}

/** The points of one local day: the sum over install keys. */
export function pointsOn(log: DayLog | undefined, day: string): number {
  return dayLogPoints(log, day);
}

/**
 * `log` with `points` added to this install key's count on `day`, trimmed to the newest 70 days. A count
 * only grows, so the merge's max per day and install key keeps it. A non-positive amount changes nothing.
 */
export function withPoints(log: DayLog | undefined, day: string, installKey: string, points: number): DayLog {
  if (!(points > 0)) return log ?? {};
  const keys = log?.[day] ?? {};
  return trimDayLog({ ...(log ?? {}), [day]: { ...keys, [installKey]: (keys[installKey] ?? 0) + points } });
}

export type RingState = 'empty' | 'partly' | 'met';

/** Today's ring: a shape only, never a number. `fraction` is 0 to 1. */
export function ringOf(points: number, daily: DailyGoal): { state: RingState; fraction: number } {
  const fraction = Math.max(0, Math.min(1, points / daily));
  return { state: fraction >= 1 ? 'met' : fraction > 0 ? 'partly' : 'empty', fraction };
}
