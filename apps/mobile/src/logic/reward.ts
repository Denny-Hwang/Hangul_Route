/**
 * Reward gating — F-MOTION-003 §3.5: a card is unlocked (and its banner
 * shown) only from 2 stars up. 1-star and 0-star runs keep the card waiting
 * so the Library never shows a card the celebration never announced.
 */
export const CARD_UNLOCK_MIN_STARS = 2;

export function shouldUnlockCard(stars: 0 | 1 | 2 | 3): boolean {
  return stars >= CARD_UNLOCK_MIN_STARS;
}
