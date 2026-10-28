import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { requiredQuestIds } from '@hangul-route/content-schema';
import { episodesAll, questById, questsAll, stage1Cards } from '../../content';
import { gridEpisodes } from '../../content/episodes';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { completeStages } from '../../logic/my-route/latch';
import { nextQuestAfter } from '../../logic/next-quest';
import { opensStagePrize, stagePrizeCards } from '../../logic/stage1/stage-complete';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

/**
 * F-QUEST-002 §3.8 integration (PR Q-9): the 15 Stage 1 quests through the real progress store at
 * mixed stars, wired the way ResultsScreen wires `applyQuestResult`. The last quest completes the
 * stage: every Stage 1 card is owned (15 quest cards, 11 episode extras, the 3 legendary cards and
 * the welcome card), `stage.complete` is sent once, Results offers the prize once, and a replay
 * brings nothing.
 */

const CREATED = '2026-09-01T08:00:00.000Z';
/** The quests Stage 1 needs: the optional addition of F-CURR-002 row CM-33 (Play & Crafts quest 4) is not one. */
const STAGE1_QUESTS = gridEpisodes(episodesAll)
  .filter((e) => e.stage === 'stage1')
  .flatMap((e) => requiredQuestIds(e).map((questId) => ({ questId, episodeId: e.id })));
const ADDITION = { questId: 'quest:stage1-crafts-q4', episodeId: 'episode:stage1-crafts' };

type Event = { name: string; payload: Record<string, unknown> };

function visit(questId: string, episodeId: string, stars: 1 | 2 | 3, track: ReturnType<typeof vi.fn>): QuestResultOutcome {
  const s = useProgressStore.getState();
  return applyQuestResult(
    {
      profileId: 'p1',
      profileCreatedAt: CREATED,
      questId,
      episodeId,
      rewardCardId: questById(questId)?.rewardCardId,
      stars,
      correct: stars,
      total: 3,
      retries: 0,
    },
    {
      isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
      snapshot: (id) => useProgressStore.getState().byProfile[id],
      recordQuestComplete: s.recordQuestComplete,
      unlockCards: s.unlockCards,
      recordCatchUp: s.recordCatchUp,
      track,
    },
  );
}

const owned = (): string[] => (useProgressStore.getState().byProfile['p1']?.cards ?? []).map((c) => c.cardId);
const events = (track: ReturnType<typeof vi.fn>, name: string): Event[] =>
  track.mock.calls.map((c) => c[0] as Event).filter((e) => e.name === name);

