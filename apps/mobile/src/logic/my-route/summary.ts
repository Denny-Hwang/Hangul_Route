import { pickGoal, type InboxPlan, type ProgressSnapshot, type ProgressSummary, type StageKey } from '@hangul-route/content-schema';
import { sourcesOf } from '../homework/plan-derivation';
import { stageAvailability } from '../journey';
import { buildMyRoute } from './model';
import { gridEpisodesOf } from './order';
import { startRouteOf } from './start-marker';
import type { MyRouteInput, MyRouteModel, StageState } from './types';

/**
 * `summarizeJourney` (F-ROUTE-001 section 3.12): the stage-level counts the
 * console strip reads, about 300 bytes. The tolerant wire schema is
 * `JourneySummarySchema` (content-schema); sync-store passes this into
 * `summarize` through `journeySummaryOf` (R-8).
 * `total` sizes a segment; it is never shown as a goal.
 */
export interface JourneyStageSummary {
  stage: StageKey;
  state: StageState;
  /** Done grid quests in that stage. */
  done: number;
  /** Placed out and not done. */
  known: number;
  /** Grid quests this build offers there. */
  total: number;
}

export interface JourneySummary {
  v: 1;
  here: StageKey | null;
  stages: JourneyStageSummary[];
  /**
   * Set by `journeySummaryOf`: built by a client that reads the stored level
   * check (R-7a) and derives `here` from the start marker. Absent on older
   * builds, whose `known` counts are always 0, so the console can tell them apart.
   */
  seeded?: true;
}

export function summarizeJourney(model: MyRouteModel): JourneySummary {
  return {
    v: 1,
    here: model.stages.find((s) => s.here)?.stage ?? null,
    stages: model.stages.map((s) => ({
      stage: s.stage,
      state: s.state,
      done: s.done,
      known: s.known,
      total: s.pips.filter((p) => p.kind === 'quest').length + s.newPips.length,
    })),
  };
}

/** The bundled content and the entitlement `buildMyRoute` reads; sync-store binds it once. */
export type JourneyContent = Pick<MyRouteInput, 'catalog' | 'episodes' | 'quests' | 'cards' | 'stages' | 'themes' | 'isEntitled'>;

/**
 * The sync-store input (F-ROUTE-001 R-8): `summarizeJourney(buildMyRoute(...))`
 * for the snapshot about to upload. The route comes from the stored level-check
 * results with no completions (R-7a `startRouteOf`), so `known` counts the
 * quests the level check placed out and the learner has not done, and the
 * journey carries `seeded: true`. Best effort:
 * an error gives no journey and the upload goes on without it, never blocking
 * a sync.
 */
export function journeySummaryOf(snapshot: ProgressSnapshot, content: JourneyContent, now: Date): JourneySummary | undefined {
  try {
    const route = startRouteOf(snapshot.placements, content.catalog, content.isEntitled);
    return { ...summarizeJourney(buildMyRoute({ snapshot, ...content, route, now })), seeded: true };
  } catch {
    return undefined;
  }
}

export interface RouteGoalSummaryInput {
  snapshot: ProgressSnapshot;
  /** The learner's inbox plans as the plan store holds them (published, unarchived, targeting this learner). */
  plans: readonly InboxPlan[];
  /** The stage rows of the same upload (`journeySummaryOf`); without them only a plan goal can be named. */
  journey: Pick<JourneySummary, 'stages'> | undefined;
  content: Pick<JourneyContent, 'catalog' | 'episodes'>;
  now: Date;
}

/**
 * `summary.routeGoal` (Learning Route amendment section 9, LR-6; LR-OD-12):
 * the goal the learner's Learning Route shows, so the family space names the
 * same goal as the child's tab. It is `pickGoal` over the sources Home and
 * Homework derive from (`sourcesOf(inboxPlans, snapshot.selfRoute)`), the
 * journey's stage rows and the bundle's stage availability, on the day the
 * plan derivation uses. Only the stage and the source code leave the device:
 * no plan id, no date, no name. Undefined when there is no goal (the end of
 * the open road), so the key is left out. Best effort, as `journeySummaryOf`:
 * a stored plan it cannot read gives no goal and the upload goes on without it.
 */
export function routeGoalSummaryOf(input: RouteGoalSummaryInput): ProgressSummary['routeGoal'] {
  try {
    const { snapshot, plans, journey, content, now } = input;
    const grid = gridEpisodesOf(content.episodes);
    const goal = pickGoal({
      sources: sourcesOf(plans, snapshot.selfRoute).map((source) => ({ ...source, meta: source.meta ?? null })),
      catalog: content.catalog,
      stages: journey?.stages ?? [],
      availability: (stage) => stageAvailability(stage, grid),
      // The UTC day the plan derivation uses (`dayKey` in plan-store), so a plan sets the goal exactly while it derives homework.
      today: now.toISOString().slice(0, 10),
    });
    return goal === null ? undefined : { stage: goal.stage, from: goal.from };
  } catch {
    return undefined;
  }
}
