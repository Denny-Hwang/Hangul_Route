import { effectiveRoute, type PlacementResult, type RouteCatalog, type RouteSeed, type StageKey } from '@hangul-route/content-schema';
import type { RouteEntry } from './order';
import type { MyRouteModel } from './types';

/**
 * The start marker (F-ROUTE-001 R-7a, section 3.6): "You started here".
 *
 * The route is computed with **no completions**, so the start never moves
 * because the learner played. It moves with a better retake (the placed-out
 * set only grows) or a grown-up override (which may move it earlier). It is
 * also read against today's bundle and tier, the same way `effectiveRoute`
 * picks where the app starts the learner: a quest that joins the bundle ahead
 * of the old start, or a stage the learner is newly entitled to, can become
 * the start, because it was never placed out (section 3.6).
 */

/** `effectiveRoute(placements, catalog, { isEntitled, completedQuestIds: new Set() })`; null without a stored result. */
export function startRouteOf(
  placements: readonly PlacementResult[] | undefined,
  catalog: RouteCatalog,
  isEntitled: (stage: StageKey) => boolean,
): RouteSeed | null {
  if (placements === undefined) return null;
  return effectiveRoute(placements, catalog, { isEntitled, completedQuestIds: new Set() });
}

/**
 * Where the marker sits. The pip of `route.startQuestId` carries it and the tag
 * goes on that quest's stage. With no start quest in the bundle (placed past
 * every quest, or at a stage the tier lacks) the tag goes on the highest stage
 * that holds a placed-out quest, so it stays put while the learner finishes
 * those quests. Ids the bundle does not hold are ignored. Null without a route.
 */
export function startMarkerOf(route: RouteSeed | null, order: readonly RouteEntry[]): MyRouteModel['start'] {
  if (route === null) return null;
  const start = order.find((e) => e.questId === route.startQuestId);
  if (start !== undefined) return { stage: start.stage, questId: start.questId };
  const placedOut = new Set(route.placedOutQuestIds);
  const highest = [...order].reverse().find((e) => placedOut.has(e.questId));
  return highest === undefined ? null : { stage: highest.stage, questId: null };
}
