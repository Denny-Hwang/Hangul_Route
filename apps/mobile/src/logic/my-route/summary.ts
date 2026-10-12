import type { ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { buildMyRoute } from './model';
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
 * quests the level check placed out and the learner has not done. Best effort:
 * an error gives no journey and the upload goes on without it, never blocking
 * a sync.
 */
export function journeySummaryOf(snapshot: ProgressSnapshot, content: JourneyContent, now: Date): JourneySummary | undefined {
  try {
    const route = startRouteOf(snapshot.placements, content.catalog, content.isEntitled);
    return summarizeJourney(buildMyRoute({ snapshot, ...content, route, now }));
  } catch {
    return undefined;
  }
}
