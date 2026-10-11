import type { RouteCatalog, RouteQuest } from '../placement/route-seed';
import { StageKeySchema, ThemeKeySchema, type StageKey, type ThemeKey } from '../schemas/heritage-card';
import { cellIsReady, storyIsReady, type Catalog } from './schema';

const NOT_ON_THE_ROUTE = Number.MAX_SAFE_INTEGER;

/**
 * The catalogue as F-PLC-001's `RouteCatalog` (spec section 3.2). `order` is the
 * canonical position on the route: lesson quests in grid order (stage, then theme,
 * then the cell's own quest list), then the story quests in story order. `playable`
 * is "the cell is ready" for a lesson and "the story is ready" for a story quest;
 * `grid` is `kind === 'lesson'`. A quest that no cell and no story lists (an invalid
 * catalogue) sorts last, in array order.
 */
export const routeCatalogOf = (catalog: Catalog): RouteCatalog => {
  const stageRank = (stage: StageKey): number => StageKeySchema.options.indexOf(stage);
  const themeRank = (theme: ThemeKey): number => ThemeKeySchema.options.indexOf(theme);

  const rank = new Map<string, number>();
  const cells = [...catalog.cells].sort(
    (a, b) => stageRank(a.stage) - stageRank(b.stage) || themeRank(a.theme) - themeRank(b.theme),
  );
  for (const cell of cells) for (const questId of cell.questIds) rank.set(questId, rank.size);
  const stories = [...catalog.stories].sort((a, b) => a.order - b.order);
  for (const story of stories) rank.set(story.questId, rank.size);

  const readyEpisodes = new Set(catalog.cells.filter(cellIsReady).map((cell) => cell.episodeId));
  const readyStoryQuests = new Set(catalog.stories.filter(storyIsReady).map((story) => story.questId));

  const quests = catalog.quests
    .map((quest) => ({ quest, rank: rank.get(quest.id) ?? NOT_ON_THE_ROUTE }))
    .sort((a, b) => a.rank - b.rank)
    .map(
      ({ quest }, index): RouteQuest => ({
        id: quest.id,
        episodeId: quest.episodeId,
        stage: quest.stage,
        theme: quest.theme,
        order: index + 1,
        teaches: [...quest.teaches],
        playable: quest.kind === 'lesson' ? readyEpisodes.has(quest.episodeId) : readyStoryQuests.has(quest.id),
        grid: quest.kind === 'lesson',
      }),
    );
  return { quests };
};
