import type { HeritageCard } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { HELD_STORY_CARDS, STORY_SHELF, loadStoryBody } from '../__generated__/stories-index';
import { buildStoryCards } from '../../logic/awards/story-cards';
import { createStoryStore, storiesOverStore, type StoryBodyChunk } from '../../logic/story/story-chunk-store';
import { liveStoryCard, storyCards, storySets, heldStoryCardIds, heldSetCardIds } from '../story-cards';
import { storySetDefs } from '../story-sets';

/**
 * The story cards are built at module load (F-CURR-002 §10, row CM-8), when the app's story store is
 * still cold: keywords hold only the card's keyword, facts are empty and the summary is blank. The global
 * test setup preloads every chunk, so the app's `storyCards` here were built warm. This builds them again
 * from a store whose chunks have not arrived and checks that a cold build lists, groups and awards the
 * same cards with the same faces, and that a live card's back moves from the placeholder to the loaded
 * values once its story's chunk is in.
 */
const FACE = ['id', 'titleEn', 'subtitleKo', 'romanization', 'theme', 'stage', 'rarity', 'unlockedBy', 'storyId'] as const;
const face = (card: HeritageCard): Partial<HeritageCard> => Object.fromEntries(FACE.map((k) => [k, card[k]]));

/** A store whose loads wait until `arrive(id)` hands over the real chunk. */
function coldStore() {
  const waiting = new Map<string, (chunk: StoryBodyChunk) => void>();
  const store = createStoryStore({ entries: STORY_SHELF }, (id) => {
    const real = loadStoryBody(id);
    if (real === undefined) return undefined;
    return new Promise<StoryBodyChunk>((resolve) => {
      waiting.set(id, resolve);
    });
  });
  const arrive = async (id: string): Promise<void> => {
    const loading = store.ensureStories([id]);
    const chunk = (await loadStoryBody(id)) as StoryBodyChunk;
    waiting.get(id)?.(chunk);
    await loading;
  };
  return { store, arrive };
}

describe('story cards built from a cold store (the app at start)', () => {
  const cold = coldStore();
  const stories = storiesOverStore(STORY_SHELF, cold.store);
  const built = buildStoryCards(stories, storySetDefs, HELD_STORY_CARDS);

  it('the cold store holds no story body yet', () => {
    expect(STORY_SHELF.length).toBeGreaterThan(0);
    expect(STORY_SHELF.every((e) => !cold.store.isStoryReady(e.id))).toBe(true);
    expect(stories.every((s) => s.facts.length === 0 && s.summaryEn === '')).toBe(true);
  });

  it('lists the same cards, with the same faces, sets and held ids as the warm build', () => {
    expect(storyCards.length).toBeGreaterThan(0);
    expect(built.cards.map(face)).toEqual(storyCards.map(face));
    expect(built.sets).toEqual(storySets);
    expect(built.heldCardIds).toEqual(heldStoryCardIds);
    expect(built.heldSetCardIds).toEqual(heldSetCardIds);
  });

  it('a live card’s blurb, fact and citation move from the placeholder to the loaded values when its chunk arrives', async () => {
    const byId = new Map(stories.map((s) => [s.id, s]));
    const held = new Set(built.heldCardIds);
    const index = built.cards.findIndex((c) => c.storyId !== undefined && !held.has(c.id));
    expect(index).toBeGreaterThanOrEqual(0);
    const card = built.cards[index]!;
    const live = liveStoryCard(card, held, { store: cold.store, storyById: (id) => byId.get(id) });
    const warm = storyCards.find((c) => c.id === card.id)!;
    expect(live.blurbEn).toBe('');
    expect(live.factEn).toBeUndefined();
    expect(live.citation).toBeUndefined();
    expect(face(live)).toEqual(face(warm));

    await cold.arrive(card.storyId!);
    expect(live.blurbEn).toBe(warm.blurbEn);
    expect(live.blurbEn).not.toBe('');
    expect(live.factEn).toBe(warm.factEn);
    expect(live.factId).toBe(warm.factId);
    expect(live.citation).toEqual(warm.citation);
    expect(face(live)).toEqual(face(warm));
  });
});
