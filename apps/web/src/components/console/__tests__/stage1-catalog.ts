import { CATALOG, ThemeKeySchema, cellIsReady, type CatalogCell, type CatalogQuest } from '@hangul-route/content-schema';

/**
 * Test data only: the ready Stage 1 episodes in grid (theme) order with their quests, read straight from `CATALOG`
 * (the console pickers draw every stage through `chooserGroups`; nothing in the app lists Stage 1 on its own).
 * The pseudo-locale tests treat these titles as content.
 */
export const STAGE1_EPISODES: readonly CatalogCell[] = CATALOG.cells
  .filter((cell) => cell.stage === 'stage1' && cellIsReady(cell))
  .sort((a, b) => ThemeKeySchema.options.indexOf(a.theme) - ThemeKeySchema.options.indexOf(b.theme));

/** The quests of an episode in the cell's own order. */
export function questsOfCell(cell: CatalogCell): CatalogQuest[] {
  return cell.questIds.map((id) => CATALOG.quests.find((q) => q.id === id)).filter((q): q is CatalogQuest => q !== undefined);
}

/** Every Stage 1 episode and quest title (English, as CATALOG holds them). */
export const STAGE1_TITLES: readonly string[] = STAGE1_EPISODES.flatMap((cell) => [cell.title, ...questsOfCell(cell).map((q) => q.title)]);
