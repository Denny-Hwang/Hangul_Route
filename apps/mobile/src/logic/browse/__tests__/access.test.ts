import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { browseQuestOpen, isContentLocked, questAccess } from '../../content-access';
import { entryForQuest } from '../../story/story-index';
import { itemAccess, type AccessItemKind } from '../access';
import { defaultBrowseBundle, episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from '../bundle';
import { CULTURE_ID, TALE_ID, fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 §4.2 and §4.13 (BR-4): what each scope may open. Sampler is
 * exactly what a new free learner can open, through the learner's own
 * predicates and the one switch; with the switch off sampler and full are
 * identical.
 */
const bundle = fixtureBundle();
const ctx = { bundle };

interface Item {
  kind: AccessItemKind;
  id: string;
}

const openableEpisodes = bundle.episodes.filter(isOpenableEpisode);
const laterEpisodes = bundle.episodes.filter((e) => e.status === 'preview');
const openableQuests = bundle.quests.filter((q) => episodeOfQuest(bundle, q.id));
const everyItem: Item[] = [
  ...openableEpisodes.map((e) => ({ kind: 'episode' as const, id: e.id })),
  ...openableQuests.map((q) => ({ kind: 'quest' as const, id: q.id })),
  ...bundle.storyIndex.map((e) => ({ kind: 'story' as const, id: e.storyId })),
  ...bundle.vocabTopics.map((t) => ({ kind: 'vocab-topic' as const, id: t.id })),
  ...bundle.cards.map((c) => ({ kind: 'card' as const, id: c.id })),
];

describe('itemAccess (F-BROWSE-001 §4.2)', () => {
  it('the bundle has something of every kind to check', () => {
    for (const kind of ['episode', 'quest', 'story', 'vocab-topic', 'card'] as const) {
      expect(everyItem.some((i) => i.kind === kind), kind).toBe(true);
    }
    expect(laterEpisodes.length).toBeGreaterThan(0);
  });

  it('none: every item goes to the Access screen', () => {
    for (const item of [...everyItem, ...laterEpisodes.map((e) => ({ kind: 'episode' as const, id: e.id }))]) {
      expect(itemAccess(item, 'none', false, ctx), item.id).toBe('access');
      expect(itemAccess(item, 'none', true, ctx), item.id).toBe('access');
    }
  });

  it('full: every shipped item opens, with the switch on or off', () => {
    for (const gating of [false, true]) {
      for (const item of everyItem) expect(itemAccess(item, 'full', gating, ctx), `${item.id} ${gating}`).toBe('open');
    }
  });

  it('golden, switch off: sampler opens every bundled item', () => {
    for (const item of everyItem) expect(itemAccess(item, 'sampler', false, ctx), item.id).toBe('open');
  });

  it('switch on: sampler equals what a new free learner can open, item by item', () => {
    // A new free learner's story rule, with the free set of this bundle (its sampler stories).
    const storyOpen = (storyId: string): boolean => !isContentLocked({ kind: 'story', id: storyId, tier: 'free', gatingEnabled: true, registry: bundle.freeRegistry });
    let closedLessons = 0;
    for (const quest of openableQuests) {
      const story = entryForQuest(bundle.storyIndex, quest.id);
      // A story quest follows its story; a lesson follows F-ENT-003's rule for a free learner with nothing finished.
      const lessonOpen = questAccess({ questId: quest.id, tier: 'free', gatingEnabled: true, completedQuestIds: new Set() }) !== 'closed';
      expect(browseQuestOpen('sampler', true)(quest.id), quest.id).toBe(lessonOpen);
      if (!story && !lessonOpen) closedLessons += 1;
      const open = story ? storyOpen(story.storyId) : lessonOpen;
      expect(itemAccess({ kind: 'quest', id: quest.id }, 'sampler', true, ctx), quest.id).toBe(open ? 'open' : 'closed');
    }
    expect(closedLessons).toBeGreaterThan(0); // the free lessons (all of Stage 1) are a real subset
    for (const entry of bundle.storyIndex) {
      expect(itemAccess({ kind: 'story', id: entry.storyId }, 'sampler', true, ctx), entry.storyId).toBe(storyOpen(entry.storyId) ? 'open' : 'closed');
    }
    let closedTopics = 0;
    for (const topic of bundle.vocabTopics) {
      const locked = isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(topic.id), tier: 'free', gatingEnabled: true });
      if (locked) closedTopics += 1;
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', true, ctx), topic.id).toBe(locked ? 'closed' : 'open');
    }
    expect(closedTopics).toBeGreaterThan(0); // the free set is a real subset of the topics
  });

  it('switch on: a sampler story opens and a story without the sampler mark is closed (F-BROWSE-001 §4.13)', () => {
    expect(itemAccess({ kind: 'story', id: TALE_ID }, 'sampler', true, ctx)).toBe('open');
    expect(itemAccess({ kind: 'story', id: CULTURE_ID }, 'sampler', true, ctx)).toBe('closed');
    expect(itemAccess({ kind: 'story', id: CULTURE_ID }, 'full', true, ctx)).toBe('open');
    expect(itemAccess({ kind: 'story', id: CULTURE_ID }, 'sampler', false, ctx)).toBe('open');
  });

  it("switch on: a story's own quest and shelf episode open exactly when the story does", () => {
    for (const [storyId, expected] of [
      [TALE_ID, 'open'],
      [CULTURE_ID, 'closed'],
    ] as const) {
      const entry = bundle.storyIndex.find((e) => e.storyId === storyId);
      expect(entry, storyId).toBeDefined();
      expect(itemAccess({ kind: 'quest', id: entry?.questId ?? '' }, 'sampler', true, ctx), storyId).toBe(expected);
      expect(itemAccess({ kind: 'episode', id: entry?.episodeId ?? '' }, 'sampler', true, ctx), storyId).toBe(expected);
      // the lesson predicate never decides a story quest
      expect(itemAccess({ kind: 'quest', id: entry?.questId ?? '' }, 'sampler', true, { bundle, freeQuestOpen: () => expected === 'closed' }), storyId).toBe(expected);
    }
  });

  it("an unreviewed story's quest and shelf episode are not in this bundle: \"Coming later\" for every scope", () => {
    for (const item of [
      { kind: 'quest' as const, id: 'quest:story-draft-tale-listen' },
      { kind: 'episode' as const, id: 'episode:shelf-draft-tale' },
      { kind: 'story' as const, id: 'story:draft-tale' },
    ]) {
      expect(itemAccess(item, 'full', false, ctx), item.id).toBe('later');
      expect(itemAccess(item, 'sampler', true, ctx), item.id).toBe('later');
    }
  });

  it('the production bundle: switch off opens everything; switch on follows the learner free set', () => {
    const production = defaultBrowseBundle();
    for (const episode of production.episodes.filter(isOpenableEpisode)) {
      expect(itemAccess({ kind: 'episode', id: episode.id }, 'sampler', false), episode.id).toBe('open');
    }
    // switch on: all of Stage 1 opens (the free lessons), a Stage 2 lesson does not
    expect(itemAccess({ kind: 'episode', id: 'episode:stage1-letters' }, 'sampler', true)).toBe('open');
    expect(itemAccess({ kind: 'quest', id: 'quest:stage1-life-q1' }, 'sampler', true)).toBe('open');
    expect(itemAccess({ kind: 'quest', id: 'quest:stage2-life-q1' }, 'sampler', true)).toBe('closed');
    expect(itemAccess({ kind: 'quest', id: 'quest:stage2-life-q1' }, 'full', true)).toBe('open');
    for (const topic of production.vocabTopics) {
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', false), topic.id).toBe('open');
      const locked = isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(topic.id), tier: 'free', gatingEnabled: true });
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', true), topic.id).toBe(locked ? 'closed' : 'open');
    }
  });

  it('cards: front and back for full and sampler alike (OD-7)', () => {
    for (const card of bundle.cards) {
      expect(itemAccess({ kind: 'card', id: card.id }, 'sampler', true, ctx)).toBe('open');
      expect(itemAccess({ kind: 'card', id: card.id }, 'full', true, ctx)).toBe('open');
    }
  });

  it('a preview episode, a quest no shipped episode lists and an unknown id are "Coming later"', () => {
    for (const episode of laterEpisodes) {
      expect(itemAccess({ kind: 'episode', id: episode.id }, 'full', false, ctx)).toBe('later');
      expect(itemAccess({ kind: 'episode', id: episode.id }, 'sampler', true, ctx)).toBe('later');
    }
    for (const kind of ['episode', 'quest', 'story', 'vocab-topic', 'card'] as const) {
      expect(itemAccess({ kind, id: `${kind}:not-bundled` }, 'full', false, ctx), kind).toBe('later');
    }
  });

  it('an episode with no quests is "Coming later"', () => {
    const empty: Episode = { ...(openableEpisodes[0] as Episode), id: 'episode:empty', questIds: [] };
    const withEmpty: BrowseBundle = { ...bundle, episodes: [...bundle.episodes, empty] };
    expect(itemAccess({ kind: 'episode', id: 'episode:empty' }, 'full', false, { bundle: withEmpty })).toBe('later');
  });

  it('a closed quest closes its row, and an episode closes only when none of its quests is open', () => {
    const letters = bundle.episodes.find((e) => e.id === 'episode:stage1-letters') as Episode;
    const [first, second] = letters.questIds as [string, string];
    const onlyFirst = (questId: string): boolean => questId === first;
    expect(itemAccess({ kind: 'quest', id: first }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('open');
    expect(itemAccess({ kind: 'quest', id: second }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('closed');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('open');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'sampler', true, { bundle, freeQuestOpen: () => false })).toBe('closed');
    // the switch off still opens everything, whatever the predicate would say
    expect(itemAccess({ kind: 'quest', id: second }, 'sampler', false, { bundle, freeQuestOpen: () => false })).toBe('open');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'full', true, { bundle, freeQuestOpen: () => false })).toBe('open');
  });
});
