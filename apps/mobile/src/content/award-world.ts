import type { AwardWorld, CardSet } from '../logic/awards/types';
import { withUpperCards } from '../logic/awards/upper-cards';
import { episodesWithVolumes } from './episodes';
import { UPPER_CARD_GATED_IDS, albumLegendCards, cardById, heritageCardsAll } from './heritage-cards';
import { questsAll } from './quests';
import { storySets } from './story-cards';
import { UPPER_CELL_CARDS } from './upper-cell-cards';

/**
 * The five album sets (F-CURR-002 §7.2, row CM-23c): a legendary card's set is its theme's upper-cell cards across the
 * album stages, so the set rule brings it once the learner holds all five, dated by the last of them (the same on every
 * device). `titleEn` is the album's theme key: the Library names the album in the UI language (`logic/awards/earn-hint.ts`).
 * `logic/awards/albums.ts` (`albumSets`) derives the same sets from the album views (test).
 */
export const albumCardSets: readonly CardSet[] = albumLegendCards.map((c) => ({
  id: c.unlockedBy,
  cardId: c.id,
  titleEn: c.theme,
  memberCardIds: UPPER_CELL_CARDS.filter((id) => cardById(id)?.theme === c.theme),
}));

/**
 * The shipped bundle as the award engine reads it (F-STORY-006 §3.2): every
 * card, every grid and shelf episode, every quest, and the collections of
 * story cards whose member stories are all bundled (`content/story-cards.ts`).
 * A cell's later volume is one of its episodes (F-CURR-002 row CM-40), so an
 * `episode:` card of a Volume 2 or a Stage 5 book 2 is derived whether
 * `volumes` is on or off; a stage's completion still reads each cell's first
 * volume (`derive.ts` `stageCells`).
 */
export const awardWorld: AwardWorld = {
  cards: heritageCardsAll,
  episodes: episodesWithVolumes,
  quests: questsAll,
  sets: [...storySets, ...albumCardSets],
  // F-CURR-002 §4.8 step 7 (row CM-23): the upper-cell cards are dated by the cells' first finishes.
  firstFinishCardIds: UPPER_CARD_GATED_IDS,
};

/** The award world under the `upperCards` switch for a learner holding `owned` (logic/awards/upper-cards.ts). */
export const awardWorldFor = (upperCardsOn: boolean, owned: ReadonlySet<string>): AwardWorld =>
  withUpperCards(awardWorld, upperCardsOn, UPPER_CARD_GATED_IDS, owned);

/**
 * Cards every profile is given on its first launch (`unlockedBy:
 * 'first-launch'`, F-STORY-006 §3.3): Hoya's welcome card. They are never a
 * catch-up and never the learner's first earned card (§3.4, §3.5).
 */
export const welcomeCardIds: readonly string[] = heritageCardsAll.filter((c) => c.unlockedBy === 'first-launch').map((c) => c.id);
