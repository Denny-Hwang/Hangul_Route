import type { RouteCatalog, RouteQuest, StageKey, ThemeKey } from '@hangul-route/content-schema';

/**
 * The Journey's placed-out look (F-PLC-001 section 3.7, consumer 3): a cell
 * whose quests are all placed out or done, and not all done, draws a light
 * outline and a small check-in-circle glyph, clearly different from the
 * completed tint; it stays tappable and awards normally. A pin marks the
 * start cell. Pure, so F-STORY-005's `cellModel` can take it as an input.
 * When F-ROUTE-001's `pipStateOf` (`logic/my-route/pips.ts`, R-1a) lands,
 * this becomes a thin adapter over it, so "placed out" keeps one definition.
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
  if (quests.every((q) => completed.has(q.id))) return 'done';
  return quests.every((q) => completed.has(q.id) || placedOut.has(q.id)) ? 'placed-out' : 'none';
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
