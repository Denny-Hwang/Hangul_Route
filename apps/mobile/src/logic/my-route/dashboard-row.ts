import type { StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { stageA11yLabel, skillsNoteCopy, tilesCopy, type CopyContext } from './copy';
import type { MyRouteModel, StageRow, StageState } from './types';
import { myRouteMessages, skillRowView, type SkillRowView } from './view';

/**
 * The Learning Route row on each profile card of the in-app parent dashboard
 * (F-ROUTE-001 R-9b, section 3.12; amendment LR-A6; wireframes
 * `design/wireframes/journey/my-route-overview.md` H and
 * `design/wireframes/parent/learning-route.md` L1a). Behind the grown-up gate
 * and written about the child: seven drawn segments (one per stage, a text
 * list for screen readers), "Now: Stage N · Title", the goal line when a goal
 * exists, "Started: Stage N · band · date" when a level check exists, the
 * read, listen and write mini rows, "Spelling with tiles", the one skills note
 * and See Learning Route. Pure: the words come from the dictionary, the facts
 * from `buildMyRoute`. No ratio, no comparison between profiles.
 */

export interface DashboardRowInput {
  model: MyRouteModel;
  messages: Messages;
  /** The profile's display name: every sentence is about the child. */
  name: string;
  /** The newest level check (`startingSpotRow`): its stage, band label and formatted date; null without a check. */
  started: { stage: StageKey; band: string; date: string } | null;
  /** The goal stage (`pickGoal` over the local model, LR-3a, fed with LR-5a); absent or null shows no goal line. */
  goalStage?: StageKey | null;
}

export interface DashboardSegment {
  stage: StageKey;
  /** 1 to 7. */
  order: number;
  /** Drawn as its own shape by the design system `StageSegments` (the PipRow vocabulary); never a count. */
  state: StageState;
  here: boolean;
  /** The segment in words, for the screen-reader list: the stage row's grown-up label. */
  a11yLabel: string;
}

export interface DashboardRowView {
  title: string;
  segments: DashboardSegment[];
  /** The label of the screen-reader list of segments. */
  segmentsLabel: string;
  now: string;
  goal: string | null;
  started: string | null;
  /** The now, goal and started lines read aloud: in the third person and without the middle dot. */
  a11y: { now: string; goal: string | null; started: string | null };
  skills: SkillRowView[];
  tiles: string | null;
  note: string;
  cta: string;
}

export function dashboardRowView(i: DashboardRowInput): DashboardRowView {
  const { model, messages, name } = i;
  const words = messages.caregiver.journey.row;
  const a11y = messages.a11y.myRoute;
  const ctx: CopyContext = { viewer: 'grownup', name, m: myRouteMessages(messages) };
  const rowOf = (stage: StageKey | null | undefined): StageRow | undefined => (stage ? model.stages.find((s) => s.stage === stage) : undefined);
  // Exactly one stage is `here` (section 3.3).
  const here = model.stages.find((s) => s.here) as StageRow;
  const goalRow = rowOf(i.goalStage);
  const startRow = rowOf(i.started?.stage);
  const started = i.started !== null && startRow !== undefined ? { order: startRow.order, band: i.started.band, date: i.started.date } : null;

  return {
    title: words.title,
    segments: model.stages.map((row) => ({ stage: row.stage, order: row.order, state: row.state, here: row.here, a11yLabel: stageA11yLabel(row, ctx) })),
    segmentsLabel: a11y.trail,
    now: words.now(here.order, here.title),
    goal: goalRow ? words.goal(goalRow.order, goalRow.title) : null,
    started: started ? words.started(started.order, started.band, started.date) : null,
    a11y: {
      now: messages.caregiver.journey.here(name, here.order, here.title),
      goal: goalRow ? a11y.rowGoal(goalRow.order, goalRow.title) : null,
      started: started ? a11y.rowStarted(started.order, started.band, started.date) : null,
    },
    skills: model.skills.map((row) => skillRowView(row, ctx, messages)),
    tiles: tilesCopy(model, ctx),
    note: skillsNoteCopy(ctx) as string,
    cta: words.cta,
  };
}
