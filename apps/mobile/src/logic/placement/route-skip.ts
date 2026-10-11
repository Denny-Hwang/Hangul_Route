import { effectiveRoute, type Episode, type PlacementResult, type Quest, type RouteCatalog, type RouteQuest, type RouteSeed } from '@hangul-route/content-schema';
import { gridEpisodes } from '../../content/episodes';
import { playableEpisodes } from '../next-quest';

/**
 * The app's quests as F-PLC-001's `RouteCatalog`, in the cursor's order (the
 * quest list order), so "every grid quest before the chosen one" of a parent
 * override means what the cursor means by "before". Only what the placed-out
 * set needs is filled: `teaches` is empty (the stored results already carry
 * their placed-out ids; the level map is not recomputed here).
 */
export function appRouteCatalog(quests: readonly Quest[], episodes: readonly Episode[]): RouteCatalog {
  const grid = new Set(gridEpisodes(episodes).map((e) => e.id));
  const playable = new Set(playableEpisodes(episodes).map((e) => e.id));
  // The first episode listing a quest wins (the later ones are written first and overwritten).
  const episodeOf = new Map<string, Episode>();
  for (const episode of [...episodes].reverse()) for (const questId of episode.questIds) episodeOf.set(questId, episode);
  return {
    quests: quests.flatMap((quest, index): RouteQuest[] => {
      const episode = episodeOf.get(quest.id);
      if (episode === undefined) return [];
      return [
        {
          id: quest.id,
          episodeId: episode.id,
          stage: episode.stage,
          theme: episode.theme,
          order: index,
          teaches: [],
          playable: playable.has(episode.id),
          grid: grid.has(episode.id),
        },
      ];
    }),
  };
}

/**
 * The quests the shared cursor skips (F-PLC-001 section 3.7, consumer 1):
 * the effective route's placed-out set (the union of every result, minus
 * what a parent override put back). Undefined without a stored result, so
 * the cursor is unchanged for every learner who never took the check.
 */
export function placedOutSkipSet(
  placements: readonly PlacementResult[] | undefined,
  quests: readonly Quest[],
  episodes: readonly Episode[],
): ReadonlySet<string> | undefined {
  if (placements === undefined || placements.length === 0) return undefined;
  // Never null here: `effectiveRoute` is null only for an empty list.
  const seed = effectiveRoute(placements, appRouteCatalog(quests, episodes), {
    isEntitled: () => true,
    completedQuestIds: new Set(),
  }) as RouteSeed;
  return new Set(seed.placedOutQuestIds);
}
