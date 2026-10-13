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
  vocabCardShownEvent,
  type BuildMissionInput,
  type MissionCard,
  type MissionPlan,
} from '../mission-builder';

/**
 * The Home "Words are ready" card (F-VOC-005 section 3.7, PR P-3): slot 3's
 * chain is vocabulary -> `next` story -> replay -> `again` story -> explore
 * (the review's reconciliation with F-STORY-004 section 3.7, section 8 item 7),
 * slot 1 never takes it, the Daily Test replaces it, and it is pinned for the day.
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

describe('slot 3: the vocabulary card first (F-VOC-005 section 3.7)', () => {
  it('is the "Words are ready" card for the nudge topic when at least three words are due', () => {
    const plan = build({ vocab: NUDGE });
    expect(slot(plan, 3)).toEqual({
      slot: 3,
      kind: 'vocab',
      titleEn: null,
      subtitle: 'vocab',
      topicKey: 'food',
      vocabDue: 5,
      collected: false,
    });
    expect(plan.cards).toHaveLength(3);
  });

  it('comes before the next story, which slot 3 shows without a nudge', () => {
    const without = build({ vocab: null });
    expect(slot(without, 3)?.kind).toBe('story');
    expect(slot(without, 3)?.storyReason).toBe('next');
    const withCard = build({ vocab: NUDGE });
    expect(slot(withCard, 3)?.kind).toBe('vocab');
  });

  it('comes before a replay too (an active learner has one almost every day)', () => {
    // Slot 1 takes a story; the replay would be slot 3's next link after the next story.
    const plan = build({ vocab: NUDGE, snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]), stories: undefined });
    expect(slot(plan, 1)?.kind).toBe('replay');
    expect(slot(plan, 3)?.kind).toBe('vocab');
  });

  it('never takes slot 1, whose chain is unchanged', () => {
    const plan = build({ vocab: NUDGE });
    const without = build();
    expect(slot(plan, 1)).toEqual(slot(without, 1));
    expect(plan.cards.filter((c) => c.kind === 'vocab')).toHaveLength(1);
    expect(slot(plan, 2)).toEqual(slot(without, 2));
  });

  it('is absent when the input is null or omitted (the flag off, or fewer than three due)', () => {
    expect(build({ vocab: null }).cards.some((c) => c.kind === 'vocab')).toBe(false);
    expect(build().cards.some((c) => c.kind === 'vocab')).toBe(false);
    expect(build({ vocab: null })).toEqual(build());
  });

  it('gives way to the Daily Test once it is available (its pools already hold the due words)', () => {
    const plan = build({ vocab: NUDGE, capabilities: { dailyTestAvailable: true } });
    expect(slot(plan, 3)?.kind).toBe('daily-test');
    expect(plan.cards.some((c) => c.kind === 'vocab')).toBe(false);
  });
});

describe('the vocabulary card under the day pin', () => {
  it('stays all day, with its topic and count, whatever the nudge says later', () => {
    const pinned = build({ vocab: NUDGE });
    expect(build({ vocab: null, pinned })).toEqual(pinned);
    expect(build({ vocab: { topicKey: 'animals', due: 9 }, pinned })).toEqual(pinned);
  });

  it('a nudge that appears after the pin does not move the cards', () => {
    const pinned = build({ vocab: null });
    expect(build({ vocab: NUDGE, pinned })).toEqual(pinned);
  });

  it('is collected once a Speed Round of its topic completed today', () => {
    const pinned = build({ vocab: NUDGE });
    expect(slot(build({ pinned, vocabRoundsDone: new Set(['animals']) }), 3)?.collected).toBe(false);
    expect(slot(build({ pinned, vocabRoundsDone: new Set(['food']) }), 3)?.collected).toBe(true);
    expect(slot(build({ pinned }), 3)?.collected).toBe(false);
  });

  it('a fresh build after a round already done today is collected from the start', () => {
    expect(slot(build({ vocab: NUDGE, vocabRoundsDone: new Set(['food']) }), 3)?.collected).toBe(true);
  });

  it('is never re-picked as closed: it has no quest that access could close', () => {
    const pinned = build({ vocab: NUDGE });
    const after = build({ pinned, isQuestOpen: () => false });
    expect(slot(after, 3)).toEqual(slot(pinned, 3));
  });
});

describe('the card copy', () => {
  it('reads "Words are ready" and the count, in the UI language', () => {
    const card = slot(build({ vocab: NUDGE }), 3) as MissionCard;
    expect(missionCardText(card, learner)).toEqual({ title: 'Words are ready', subtitle: '5 words would like another look' });
    expect(missionCardText(card, getMessages('es').learner)).toEqual({
      title: '¡Palabras listas!',
      subtitle: '5 palabras quieren verte otra vez',
    });
    expect(missionCardText(card, getMessages('ko').learner)).toEqual({ title: '낱말이 준비됐어요', subtitle: '낱말 5개가 다시 만나고 싶어 해요' });
  });

  it('never names a day count, a miss or a delay, in any locale', () => {
    const plan = build({ vocab: { topicKey: 'food', due: 3 } });
    expect(scanLearnerCopy(missionCopy(plan, learner))).toEqual([]);
    for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
      const m = getMessages(locale).learner;
      const copy = [...missionCopy(plan, m), m.home.mission.vocab.cta];
      for (const text of copy) expect(findBannedWord(text, locale, 'learner')).toBeNull();
      const vocabText = [m.home.mission.vocab.title, m.home.mission.vocab.subtitle(3), m.home.mission.vocab.cta].join(' ');
      expect(vocabText).not.toMatch(/\bdays?\b|overdue|missed|behind|forgot|d[ií]as?\b|일|어제/i);
    }
  });

  it('missionCopy lists the button label of a vocabulary card', () => {
    const plan = build({ vocab: NUDGE });
    expect(missionCopy(plan, learner)).toContain('Say hello again');
  });
});

describe('vocabCardShownEvent (F-VOC-005 section 3.9)', () => {
  it('is { topicKey, due } for a plan with the vocabulary card', () => {
    expect(vocabCardShownEvent(build({ vocab: NUDGE }))).toEqual({
      name: 'home.vocab_card.shown',
      payload: { topicKey: 'food', due: 5 },
    });
  });

  it('is null for a plan without one', () => {
    expect(vocabCardShownEvent(build())).toBeNull();
  });
});
