/**
 * Reward gating — F-MOTION-003 §3.5: a card is unlocked (and its banner
 * shown) only from 2 stars up. 1-star and 0-star runs keep the card waiting
 * so the Library never shows a card the celebration never announced.
 */
export const CARD_UNLOCK_MIN_STARS = 2;

export function shouldUnlockCard(stars: 0 | 1 | 2 | 3): boolean {
  return stars >= CARD_UNLOCK_MIN_STARS;
}

export interface CardAward {
  cardId: string;
  /** false on a replay whose card is already in the Library — nothing to announce. */
  isNew: boolean;
  /** The learner's first card ever (card.first_earned). */
  isFirstCard: boolean;
}

/**
 * What the results screen may announce (audit UX-03). A card is awarded at
 * 2+ stars (above), but it is *announced* — reveal, card.unlocked
 * telemetry — only when this run earned it for the first time. Replaying a
 * finished quest must not say "new card" again.
 */
export function decideCardAward(input: {
  rewardCardId: string | undefined;
  stars: 0 | 1 | 2 | 3;
  ownedCardIds: readonly string[];
}): CardAward | null {
  const { rewardCardId, stars, ownedCardIds } = input;
  if (!rewardCardId || !shouldUnlockCard(stars)) return null;
  const isNew = !ownedCardIds.includes(rewardCardId);
  return { cardId: rewardCardId, isNew, isFirstCard: isNew && ownedCardIds.length === 0 };
}
