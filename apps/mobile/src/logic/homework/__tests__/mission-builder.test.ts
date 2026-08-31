import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../banned-text';
import {
  buildTodaysMission,
  dayKey,
  missionCopy,
  type BuildMissionInput,
  type MissionPlan,
} from '../mission-builder';

const TODAY = '2026-05-20';
const YESTERDAY = '2026-05-19';
const TWO_DAYS_AGO = '2026-05-18';
const FOUR_DAYS_AGO = '2026-05-16';

function quest(id: string, titleEn: string): Quest {
  return {
    id,
    titleEn,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'practice', titleEn: 'Try' },
      { id: 's3', kind: 'reward', titleEn: 'Yay' },
    ],
  };
}

function episode(id: string, questIds: string[], status: Episode['status'] = 'shipped'): Episode {
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
    status,
  };
}

const QUESTS = [
  quest('quest:a', 'Meet g, n, d'),
  quest('quest:b', 'Meet m, b, s'),
  quest('quest:c', 'Meet vowels'),
];
const EPISODES = [
  episode('episode:one', ['quest:a', 'quest:b']),
  episode('episode:two', ['quest:c']),
];

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

function done(
  questId: string,
  day: string,
  accuracy: number,
): ProgressSnapshot['quests'][number] {
  return {
    questId,
    episodeId: 'episode:one',
    startedAt: `${day}T09:00:00.000Z`,
    completedAt: `${day}T09:10:00.000Z`,
    stars: accuracy >= 1 ? 3 : 2,
    attempts: 1,
    accuracy,
  };
}

function build(overrides: Partial<BuildMissionInput> = {}): MissionPlan {
  return buildTodaysMission({
    profileId: 'profile:kid1',
    snapshot: snapshot(),
    quests: QUESTS,
    episodes: EPISODES,
    today: TODAY,
    ...overrides,
  });
}

describe('dayKey', () => {
  it('reduces an ISO timestamp to its UTC day', () => {
    expect(dayKey('2026-05-20T23:59:59.000Z')).toBe('2026-05-20');
  });
});

describe('buildTodaysMission — card count and order', () => {
  it('always returns exactly 3 cards in slot order', () => {
    const plan = build();
    expect(plan.cards).toHaveLength(3);
    expect(plan.cards.map((c) => c.slot)).toEqual([1, 2, 3]);
  });

  it('returns 3 cards even on day one with no history at all', () => {
    const plan = build({ snapshot: snapshot() });
    expect(plan.cards).toHaveLength(3);
    // No replay is possible yet, so slot ① falls back to Story Time (§3.1).
    expect(plan.cards[0]?.kind).toBe('story');
  });

  it('stamps the plan with its date and profile', () => {
    const plan = build();
    expect(plan.date).toBe(TODAY);
    expect(plan.profileId).toBe('profile:kid1');
  });
});

describe('slot ① — replay selection (§3.1)', () => {
  it('picks a quest completed yesterday with a wrong answer', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.6)]) });
    expect(plan.cards[0]).toMatchObject({ slot: 1, kind: 'replay', questId: 'quest:a' });
  });

  it('accepts a quest from two days ago', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', TWO_DAYS_AGO, 0.6)]) });
    expect(plan.cards[0]?.kind).toBe('replay');
  });

  it('ignores quests older than the replay window', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', FOUR_DAYS_AGO, 0.6)]) });
    expect(plan.cards[0]?.kind).toBe('story');
  });

  it('ignores a quest answered perfectly — nothing to revisit', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 1)]) });
    expect(plan.cards[0]?.kind).toBe('story');
  });

  it('prefers the lowest accuracy when several qualify', () => {
    const plan = build({
      snapshot: snapshot([done('quest:a', YESTERDAY, 0.8), done('quest:b', YESTERDAY, 0.3)]),
    });
    expect(plan.cards[0]?.questId).toBe('quest:b');
  });

  it('breaks an accuracy tie by most recent completion', () => {
    const plan = build({
      snapshot: snapshot([done('quest:a', TWO_DAYS_AGO, 0.5), done('quest:b', YESTERDAY, 0.5)]),
    });
    expect(plan.cards[0]?.questId).toBe('quest:b');
  });

  it('carries the episode id so the card can navigate', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.6)]) });
    expect(plan.cards[0]?.episodeId).toBe('episode:one');
  });
});

describe('slot ② — the Journey cursor', () => {
  it('offers the first uncompleted quest', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 1)]) });
    expect(plan.cards[1]).toMatchObject({ slot: 2, kind: 'new', questId: 'quest:b' });
  });

  it('never repeats the quest already used by slot ①', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]) });
    expect(plan.cards[0]?.questId).toBe('quest:a');
    expect(plan.cards[1]?.questId).not.toBe('quest:a');
  });

  it('falls back to the last quest once everything is complete', () => {
    const plan = build({
      snapshot: snapshot(QUESTS.map((q) => done(q.id, YESTERDAY, 1))),
    });
    expect(plan.cards[1]?.questId).toBe('quest:c');
  });
});