describe('Stage 1 completion through the real store (F-QUEST-002 §3.8)', () => {
  beforeEach(() => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(['p1']), pendingFor: new Set(), catchUp: {} });
    useProfileStore.setState({
      profiles: [{ id: 'p1', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: CREATED }],
      activeId: 'p1',
      hydrated: true,
    });
    useProgressStore.getState().ensure('p1');
  });

  it('has the 15 quests the stage needs', () => {
    expect(STAGE1_QUESTS).toHaveLength(15);
  });

  it('15 quests at mixed stars award every Stage 1 card, the stage once and the prize once; a replay adds nothing', () => {
    const track = vi.fn();
    const outcomes = STAGE1_QUESTS.map(({ questId, episodeId }, i) => visit(questId, episodeId, ((i % 3) + 1) as 1 | 2 | 3, track));

    // Only the last run completed the stage, and only it opens the ceremony.
    expect(outcomes.slice(0, -1).every((o) => o.stageCompleted === null)).toBe(true);
    expect(outcomes.at(-1)?.stageCompleted).toBe('stage1');
    expect(outcomes.filter((o) => opensStagePrize(o))).toHaveLength(1);

    // 15 quest cards + 11 episode extras + 3 legendary cards + the welcome card: all 30 Stage 1 cards, each once.
    expect(new Set(owned())).toEqual(new Set(stage1Cards.map((c) => c.id)));
    expect(owned()).toHaveLength(30);
    // The legendary cards arrive as extras of the last run, though some runs were one star (not star-gated).
    const legendary = stagePrizeCards('stage1').map((c) => c.id);
    expect(outcomes.at(-1)?.extras.filter((x) => x.source === 'stage').map((x) => x.cardId).sort()).toEqual([...legendary].sort());

    // stage.complete once, counting the three legendary cards; a card.unlocked per legendary card.
    expect(events(track, 'stage.complete')).toEqual([
      expect.objectContaining({ profileId: 'p1', payload: { stageKey: 'stage1', cardsAwarded: 3 } }),
    ]);
    const unlocked = events(track, 'card.unlocked').map((e) => e.payload.cardId);
    for (const id of legendary) expect(unlocked.filter((c) => c === id)).toHaveLength(1);

    // The Journey header now reads Complete for Stage 1.
    const snapshot = useProgressStore.getState().byProfile['p1'];
    expect(snapshot && completeStages(snapshot, episodesAll).has('stage1')).toBe(true);

    // Replaying the last quest announces nothing and adds nothing.
    const replayTrack = vi.fn();
    const last = STAGE1_QUESTS.at(-1) as { questId: string; episodeId: string };
    const replay = visit(last.questId, last.episodeId, 3, replayTrack);
    expect(replay).toMatchObject({ extras: [], episodeCompleted: null, stageCompleted: null });
    expect(replay.award?.isNew ?? false).toBe(false);
    expect(opensStagePrize(replay)).toBe(false);
    expect(events(replayTrack, 'stage.complete')).toEqual([]);
    expect(events(replayTrack, 'card.unlocked')).toEqual([]);
    expect(owned()).toHaveLength(30);
  });

  it('the optional Stage 1 addition (row CM-33) never reopens a finished stage, announces nothing and opens no prize', () => {
    // A learner who finished the 15 quests before the addition shipped: Stage 1 is complete and stays complete.
    const track = vi.fn();
    STAGE1_QUESTS.forEach(({ questId, episodeId }) => visit(questId, episodeId, 2, track));
    expect(events(track, 'stage.complete')).toHaveLength(1);
    const before = useProgressStore.getState().byProfile['p1'];
    expect(before && completeStages({ ...before, stageDoneAt: {} }, episodesAll).has('stage1')).toBe(true);
    const cardsBefore = owned();

    // Then they play the addition: no stage or episode completion, no telemetry for either, no ceremony, no card.
    const later = vi.fn();
    const outcome = visit(ADDITION.questId, ADDITION.episodeId, 3, later);
    expect(outcome).toMatchObject({ extras: [], episodeCompleted: null, stageCompleted: null });
    expect(opensStagePrize(outcome)).toBe(false);
    expect(events(later, 'stage.complete')).toEqual([]);
    expect(events(later, 'episode.complete')).toEqual([]);
    expect(events(later, 'card.unlocked')).toEqual([]);
    expect(owned()).toEqual(cardsBefore);
    const after = useProgressStore.getState().byProfile['p1'];
    expect(after && completeStages({ ...after, stageDoneAt: {} }, episodesAll).has('stage1')).toBe(true);
  });

  it('the cursor offers the addition after Read Hangul!, and never pulls a learner back once they are past it', () => {
    STAGE1_QUESTS.forEach(({ questId, episodeId }) => visit(questId, episodeId, 2, vi.fn()));
    const snapshot = useProgressStore.getState().byProfile['p1'];
    if (!snapshot) throw new Error('no snapshot');
    // Straight after Stage 1: the addition is next on the route.
    expect(nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll })?.id).toBe(ADDITION.questId);
    // A learner already in Stage 2 (a quest after it done): the cursor stays where they are.
    const stage2 = gridEpisodes(episodesAll).find((e) => e.stage === 'stage2' && e.status === 'shipped');
    const first = stage2?.questIds[0];
    if (!stage2 || !first) throw new Error('no Stage 2 episode');
    const moved = { ...snapshot, quests: [...snapshot.quests, { questId: first, episodeId: stage2.id, startedAt: CREATED, completedAt: CREATED, stars: 2 as const, attempts: 1, accuracy: 1 }] };
    const next = nextQuestAfter({ snapshot: moved, quests: questsAll, episodes: episodesAll });
    expect(next?.id).not.toBe(ADDITION.questId);
    expect(next?.id.startsWith('quest:stage1-')).toBe(false);
  });

  it('out of order: the stage completes when the last quest of any episode completes', () => {
    const track = vi.fn();
    const reversed = [...STAGE1_QUESTS].reverse();
    const outcomes = reversed.map(({ questId, episodeId }) => visit(questId, episodeId, 1, track));
    expect(outcomes.at(-1)?.stageCompleted).toBe('stage1');
    expect(outcomes.filter((o) => o.stageCompleted !== null)).toHaveLength(1);
    expect(events(track, 'stage.complete')).toHaveLength(1);
  });
});
