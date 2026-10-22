import type { Messages } from '@hangul-route/i18n';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { streakOf } from '../streak';
import { goalsInForce, pointsOn, ringOf, tierOf, type DailyGoal, type DailyTier, type RingState, type WeeklyDays } from './points';
import { steadyWeekCount, weeklyTarget } from './steady-weeks';
import { learnedDays, weekDots, type WeekDot } from './week';

/*
 * What the Home week strip and the goals sheet show (F-CURR-002 section 7.4, OD-6, OD-14, row CM-17;
 * design/wireframes/home/goal-ring-weekly-dots.md). Pure: the screen draws it as it is.
 *
 * - The headline is the steady-week count (the stored latch, so it only grows); 0 reads "Your first steady
 *   week starts here".
 * - The streak line is the CM-4 local-day run: "Streak N days" while a run goes on; once a run has ended,
 *   "Start a new run! Best run: N days" until the next finished activity (the best run is kept; nothing says
 *   lost); nothing before the first finished activity.
 * - The ring is today's points over the daily goal, a shape with no number.
 */

export type StreakLine = { kind: 'run'; days: number } | { kind: 'newRun'; best: number } | null;

export interface GoalStripView {
  dots: WeekDot[];
  steadyWeeks: number;
  streak: StreakLine;
  ring: { state: RingState; fraction: number };
  daily: DailyGoal;
  tier: DailyTier;
  /** The weekly days in force: the plan's when one is on, else the goal's. */
  weeklyDays: number;
  /** The stored (or default) weekly goal, the sheet's choice while no plan is on. */
  weeklyGoal: WeeklyDays;
  /** A weekly plan is on: the sheet shows its days read-only (C2). */
  fromPlan: boolean;
  /** The first choice (D): no goals stored yet and something finished. */
  offerFirstChoice: boolean;
}

export function goalStripView(snapshot: ProgressSnapshot | undefined, today: string, planDays: number | null): GoalStripView {
  const learned = learnedDays(snapshot);
  const { daily, weeklyDays } = goalsInForce(snapshot?.goals);
  const streak = snapshot ? streakOf([snapshot], snapshot.sessions, today) : { shown: 0, best: undefined };
  const best = streak.best ?? 0;
  return {
    dots: weekDots(learned, today, streak.shown > 0),
    steadyWeeks: steadyWeekCount(snapshot),
    streak: streak.shown > 0 ? { kind: 'run', days: streak.shown } : best > 0 ? { kind: 'newRun', best } : null,
    ring: ringOf(pointsOn(snapshot?.dayLog, today), daily),
    daily,
    tier: tierOf(daily),
    weeklyDays: weeklyTarget(snapshot?.goals, planDays),
    weeklyGoal: weeklyDays,
    fromPlan: planDays !== null && planDays > 0,
    offerFirstChoice: snapshot?.goals === undefined && [...learned].some((day) => day <= today),
  };
}

/**
 * What the goals sheet saves when it closes: with a weekly plan on only the daily goal changes (the stored weekly goal
 * applies again when the plan ends). Closing on the goals it opened with while none are stored is no choice: null,
 * so nothing is stored or sent and the first choice (D) still comes.
 */
export function sheetChoiceToSave(
  view: Pick<GoalStripView, 'daily' | 'weeklyGoal' | 'fromPlan'>,
  goalsStored: boolean,
  choice: { daily: DailyGoal; weeklyDays: WeeklyDays },
): { daily: DailyGoal; weeklyDays: WeeklyDays } | null {
  const next = view.fromPlan ? { daily: choice.daily, weeklyDays: view.weeklyGoal } : choice;
  return !goalsStored && next.daily === view.daily && next.weeklyDays === view.weeklyGoal ? null : next;
}

/** The headline text. */
export function headlineOf(view: Pick<GoalStripView, 'steadyWeeks'>, m: Messages['learner']['goals']): string {
  return view.steadyWeeks > 0 ? m.steadyWeeks(view.steadyWeeks) : m.firstWeek;
}

/** The streak line text, or null when there is none to show. */
export function streakTextOf(view: Pick<GoalStripView, 'streak'>, messages: Pick<Messages, 'learner'>): string | null {
  if (view.streak === null) return null;
  return view.streak.kind === 'run' ? messages.learner.home.streak.pill(view.streak.days) : messages.learner.goals.newRun(view.streak.best);
}

/** "Light, about 5 minutes". */
export function tierLabelOf(tier: DailyTier, m: Messages['learner']['goals']): string {
  return m.daily.label(m.daily[tier], m.daily.time[tier]);
}

/** The ring's state line beside it. */
export function ringLineOf(view: Pick<GoalStripView, 'ring'>, m: Messages['learner']['goals']): string {
  return view.ring.state === 'met' ? m.today.met : m.today.more;
}

/**
 * The strip's one accessible name: every day with its state (the dots are the headline), the headline, the
 * streak line and the daily goal; a part with nothing to say is left out. `dayName` gives the full weekday name
 * (`formatDate(locale, day, 'weekdayLong')`).
 */
export function stripLabelOf(view: GoalStripView, messages: Pick<Messages, 'learner' | 'a11y'>, today: string, dayName: (day: string) => string): string {
  const a = messages.a11y.goals;
  const days = view.dots
    .map((dot) => {
      const name = dayName(dot.day);
      if (dot.state === 'learned') return dot.day === today ? a.day.learnedToday(name) : a.day.learned(name);
      if (dot.state === 'rest') return a.day.rest(name);
      if (dot.state === 'today') return a.day.today(name);
      return name;
    })
    .join(', ');
  const goalState = view.ring.state === 'met' ? a.state.met : view.ring.state === 'partly' ? a.state.more : a.state.empty;
  return a.strip({
    days,
    steadyWeeks: headlineOf(view, messages.learner.goals),
    streak: streakTextOf(view, messages),
    goal: `${tierLabelOf(view.tier, messages.learner.goals)}, ${goalState}`,
  });
}
