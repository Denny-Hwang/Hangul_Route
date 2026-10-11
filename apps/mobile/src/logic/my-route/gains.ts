import type { Episode, ProgressSnapshot } from '@hangul-route/content-schema';
import { isGridEpisode } from './order';

/**
 * Gains (F-ROUTE-001 section 3.8): absolute numbers, shown only when greater
 * than zero. Stars is the sum of the best stars per quest; Cards has no total;
 * Stories read counts distinct finished shelf quests.
 */
export function gainsOf(i: {
  snapshot: Pick<ProgressSnapshot, 'quests' | 'cards'>;
  episodes: readonly Episode[];
}): { stars: number; cards: number; storiesRead: number } {
  const best = new Map<string, number>();
  for (const q of i.snapshot.quests) best.set(q.questId, Math.max(best.get(q.questId) ?? 0, q.stars));
  const shelfQuests = new Set(i.episodes.filter((e) => !isGridEpisode(e)).flatMap((e) => e.questIds));
  const storiesRead = new Set(i.snapshot.quests.filter((q) => q.completedAt && shelfQuests.has(q.questId)).map((q) => q.questId));
  return {
    stars: [...best.values()].reduce((sum, n) => sum + n, 0),
    cards: i.snapshot.cards.length,
    storiesRead: storiesRead.size,
  };
}
