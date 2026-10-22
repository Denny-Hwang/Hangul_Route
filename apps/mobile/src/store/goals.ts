import { CURR_TELEMETRY_PAYLOADS, boundToNow, type ProgressSnapshot } from '@hangul-route/content-schema';
import type { GoalEvent } from '../logic/goals/goal-events';
import { planDaysInForce } from '../logic/goals/plan-days';
import { ACTIVITY_POINTS, goalsInForce, pointsOn, withPoints, type ActivityKind, type DailyGoal, type WeeklyDays } from '../logic/goals/points';
import { latchSteadyWeeks, steadyWeekCount, type LatchedWeek } from '../logic/goals/steady-weeks';
import { weekMondayOf } from '../logic/goals/week';
import { utcDayKey } from '../logic/day-clock';
import { sourcesOf } from '../logic/homework/plan-derivation';
import { localDay } from '../logic/vocab/progress';
import { goalNow, loadGoalClock } from '../platform/goal-clock';
import { goalInstallKey, loadInstallKey } from '../platform/install-key';
import { track } from '../platform/telemetry';
import { usePlanStore } from './plan-store';
import { useProgressStore } from './progress-store';
import { currFlagOn } from './remote-config-store';

/*
 * Daily and weekly goals (F-CURR-002 section 7.4, row CM-17), behind `goals`. Part of the goals chunk
 * (`screens/goals/goals-chunk.ts`): the start bundle reaches it only through `store/goals-entry.ts` (section 12.2; built-in pct 0, the
 * owner ramps it). The one API every activity calls is `recordActivityPoints(profileId, kind)`: a quest, a story
 * and a word set call it today; the Daily Review, Keep going, Try these again and pack quests call it from their
 * rows. With `goals` off nothing is written and nothing is sent; stored goals, `dayLog` and `steadyWeeks` stay.
 *
 * Every write is dated by `goalNow()` (the device clock capped at the last server time seen, section 13) and goes
 * through `boundToNow`, so a value a wrong clock wrote earlier is brought back to now and stops being sent.
 * Telemetry: `goal.set { daily, weeklyDays }` when a choice changes the goals, `goal.met { points, target }` once a
 * local day when the day's points first reach the daily goal, `week.goal_met { days, target }` when this device
 * latches a week (a week that arrives in a merge sends nothing). Each payload is parsed with
 * `CURR_TELEMETRY_PAYLOADS` before it is sent; none carries the install key.
 */

/** What an activity reached, for its Results banner. */
export interface GoalMoment {
  /** The day's points reached the daily goal with this activity. */
  dayMet: boolean;
  /** The steady-week count after this activity latched the current week; null when it did not. */
  weekMet: number | null;
}

type GoalEventName = 'goal.set' | 'goal.met' | 'week.goal_met';

function send(name: GoalEventName, profileId: string, payload: unknown): void {
  const parsed = CURR_TELEMETRY_PAYLOADS[name].safeParse(payload);
  if (parsed.success) void track({ name, profileId, payload: parsed.data as Record<string, unknown> });
}

/** `goal.met` once a local day per profile on this device. */
const metSent = new Set<string>();
/** The last goal moment of a word set, for a Results screen that did not call the API itself, with when it happened. */
const moments = new Map<string, { moment: GoalMoment; at: number }>();
/** A moment older than this belongs to another screen's finish (a match or a card set) and is never shown. */
export const MOMENT_FRESH_MS = 60_000;
let clockLoaded = false;
const clockReady = Promise.all([loadGoalClock(), loadInstallKey()]).then(() => {
  clockLoaded = true;
});

/** An active weekly plan's days a week for the learner (F-PLAN-002), or null. */
export function planDaysFor(profileId: string, snapshot: Pick<ProgressSnapshot, 'selfRoute'> | undefined, now: Date = new Date()): number | null {
  const plans = usePlanStore.getState().byLearner[profileId] ?? [];
  return planDaysInForce(sourcesOf(plans, snapshot?.selfRoute ?? null), utcDayKey(now));
}

/** `snap` with the steady-weeks latch run on `now`, and the weeks it added. */
function latched(profileId: string, snap: ProgressSnapshot, now: Date): { snap: ProgressSnapshot; added: LatchedWeek[] } {
  const result = latchSteadyWeeks({
    snapshot: snap,
    today: localDay(now),
    at: now.toISOString(),
    goalsSetDay: snap.goals ? localDay(new Date(snap.goals.setAt)) : undefined,
    planDays: planDaysFor(profileId, snap, now),
  });
  return result.added.length === 0 ? { snap, added: [] } : { snap: { ...snap, steadyWeeks: result.steadyWeeks }, added: result.added };
}

function sendWeeks(profileId: string, added: readonly LatchedWeek[]): void {
  for (const week of added) send('week.goal_met', profileId, { days: week.days, target: week.target });
}

/** True once the profile's saved copy and the goals clock are read; otherwise starts both and calls `then` after. */
function ready(profileId: string, then: () => void): boolean {
  const store = useProgressStore.getState();
  if (store.hydratedFor.has(profileId) && clockLoaded) return true;
  void Promise.all([store.hydrate(profileId), clockReady]).then(() => {
    if (useProgressStore.getState().hydratedFor.has(profileId)) then();
  });
  return false;
}

