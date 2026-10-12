import { HeritageCardSchema, type Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { readyStory } from '../../story/__tests__/story-fixture';
import { buildStoryCards, storyCardFor, type StorySetDef } from '../story-cards';

/** The fixture story under another id and recommended stage (the card fields are its own). */
function story(slug: string, recommendedStage = 1, edit: (s: Story) => void = () => undefined): Story {
  const s = readyStory();
  s.id = `story:${slug}`;
  s.recommendedStage = recommendedStage;
  s.rewardCardIds = { listen: `card:story-${slug}` };
  edit(s);
  return s;
}

const SET: StorySetDef = {
  id: 'set:test-pair',
  cardId: 'card:set-test-pair',
  memberStoryIds: ['story:one', 'story:two'],
  collectionEn: 'Test Pair',
  titleEn: 'Pair',
  headword: { ko: '기록', romanization: 'girok', en: 'record' },
  blurbEn: 'Two stories, one collection.',
  theme: 'letters',
  rarity: 'legendary',
};

describe('storyCardFor (F-STORY-006 §3.8)', () => {
  it('builds the card from the story: id, headword, summary, verbatim fact and its first source', () => {
    const s = readyStory();
    const card = storyCardFor(s);
    const fact = s.facts.find((f) => f.id === 'f3')!;
    expect(card).toEqual({
      id: 'card:story-hangul-day',
      titleEn: 'Hangul Day',
      subtitleKo: '한글날',
      romanization: 'hangeullal',
      blurbEn: s.summaryEn,
      factEn: fact.claimEn,
      theme: s.theme,
      stage: 'stage1',
      rarity: 'common',
      unlockedBy: 'episode:shelf-hangul-day',
      storyId: 'story:hangul-day',
      factId: 'f3',
      citation: { title: fact.sources[0]!.title, publisher: fact.sources[0]!.publisher, more: 1 },
    });
    expect(() => HeritageCardSchema.parse(card)).not.toThrow();
  });

  it('derives stage and rarity from the recommended stage', () => {
    expect(storyCardFor(story('a', 2))).toMatchObject({ stage: 'stage2', rarity: 'uncommon' });
    expect(storyCardFor(story('a', 3))).toMatchObject({ stage: 'stage3', rarity: 'rare' });
    expect(storyCardFor(story('a', 6))).toMatchObject({ stage: 'stage6', rarity: 'rare' });
  });

  it('counts the other sources of the fact in citation.more', () => {
    const s = story('a', 1, (x) => {
      const f3 = x.facts.find((f) => f.id === 'f3')!;
      f3.sources.push({ ...f3.sources[0]! }, { ...f3.sources[0]! });
    });
    expect(storyCardFor(s)?.citation?.more).toBe(3);
  });

  it('builds no card for a draft, a story with no shelf block or no card block', () => {
    expect(storyCardFor(story('a', 1, (s) => (s.state = 'draft')))).toBeNull();
    expect(storyCardFor(story('a', 1, (s) => delete s.shelf))).toBeNull();
    expect(storyCardFor(story('a', 1, (s) => delete s.card))).toBeNull();
  });

  it('builds no card when the headword or the fact does not resolve (the lint fails such a story)', () => {
    expect(storyCardFor(story('a', 1, (s) => (s.card!.keywordId = 'nope')))).toBeNull();
    expect(storyCardFor(story('a', 1, (s) => (s.card!.factId = 'f9')))).toBeNull();
  });
});

describe('buildStoryCards (F-STORY-006 §3.2, §3.8)', () => {
  it('returns nothing for no stories, and no set while a member has no card', () => {
    expect(buildStoryCards([], [SET])).toEqual({ cards: [], sets: [] });
    const { cards, sets } = buildStoryCards([story('one')], [SET]);
    expect(cards.map((c) => c.id)).toEqual(['card:story-one']);
    expect(cards[0]!.setId).toBeUndefined();
    expect(sets).toEqual([]);
  });

  it('registers a set once every member story has a card: the set, its legendary card and the members setId', () => {
    const { cards, sets } = buildStoryCards([story('one', 1), story('three', 2), story('two', 4)], [SET]);
    expect(sets).toEqual([
      { id: 'set:test-pair', cardId: 'card:set-test-pair', titleEn: 'Test Pair', memberCardIds: ['card:story-one', 'card:story-two'] },
    ]);
    expect(cards.map((c) => [c.id, c.setId])).toEqual([
      ['card:story-one', 'set:test-pair'],
      ['card:story-three', undefined],
      ['card:story-two', 'set:test-pair'],
      ['card:set-test-pair', undefined],
    ]);
    const setCard = cards.at(-1)!;
    expect(setCard).toEqual({
      id: 'card:set-test-pair',
      titleEn: 'Pair',
      subtitleKo: '기록',
      romanization: 'girok',
      blurbEn: 'Two stories, one collection.',
      theme: 'letters',
      // The set completes with its last member, so it sits at the latest member's stage.
      stage: 'stage4',
      rarity: 'legendary',
      unlockedBy: 'set:test-pair',
    });
    // A set card makes no factual claim (D14).
    expect(setCard.factEn).toBeUndefined();
    expect(setCard.citation).toBeUndefined();
    for (const card of cards) expect(() => HeritageCardSchema.parse(card), card.id).not.toThrow();
  });

  it('does not register a set whose member is held (a draft is not bundled as a card)', () => {
    const held = story('two', 1, (s) => (s.state = 'draft'));
    expect(buildStoryCards([story('one'), held], [SET]).sets).toEqual([]);
  });
});
