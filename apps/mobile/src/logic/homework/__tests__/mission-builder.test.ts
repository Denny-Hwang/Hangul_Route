import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { questOpenPredicate } from '../../content-access';
import { offerableQuests } from '../../next-quest';
import type { RouteNextInput } from '../../route-next';
import { scanLearnerCopy } from '../banned-text';
import {
  buildTodaysMission,
  dayKey,
  missionCardText,
  missionCopy,
  type BuildMissionInput,
  type MissionPlan,
} from '../mission-builder';

const learner = getMessages('en').learner;
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
    // No replay and no story is possible yet, so slot ① falls back to the explore card (F-STORY-004 §3.7).
    expect(plan.cards[0]?.kind).toBe('explore');
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
    expect(plan.cards[0]?.kind).toBe('explore');
  });

  it('ignores a quest answered perfectly — nothing to revisit', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 1)]) });
    expect(plan.cards[0]?.kind).toBe('explore');
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

  it('skips placed-out quests when a route seed is given (F-PLC-001 section 3.7)', () => {
    const plan = build({ snapshot: snapshot([]), skipQuestIds: new Set(['quest:a']) });
    expect(plan.cards[1]).toMatchObject({ slot: 2, kind: 'new', questId: 'quest:b' });
  });

  it('a placed-out quest stays playable: once every other quest is done it is offered before any replay', () => {
    const plan = build({
      snapshot: snapshot([done('quest:b', YESTERDAY, 1), done('quest:c', YESTERDAY, 1)]),
      skipQuestIds: new Set(['quest:a']),
    });
    expect(plan.cards[1]?.questId).toBe('quest:a');
  });

  it('with every quest done, placed out or not, it falls back to the last quest as before', () => {
    const plan = build({
      snapshot: snapshot([done('quest:a', YESTERDAY, 1), done('quest:b', YESTERDAY, 1), done('quest:c', YESTERDAY, 1)]),
      skipQuestIds: new Set(['quest:a']),
    });
    expect(plan.cards[1]?.questId).toBe('quest:c');
  });

  it('without a route seed the cursor is unchanged', () => {
    expect(build({ snapshot: snapshot([]) }).cards[1]?.questId).toBe('quest:a');
    expect(build({ snapshot: snapshot([]), skipQuestIds: new Set() }).cards[1]?.questId).toBe('quest:a');
  });
});

