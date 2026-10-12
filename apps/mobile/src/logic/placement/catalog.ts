import type { Episode, Jamo, Quest, RouteCatalog } from '@hangul-route/content-schema';
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

export function placementRouteCatalog(
  quests: readonly Quest[],
  episodes: readonly Episode[],
  jamoOf: (id: string) => Pick<Jamo, 'char' | 'kind'> | undefined = findJamo,
): RouteCatalog {
  const byId = new Map(quests.map((quest) => [quest.id, quest]));
  return {
    quests: appRouteCatalog(quests, episodes).quests.map((routeQuest) => {
      const quest = byId.get(routeQuest.id) as Quest;
      const teaches = questTeaches(quest).flatMap((id) => {
        const jamo = jamoOf(id);
        return jamo === undefined ? [] : [symbolKeyOf(jamo)];
      });
      return { ...routeQuest, teaches };
    }),
  };
}
