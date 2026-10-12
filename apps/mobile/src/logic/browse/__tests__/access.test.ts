import type { Episode, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isContentLocked } from '../../content-access';
import { isStagePlayable } from '../../entitlement';
import { itemAccess, type AccessItemKind } from '../access';
import { defaultBrowseBundle, episodeOfQuest, isOpenableEpisode, vocabTopicKey, type BrowseBundle } from '../bundle';
import { fixtureBundle } from './browse-fixture';

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
    for (const quest of openableQuests) {
      const episode = episodeOfQuest(bundle, quest.id) as Episode;
      // Today's learner rule until F-ENT-003 E3-2: every quest of a shipped stage (isStagePlayable).
      expect(itemAccess({ kind: 'quest', id: quest.id }, 'sampler', true, ctx), quest.id).toBe(isStagePlayable(episode.stage) ? 'open' : 'closed');
    }
    for (const entry of bundle.storyIndex) {
      const locked = isContentLocked({ kind: 'story', id: entry.storyId, tier: 'free', gatingEnabled: true });
      expect(itemAccess({ kind: 'story', id: entry.storyId }, 'sampler', true, ctx), entry.storyId).toBe(locked ? 'closed' : 'open');
    }
    let closedTopics = 0;
    for (const topic of bundle.vocabTopics) {
      const locked = isContentLocked({ kind: 'vocab-topic', id: vocabTopicKey(topic.id), tier: 'free', gatingEnabled: true });
      if (locked) closedTopics += 1;
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', true, ctx), topic.id).toBe(locked ? 'closed' : 'open');
    }
    expect(closedTopics).toBeGreaterThan(0); // the free set is a real subset of the topics
  });

  it('the production bundle: switch off opens everything, and the free word topics are exactly the topics a learner may open today', () => {
    const production = defaultBrowseBundle();
    for (const episode of production.episodes.filter(isOpenableEpisode)) {
      expect(itemAccess({ kind: 'episode', id: episode.id }, 'sampler', false), episode.id).toBe('open');
    }
    for (const topic of production.vocabTopics) {
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', false), topic.id).toBe('open');
      expect(itemAccess({ kind: 'vocab-topic', id: topic.id }, 'sampler', true), topic.id).toBe('open');
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
    const onlyFirst = (quest: Pick<Quest, 'id'>): boolean => quest.id === first;
    expect(itemAccess({ kind: 'quest', id: first }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('open');
    expect(itemAccess({ kind: 'quest', id: second }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('closed');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'sampler', true, { bundle, freeQuestOpen: onlyFirst })).toBe('open');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'sampler', true, { bundle, freeQuestOpen: () => false })).toBe('closed');
    // the switch off still opens everything, whatever the predicate would say
    expect(itemAccess({ kind: 'quest', id: second }, 'sampler', false, { bundle, freeQuestOpen: () => false })).toBe('open');
    expect(itemAccess({ kind: 'episode', id: letters.id }, 'full', true, { bundle, freeQuestOpen: () => false })).toBe('open');
  });
});
