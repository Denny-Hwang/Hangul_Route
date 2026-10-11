import type { StageKey } from '@hangul-route/content-schema';
import type { MyRouteModel, StageState } from './types';

/**
 * `summarizeJourney` (F-ROUTE-001 section 3.12): the stage-level counts the
 * console strip reads, about 300 bytes. R-8 adds the tolerant wire schema
 * (`JourneySummarySchema`) and passes this into `summarize` from sync-store.
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
