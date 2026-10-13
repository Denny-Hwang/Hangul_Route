import { CATALOG, freeLessonsFacts, type ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import {
  earnedFaces,
  EARNED_ROW_MAX,
  favoriteReplay,
  freeEndPrimary,
  freeEndReachedEvent,
  freeEndResults,
  freeEndSeenKey,
  freeLessonCards,
  practiceTarget,
} from '../free-end';

const TODAY = '2026-10-12';

function snap(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    profileId: 'p1',
    updatedAt: '2026-10-12T00:00:00.000Z',
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...over,
  } as ProgressSnapshot;
}

const done = (questId: string, accuracy: number, completedAt: string) => ({
  questId,
  episodeId: episodesAll.find((e) => e.questIds.includes(questId))!.id,
  stars: 2 as const,
  accuracy,
  attempts: 1,
  completedAt,
});

describe('freeEndSeenKey and freeEndReachedEvent', () => {
  it('keys the seen flag per profile on this device (never synced)', () => {
    expect(freeEndSeenKey('p1')).toBe('free-end-seen:p1');
  });

  it('sends the number of free route days and placedOut, codes only', () => {
    expect(freeEndReachedEvent('p1', false)).toEqual({
      name: 'access.free_end_reached',
      profileId: 'p1',
      payload: { freeDays: freeLessonsFacts(CATALOG).days, placedOut: false },
    });
    expect(freeEndReachedEvent('p1', true).payload).toEqual({ freeDays: 5, placedOut: true });
  });
});

describe('favoriteReplay', () => {
  it('is the kept grid quest that most needs a replay: lowest accuracy, then the most recent', () => {
    const s = snap({
      quests: [
        done('quest:stage1-letters-q1', 1, '2026-10-01T10:00:00.000Z'),
        done('quest:stage1-letters-q2', 0.5, '2026-10-02T10:00:00.000Z'),
        done('quest:stage1-life-q1', 0.5, '2026-10-03T10:00:00.000Z'),
      ] as ProgressSnapshot['quests'],
    });
    expect(favoriteReplay(s, questsAll, episodesAll)?.id).toBe('quest:stage1-life-q1');
  });

  it('falls back to the first lesson when nothing is kept', () => {
    expect(favoriteReplay(snap(), questsAll, episodesAll)?.id).toBe('quest:stage1-letters-q1');
  });
});

describe('practiceTarget (the practice card, section 3.7)', () => {
  const topics = [
    { key: 'food', title: 'Food' },
    { key: 'animals', title: 'Animals' },
  ];
  const story = { storyId: 'story:x', questId: 'quest:story-x', episodeId: 'episode:story-x', title: 'The Sun and the Moon' };

  it('the first free word topic the learner has not finished today', () => {
    const s = snap({ vocab: { v: 1, items: [], topics: [{ topic: 'food', bestStars: 1, sessions: 1, last: TODAY, bestCaught: 0 }] } });
    expect(practiceTarget({ snapshot: s, today: TODAY, quests: questsAll, episodes: episodesAll, freeTopics: topics, samplerStory: story })).toEqual({
      kind: 'topic',
      topicKey: 'animals',
      title: 'Animals',
    });
  });

  it('a topic played on an earlier day counts again', () => {
    const s = snap({ vocab: { v: 1, items: [], topics: [{ topic: 'food', bestStars: 1, sessions: 1, last: '2026-10-11', bestCaught: 0 }] } });
    expect(practiceTarget({ snapshot: s, today: TODAY, quests: questsAll, episodes: episodesAll, freeTopics: topics, samplerStory: null })).toMatchObject({
      kind: 'topic',
      topicKey: 'food',
    });
  });

  it('else a sampler story, else the best kept replay', () => {
    expect(practiceTarget({ snapshot: snap(), today: TODAY, quests: questsAll, episodes: episodesAll, freeTopics: [], samplerStory: story })).toEqual({
      kind: 'story',
      ...story,
    });
    expect(practiceTarget({ snapshot: snap(), today: TODAY, quests: questsAll, episodes: episodesAll, freeTopics: [], samplerStory: null })).toMatchObject({
      kind: 'replay',
      questId: 'quest:stage1-letters-q1',
      episodeId: 'episode:stage1-letters',
    });
  });
});

describe('freeEndPrimary', () => {
  it('Practice words when a free topic is playable, else Read a story when a sampler story is bundled, else none', () => {
    const story = { storyId: 's', questId: 'q', episodeId: 'e', title: 'T' };
    expect(freeEndPrimary('food', story)).toEqual({ kind: 'topic', topicKey: 'food' });
    expect(freeEndPrimary(null, story)).toEqual({ kind: 'story', storyId: 's', questId: 'q', episodeId: 'e' });
    expect(freeEndPrimary(null, null)).toBeNull();
  });
});

describe('freeLessonCards and earnedFaces (Results, D9)', () => {
  it('lists the cards earned from the free lessons, in the order they were earned', () => {
    const free = episodesAll.filter((e) => e.stage === 'stage1' && e.rewardCardIds.length > 0);
    const [a, b] = [free[0]!.rewardCardIds[0]!, free[1]!.rewardCardIds[0]!];
    const stage2 = episodesAll.find((e) => e.stage === 'stage2' && e.rewardCardIds.length > 0)!.rewardCardIds[0]!;
    const s = snap({
      cards: [
        { cardId: b, unlockedAt: '2026-10-02T00:00:00.000Z' },
        { cardId: stage2, unlockedAt: '2026-10-03T00:00:00.000Z' },
        { cardId: a, unlockedAt: '2026-10-01T00:00:00.000Z' },
      ] as ProgressSnapshot['cards'],
    });
    expect(freeLessonCards(s, episodesAll, freeLessonsFacts(CATALOG).episodeIds)).toEqual([b, a]);
  });

  it('shows as many faces as fit, at most six, and counts the rest', () => {
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    expect(EARNED_ROW_MAX).toBe(6);
    expect(earnedFaces(ids, 3)).toEqual({ shown: ['c1', 'c2', 'c3'], more: 5 });
    expect(earnedFaces(ids, 10)).toEqual({ shown: ids.slice(0, 6), more: 2 });
    expect(earnedFaces(['c1'], 4)).toEqual({ shown: ['c1'], more: 0 });
    expect(earnedFaces([], 4)).toEqual({ shown: [], more: 0 });
    expect(earnedFaces(ids, 0)).toEqual({ shown: [], more: 8 });
  });
});

describe('freeEndResults (Results, section 3.8)', () => {
  const freeEnd = { kind: 'free-end', placedOut: false } as const;
  it('celebrates once after a scored quest that reaches free-end, then says every open quest is played', () => {
    expect(freeEndResults({ next: freeEnd, scored: true, seen: false })).toBe('celebrate');
    expect(freeEndResults({ next: freeEnd, scored: true, seen: true })).toBe('open-for-you');
  });

  it('waits for the seen key before choosing (no flash of the wrong state)', () => {
    expect(freeEndResults({ next: freeEnd, scored: true, seen: null })).toBe('pending');
  });

  it('leaves Results unchanged when every game was skipped, or when the next is not free-end', () => {
    expect(freeEndResults({ next: freeEnd, scored: false, seen: false })).toBeNull();
    expect(freeEndResults({ next: { kind: 'rest' }, scored: true, seen: false })).toBeNull();
    expect(freeEndResults({ next: null, scored: true, seen: false })).toBeNull();
  });
});
