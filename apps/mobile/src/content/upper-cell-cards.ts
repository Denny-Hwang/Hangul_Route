/**
 * The upper-cell cards and the five category albums (F-CURR-002 §7.2, row CM-23; the decision record under §7.2).
 *
 * - **One card per upper cell**, earned by finishing the cell's first volume (`unlockedBy: 'episode:<cell>'`): 25 cells
 *   in all, Stages 2, 3, 4, 6 and 7 of the five themes (Stage 5 holds the books, F-STORY-005). Part 1 (Stages 2-3)
 *   shipped ten, part 2 appends Stage 4's five; part 3 appends Stages 6-7.
 * - **The three shipped taste cells keep their awards** (F-CURR-001 "Cards"): Lunch Box Words, Outdoor Words and
 *   Greeting Dialogues still give their four cards each and their q1 card. Their album card is that q1
 *   card, the cell's rare card, so no shipped card moves, none is added, and the album slot is the one the learner
 *   already earns first (`UPPER_CARD_SHIPPED`, test data in upper-cell-card-sources.ts).
 * - **Albums**: one per theme (Letters, Food, Holidays, Nature, Play), holding that theme's upper-cell cards across the
 *   album stages. A finished album unlocks the theme's legendary card; those cards ship in row CM-23c, once every album
 *   can complete (`logic/awards/albums.ts`).
 * - **Fair**: every card here comes from finishing a cell. None is random and none is sold.
 */
// The album order (ALBUM_STAGES, ALBUM_THEMES) is content/album-order.ts, which only the upper-cards chunk reads (row
// CM-23 part 2), so the start bundle carries this list alone: the stage ceremony and summary read it.
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
  // Stage 4 (part 2)
  'card:mwoyeyo',
  'card:masisseoyo',
  'card:insa',
  'card:biga-wayo',
  'card:gachi',
];

