import {
  StageKeySchema,
  ThemeKeySchema,
  type Episode,
  type Quest,
  type RouteCatalog,
  type StageKey,
  type ThemeKey,
} from '@hangul-route/content-schema';
import { playableEpisodes } from '../next-quest';

/**
 * The one ordered list (F-ROUTE-001 section 3.2): the grid quests of the
 * playable grid episodes, in `RouteQuest.order` (stage, then theme, then the
 * cell's own quest list). Pips, the cursor check and the start marker all read it.
 */

/**
 * A grid episode. The bundle is not parsed, so `placement` is absent on every
 * hand-written episode and the schema default `'grid'` never applied; the
 * `?? 'grid'` stands in for it. F-STORY-004's `gridEpisodes` replaces this
 * predicate when it lands, with the same fallback.
 */
export const isGridEpisode = (episode: Pick<Episode, 'placement'>): boolean =>
  (episode.placement ?? 'grid') === 'grid';

export const gridEpisodesOf = (episodes: readonly Episode[]): Episode[] => episodes.filter(isGridEpisode);

export interface RouteEntry {
  questId: string;
  episodeId: string;
  stage: StageKey;
  theme: ThemeKey;
}

const stageRank = (stage: StageKey): number => StageKeySchema.options.indexOf(stage);
const themeRank = (theme: ThemeKey): number => ThemeKeySchema.options.indexOf(theme);

/**
 * Quests an episode lists but the bundle does not hold are left out (they
 * could never be the cursor). A quest the catalogue does not list sorts after
 * the listed ones of its cell, in the episode's own order.
 */
export function routeOrder(input: {
  catalog: RouteCatalog;
  episodes: readonly Episode[];
  quests: readonly Pick<Quest, 'id'>[];
}): RouteEntry[] {
  const known = new Set(input.quests.map((q) => q.id));
  const rank = new Map(input.catalog.quests.map((q) => [q.id, q.order]));
  const entries = playableEpisodes(gridEpisodesOf(input.episodes)).flatMap((e) =>
    e.questIds
      .filter((id) => known.has(id))
      .map((questId, index) => ({ questId, episodeId: e.id, stage: e.stage, theme: e.theme, index })),
  );
  const unlisted = Number.MAX_SAFE_INTEGER;
  entries.sort(
    (a, b) =>
      stageRank(a.stage) - stageRank(b.stage) ||
      themeRank(a.theme) - themeRank(b.theme) ||
      (rank.get(a.questId) ?? unlisted) - (rank.get(b.questId) ?? unlisted) ||
      a.index - b.index,
  );
  return entries.map(({ questId, episodeId, stage, theme }) => ({ questId, episodeId, stage, theme }));
}