describe('slot ② — the same stages as Results and My route (F-ROUTE-001 R-4a)', () => {
  const S2_QUESTS = [...QUESTS, quest('quest:s2', 'Words at home')];
  const S2_EPISODES: Episode[] = [...EPISODES, { ...episode('episode:s2', ['quest:s2']), stage: 'stage2', theme: 'life' }];
  const stage1Only = (stageKey: string): boolean => stageKey === 'stage1';
  const allStage1 = (): ProgressSnapshot => snapshot(QUESTS.map((q) => done(q.id, YESTERDAY, 1)));

  it('offers a later stage when the predicate opens it', () => {
    const plan = build({ snapshot: allStage1(), quests: S2_QUESTS, episodes: S2_EPISODES, isEntitled: () => true });
    expect(plan.cards[1]?.questId).toBe('quest:s2');
  });

  it('never offers a stage the predicate leaves out, even as the replay fallback', () => {
    const plan = build({ snapshot: allStage1(), quests: S2_QUESTS, episodes: S2_EPISODES, isEntitled: stage1Only });
    expect(plan.cards[1]?.questId).toBe('quest:c');
  });

  it('applies the predicate and the placed-out set together', () => {
    const plan = build({
      snapshot: snapshot([done('quest:b', YESTERDAY, 1), done('quest:c', YESTERDAY, 1)]),
      quests: S2_QUESTS,
      episodes: S2_EPISODES,
      isEntitled: stage1Only,
      skipQuestIds: new Set(['quest:a']),
    });
    expect(plan.cards[1]?.questId).toBe('quest:a');
  });

  it('without a predicate every playable stage is open, as before', () => {
    expect(build({ snapshot: allStage1(), quests: S2_QUESTS, episodes: S2_EPISODES }).cards[1]?.questId).toBe('quest:s2');
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

  it('two explore fallbacks never point at the same episode', () => {
    const plan = build({ snapshot: snapshot() });
    const explore = plan.cards.filter((c) => c.kind === 'explore');
    expect(explore).toHaveLength(2);
    expect(new Set(explore.map((c) => c.episodeId)).size).toBe(explore.length);
  });
});

describe('resilience to partial or stale progress data', () => {
  it('ignores a quest that was started but never finished', () => {
    const inProgress = { ...done('quest:a', YESTERDAY, 0.4), completedAt: undefined };
    const plan = build({ snapshot: snapshot([inProgress]) });
    expect(plan.cards[0]?.kind).toBe('explore');
  });

  it('skips a progress record whose quest no longer exists in the content', () => {
    const plan = build({ snapshot: snapshot([done('quest:removed', YESTERDAY, 0.4)]) });
    expect(plan.cards).toHaveLength(3);
    expect(plan.cards[0]?.kind).toBe('explore');
  });
});

describe('explore fallback (F-STORY-004 §3.7: replaces the old "Story time" episode card)', () => {
  it('offers an episode that is ready but not yet marked shipped', () => {
    const plan = build({
      episodes: [episode('episode:ready', ['quest:a'], 'ready')],
      snapshot: snapshot(),
    });
    expect(plan.cards[0]).toMatchObject({ kind: 'explore', subtitle: 'explore', titleEn: 'Episode episode:ready', episodeId: 'episode:ready' });
  });

  it('never offers an episode that is only a preview placeholder', () => {
    const plan = build({
      episodes: [episode('episode:preview', ['quest:a'], 'preview'), EPISODES[1]!],
    });
    for (const card of plan.cards) {
      expect(card.episodeId).not.toBe('episode:preview');
    }
  });

  it('never offers a shelf episode as the Journey cursor or the fallback (F-STORY-004 §3.10)', () => {
    const shelf: Episode = { ...episode('episode:shelf-tale', ['quest:shelf']), placement: 'shelf', format: 'story', order: 0 };
    const plan = build({
      episodes: [shelf, ...EPISODES],
      quests: [quest('quest:shelf', 'A tale'), ...QUESTS],
    });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: 'quest:a' });
    for (const card of plan.cards) {
      expect(card.episodeId).not.toBe('episode:shelf-tale');
      expect(card.questId).not.toBe('quest:shelf');
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

  it('moves the "New" card off a quest the level check placed out after the plan was pinned (F-ROUTE-001 R-4a)', () => {
    const first = build();
    expect(first.cards[1]?.questId).toBe('quest:a');
    const after = build({ pinned: first, skipQuestIds: new Set(['quest:a']) });
    expect(after.cards[1]).toMatchObject({ slot: 2, kind: 'new', questId: 'quest:b', episodeId: 'episode:one', collected: false });
    expect([after.cards[0], after.cards[2]]).toEqual([first.cards[0], first.cards[2]]);
  });

  it('keeps a placed-out "New" card the learner already played today', () => {
    const first = build();
    const after = build({ snapshot: snapshot([done('quest:a', TODAY, 1)]), pinned: first, skipQuestIds: new Set(['quest:a']) });
    expect(after.cards[1]).toMatchObject({ questId: 'quest:a', collected: true });
  });

  it('keeps a pinned assigned card even when its quest is placed out (only the system "New" card re-pins)', () => {
    const base = build();
    const assigned: MissionPlan = {
      ...base,
      cards: base.cards.map((card) =>
        card.slot === 2 ? { ...card, subtitle: 'assigned', questId: 'quest:a', episodeId: 'episode:one' } : card,
      ),
    };
    const after = build({ pinned: assigned, skipQuestIds: new Set(['quest:a']) });
    expect(after.cards[1]).toMatchObject({ slot: 2, kind: 'new', subtitle: 'assigned', questId: 'quest:a' });
  });

  it('keeps the pinned "New" card when every other quest is placed out too', () => {
    const first = build();
    const after = build({ pinned: first, skipQuestIds: new Set(['quest:a', 'quest:b', 'quest:c']) });
    expect(after.cards[1]?.questId).toBe('quest:a');
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
      expect(scanLearnerCopy(missionCopy(build({ snapshot: snap }), learner))).toEqual([]);
    }
    expect(
      scanLearnerCopy(missionCopy(build({ capabilities: { dailyTestAvailable: true } }), learner)),
    ).toEqual([]);
  });
});

describe('mission card words come from the dictionary (F-I18N-001 §3.4 rule 3)', () => {
  it('cards carry a subtitle code, never prose', () => {
    const cards = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.2)]) }).cards;
    expect(cards.map((c) => c.subtitle)).toEqual(['replay', 'new', 'explore']);
    expect(build({ capabilities: { dailyTestAvailable: true } }).cards[2]).toMatchObject({
      kind: 'daily-test',
      titleEn: null,
      subtitle: 'dailyTest',
    });
  });

  it('missionCardText renders the title and subtitle in the given message subtree', () => {
    const cards = build({
      snapshot: snapshot([done('quest:a', YESTERDAY, 0.2)]),
      capabilities: { dailyTestAvailable: true },
    }).cards;
    expect(cards.map((c) => missionCardText(c, learner))).toEqual([
      { title: 'Meet g, n, d', subtitle: 'One more go with Hoya' },
      { title: 'Meet m, b, s', subtitle: 'Something new today' },
      { title: 'Quick review', subtitle: 'About a minute with Hoya' },
    ]);
    expect(missionCardText({ ...cards[1]!, subtitle: 'assigned' }, learner).subtitle).toBe('Picked just for you');
    expect(missionCardText({ ...cards[1]!, subtitle: 'explore' }, learner).subtitle).toBe('Take a look');
  });
});

