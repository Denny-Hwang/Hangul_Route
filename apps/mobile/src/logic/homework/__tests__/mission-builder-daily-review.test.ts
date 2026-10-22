import type { Episode, ProgressSnapshot, Quest, Story } from '@hangul-route/content-schema';
import { findBannedWord, getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { emptyBookmarks } from '../../story/bookmarks';
import { shelfEpisode, shelfIndex, story, storyQuest } from '../../story/__tests__/shelf-fixture';
import { scanLearnerCopy } from '../banned-text';
import {
  buildTodaysMission,
  missionCardText,
  missionCopy,
  DAILY_REVIEW_MIN_DUE,
  type BuildMissionInput,
  type MissionCard,
  type MissionPlan,
} from '../mission-builder';

/**
 * The Daily Review card in Today with Hoya (F-CURR-002 sections 4.3, 4.5 and 12.2, row CM-14;
 * design/wireframes/reviews/daily-review.md panels A and A2): slot 3 when the review is on and 3 or
 * more items are due (or it was done today), today's slot 3 chain (word set, story, replay) with the
 * flag off, and first on a review-first day without ever taking the new lesson's place.
 */

const learner = getMessages('en').learner;
const TODAY = '2026-05-20';
const YESTERDAY = '2026-05-19';

function quest(id: string, titleEn: string): Quest {
  return {
    id,
    titleEn,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'practice', titleEn: 'Try' },
    ],
  };
}

function gridEpisode(id: string, questIds: string[]): Episode {
  return {
    id,
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: `Episode ${id}`,
    hoyaIntroEn: 'Hello!',
    questIds,
    rewardCardIds: [],
    estimatedMinutes: 10,
    status: 'shipped',
  };
}

const tiger = story('tiger', { shelf: { category: 'story-time', order: 1 } });
const sun = story('sun', { shelf: { category: 'story-time', order: 2 } });
const STORIES: Story[] = [sun, tiger];
const SHELF_EPISODES = STORIES.map((s) => shelfEpisode(s));
const SHELF_QUESTS = ['tiger', 'sun'].map((slug) => ({ ...storyQuest(slug, 'listen'), titleEn: `Quest ${slug}`, estimatedMinutes: 5 }));
const GRID_QUESTS = [quest('quest:a', 'Meet g, n, d'), quest('quest:b', 'Meet m, b, s'), quest('quest:c', 'Meet vowels')];
const GRID_EPISODES = [gridEpisode('episode:one', ['quest:a', 'quest:b']), gridEpisode('episode:two', ['quest:c'])];

function snapshot(quests: ProgressSnapshot['quests'] = []): ProgressSnapshot {
  return {
    profileId: 'profile:kid1',
    updatedAt: `${TODAY}T09:00:00.000Z`,
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
  };
}

function done(id: string, day: string, accuracy: number): ProgressSnapshot['quests'][number] {
  return {
    questId: id,
    episodeId: 'episode:one',
    startedAt: `${day}T09:00:00.000Z`,
    completedAt: `${day}T09:10:00.000Z`,
    stars: accuracy >= 1 ? 3 : 2,
    attempts: 1,
    accuracy,
  };
}

const NUDGE = { topicKey: 'food', due: 5 } as const;

function build(overrides: Partial<BuildMissionInput> = {}): MissionPlan {
  return buildTodaysMission({
    profileId: 'profile:kid1',
    snapshot: snapshot(),
    quests: [...GRID_QUESTS, ...SHELF_QUESTS],
    episodes: [...GRID_EPISODES, ...SHELF_EPISODES],
    today: TODAY,
    stories: { entries: shelfIndex(STORIES), bookmarks: emptyBookmarks(), isLocked: () => false },
    ...overrides,
  });
}

const slot = (plan: MissionPlan, n: 1 | 2 | 3): MissionCard | undefined => plan.cards.find((c) => c.slot === n);


const on = (due: number, extra: Partial<{ done: boolean; reviewFirst: boolean }> = {}) => ({ due, done: false, reviewFirst: false, ...extra });

describe('slot 3: the Daily Review card (section 4.5)', () => {
  it('shows from 3 due items, names itself and carries no count', () => {
    expect(DAILY_REVIEW_MIN_DUE).toBe(3);
    const plan = build({ dailyReview: on(3) });
    expect(slot(plan, 3)).toEqual({ slot: 3, kind: 'daily-review', titleEn: null, subtitle: 'dailyReview', collected: false });
    expect(missionCardText(slot(plan, 3) as MissionCard, learner)).toEqual({ title: 'Daily Review', subtitle: 'About 3 minutes' });
    expect(plan.reviewFirst).toBeUndefined();
  });

  it('below 3 due items slot 3 keeps today\'s chain', () => {
    expect(slot(build({ dailyReview: on(2) }), 3)?.kind).toBe('story');
    expect(slot(build({ dailyReview: on(2), vocab: NUDGE }), 3)?.kind).toBe('vocab');
  });

  it('with the flag off (null) slot 3 falls back to today\'s behaviour: word set, story or replay', () => {
    expect(slot(build({ dailyReview: null, vocab: NUDGE }), 3)?.kind).toBe('vocab');
    expect(slot(build({ dailyReview: null }), 3)?.kind).toBe('story');
    const replays = snapshot([done('quest:a', YESTERDAY, 0.5), done('quest:b', YESTERDAY, 0.6)]);
    const off = build({ dailyReview: null, snapshot: replays, stories: undefined });
    expect(off.cards.map((c) => c.kind)).toEqual(['replay', 'new', 'replay']);
    expect(off.cards.some((c) => c.kind === 'daily-review')).toBe(false);
  });

  it('replaces the vocabulary card: its pool already holds the due words', () => {
    expect(slot(build({ dailyReview: on(4), vocab: NUDGE }), 3)?.kind).toBe('daily-review');
  });

  it('done today: the card stays, collected and tappable, even with fewer than 3 due', () => {
    expect(slot(build({ dailyReview: on(0, { done: true }) }), 3)).toMatchObject({ kind: 'daily-review', collected: true });
  });

  it('its words pass the learner banned-word scan', () => {
    expect(scanLearnerCopy(missionCopy(build({ dailyReview: on(40, { reviewFirst: true }) }), learner))).toEqual([]);
  });
});

