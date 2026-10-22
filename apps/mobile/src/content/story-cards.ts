import type { HeritageCard, Story } from '@hangul-route/content-schema';
import type { StoryStore } from '../logic/story/story-chunk-store';
import { buildStoryCards, storyCardFor } from '../logic/awards/story-cards';
import type { CardSet } from '../logic/awards/types';
import { heldStoryCards, storiesAll, storyById, storyContent } from './stories';
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

/**
 * The fields of a story card that come from its story's body chunk (F-CURR-002 §10, row CM-8): the
 * blurb (the story's summary), the fact and its citation. The face (title, Korean word, theme, stage)
 * is in the shelf, so a card is listed and awarded at start; the back reads these once the story's
 * chunk is in (the card screens load it, `useStoriesLoaded`).
 */
const BODY_FIELDS = ['blurbEn', 'factEn', 'factId', 'citation'] as const;

/** What a live card reads: the story store and the stories over it. */
export interface LiveStoryCardDeps {
  store: Pick<StoryStore, 'version' | 'isStoryReady'>;
  storyById: (id: string) => Story | undefined;
}

/**
 * A card built at start (its back fields the placeholders of a cold store) whose blurb, fact, fact id and
 * citation read the story's card again once its chunk is in. Held cards and set cards are returned as built.
 */
export function liveStoryCard(card: HeritageCard, held: ReadonlySet<string>, deps: LiveStoryCardDeps): HeritageCard {
  const story = card.storyId === undefined || held.has(card.id) ? undefined : deps.storyById(card.storyId);
  if (story === undefined) return card;
  let cached: { version: number; card: HeritageCard } | null = null;
  const current = (): HeritageCard => {
    const version = deps.store.version();
    if (cached === null || cached.version !== version) {
      cached = { version, card: deps.store.isStoryReady(story.id) ? (storyCardFor(story) ?? card) : card };
    }
    return cached.card;
  };
  const live = { ...card };
  for (const field of BODY_FIELDS) {
    Object.defineProperty(live, field, { enumerable: true, configurable: false, get: () => current()[field] });
  }
  return live;
}

const heldIds = new Set(built.heldCardIds);

export const storyCards: readonly HeritageCard[] = built.cards.map((card) => liveStoryCard(card, heldIds, { store: storyContent, storyById }));
export const storySets: readonly CardSet[] = built.sets;
export const heldStoryCardIds: readonly string[] = built.heldCardIds;
export const heldSetCardIds: readonly string[] = built.heldSetCardIds;