/**
 * Records the points of a finished activity (section 7.4's table) on today's local day under this device's
 * install key, then runs the steady-weeks latch. Accuracy never removes points. Returns what the activity reached,
 * or null when `goals` is off or the saved copy is not read yet (the write then lands once it is, with no banner).
 */
export function recordActivityPoints(profileId: string, kind: ActivityKind, deviceNow: Date = new Date()): GoalMoment | null {
  if (!currFlagOn('goals', profileId)) return null;
  if (!ready(profileId, () => void recordActivityPoints(profileId, kind, deviceNow))) return null;
  const now = goalNow(deviceNow);
  const day = localDay(now);
  let moment: GoalMoment | null = null;
  let reached: { points: number; target: DailyGoal } | null = null;
  let added: LatchedWeek[] = [];
  useProgressStore.getState().applyGoalWrite(profileId, (stored) => {
    const snap = boundToNow(stored, now);
    const target = goalsInForce(snap.goals).daily;
    const before = pointsOn(snap.dayLog, day);
    const dayLog = withPoints(snap.dayLog, day, goalInstallKey(), ACTIVITY_POINTS[kind]);
    const after = pointsOn(dayLog, day);
    const result = latched(profileId, { ...snap, dayLog, updatedAt: now.toISOString() }, now);
    added = result.added;
    const dayMet = before < target && after >= target;
    if (dayMet) reached = { points: after, target };
    const current = weekMondayOf(day);
    moment = { dayMet, weekMet: added.some((w) => w.week === current) ? steadyWeekCount(result.snap) : null };
    return result.snap;
  });
  const met = reached as { points: number; target: DailyGoal } | null;
  if (met !== null && !metSent.has(`${profileId}|${day}`)) {
    metSent.add(`${profileId}|${day}`);
    send('goal.met', profileId, met);
  }
  sendWeeks(profileId, added);
  return moment;
}

/**
 * Saves the learner's goals (the sheet, or the first choice). With a weekly plan on, only the daily goal changes
 * (the plan's days are the weekly days in force). Sends `goal.set` when the goals in force changed or none were
 * stored, and runs the latch at once: lowering the weekly days to the days already learned latches the week now.
 * `quiet` saves without `goal.set` (the first choice's Not now keeps the defaults).
 */
export function saveGoals(profileId: string, choice: { daily: DailyGoal; weeklyDays: WeeklyDays }, options: { quiet?: boolean; deviceNow?: Date } = {}): void {
  if (!currFlagOn('goals', profileId)) return;
  if (!ready(profileId, () => saveGoals(profileId, choice, options))) return;
  const now = goalNow(options.deviceNow ?? new Date());
  let changed = false;
  let added: LatchedWeek[] = [];
  useProgressStore.getState().applyGoalWrite(profileId, (stored) => {
    const snap = boundToNow(stored, now);
    const held = snap.goals;
    changed = held === undefined || held.daily !== choice.daily || held.weeklyDays !== choice.weeklyDays;
    const goals = changed || held === undefined ? { daily: choice.daily, weeklyDays: choice.weeklyDays, setAt: now.toISOString() } : held;
    const result = latched(profileId, goals === held ? snap : { ...snap, goals, updatedAt: now.toISOString() }, now);
    added = result.added;
    return result.snap;
  });
  if (changed && options.quiet !== true) send('goal.set', profileId, choice);
  sendWeeks(profileId, added);
}

/** The latch check on its own: when Home opens and after every merge. */
export function checkSteadyWeeks(profileId: string, deviceNow: Date = new Date()): void {
  if (!currFlagOn('goals', profileId)) return;
  if (!ready(profileId, () => checkSteadyWeeks(profileId, deviceNow))) return;
  const now = goalNow(deviceNow);
  let added: LatchedWeek[] = [];
  useProgressStore.getState().applyGoalWrite(profileId, (stored) => {
    const result = latched(profileId, stored, now);
    added = result.added;
    return result.snap;
  });
  sendWeeks(profileId, added);
}

/** The goal moment a word set left for its Results screen, while it is fresh; read once. */
export function takeGoalMoment(profileId: string, now: number = Date.now()): GoalMoment | null {
  const held = moments.get(profileId);
  moments.delete(profileId);
  return held !== undefined && now - held.at >= 0 && now - held.at < MOMENT_FRESH_MS ? held.moment : null;
}

/**
 * What the progress store tells the goals (`logic/goals/goal-events.ts`, forwarded by `store/goals-entry.ts`): a
 * word set it recorded itself earns its point, and every snapshot a sync or restore hands back runs the latch.
 */
export function handleGoalEvent(event: GoalEvent): void {
  if (event.type === 'merged') {
    checkSteadyWeeks(event.profileId);
    return;
  }
  const moment = recordActivityPoints(event.profileId, event.kind);
  if (moment !== null && (moment.dayMet || moment.weekMet !== null)) moments.set(event.profileId, { moment, at: Date.now() });
}

/** Tests only. */
export function resetGoalsForTests(): void {
  metSent.clear();
  moments.clear();
}
