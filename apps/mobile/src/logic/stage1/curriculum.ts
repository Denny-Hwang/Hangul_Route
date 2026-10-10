import type { Episode, Quest } from '@hangul-route/content-schema';
import { episodesAll, questsAll } from '../../content';
import { playableEpisodes } from '../next-quest';

/**
 * Which quest teaches which symbol (F-QUEST-002 §3.6, §3.7). A symbol is taught
 * by the Discover step of exactly one quest; everything else only asks it.
 */

/** The stage1 quests of the playable grid episodes, in quest (content) order. */
export function stage1QuestsFrom(episodes: readonly Episode[], quests: readonly Quest[]): Quest[] {
  const ids = new Set(
    playableEpisodes(episodes)
      .filter((e) => e.stage === 'stage1')
      .flatMap((e) => e.questIds),
  );
  return quests.filter((q) => ids.has(q.id));
}

export const STAGE1_QUESTS: readonly Quest[] = stage1QuestsFrom(episodesAll, questsAll);

/** Jamo ids the quest's Discover step introduces, in page order. */
export function questTeaches(quest: Quest): string[] {
  const ids: string[] = [];
  for (const step of quest.steps) {
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items) {
        if (item.type === 'jamo') ids.push(item.jamoId);
      }
    }
  }
  return ids;
}

/** The quest that teaches a symbol, or `undefined` when none does. */
export function teachingQuestFor(jamoId: string, quests: readonly Quest[] = STAGE1_QUESTS): Quest | undefined {
  return quests.find((q) => questTeaches(q).includes(jamoId));
}

/** Everything taught by this quest and the quests before it, in teaching order. */
export function symbolsMetThrough(questId: string, quests: readonly Quest[] = STAGE1_QUESTS): string[] {
  const at = quests.findIndex((q) => q.id === questId);
  if (at === -1) return [];
  return quests.slice(0, at + 1).flatMap(questTeaches);
}