/**
 * Golden: the private cursor `mission-builder.ts` carried before F-QUEST-002
 * Q-2 moved it to `logic/next-quest.ts`. Home's "New" card must keep giving
 * the same answer, including the "all done -> last quest" fallback.
 */
function legacyNextQuest(
  snap: ProgressSnapshot,
  quests: readonly Quest[],
  episodes: readonly Episode[],
): Quest | undefined {
  const openIds = new Set(
    episodes.filter((e) => e.status === 'shipped' || e.status === 'ready').flatMap((e) => e.questIds),
  );
  const offerable = quests.filter((q) => openIds.has(q.id));
  const doneIds = new Set(snap.quests.filter((q) => q.completedAt).map((q) => q.questId));
  return offerable.find((q) => !doneIds.has(q.id)) ?? offerable[offerable.length - 1];
}

describe('"New" card = the shared Journey cursor (F-QUEST-002 §3.5)', () => {
  const quests = [...QUESTS, quest('quest:p', 'Preview one')];
  const episodes = [...EPISODES, episode('episode:soon', ['quest:p'], 'preview')];

  it('matches the pre-extraction behaviour for every subset of completed quests', () => {
    const ids = QUESTS.map((q) => q.id);
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const doneQuests = ids.filter((_, i) => mask & (1 << i)).map((id) => done(id, YESTERDAY, 1));
      const snap = snapshot(doneQuests);
      const plan = build({ snapshot: snap, quests, episodes });
      const newCard = plan.cards.find((c) => c.kind === 'new');
      expect(newCard?.questId, `mask ${mask}`).toBe(legacyNextQuest(snap, quests, episodes)?.id);
    }
  });

  it('offers no New card when no episode is playable', () => {
    const plan = build({ quests, episodes: [episode('episode:soon', ['quest:p'], 'preview')] });
    expect(plan.cards.find((c) => c.kind === 'new')).toBeUndefined();
  });
});

