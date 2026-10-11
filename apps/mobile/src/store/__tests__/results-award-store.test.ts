import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { episodeById } from '../../content';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { writeJson } from '../../platform/storage';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const CREATED = '2026-09-01T08:00:00.000Z';
const LETTERS = 'episode:stage1-letters';

const owned = (): string[] => (useProgressStore.getState().byProfile['p1']?.cards ?? []).map((c) => c.cardId);

/** One Results visit through the real store, wired the way ResultsScreen wires it. */
function visit(questId: string, rewardCardId: string | undefined, stars: 0 | 1 | 2 | 3, track = vi.fn()): { outcome: QuestResultOutcome; track: ReturnType<typeof vi.fn> } {
  const s = useProgressStore.getState();
  const outcome = applyQuestResult(
    { profileId: 'p1', profileCreatedAt: CREATED, questId, episodeId: LETTERS, rewardCardId, stars, correct: stars, total: 3, retries: 0 },
    { snapshot: (id) => useProgressStore.getState().byProfile[id], recordQuestComplete: s.recordQuestComplete, unlockCards: s.unlockCards, track },
  );
  return { outcome, track };
}

const names = (track: ReturnType<typeof vi.fn>): string[] => track.mock.calls.map((c) => (c[0] as { name: string }).name);

describe('Results award through the real progress store', () => {
  beforeEach(() => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(['p1']), pendingFor: new Set(), catchUp: {} });
    useProfileStore.setState({
      profiles: [{ id: 'p1', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: CREATED }],
      activeId: 'p1',
      hydrated: true,
    });
    // Home's ensure: the blank snapshot and the welcome card, in memory.
    useProgressStore.getState().ensure('p1');
    vi.mocked(writeJson).mockClear();
  });

  afterEach(() => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
  });

  it('first 2-star finish unlocks the card once; a replay announces nothing', () => {
    const first = visit('quest:stage1-letters-q1', 'card:book', 2);
    expect(first.outcome.award).toMatchObject({ cardId: 'card:book', isNew: true, isFirstCard: true });
    expect(first.outcome.extras).toEqual([]);
    expect(owned().sort()).toEqual(['card:book', 'card:tiger']);

    const replay = visit('quest:stage1-letters-q1', 'card:book', 3);
    expect(replay.outcome.award).toMatchObject({ isNew: false });
    expect(owned().sort()).toEqual(['card:book', 'card:tiger']);
    expect(names(replay.track)).toEqual(['quest.complete']);
  });

  it('a 1-star finish records the quest but leaves the card locked', () => {
    const r = visit('quest:stage1-letters-q1', 'card:book', 1);
    expect(r.outcome.award).toBeNull();
    expect(owned()).toEqual(['card:tiger']);
    expect(useProgressStore.getState().byProfile['p1']?.quests).toHaveLength(1);
  });

  it('the last quest of Meet the Letters at 1 star brings the episode cards as extras with one write, and the reconcile finds nothing left', () => {
    visit('quest:stage1-letters-q1', 'card:book', 1);
    visit('quest:stage1-letters-q2', 'card:hanji', 1);
    vi.mocked(writeJson).mockClear();
    const last = visit('quest:stage1-letters-q3', 'card:brush', 1);
    const lettersCards = episodeById(LETTERS)?.rewardCardIds ?? [];
    expect(last.outcome.award).toBeNull();
    expect(last.outcome.extras.map((e) => e.cardId).sort()).toEqual([...lettersCards].sort());
    expect(last.outcome.extras.every((e) => e.source === 'episode')).toBe(true);
    expect(last.outcome.episodeCompleted).toBe(LETTERS);
    expect(owned().sort()).toEqual([...lettersCards, 'card:tiger'].sort());
    // One write for the score, one for the cards.
    expect(vi.mocked(writeJson).mock.calls.filter(([k]) => k === 'progress:p1')).toHaveLength(2);
    expect(names(last.track)).toContain('episode.complete');
    expect(useProgressStore.getState().reconcileAwards('p1')).toEqual([]);
    expect(useProgressStore.getState().catchUp['p1']).toBeUndefined();
  });

  it('cards arrive marked new for the Library, and a replay at fewer stars takes nothing away', () => {
    visit('quest:stage1-letters-q1', 'card:book', 3);
    visit('quest:stage1-letters-q2', 'card:hanji', 3);
    visit('quest:stage1-letters-q3', 'card:brush', 3);
    const before = useProgressStore.getState().byProfile['p1']?.cards ?? [];
    expect(before.filter((c) => c.cardId !== 'card:tiger').every((c) => c.newSinceLastView)).toBe(true);
    const replay = visit('quest:stage1-letters-q3', 'card:brush', 1);
    expect(replay.outcome).toEqual({ award: null, extras: [], episodeCompleted: null, stageCompleted: null });
    expect(useProgressStore.getState().byProfile['p1']?.cards).toEqual(before);
  });
});
