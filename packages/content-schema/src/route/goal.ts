import { cellIsReady, type Catalog } from '../catalog/schema';
import { addDays } from '../curriculum/dates';
import type { CurriculumMeta } from '../curriculum/draft';
import type { DateKey } from '../curriculum/params';
import type { RouteCatalog } from '../placement/route-seed';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import type { PlanItem } from '../schemas/plan-item';

/**
 * The Learning Route destination (Learning Route amendment section 4.1, LR-3a).
 * Pure and shared: the learner page, the in-app grown-up page, the summary
 * writer and the console all pick the goal with these functions, so the child's
 * tab and the grown-up views can never name different goals from the same data.
 * No clock, no locale and no catalogue import: the caller passes `today`, the
 * catalogue and the stage rows.
 */

/** Which source set the goal. Wording only: never shown as a person. */
export type GoalFrom = 'class' | 'school' | 'family' | 'self' | 'default';

/**
 * One plan the goal may come from. On the device: `sourcesOf(inboxPlans,
 * snapshot.selfRoute)` (`assignedAt` = `publishedAt` or the self plan's
 * `createdAt`). In the console: only this space's published, unarchived plans
 * that target the learner (`assignedAt` = `publishedAt`), so a draft never sets
 * a goal.
 */
export interface GoalSource {
  id: string;
  kind: 'class' | 'school' | 'family' | 'self';
  assignedAt: string;
  items: readonly PlanItem[];
  /** A curriculum's meta; null for a classic plan, which is homework and sets no goal. */
  meta: CurriculumMeta | null;
}

export interface RouteGoal {
  /** The stage the learner is heading to. */
  stage: StageKey;
  from: GoalFrom;
  /** Plan id or self-route id; null for `default`. */
  sourceId: string | null;
  /** Last day of the plan (grown-up views only); null for `default`. */
  endsOn: DateKey | null;
  /** Section 4.1 rule 6; never true for `default`. */
  reached: boolean;
  /** The goal stage's availability is `taste` (worded "Explore"). */
  taste: boolean;
}

/** The app's `StageAvailability` (`apps/mobile/src/logic/journey.ts`): every cell ready, some, none. */
export type RouteStageAvailability = 'open' | 'taste' | 'soon';

/** The app's `StageState` (`logic/my-route/types.ts`) and `summary.journey.stages[].state` once validated. */
export type RouteStageState = 'complete' | 'known' | 'explored' | 'open' | 'later';

export interface RouteStageRow {
  stage: StageKey;
  state: RouteStageState;
}

export interface PickGoalInput {
  sources: readonly GoalSource[];
  /** `routeCatalogOf(CATALOG)`. */
  catalog: RouteCatalog;
  /** The seven stage rows (or the validated `summary.journey.stages`). */
  stages: readonly RouteStageRow[];
  /** App: `stageAvailability`; console: `(s) => stageAvailabilityOf(CATALOG, s)`. */
  availability: (stage: StageKey) => RouteStageAvailability;
  today: DateKey;
}

const STAGES = StageKeySchema.options as readonly StageKey[];
const stageIndex = (stage: StageKey): number => STAGES.indexOf(stage);
/** Plain code-unit order (never a locale comparison), as the curriculum generator. */
const compareKeys = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

/**
 * The catalogue twin of the app's `stageAvailability`: `open` when every cell
 * of the stage is ready (`shipped` or `ready`), `taste` when some are, `soon`
 * when none is. The console has the shared catalogue, not the bundle, so it
 * words a taste stage exactly as the app does (a parity test on the bundled
 * content holds them equal, LR-3b).
 */
export function stageAvailabilityOf(catalog: Catalog, stage: StageKey): RouteStageAvailability {
  const cells = catalog.cells.filter((cell) => cell.stage === stage);
  const ready = cells.filter(cellIsReady).length;
  if (ready === 0) return 'soon';
  return ready === cells.length ? 'open' : 'taste';
}

/**
 * The last day of a curriculum plan: its last week's start plus 6 days
 * (`curriculum/dates`). A meta with no weeks falls back to its stored params,
 * which give the same day by construction (`startDate + 7 * weeks - 1`).
 */