describe('quest access: Home offers open quests only (F-ENT-003 section 3.6)', () => {
  const S2_QUESTS = [...QUESTS, quest('quest:s2', 'Words at home')];
  const S2_EPISODES: Episode[] = [...EPISODES, { ...episode('episode:s2', ['quest:s2']), stage: 'stage2', theme: 'life' }];
  const closed = (...ids: string[]) => {
    const shut = new Set(ids);
    return (questId: string): boolean => !shut.has(questId);
  };

  it('omitted: the plan is the same as before', () => {
    const snap = snapshot([done('quest:a', YESTERDAY, 0.5)]);
    expect(build({ snapshot: snap, isQuestOpen: undefined })).toEqual(build({ snapshot: snap }));
    expect(build({ snapshot: snap, isQuestOpen: () => true })).toEqual(build({ snapshot: snap }));
  });

  it('slot ②: the cursor skips a closed quest', () => {
    const plan = build({ quests: S2_QUESTS, episodes: S2_EPISODES, isQuestOpen: closed('quest:a') });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: 'quest:b' });
  });

  it('slot ②: once every open quest is done, the replay fallback is the last open quest, never a closed one', () => {
    const allStage1 = snapshot(QUESTS.map((q) => done(q.id, FOUR_DAYS_AGO, 1)));
    const plan = build({ snapshot: allStage1, quests: S2_QUESTS, episodes: S2_EPISODES, isQuestOpen: closed('quest:s2') });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: 'quest:c' });
    for (const card of plan.cards) expect(card.questId).not.toBe('quest:s2');
  });

  it('slot ①: a replay is offered only when its quest is open', () => {
    const snap = snapshot([done('quest:a', YESTERDAY, 0.4), done('quest:b', YESTERDAY, 0.6)]);
    expect(build({ snapshot: snap }).cards[0]?.questId).toBe('quest:a');
    expect(build({ snapshot: snap, isQuestOpen: closed('quest:a') }).cards[0]).toMatchObject({ kind: 'replay', questId: 'quest:b' });
  });

  it('a replay is always kept: with the real predicate and the switch on, a free learner keeps a finished later-stage replay', () => {
    const snap = snapshot([{ ...done('quest:s2', YESTERDAY, 0.5), episodeId: 'episode:s2' }]);
    const isQuestOpen = questOpenPredicate({
      tier: 'free',
      gatingEnabled: true,
      completedQuestIds: new Set(['quest:s2']),
      registry: { stages: new Set(['stage1']), vocabTopics: new Set(), samplerStories: new Set(), freeQuests: new Set(['quest:a', 'quest:b', 'quest:c']), gridLessons: new Set(['quest:a', 'quest:b', 'quest:c', 'quest:s2']) },
    });
    const plan = build({ snapshot: snap, quests: S2_QUESTS, episodes: S2_EPISODES, isQuestOpen });
    expect(plan.cards[0]).toMatchObject({ kind: 'replay', questId: 'quest:s2' });
  });

  it('explore: never an episode whose every quest is closed', () => {
    const plan = build({ snapshot: snapshot(), isQuestOpen: closed('quest:a', 'quest:b') });
    for (const card of plan.cards) expect(card.episodeId === 'episode:one' && card.kind === 'explore').toBe(false);
    expect(plan.cards.some((c) => c.kind === 'explore' && c.episodeId === 'episode:two')).toBe(true);
  });

  it('explore: an episode with one open quest still counts', () => {
    const plan = build({ snapshot: snapshot(), episodes: [episode('episode:one', ['quest:a', 'quest:b'])], isQuestOpen: closed('quest:a') });
    expect(plan.cards[0]).toMatchObject({ kind: 'explore', episodeId: 'episode:one' });
  });

  it('the pinned "New" card re-pins to an open quest only (F-ROUTE-001 R-4a)', () => {
    const pinned = build();
    expect(pinned.cards[1]?.questId).toBe('quest:a');
    const plan = build({ pinned, skipQuestIds: new Set(['quest:a']), isQuestOpen: closed('quest:b') });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: 'quest:c' });
  });

  it('a pinned "New" card whose quest closed after the pin moves to an open quest (access changed mid-day)', () => {
    const pinned = build({ isQuestOpen: () => true });
    expect(pinned.cards[1]?.questId).toBe('quest:a');
    const plan = build({ pinned, isQuestOpen: closed('quest:a') });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', subtitle: 'new', questId: 'quest:b' });
    expect(plan.cards[0]).toEqual(pinned.cards[0]);
    expect(plan.cards[2]).toEqual(pinned.cards[2]);
  });

  it('a pinned "New" card stays when its quest is still open, or was finished today', () => {
    const pinned = build({ isQuestOpen: () => true });
    expect(build({ pinned, isQuestOpen: closed('quest:b') }).cards[1]?.questId).toBe('quest:a');
    const doneToday = build({ snapshot: snapshot([done('quest:a', TODAY, 1)]), pinned, isQuestOpen: closed('quest:a') });
    expect(doneToday.cards[1]).toMatchObject({ questId: 'quest:a', collected: true });
  });

  it('a pinned assigned card keeps its slot even when its quest closes', () => {
    const first = build();
    const assigned: MissionPlan = { ...first, cards: first.cards.map((c) => (c.slot === 2 ? { ...c, subtitle: 'assigned' as const } : c)) };
    expect(build({ pinned: assigned, isQuestOpen: closed('quest:a') }).cards[1]).toMatchObject({ questId: 'quest:a', subtitle: 'assigned' });
  });

  it('a pinned "New" card stays when every other quest is closed too', () => {
    const pinned = build();
    expect(build({ pinned, isQuestOpen: closed('quest:a', 'quest:b', 'quest:c') }).cards[1]?.questId).toBe('quest:a');
  });

  describe('on the shipped bundle', () => {
    const offerable = offerableQuests(questsAll, episodesAll).map((q) => q.id);
    const stage1 = offerable.filter((id) => episodesAll.some((e) => e.stage === 'stage1' && e.questIds.includes(id)));
    const finished = (ids: readonly string[], day: string, accuracy: number): ProgressSnapshot =>
      snapshot(ids.map((id) => ({ ...done(id, day, accuracy), episodeId: episodesAll.find((e) => e.questIds.includes(id))?.id ?? '' })));
    const live = (snap: ProgressSnapshot, isQuestOpen?: (questId: string) => boolean): MissionPlan =>
      buildTodaysMission({ profileId: 'profile:kid1', snapshot: snap, quests: questsAll, episodes: episodesAll, today: TODAY, isQuestOpen });
    const predicate = (tier: 'free' | 'premium', gatingEnabled: boolean, snap: ProgressSnapshot) =>
      questOpenPredicate({ tier, gatingEnabled, completedQuestIds: new Set(snap.quests.filter((q) => q.completedAt).map((q) => q.questId)) });

    it('golden, switch off: every card is unchanged for every prefix of the route, free and premium', () => {
      for (let n = 0; n <= offerable.length; n++) {
        for (const [day, accuracy] of [[YESTERDAY, 0.5], [FOUR_DAYS_AGO, 1]] as const) {
          const snap = finished(offerable.slice(0, n), day, accuracy);
          const today = live(snap);
          for (const tier of ['free', 'premium'] as const) {
            expect(live(snap, predicate(tier, false, snap)), `${tier}, ${n} done ${day}`).toEqual(today);
          }
        }
      }
    });

    it('switch on, free: three cards every day, none of them a closed lesson', () => {
      for (let n = 0; n <= stage1.length; n++) {
        const snap = finished(stage1.slice(0, n), YESTERDAY, 0.5);
        const isQuestOpen = predicate('free', true, snap);
        const plan = live(snap, isQuestOpen);
        expect(plan.cards, `${n} done`).toHaveLength(3);
        for (const card of plan.cards) {
          if (card.questId) expect(isQuestOpen(card.questId), `${n} done: ${card.questId}`).toBe(true);
          if (card.kind === 'explore') expect(episodesAll.find((e) => e.id === card.episodeId)?.questIds.some(isQuestOpen)).toBe(true);
        }
      }
    });
  });
});

