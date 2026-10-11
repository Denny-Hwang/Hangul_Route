import type { Episode, Quest } from '@hangul-route/content-schema';
import { offerableQuests } from './next-quest';
import { CARD_UNLOCK_MIN_STARS } from './reward';

/**
 * How a locked card is earned, for the "how to earn" text of the Library pane
 * (F-LAYOUT-001 §3.6; wireframe layout/wide D: "where it is earned", no paywall).
 * A card is earned at `CARD_UNLOCK_MIN_STARS` or more in the quest that rewards it
 * (`logic/reward.ts`); a card no playable quest rewards yet is "later", never a promise
 * the app cannot keep. With `isEntitled`, a quest in a stage the learner cannot open is skipped
 * too, so the hint never points at a locked Premium quest (no implicit paywall, D5).
 */
export type CardEarnHint =
  | { kind: 'quest'; questId: string; questTitle: string; minStars: number }
  | { kind: 'later' };

export function cardEarnHint(
  cardId: string,
  quests: readonly Quest[],
  episodes: readonly Episode[],
  isEntitled?: (stageKey: string) => boolean,
): CardEarnHint {
  const quest = offerableQuests(quests, episodes, isEntitled).find((q) => q.rewardCardId === cardId);
  return quest
    ? { kind: 'quest', questId: quest.id, questTitle: quest.titleEn, minStars: CARD_UNLOCK_MIN_STARS }
    : { kind: 'later' };
}
