import {
  effectiveRoute,
  type PlacementResult,
  type RouteCatalog,
  type RouteQuest,
  type StageKey,
  type ThemeKey,
} from '@hangul-route/content-schema';
import { pipStateOf } from '../my-route/pips';

/**
 * The Journey's placed-out look (F-PLC-001 section 3.7, consumer 3): a cell
 * whose quests are all placed out or done, and not all done, draws a light
 * outline and a small check-in-circle glyph, clearly different from the
 * completed tint; it stays tappable and awards normally. A pin marks the
 * start cell. Pure, so F-STORY-005's `cellModel` can take it as an input.
 * A thin adapter over F-ROUTE-001's `pipStateOf` (`logic/my-route/pips.ts`),
 * so "placed out" keeps one definition (AM-13): a cell is placed out when
 * every quest is `done` or `known` and not every quest is `done`.
 * Only grid quests count: shelf content is never placed out.
 */

export type CellLook = 'done' | 'placed-out' | 'none';

function gridQuestsByEpisode(catalog: RouteCatalog): Map<string, RouteQuest[]> {
  const out = new Map<string, RouteQuest[]>();
  for (const quest of catalog.quests) {
    if (!quest.grid) continue;
    out.set(quest.episodeId, [...(out.get(quest.episodeId) ?? []), quest]);
  }
  return out;
}

function lookOf(quests: readonly RouteQuest[], placedOut: ReadonlySet<string>, completed: ReadonlySet<string>): CellLook {
  if (quests.length === 0) return 'none';
  // Only `done` and `known` matter to the look, so the other two facts stay at their neutral value.
  const states = quests.map((q) =>
    pipStateOf({ done: completed.has(q.id), placedOut: placedOut.has(q.id), joinedAfterLatch: false, offerable: true }),
  );
  if (states.every((state) => state === 'done')) return 'done';
  return states.every((state) => state === 'done' || state === 'known') ? 'placed-out' : 'none';
}

/** The look of one cell (episode). */
export function cellLook(
  episodeId: string,
  catalog: RouteCatalog,
  placedOut: ReadonlySet<string>,
  completed: ReadonlySet<string>,
): CellLook {
  return lookOf(gridQuestsByEpisode(catalog).get(episodeId) ?? [], placedOut, completed);
}

/** Every episode that draws the placed-out look, in catalogue order. */
export function placedOutEpisodeIds(
  catalog: RouteCatalog,
  placedOut: ReadonlySet<string>,
  completed: ReadonlySet<string>,
): string[] {
  return [...gridQuestsByEpisode(catalog).entries()]
    .filter(([, quests]) => lookOf(quests, placedOut, completed) === 'placed-out')
    .map(([episodeId]) => episodeId);
}

/** The grid cell holding the start quest (the pin), or null. */
export function startCell(
  catalog: RouteCatalog,
  startQuestId: string | null,
): { episodeId: string; stage: StageKey; theme: ThemeKey } | null {
  const quest = catalog.quests.find((q) => q.grid && q.id === startQuestId);
  return quest === undefined ? null : { episodeId: quest.episodeId, stage: quest.stage, theme: quest.theme };
}

/** What the Journey grid draws for a learner with a stored result. */
export interface JourneyMarks {
  /** The effective placed-out set: the union of every result, minus what a grown-up put back. */
  placedOut: ReadonlySet<string>;
  /** The cell with the pin, or null when no playable quest is left to start. */
  start: { episodeId: string; stage: StageKey; theme: ThemeKey } | null;
}

/**
 * The Journey's marks from the stored results (`effectiveRoute`), or null
 * without one (the grid is unchanged). The pin is computed with **no**
 * completions, as F-ROUTE-001's start marker is: "where you started" is a
 * fixed anchor that moves only with a higher retake or a grown-up override,
 * never because the learner played. `isEntitled` is the cursor's stage rule
 * (`cursorEntitlement`), so the pin never sits where the cursor cannot go.
 */
export function journeyMarks(
  placements: readonly PlacementResult[] | undefined,
  catalog: RouteCatalog,
  isEntitled: (stage: StageKey) => boolean,
): JourneyMarks | null {
  if (placements === undefined || placements.length === 0) return null;
  // Never null here: `effectiveRoute` is null only for an empty list.
  const seed = effectiveRoute(placements, catalog, { isEntitled, completedQuestIds: new Set() }) as NonNullable<
    ReturnType<typeof effectiveRoute>
  >;
  return { placedOut: new Set(seed.placedOutQuestIds), start: startCell(catalog, seed.startQuestId) };
}
