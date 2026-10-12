import { HeritageCardSchema, type HeldStoryCard, type ProgressSnapshot, type Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { readyStory } from '../../story/__tests__/story-fixture';
import { derivedAwards } from '../derive';
import { obtainableCards } from '../obtainable';
import { buildStoryCards, heldStoryCardFor, storyCardFor, type StorySetDef } from '../story-cards';
import type { AwardWorld } from '../types';

/** The fixture story under another id and recommended stage (the card fields are its own). */
function story(slug: string, recommendedStage = 1, edit: (s: Story) => void = () => undefined): Story {
  const s = readyStory();
  s.id = `story:${slug}`;
  s.recommendedStage = recommendedStage;
  s.rewardCardIds = { listen: `card:story-${slug}` };
  edit(s);
  return s;
}

/** What the bundle keeps of a held story (`build-stories.mjs` heldStoryCards). */
function heldOf(slug: string, recommendedStage = 1): HeldStoryCard {
  const s = story(slug, recommendedStage);
  const keyword = s.keywords.find((k) => k.id === s.card!.keywordId)!;
  return {
    storyId: s.id,
    titleEn: s.card!.titleEn,
    keyword: { ko: keyword.ko, romanization: keyword.romanization },
    summaryEn: s.summaryEn,
    theme: s.theme,
    recommendedStage,
  };
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
      titleEn: 'King Sejong',
      subtitleKo: '세종',
      romanization: 'sejong',
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
    expect(buildStoryCards([], [SET])).toEqual({ cards: [], sets: [], heldCardIds: [] });
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

  it('does not register a set whose member has no card at all (a draft the bundle keeps no card for)', () => {
    const draft = story('two', 1, (s) => (s.state = 'draft'));
    expect(buildStoryCards([story('one'), draft], [SET]).sets).toEqual([]);
  });

  it('keeps the card of a held story, with no fact and no citation, and keeps its set registered', () => {
    const { cards, sets, heldCardIds } = buildStoryCards([story('one')], [SET], [heldOf('two', 2)]);
    expect(heldCardIds).toEqual(['card:story-two']);
    expect(sets.map((x) => x.memberCardIds)).toEqual([['card:story-one', 'card:story-two']]);
    const held = cards.find((c) => c.id === 'card:story-two')!;
    const s = story('two', 2);
    expect(held).toEqual({
      id: 'card:story-two',
      titleEn: 'King Sejong',
      subtitleKo: s.keywords.find((k) => k.id === s.card!.keywordId)!.ko,
      romanization: s.keywords.find((k) => k.id === s.card!.keywordId)!.romanization,
      blurbEn: s.summaryEn,
      theme: s.theme,
      stage: 'stage2',
      rarity: 'uncommon',
      unlockedBy: 'episode:shelf-two',
      storyId: 'story:two',
      setId: 'set:test-pair',
    });
    expect(held.factEn).toBeUndefined();
    expect(held.citation).toBeUndefined();
    for (const card of cards) expect(() => HeritageCardSchema.parse(card), card.id).not.toThrow();
  });

  it('the same card for a held story as when it shipped, except the fact and the citation', () => {
    const { factEn: _fact, factId: _factId, citation: _citation, ...shipped } = storyCardFor(story('one', 3))!;
    expect(heldStoryCardFor(heldOf('one', 3))).toEqual(shipped);
  });

  it('a reviewed copy of a story wins over a held entry with the same id', () => {
    const { cards, heldCardIds } = buildStoryCards([story('one')], [], [heldOf('one')]);
    expect(heldCardIds).toEqual([]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.factEn).toBeDefined();
  });
});

describe('a held story in the award world (F-STORY-006 Behaviour #10, rule 1)', () => {
  // story:one is reviewed; story:two was held after it shipped (it is a draft now, so it has no episode).
  const { cards, sets } = buildStoryCards([story('one')], [SET], [heldOf('two')]);
  const world: AwardWorld = {
    cards,
    sets,
    episodes: [
      {
        id: 'episode:shelf-one',
        stage: 'stage1',
        theme: 'letters',
        titleEn: 'One',
        status: 'shipped',
        questIds: ['quest:story-one-listen'],
        rewardCardIds: ['card:story-one'],
        format: 'story',
        placement: 'shelf',
        volume: 1,
        storyIds: ['story:one'],
      } as AwardWorld['episodes'][number],
    ],
    quests: [],
  };
  const listed = (owned: readonly string[]): string[] => obtainableCards(world, new Set(owned)).map((c) => c.id);

  it('an unowned held card is not listed, and neither is its set card', () => {
    expect(listed([])).toEqual(['card:story-one']);
  });

  it('an owned held card stays listed, and an owned set card stays listed', () => {
    expect(listed(['card:story-two'])).toEqual(['card:story-one', 'card:story-two', 'card:set-test-pair']);
    expect(listed(['card:story-one', 'card:story-two', 'card:set-test-pair'])).toContain('card:set-test-pair');
  });

  it('a held card is never awarded by its rule, and owning both members still completes the set', () => {
    const AT = '2026-09-10T00:00:00.000Z';
    const snapshot = (owned: readonly string[]): ProgressSnapshot => ({
      profileId: 'profile:a',
      updatedAt: AT,
      episodes: [],
      quests: [],
      cards: owned.map((cardId) => ({ cardId, unlockedAt: AT, newSinceLastView: false })),
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
    });
    const profile = { createdAt: '2026-09-01T00:00:00.000Z' };
    expect(derivedAwards(world, snapshot([]), profile).map((a) => a.cardId)).not.toContain('card:story-two');
    expect(derivedAwards(world, snapshot(['card:story-one', 'card:story-two']), profile).map((a) => a.cardId)).toEqual(['card:set-test-pair']);
  });
});