describe('review first (section 4.3): a suggestion, never a block', () => {
  it('puts the Daily Review first and the normal day\'s cards 1 and 2 after it, in their order', () => {
    const normal = build({ dailyReview: on(31) });
    const first = build({ dailyReview: on(31, { reviewFirst: true }) });
    expect(first.reviewFirst).toBe(true);
    expect(first.cards.map((c) => c.kind)).toEqual(['daily-review', ...normal.cards.filter((c) => c.kind !== 'daily-review').map((c) => c.kind)]);
    // The new lesson is still offered (never blocked).
    expect(first.cards.some((c) => c.kind === 'new' && c.slot === 2)).toBe(true);
    expect(first.cards).toHaveLength(3);
  });

  it('never once the Daily Review is done today', () => {
    const plan = build({ dailyReview: on(40, { reviewFirst: true, done: true }) });
    expect(plan.reviewFirst).toBeUndefined();
    expect(plan.cards[2]).toMatchObject({ kind: 'daily-review', collected: true });
  });
});

describe('the day pin and the Daily Review (section 12.2)', () => {
  it('a pinned card stays all day and is collected once done', () => {
    const pinned = build({ dailyReview: on(12) });
    const later = build({ pinned, dailyReview: on(2, { done: true }) });
    expect(slot(later, 3)).toMatchObject({ kind: 'daily-review', collected: true });
    // Unknown (omitted) keeps the pin as it is.
    expect(slot(build({ pinned }), 3)).toMatchObject({ kind: 'daily-review', collected: false });
  });

  it('a review-first pin keeps its order all day', () => {
    const pinned = build({ dailyReview: on(40, { reviewFirst: true }) });
    const later = build({ pinned, dailyReview: on(10) });
    expect(later.cards.map((c) => c.kind)).toEqual(pinned.cards.map((c) => c.kind));
    expect(later.reviewFirst).toBe(true);
  });

  it('turned off after the pin (null): the card gives way to slot 3\'s chain and the order goes back to normal', () => {
    const pinned = build({ dailyReview: on(40, { reviewFirst: true }) });
    const off = build({ pinned, dailyReview: null });
    expect(off.reviewFirst).toBeUndefined();
    expect(off.cards.map((c) => c.slot)).toEqual([1, 2, 3]);
    expect(off.cards.some((c) => c.kind === 'daily-review')).toBe(false);
    expect(slot(off, 3)?.kind).toBe(slot(build({ dailyReview: null }), 3)?.kind);
  });

  it('turned on after the pin with items due: slot 3 takes the card unless it was collected or is a started story', () => {
    const pinned = build({ dailyReview: null });
    expect(slot(build({ pinned, dailyReview: on(5) }), 3)).toMatchObject({ kind: 'daily-review', collected: false });
    expect(slot(build({ pinned, dailyReview: on(2) }), 3)?.kind).toBe(slot(pinned, 3)?.kind);
    // A story the learner has started ("Keep reading") stays; one not started gives way.
    const tale = (storyReason: 'continue' | 'next'): MissionPlan => ({
      ...pinned,
      cards: [
        ...pinned.cards.filter((c) => c.slot !== 3),
        { slot: 3, kind: 'story', titleEn: 'A tale', subtitle: 'story', questId: 'quest:tale', storyId: 'story:tale', storyReason, storyMode: 'play', collected: false },
      ],
    });
    expect(slot(build({ pinned: tale('continue'), dailyReview: on(5) }), 3)?.kind).toBe('story');
    expect(slot(build({ pinned: tale('next'), dailyReview: on(5) }), 3)?.kind).toBe('daily-review');
    const explored: MissionCard = { slot: 3, kind: 'explore', titleEn: 'Episode episode:two', subtitle: 'explore', episodeId: 'episode:two', collected: true };
    const collected = { ...pinned, cards: [...pinned.cards.filter((c) => c.slot !== 3), explored] };
    expect(slot(build({ pinned: collected, dailyReview: on(5) }), 3)?.kind).toBe('explore');
    // A pinned plan never turns review first.
    expect(build({ pinned, dailyReview: on(40, { reviewFirst: true }) }).reviewFirst).toBeUndefined();
  });

  it('a pinned plan with no slot 3 card gains the card at the end', () => {
    const pinned = build({ dailyReview: null });
    const two = { ...pinned, cards: pinned.cards.filter((c) => c.slot !== 3) };
    expect(build({ pinned: two, dailyReview: on(5) }).cards.map((c) => c.kind)).toEqual([...two.cards.map((c) => c.kind), 'daily-review']);
  });
});
