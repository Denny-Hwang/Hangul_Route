import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { awardWorld } from '../../../content/award-world';
import { cardById } from '../../../content/heritage-cards';
import { episodeById } from '../../../content/episodes';
import { scanLearnerCopy } from '../../homework/banned-text';
import { cardWaits } from '../../reward';

describe('cardWaits (F-STORY-006 §3.1, F-MOTION-003 §3.5)', () => {
  it('a quest with no card has nothing waiting', () => {
    expect(cardWaits({ rewardCardId: undefined, stars: 1, held: false })).toBe(false);
  });

  it('under 2 stars a card not held waits; 2 and 3 stars earn it, so nothing waits', () => {
    expect(cardWaits({ rewardCardId: 'card:seollal', stars: 0, held: false })).toBe(true);
    expect(cardWaits({ rewardCardId: 'card:seollal', stars: 1, held: false })).toBe(true);
    expect(cardWaits({ rewardCardId: 'card:seollal', stars: 2, held: false })).toBe(false);
    expect(cardWaits({ rewardCardId: 'card:seollal', stars: 3, held: false })).toBe(false);
  });

  it('a card already held never waits, at any stars', () => {
    for (const stars of [0, 1, 2, 3] as const) expect(cardWaits({ rewardCardId: 'card:seollal', stars, held: true })).toBe(false);
  });
});

describe('the lines of a waiting card', () => {
  it('every shipped quest card is an episode card of its own episode, so the line always has an episode to name', () => {
    let seen = 0;
    for (const quest of awardWorld.quests) {
      const cardId = quest.rewardCardId;
      const card = cardId === undefined ? undefined : cardById(cardId);
      if (!card) continue;
      seen += 1;
      // The card's rule is the episode's id (`episode:<id>`), which is what the reward step and Results look up.
      expect(episodeById(card.unlockedBy)?.questIds ?? [], `${quest.id} -> ${card.id}`).toContain(quest.id);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the words name both ways to the card and are learner-safe in every language', () => {
    const en = getMessages('en').learner.quest.cardWaiting;
    expect(en.title('Lunar New Year')).toBe('The Lunar New Year card is waiting');
    expect(en.line('Lunar New Year', 'Holidays')).toBe(
      'Get 2 stars in this quest to earn the Lunar New Year card. You also get it when you finish every quest in Holidays.',
    );
    expect(scanLearnerCopy([en.title('Lunar New Year'), en.line('Lunar New Year', 'Holidays')])).toEqual([]);
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale).learner.quest.cardWaiting;
      for (const t of [m.title('Lunar New Year'), m.line('Lunar New Year', 'Holidays')]) {
        expect(t).toContain('Lunar New Year');
        expect(t).not.toMatch(/\d+\s*(of|\/|de)\s*\d+|%/);
        expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});
