import type { StageKey, ThemeKey } from '@hangul-route/content-schema';

/**
 * The upper-cell cards and the five category albums (F-CURR-002 §7.2, row CM-23; the decision record under §7.2).
 *
 * - **One card per upper cell**, earned by finishing the cell's first volume (`unlockedBy: 'episode:<cell>'`): 25 cells
 *   in all, Stages 2, 3, 4, 6 and 7 of the five themes (Stage 5 holds the books, F-STORY-005). Part 1 (Stages 2-3)
 *   ships these ten; parts 2 and 3 append Stages 4 and 6-7.
 * - **The two shipped taste cells keep their awards** (F-CURR-001 "Cards"): Lunch Box Words and Outdoor Words still give
 *   their four cards each and their q1 card. Their album card is that q1 card, the cell's rare card, so no shipped card
 *   moves, none is added, and the album slot is the one the learner already earns first (`UPPER_CARD_SHIPPED`).
 * - **Albums**: one per theme (Letters, Food, Holidays, Nature, Play), holding that theme's upper-cell cards across the
 *   album stages. A finished album unlocks the theme's legendary card; those cards ship in row CM-23c, once every album
 *   can complete (`logic/awards/albums.ts`).
 * - **Fair**: every card here comes from finishing a cell. None is random and none is sold.
 */
/** The stages whose cells fill the albums, in album order (Stage 5 is the books). */
export const ALBUM_STAGES: readonly StageKey[] = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'];

/** The albums in Library order: the Journey's theme order. */
export const ALBUM_THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

/**
 * The upper-cell card of each cell, by stage then theme. Each card names its cell in `unlockedBy` (`episode:<cell>`)
 * and carries the cell's stage and theme, so this list is all the albums need (content/__tests__/upper-cell-cards).
 */
export const UPPER_CELL_CARDS: readonly string[] = [
  // Stage 2
  'card:norae',
  'card:dosirak',
  'card:bokjumeoni',
  'card:byeol',
  'card:swing',
  // Stage 3
  'card:hangeul',
  'card:tteok',
  'card:full-moon',
  'card:gom',
  'card:yut',
];

/** The two album cards that shipped before row CM-23 (the taste cells' q1 cards): never gated (heritage-cards.ts `UPPER_CARD_GATED_IDS`). */
export const UPPER_CARD_SHIPPED: ReadonlySet<string> = new Set(['card:dosirak', 'card:byeol']);