export function planLastDay(meta: CurriculumMeta): DateKey {
  const starts = meta.weeks.map((week) => week.startDate).sort(compareKeys);
  const lastStart = starts[starts.length - 1];
  return lastStart === undefined ? addDays(meta.params.startDate, 7 * meta.params.weeks - 1) : addDays(lastStart, 6);
}

/**
 * The stage a curriculum plan reaches (section 4.1 rule 3): the highest stage
 * of its lesson items, never below the plan level's stage. That is the
 * generator's own `endsAtStage` rule (`curriculum/generate.ts`, `summarise`),
 * read back from what a plan stores; a golden test holds the two equal.
 * - A quest item counts when the catalogue knows it as a grid lesson; a story
 *   quest never moves the goal, whatever stage it recommends.
 * - An episode item counts when it is a ready cell (one of its grid quests is
 *   playable); a coming-soon placeholder never does.
 * - Unknown ids are ignored.
 */
export function planGoalStage(items: readonly PlanItem[], meta: CurriculumMeta, catalog: RouteCatalog): StageKey {
  const lessonById = new Map(catalog.quests.filter((quest) => quest.grid).map((quest) => [quest.id, quest.stage]));
  const readyCellStage = new Map(catalog.quests.filter((quest) => quest.grid && quest.playable).map((quest) => [quest.episodeId, quest.stage]));
  let top: StageKey = meta.params.level.stage;
  for (const item of items) {
    const stage = item.kind === 'quest' ? lessonById.get(item.id) : readyCellStage.get(item.id);
    if (stage !== undefined && stageIndex(stage) > stageIndex(top)) top = stage;
  }
  return top;
}

/**
 * The goal with no active curriculum source (section 4.1 rule 4, LR-OD-5): the
 * first stage, in order 1 to 7, whose state is `open`. Today that is Stage 1;
 * after it, Stage 2 (a taste), then Stage 4, then none (`null`).
 */
export function defaultGoalStage(stages: readonly RouteStageRow[]): StageKey | null {
  const open = new Set(stages.filter((row) => row.state === 'open').map((row) => row.stage));
  return STAGES.find((stage) => open.has(stage)) ?? null;
}

/** Section 4.1 rule 2: a teacher's plan, then a parent's (family and school), then the learner's own. */
const RANK: Readonly<Record<GoalSource['kind'], number>> = { class: 0, family: 1, school: 1, self: 2 };

/**
 * Where the learner is heading (section 4.1), or `null` at the end of the open
 * road.
 * - Rule 1: only curriculum sources count (`meta !== null`), and only while
 *   `today` is on or before the plan's last day.
 * - Rule 2: the leading source is the first by rank, then the newest
 *   `assignedAt` (an exact tie goes to the lower id, so the pick never depends
 *   on input order). This is the precedence Home, Homework and `routeNext` use.
 * - Rules 3 to 5: its goal stage is `planGoalStage`; with no live curriculum
 *   source the default rule applies, and with no open stage the goal is null.
 * - Rule 6: a plan goal is `reached` when its stage is complete or known, or
 *   explored when the stage is a taste; it stays the goal until the plan ends.
 *   A default goal is never reached: the rule moves on to the next open stage.
 */
export function pickGoal(input: PickGoalInput): RouteGoal | null {
  const { sources, catalog, stages, availability, today } = input;
  const live = sources.flatMap((source) => {
    if (source.meta === null) return [];
    const endsOn = planLastDay(source.meta);
    return today <= endsOn ? [{ source, meta: source.meta, endsOn }] : [];
  });
  live.sort(
    (a, b) =>
      RANK[a.source.kind] - RANK[b.source.kind] ||
      compareKeys(b.source.assignedAt, a.source.assignedAt) ||
      compareKeys(a.source.id, b.source.id),
  );
  const lead = live[0];
  if (lead !== undefined) {
    const stage = planGoalStage(lead.source.items, lead.meta, catalog);
    const taste = availability(stage) === 'taste';
    const state = stages.find((row) => row.stage === stage)?.state;
    const reached = state === 'complete' || state === 'known' || (state === 'explored' && taste);
    return { stage, from: lead.source.kind, sourceId: lead.source.id, endsOn: lead.endsOn, reached, taste };
  }
  const stage = defaultGoalStage(stages);
  if (stage === null) return null;
  return { stage, from: 'default', sourceId: null, endsOn: null, reached: false, taste: availability(stage) === 'taste' };
}
