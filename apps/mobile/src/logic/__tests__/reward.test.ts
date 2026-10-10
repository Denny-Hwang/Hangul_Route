import { describe, expect, it } from 'vitest';
import { CARD_UNLOCK_MIN_STARS, decideCardAward, shouldUnlockCard } from '../reward';

describe('shouldUnlockCard (F-MOTION-003 §3.5)', () => {
  it('unlocks at 2 and 3 stars', () => {
    expect(shouldUnlockCard(2)).toBe(true);
    expect(shouldUnlockCard(3)).toBe(true);
  });
  it('never unlocks at 0 or 1 star', () => {
    expect(shouldUnlockCard(0)).toBe(false);
    expect(shouldUnlockCard(1)).toBe(false);
  });
  it('threshold constant matches the spec', () => {
    expect(CARD_UNLOCK_MIN_STARS).toBe(2);
  });
});

describe('decideCardAward (F-MOTION-003 §3.5, audit UX-03)', () => {
  it('no reward card, no award', () => {
    expect(decideCardAward({ rewardCardId: undefined, stars: 3, ownedCardIds: [] })).toBeNull();
  });

  it('below 2 stars, no award', () => {
    expect(decideCardAward({ rewardCardId: 'card:book', stars: 1, ownedCardIds: [] })).toBeNull();
    expect(decideCardAward({ rewardCardId: 'card:book', stars: 0, ownedCardIds: [] })).toBeNull();
  });

  it('a card the learner does not own yet is new', () => {
    expect(decideCardAward({ rewardCardId: 'card:book', stars: 2, ownedCardIds: ['card:kimchi'] })).toEqual({
      cardId: 'card:book',
      isNew: true,
      isFirstCard: false,
    });
  });

  it('the very first card is flagged for card.first_earned', () => {
    expect(decideCardAward({ rewardCardId: 'card:book', stars: 3, ownedCardIds: [] })).toEqual({
      cardId: 'card:book',
      isNew: true,
      isFirstCard: true,
    });
  });

  it('replaying a quest whose card is already owned is not a new card', () => {
    expect(decideCardAward({ rewardCardId: 'card:book', stars: 3, ownedCardIds: ['card:book'] })).toEqual({
      cardId: 'card:book',
      isNew: false,
      isFirstCard: false,
    });
  });
});
