import type { Episode, Quest } from '@hangul-route/content-schema';

/**
 * The quest a brand-new learner lands in straight after onboarding
 * (wireframe onboarding/first-quest-preview): the first quest of the
 * lowest-ordered shipped episode. Content-driven so a content change can
 * never leave the preview copy stale.
 */
export interface FirstQuestTarget {
  episode: Episode;
  quest: Quest;
  /** Distinct jamo characters taught by the episode's first quest scope. */
  questCount: number;
  cardCount: number;
}

export function firstQuestFor(
  episodes: readonly Episode[],
  quests: readonly Quest[],
): FirstQuestTarget | null {
  const shipped = episodes
    .filter((e) => e.status === 'shipped')
    .sort((a, b) => a.order - b.order);
  for (const episode of shipped) {
    const firstQuestId = episode.questIds[0];
    const quest = quests.find((q) => q.id === firstQuestId);
    if (quest) {
      return {
        episode,
        quest,
        questCount: episode.questIds.length,
        cardCount: episode.rewardCardIds.length,
      };
    }
  }
  return null;
}
