import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isFreeContent } from '../../content-access';
import { storyReadStep } from '../../story/story-ref';
import { buildBrowseBundle } from '../bundle';
import { CULTURE_ID, DRAFT_ID, TALE_ID, fixtureBundle, fixtureInput } from './browse-fixture';

/**
 * F-BROWSE-001 §4.5 (BR-4): the content All lessons shows. The story review
 * gate (F-STORY-004 D14) holds on every path, not only for the story id: an
 * unreviewed story's own quest and shelf episode are left out too. Word
 * topics follow the learner picker's T8 rule (a topic with a picture it
 * cannot draw is skipped).
 */
const bundle = fixtureBundle();
const DRAFT_QUEST = 'quest:story-draft-tale-listen';
const DRAFT_EPISODE = 'episode:shelf-draft-tale';

describe('buildBrowseBundle: the story review gate', () => {
  it('keeps the quest and shelf episode of a reviewed story', () => {
    const tale = bundle.storyIndex.find((e) => e.storyId === TALE_ID);
    expect(tale).toBeDefined();
    expect(bundle.quests.some((q) => q.id === tale?.questId)).toBe(true);
    expect(bundle.episodes.some((e) => e.id === tale?.episodeId)).toBe(true);
  });

  it('leaves out the quest and the shelf episode of an unreviewed story', () => {
    expect(fixtureInput().quests.some((q) => q.id === DRAFT_QUEST)).toBe(true);
    expect(fixtureInput().episodes.some((e) => e.id === DRAFT_EPISODE)).toBe(true);
    expect(bundle.storyIndex.some((e) => e.storyId === DRAFT_ID)).toBe(false);
    expect(bundle.quests.some((q) => q.id === DRAFT_QUEST)).toBe(false);
    expect(bundle.episodes.some((e) => e.id === DRAFT_EPISODE)).toBe(false);
  });

  it('every story quest it keeps is a reviewed index entry, and no episode lists a quest it left out', () => {
    const indexed = new Set(bundle.storyIndex.map((e) => e.questId));
    for (const quest of bundle.quests) {
      if (storyReadStep(quest)) expect(indexed.has(quest.id), quest.id).toBe(true);
    }
    const kept = new Set(bundle.quests.map((q) => q.id));
    const input = new Set(fixtureInput().quests.map((q) => q.id));
    for (const episode of bundle.episodes) {
      for (const id of episode.questIds) expect(kept.has(id) || !input.has(id), `${episode.id} ${id}`).toBe(true);
    }
  });

  it('a book episode drops its unreviewed story quests and is left out when none is reviewed', () => {
    const input = fixtureInput();
    const taleQuest = 'quest:story-hangul-day-listen';
    const mixed: Episode = { ...(input.episodes[0] as Episode), id: 'episode:stage5-book', stage: 'stage5', format: 'story', questIds: [taleQuest, DRAFT_QUEST], status: 'ready' };
    const unreviewedOnly: Episode = { ...mixed, id: 'episode:stage5-draft-book', questIds: [DRAFT_QUEST] };
    const built = buildBrowseBundle({ ...input, episodes: [...input.episodes, mixed, unreviewedOnly] });
    expect(built.episodes.find((e) => e.id === mixed.id)?.questIds).toEqual([taleQuest]);
    expect(built.episodes.some((e) => e.id === unreviewedOnly.id)).toBe(false);
  });

  it('a preview book episode stays as a "Coming later" placeholder', () => {
    const input = fixtureInput();
    const later: Episode = { ...(input.episodes[0] as Episode), id: 'episode:stage5-later-book', stage: 'stage5', format: 'story', questIds: [], status: 'preview' };
    expect(buildBrowseBundle({ ...input, episodes: [...input.episodes, later] }).episodes.some((e) => e.id === later.id)).toBe(true);
  });

  it('grid lessons are never filtered', () => {
    const lessons = fixtureInput().quests.filter((q) => !storyReadStep(q));
    expect(bundle.quests.filter((q) => !storyReadStep(q))).toEqual(lessons);
  });
});

describe('buildBrowseBundle: the free set comes from the bundle it was given', () => {
  it('a sampler story of this bundle is free, a story without the sampler mark is not', () => {
    expect(isFreeContent('story', TALE_ID, bundle.freeRegistry)).toBe(true);
    expect(isFreeContent('story', CULTURE_ID, bundle.freeRegistry)).toBe(false);
    expect(isFreeContent('vocab-topic', 'food', bundle.freeRegistry)).toBe(true);
    expect(isFreeContent('stage', 'stage1', bundle.freeRegistry)).toBe(true);
  });
});

describe('buildBrowseBundle: word topics (F-VOC-003 T8)', () => {
  it('lists every ready topic while every picture can be drawn', () => {
    expect(bundle.vocabTopics.length).toBe(fixtureInput().vocabTopics.filter((t) => bundle.topicItems(t.key).length > 0).length);
  });

  it('skips a topic with one picture the renderer cannot draw, never showing it half-empty', () => {
    const blocked = bundle.topicItems('food')[0]?.visual as string;
    const built = fixtureBundle({ canRender: (visual) => visual !== blocked });
    expect(built.vocabTopics.some((t) => t.key === 'food')).toBe(false);
    const untouched = bundle.vocabTopics.filter((t) => bundle.topicItems(t.key).every((i) => i.visual !== blocked));
    expect(untouched.length).toBeGreaterThan(0);
    expect(built.vocabTopics.map((t) => t.key)).toEqual(untouched.map((t) => t.key));
  });
});
