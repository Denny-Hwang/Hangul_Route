import type { Rarity } from './schemas/heritage-card';

/**
 * The heritage story cards (F-STORY-006 §3.8): one card per shelf story,
 * generated from the story's `card` block. These helpers are shared by the
 * story lint (`story-lint.ts`) and the app's card builder, so the lint and the
 * bundle can never disagree on a card's id, rarity or fact limits.
 */

/** A back-face fact is the verbatim `claimEn`, at most this many characters. */
export const STORY_CARD_FACT_MAX_CHARS = 180;

/** A back-face fact cites at least this many sources (the first is printed, the rest counted). */
export const STORY_CARD_MIN_SOURCES = 2;

/** `story:cheugugi-rain-gauge` -> `card:story-cheugugi-rain-gauge`. */
export function storyCardId(storyId: string): string {
  return `card:story-${storyId.replace(/^story:/, '')}`;
}

/**
 * Rarity is derived, never stored, so a card and its story cannot disagree:
 * recommended stage 1 is common, 2 uncommon, 3 and later rare.
 */
export function storyCardRarity(recommendedStage: number): Rarity {
  if (recommendedStage <= 1) return 'common';
  if (recommendedStage === 2) return 'uncommon';
  return 'rare';
}
