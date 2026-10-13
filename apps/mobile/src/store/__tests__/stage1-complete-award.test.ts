import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { episodesAll, questById, stage1Cards } from '../../content';
import { gridEpisodes } from '../../content/episodes';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { completeStages } from '../../logic/my-route/latch';
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
const STAGE1_QUESTS = gridEpisodes(episodesAll)
  .filter((e) => e.stage === 'stage1')
  .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id })));

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

  it('out of order: the stage completes when the last quest of any episode completes', () => {
    const track = vi.fn();
    const reversed = [...STAGE1_QUESTS].reverse();
    const outcomes = reversed.map(({ questId, episodeId }) => visit(questId, episodeId, 1, track));
    expect(outcomes.at(-1)?.stageCompleted).toBe('stage1');
    expect(outcomes.filter((o) => o.stageCompleted !== null)).toHaveLength(1);
    expect(events(track, 'stage.complete')).toHaveLength(1);
  });
});
