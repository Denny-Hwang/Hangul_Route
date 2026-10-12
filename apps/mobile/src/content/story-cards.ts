import type { HeritageCard } from '@hangul-route/content-schema';
import { buildStoryCards } from '../logic/awards/story-cards';
import type { CardSet } from '../logic/awards/types';
import { heldStoryCards, storiesAll } from './stories';
import { storySetDefs } from './story-sets';

/**
 * The heritage story cards of the bundle (F-STORY-006 §3.8): one per reviewed
 * shelf story with a `card` block, then the legendary card of each complete
 * collection. `heritageCardsAll` appends them; the award engine reads the
 * sets. Zero today: the `card` blocks arrive with the reviewed stories (6.8).
 * A held story keeps its card (no fact, no citation) so a learner who owns it
 * still sees it (rule 1); `heldStoryCardIds` lists those cards, and
 * `heldSetCardIds` the set cards with a held member (neither can be earned
 * until the hold is lifted).
 */
const built = buildStoryCards(storiesAll, storySetDefs, heldStoryCards);

export const storyCards: readonly HeritageCard[] = built.cards;
export const storySets: readonly CardSet[] = built.sets;
export const heldStoryCardIds: readonly string[] = built.heldCardIds;
export const heldSetCardIds: readonly string[] = built.heldSetCardIds;
