import type { StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { MyRouteModel, Pip, StageRow } from './types';
import { stageGroups } from './view';

/**
 * The Home route strip (F-ROUTE-001 R-4b, section 3.1 entry 2, OD-3; amendment
 * LR-A6; wireframes `design/wireframes/journey/learning-route.md` H and
 * `design/wireframes/journey/my-route-overview.md` D). It replaces Home's
 * "Stage 1 progress" bar: the page's name, where the learner is, the `here`
 * stage's pips (the same groups as its row on the page), and one line each
 * for the goal and the weekly plan week, only when they exist. Pure: the
 * words come from the dictionary, the facts from `buildMyRoute`.
 */

export interface HomeStripInput {
  model: MyRouteModel;
  messages: Messages;
  /** The goal stage (`pickGoal`, amendment LR-A3); absent or null shows no goal line. */
  goalStage?: StageKey | null;
  /** The weekly plan's current week (section 3.9); absent or null when no plan is running. */
  week?: number | null;
}

export interface HomeStripView {
  /** The `here` stage: the pips' colour. */
  stage: StageKey;
  title: string;
  here: string;
  goal: string | null;
  week: string | null;
  /** Earned and open quest pips, coming-later cell pips, then the quests that joined later. */
  groups: Pip[][];
  /** The whole strip as one button label; the drawn pips are hidden from screen readers. */
  a11yLabel: string;
}

const isWeek = (week: number | null | undefined): week is number => typeof week === 'number' && Number.isInteger(week) && week >= 1;

export function homeStripView(i: HomeStripInput): HomeStripView {
  const strip = i.messages.learner.myRoute.home.strip;
  const a11y = i.messages.a11y.myRoute;
  // Exactly one stage is `here` (section 3.3).
  const here = i.model.stages.find((s) => s.here) as StageRow;
  const goalRow = i.goalStage ? i.model.stages.find((s) => s.stage === i.goalStage) : undefined;
  const hereLine = i.messages.learner.myRoute.hero.here(here.order, here.title);
  const goal = goalRow ? strip.goal(goalRow.order, goalRow.title) : null;
  const week = isWeek(i.week) ? strip.week(i.week) : null;
  return {
    stage: here.stage,
    title: strip.title,
    here: hereLine,
    goal,
    week,
    groups: stageGroups(here),
    a11yLabel: a11y.homeStrip(strip.title, hereLine, goalRow ? a11y.homeStripGoal(goalRow.order, goalRow.title) : null, week),
  };
}
