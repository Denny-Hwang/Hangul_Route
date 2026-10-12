import { describe, expect, it } from 'vitest';
import {
  CARD_ID_RE,
  STORY_CARD_FACT_MAX_CHARS,
  STORY_CARD_MIN_SOURCES,
  storyCardId,
  storyCardRarity,
} from '../index';

describe('story card helpers (F-STORY-006 §3.8)', () => {
  it('pins the back-face fact limits', () => {
    expect(STORY_CARD_FACT_MAX_CHARS).toBe(180);
    expect(STORY_CARD_MIN_SOURCES).toBe(2);
  });

  it('names a story card card:story-<slug>, a valid card id', () => {
    expect(storyCardId('story:cheugugi-rain-gauge')).toBe('card:story-cheugugi-rain-gauge');
    expect(storyCardId('story:hangul-day')).toBe('card:story-hangul-day');
    expect(CARD_ID_RE.test(storyCardId('story:sun-and-moon'))).toBe(true);
  });

  it('derives rarity from the recommended stage: 1 common, 2 uncommon, 3 and later rare', () => {
    expect(storyCardRarity(1)).toBe('common');
    expect(storyCardRarity(2)).toBe('uncommon');
    expect([3, 4, 5, 6, 7].map(storyCardRarity)).toEqual(['rare', 'rare', 'rare', 'rare', 'rare']);
  });
});
