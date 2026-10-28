/**
 * The upper-cell cards and the five category albums (F-CURR-002 §7.2, row CM-23; the decision record under §7.2).
 *
 * - **One card per upper cell**, earned by finishing the cell's first volume (`unlockedBy: 'episode:<cell>'`): 25 cells
 *   in all, Stages 2, 3, 4, 6 and 7 of the five themes (Stage 5 holds the books, F-STORY-005). Part 1 (Stages 2-3)
 *   shipped ten, part 2 appended Stage 4's five and part 3 Stages 6-7's ten, so every album can be finished.
 * - **The three shipped taste cells keep their awards** (F-CURR-001 "Cards"): Lunch Box Words, Outdoor Words and
 *   Greeting Dialogues still give their four cards each and their q1 card. Their album card is that q1
 *   card, the cell's rare card, so no shipped card moves, none is added, and the album slot is the one the learner
 *   already earns first (`UPPER_CARD_SHIPPED`, test data in upper-cell-card-sources.ts).
 * - **Albums**: one per theme (Letters, Food, Holidays, Nature, Play), holding that theme's upper-cell cards across the
 *   album stages. A finished album unlocks the theme's legendary card (row CM-23c: `albumLegendCards` in
 *   heritage-cards.ts, the sets in award-world.ts).
 * - **Fair**: every card here comes from finishing a cell. None is random and none is sold.
 */
import { ALBUM_ORDER, heritageCardsAll } from './heritage-cards';

// The album order (ALBUM_STAGES, ALBUM_THEMES) is content/album-order.ts, which only the upper-cards chunk reads (row
// CM-23 part 2), so the start bundle carries this list alone: the stage ceremony and summary read it.
/**
 * The upper-cell card of each cell, by stage then theme: a cell's rare card, earned by finishing it (`unlockedBy:
 * 'episode:<stage>-<theme>'`), on a stage after Stage 1. That is each upper cell's new card and the taste cells' q1
 * cards (`card:dosirak`, `card:byeol`, `card:insa`); no other card is rare and named for its own grid cell. Derived,
 * not listed (row CM-23 part 3), so the start bundle carries no second copy of the ids;
 * content/__tests__/upper-cell-cards.test.ts pins the twenty-five, and each card carries its stage and theme, so this
 * list is all the albums need.
 */
export const UPPER_CELL_CARDS: readonly string[] = heritageCardsAll
  .filter((c) => c.rarity === 'rare' && c.stage !== 'stage1' && c.unlockedBy === `episode:${c.stage}-${c.theme}`)
  .sort((a, b) => a.stage.localeCompare(b.stage) || ALBUM_ORDER.indexOf(a.theme) - ALBUM_ORDER.indexOf(b.theme))
  .map((c) => c.id);
