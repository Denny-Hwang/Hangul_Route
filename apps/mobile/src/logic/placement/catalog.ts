import type { Episode, Jamo, Quest, RouteCatalog, RouteQuest } from '@hangul-route/content-schema';
import { cellKey, volumeOf } from '../../content/episodes';
import { findJamo } from '../../content/jamo';
import { questTeaches } from '../stage1/curriculum';
import { appRouteCatalog } from './route-skip';

/**
 * The route catalogue a finished level check is scored against (F-PLC-001
 * section 3.6): the app's quests in cursor order, each with the symbol keys its
 * Discover step teaches (`'ㄱ'`, `'ㄴ/final'`). A quest is placed out by the
 * symbols only when it teaches some: quests 1-10 (all 30 symbols, F-QUEST-002 Q-6a
 * to Q-8) are placed out by their symbols from a `stage1` level, while the five
 * reading quests (nature q2-q3, crafts q1-q3, rule R5) teach none, so only a `stage2`
 * or higher level places those out (F-PLC-001 rule 3, consolidation quests).
 */

/** `'ㄱ'` for a consonant or vowel, `'ㄱ/final'` for a final (F-QUEST-002 section 3.7). */
export function symbolKeyOf(jamo: Pick<Jamo, 'char' | 'kind'>): string {
  return jamo.kind === 'batchim' ? `${jamo.char}/final` : jamo.char;
}

/**
 * A cell's later volume (F-CURR-002 row CM-40) in the placement catalogue: still a grid quest, so a level above its
 * stage places it out with Volume 1, but never a start. It is not playable from the route (it opens from its cell page,
 * behind `volumes`), so the grown-up's "Choose a different start" never lists it and a seed never starts on it; and it
 * sits in route order right after its cell's Volume 1, so a grown-up's chosen start places out the later volumes of the
 * cells before it and puts back those after it, never a whole route for a quest at the end of the quest list.
 */
function withLaterVolumes(catalog: RouteCatalog, episodes: readonly Episode[]): RouteCatalog {
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const later = (q: RouteQuest): boolean => volumeOf(episodeById.get(q.episodeId) ?? {}) > 1;
  const lastOfCell = new Map<string, number>();
  for (const q of catalog.quests) if (!later(q)) lastOfCell.set(cellKey(q), Math.max(lastOfCell.get(cellKey(q)) ?? -Infinity, q.order));
  return {
    quests: catalog.quests.map((q) => (later(q) ? { ...q, playable: false, order: (lastOfCell.get(cellKey(q)) ?? q.order) + 0.5 } : q)),
  };
}

export function placementRouteCatalog(
  quests: readonly Quest[],
  episodes: readonly Episode[],
  jamoOf: (id: string) => Pick<Jamo, 'char' | 'kind'> | undefined = findJamo,
): RouteCatalog {
  const byId = new Map(quests.map((quest) => [quest.id, quest]));
  return withLaterVolumes(
    {
      quests: appRouteCatalog(quests, episodes).quests.map((routeQuest) => {
        const quest = byId.get(routeQuest.id) as Quest;
        const teaches = questTeaches(quest).flatMap((id) => {
          const jamo = jamoOf(id);
          return jamo === undefined ? [] : [symbolKeyOf(jamo)];
        });
        return { ...routeQuest, teaches };
      }),
    },
    episodes,
  );
}