describe('slot ③ — daily test capability gate (§9.2)', () => {
  it('renders the daily test when the review engine is available', () => {
    const plan = build({ capabilities: { dailyTestAvailable: true } });
    expect(plan.cards[2]).toMatchObject({ slot: 3, kind: 'daily-test' });
  });

  it('falls back to a live card while F-RVW-001 has not shipped', () => {
    const plan = build();
    expect(plan.cards[2]?.kind).not.toBe('daily-test');
    expect(plan.cards).toHaveLength(3);
  });

  it('the fallback never offers the same quest as slot ①', () => {
    const plan = build({
      snapshot: snapshot([done('quest:a', YESTERDAY, 0.3), done('quest:b', YESTERDAY, 0.5)]),
    });
    // Both replays live in episode:one — sharing an episode is fine, offering
    // the same quest twice is not.
    expect(plan.cards[0]?.questId).toBe('quest:a');
    expect(plan.cards[2]?.questId).toBe('quest:b');
  });

  it('two story fallbacks never point at the same episode', () => {
    const plan = build({ snapshot: snapshot() });
    const stories = plan.cards.filter((c) => c.kind === 'story');
    expect(new Set(stories.map((c) => c.episodeId)).size).toBe(stories.length);
  });
});

describe('resilience to partial or stale progress data', () => {
  it('ignores a quest that was started but never finished', () => {
    const inProgress = { ...done('quest:a', YESTERDAY, 0.4), completedAt: undefined };
    const plan = build({ snapshot: snapshot([inProgress]) });
    expect(plan.cards[0]?.kind).toBe('story');
  });

  it('skips a progress record whose quest no longer exists in the content', () => {
    const plan = build({ snapshot: snapshot([done('quest:removed', YESTERDAY, 0.4)]) });
    expect(plan.cards).toHaveLength(3);
    expect(plan.cards[0]?.kind).toBe('story');
  });
});

describe('story fallback', () => {
  it('offers an episode that is ready but not yet marked shipped', () => {
    const plan = build({
      episodes: [episode('episode:ready', ['quest:a'], 'ready')],
      snapshot: snapshot(),
    });
    expect(plan.cards[0]).toMatchObject({ kind: 'story', episodeId: 'episode:ready' });
  });

  it('never offers an episode that is only a preview placeholder', () => {
    const plan = build({
      episodes: [episode('episode:preview', ['quest:a'], 'preview'), EPISODES[1]!],
    });
    for (const card of plan.cards) {
      expect(card.episodeId).not.toBe('episode:preview');
    }
  });
});

describe('completion state (§3.2)', () => {
  it('marks a card collected when its quest was completed today', () => {
    // With every quest done, slot ② holds the last one; finishing it today
    // must show as collected rather than as still-to-do.
    const plan = build({
      snapshot: snapshot([
        done('quest:a', YESTERDAY, 1),
        done('quest:b', YESTERDAY, 1),
        done('quest:c', TODAY, 1),
      ]),
    });
    expect(plan.cards[1]).toMatchObject({ questId: 'quest:c', collected: true });
  });

  it('leaves a card uncollected when the quest was finished on an earlier day', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]) });
    expect(plan.cards[0]?.collected).toBe(false);
  });
});

describe('pinned plans keep cards from shifting (§3.2)', () => {
  it('reuses the same slot targets for the rest of the day', () => {
    const first = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]) });
    // The learner replays quest:a to a perfect score — without pinning it
    // would drop out of the replay candidates and the cards would reshuffle.
    const after = build({
      snapshot: snapshot([done('quest:a', TODAY, 1)]),
      pinned: first,
    });
    expect(after.cards.map((c) => c.questId)).toEqual(first.cards.map((c) => c.questId));
    expect(after.cards[0]?.collected).toBe(true);
  });

  it('ignores a plan pinned for a different day', () => {
    const stale: MissionPlan = { ...build(), date: YESTERDAY };
    const fresh = build({ pinned: stale });
    expect(fresh.date).toBe(TODAY);
  });

  it('ignores a plan pinned for a different profile', () => {
    const other: MissionPlan = { ...build(), profileId: 'profile:kid2' };
    const fresh = build({ pinned: other });
    expect(fresh.profileId).toBe('profile:kid1');
  });
});

describe('anti-shame copy (§3.3)', () => {
  it('generated card copy contains no banned word', () => {
    const cases: BuildMissionInput['snapshot'][] = [
      snapshot(),
      snapshot([done('quest:a', YESTERDAY, 0.2)]),
      snapshot(QUESTS.map((q) => done(q.id, YESTERDAY, 1))),
    ];
    for (const snap of cases) {
      expect(scanLearnerCopy(missionCopy(build({ snapshot: snap })))).toEqual([]);
    }
    expect(
      scanLearnerCopy(missionCopy(build({ capabilities: { dailyTestAvailable: true } }))),
    ).toEqual([]);
  });
});