describe('card ② follows routeNext (F-ENT-003 section 3.7, PR E3-4)', () => {
  const P = 'profile:kid1';
  const selfItem = (questId: string, targetDate: string, completedAt?: string): ProgressSnapshot['homework'][number] => ({
    id: `route:mine#${questId}`,
    profileId: P,
    questId,
    episodeId: EPISODES.find((e) => e.questIds.includes(questId))!.id,
    assignedBy: 'system',
    assignedAt: '2026-05-01T00:00:00.000Z',
    targetDate,
    ...(completedAt ? { completedAt } : {}),
  });
  const routeOf = (snap: ProgressSnapshot, over: Partial<RouteNextInput> = {}): RouteNextInput => ({
    snapshot: snap,
    profileId: P,
    today: TODAY,
    sources: [{ id: 'route:mine', kind: 'self', assignedAt: '2026-05-01T00:00:00.000Z', items: QUESTS.map((q) => ({ kind: 'quest' as const, id: q.id })), meta: null }],
    quests: QUESTS,
    episodes: EPISODES,
    cursor: { isEntitled: () => true, skipQuestIds: undefined },
    isQuestOpen: () => true,
    gating: { active: false, tier: 'premium' },
    ...over,
  });

  it('a plan item dated later this week is card ② with "Next in your plan"', () => {
    const snap = { ...snapshot(), homework: [selfItem('quest:c', '2026-05-22')] };
    const card = build({ snapshot: snap, route: routeOf(snap) }).cards.find((c) => c.slot === 2);
    expect(card).toMatchObject({ kind: 'new', questId: 'quest:c', episodeId: 'episode:two', subtitle: 'nextInPlan' });
    expect(missionCardText(card!, learner).subtitle).toBe('Next in your plan');
  });

  it('no plan: card ② is the cursor with today\'s "New" subtitle', () => {
    const snap = snapshot();
    const card = build({ snapshot: snap, route: routeOf(snap, { sources: [] }) }).cards.find((c) => c.slot === 2);
    expect(card).toMatchObject({ questId: 'quest:a', subtitle: 'new' });
  });

  it('at rest (and until E3-7, at free-end) card ② keeps today\'s replay fallback among open quests', () => {
    const all = snapshot(QUESTS.map((q) => done(q.id, YESTERDAY, 1)));
    expect(build({ snapshot: all, route: routeOf(all, { sources: [] }) }).cards.find((c) => c.slot === 2)).toMatchObject({
      questId: 'quest:c',
      subtitle: 'new',
    });
    const freeEnd = routeOf(all, { sources: [], gating: { active: true, tier: 'free' }, isQuestOpen: (id) => id !== 'quest:c' });
    expect(build({ snapshot: all, route: freeEnd, isQuestOpen: freeEnd.isQuestOpen }).cards.find((c) => c.slot === 2)).toMatchObject({
      questId: 'quest:b',
      subtitle: 'new',
    });
  });

  it('a route quest this build does not list falls back to the replay fallback; no playable quest gives no card', () => {
    const snap = snapshot();
    const odd = routeOf(snap, { sources: [], quests: [quest('quest:z', 'Elsewhere'), ...QUESTS], episodes: [episode('episode:z', ['quest:z']), ...EPISODES] });
    expect(build({ snapshot: snap, route: odd }).cards.find((c) => c.slot === 2)).toMatchObject({ questId: 'quest:c', subtitle: 'new' });
    const none = routeOf(snap, { sources: [], episodes: [] });
    expect(build({ snapshot: snap, episodes: [], route: none }).cards.find((c) => c.slot === 2)).toBeUndefined();
  });

  it('a pinned "Next in your plan" card re-pins like a "New" card when its quest closes', () => {
    const snap = { ...snapshot(), homework: [selfItem('quest:c', '2026-05-22')] };
    const pinned = build({ snapshot: snap, route: routeOf(snap) });
    const closedC = (id: string): boolean => id !== 'quest:c';
    const after = build({ snapshot: snap, pinned, route: routeOf(snap, { isQuestOpen: closedC }), isQuestOpen: closedC });
    expect(after.cards.find((c) => c.slot === 2)).toMatchObject({ questId: 'quest:a', subtitle: 'new' });
  });

  it('a re-pin keeps the plan subtitle when the new next quest comes from the plan', () => {
    const snap = { ...snapshot(), homework: [selfItem('quest:c', '2026-05-22'), selfItem('quest:b', '2026-05-23')] };
    const pinned = build({ snapshot: snap, route: routeOf(snap) });
    const closedC = (id: string): boolean => id !== 'quest:c';
    const after = build({ snapshot: snap, pinned, route: routeOf(snap, { isQuestOpen: closedC }), isQuestOpen: closedC });
    expect(after.cards.find((c) => c.slot === 2)).toMatchObject({ questId: 'quest:b', subtitle: 'nextInPlan' });
  });
});
