import {
  effectiveRoute,
  type AssessmentResponse,
  type PlacementForm,
  type PlacementGate,
  type PlacementResult,
  type PlacementRunState,
  type RouteCatalog,
  type RouteOptions,
  type RouteSeed,
} from '@hangul-route/content-schema';

/**
 * Small pure helpers for the screen that hosts a run (F-PLC-001 section 3.1
 * steps 5 to 8): where the open question sits, what an event recorded, the
 * route before and after a result, and where Start leads.
 */

export interface RungPosition {
  gate: PlacementGate;
  form: PlacementForm;
  /** 0 for the first question of the rung (Short speaks the instruction only there). */
  indexInRung: number;
}

/** The open question's rung, or null once the run is finished. */
export function rungPosition(run: PlacementRunState): RungPosition | null {
  if (run.stop !== null || run.current === null) return null;
  return { gate: run.current.gate, form: run.current.form, indexInRung: run.responses.length - run.current.start };
}

/** The response an event recorded (answer or "not sure"), or null when it recorded none. */
export function newResponse(before: PlacementRunState, after: PlacementRunState): AssessmentResponse | null {
  return after.responses.length > before.responses.length ? (after.responses[after.responses.length - 1] as AssessmentResponse) : null;
}

/**
 * The effective route before a result and with it (section 3.7): the result
 * screen compares the two ("Your route stays right where it is.").
 */
export function resultRoutes(
  previous: readonly PlacementResult[],
  result: PlacementResult,
  catalog: RouteCatalog,
  opts: RouteOptions,
): { before: RouteSeed | null; after: RouteSeed } {
  const before = effectiveRoute(previous, catalog, opts);
  // Never null: the list holds at least the new result.
  const after = effectiveRoute([...previous, result], catalog, opts) as RouteSeed;
  return { before, after };
}

/** Where Start opens: the start quest and its episode, or null when no entitled quest is left. */
export function startTarget(seed: RouteSeed): { questId: string; episodeId: string } | null {
  if (seed.startQuestId === null || seed.startEpisodeId === null) return null;
  return { questId: seed.startQuestId, episodeId: seed.startEpisodeId };
}

/**
 * `completedAt` of a result: now for a run that just ended, or when the stop
 * was saved for a run recorded on reopening (`ResumeOffer` `finish`).
 */
export function completedAtOf(offer: 'live' | 'finish', savedAtMs: number, nowMs: number): string {
  return new Date(offer === 'finish' ? savedAtMs : nowMs).toISOString();
}
