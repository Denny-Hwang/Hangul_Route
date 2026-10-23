import type { AwardWorld } from '../logic/awards/types';
import { withUpperCards } from '../logic/awards/upper-cards';
import { episodesAll } from './episodes';
import { UPPER_CARD_GATED_IDS, heritageCardsAll } from './heritage-cards';
import { questsAll } from './quests';
import { storySets } from './story-cards';

/**
 * The shipped bundle as the award engine reads it (F-STORY-006 §3.2): every
 * card, every grid and shelf episode, every quest, and the collections of
 * story cards whose member stories are all bundled (`content/story-cards.ts`).
 */
export const awardWorld: AwardWorld = {
  cards: heritageCardsAll,
  episodes: episodesAll,
  quests: questsAll,
  sets: storySets,
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
