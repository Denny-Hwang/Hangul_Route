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
import { readJson, writeJson } from '../../platform/storage';
import { track as storeTrack } from '../../platform/telemetry';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const CREATED = '2026-09-01T08:00:00.000Z';
const LETTERS = 'episode:stage1-letters';

const owned = (): string[] => (useProgressStore.getState().byProfile['p1']?.cards ?? []).map((c) => c.cardId);

/** One Results visit through the real store, wired the way ResultsScreen wires it. */
function visit(
  questId: string,
  rewardCardId: string | undefined,
  stars: 0 | 1 | 2 | 3,
  track = vi.fn(),
  episodeId = LETTERS,
): { outcome: QuestResultOutcome; track: ReturnType<typeof vi.fn> } {
  const s = useProgressStore.getState();
  const outcome = applyQuestResult(
    { profileId: 'p1', profileCreatedAt: CREATED, questId, episodeId, rewardCardId, stars, correct: stars, total: 3, retries: 0 },
    {
      isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
      snapshot: (id) => useProgressStore.getState().byProfile[id],
      recordQuestComplete: s.recordQuestComplete,
      unlockCards: s.unlockCards,
      recordCatchUp: s.recordCatchUp,
      track,
    },
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
    vi.mocked(storeTrack).mockClear();
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
  it('cards a missed reconcile left out join the Home catch-up list with one aggregate event, not as extras (§3.5)', () => {
    const at = '2026-09-10T08:00:00.000Z';
    const letters = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'].map((questId) => ({
      questId,
      episodeId: LETTERS,
      startedAt: at,
      completedAt: at,
      stars: 1 as const,
      attempts: 1,
      accuracy: 0.4,
    }));
    const current = useProgressStore.getState().byProfile['p1'];
    if (!current) throw new Error('ensure made no snapshot');
    useProgressStore.setState({ byProfile: { p1: { ...current, quests: letters } } });
    const r = visit('quest:stage1-rites-q1', 'card:seollal', 1, vi.fn(), 'episode:stage1-rites');
    const lettersCards = [...(episodeById(LETTERS)?.rewardCardIds ?? [])].sort();
    const ritesCards = [...(episodeById('episode:stage1-rites')?.rewardCardIds ?? [])].sort();
    expect(r.outcome.extras.map((e) => e.cardId).sort()).toEqual(ritesCards);
    expect(owned().sort()).toEqual([...lettersCards, ...ritesCards, 'card:tiger'].sort());
    expect([...(useProgressStore.getState().catchUp['p1'] ?? [])].sort()).toEqual(lettersCards);
    expect(vi.mocked(storeTrack).mock.calls.map(([e]) => e)).toEqual([
      { name: 'card.catchup_granted', profileId: 'p1', payload: { count: lettersCards.length, episode: lettersCards.length, stage: 0, welcome: 0, quest: 0, set: 0 } },
    ]);
    const perCard = r.track.mock.calls.map(([e]) => e as { name: string; payload: { cardId?: string } }).filter((e) => e.name === 'card.unlocked');
    expect(perCard.map((e) => e.payload.cardId).sort()).toEqual(ritesCards);
  });

  it('before the saved snapshot has loaded: nothing beyond the quest card is announced, and the saved cards merge without duplicates', async () => {
    const at = '2026-09-10T08:00:00.000Z';
    const lettersCards = [...(episodeById(LETTERS)?.rewardCardIds ?? [])];
    vi.mocked(readJson).mockResolvedValueOnce({
      profileId: 'p1',
      updatedAt: at,
      quests: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'].map((questId) => ({
        questId,
        episodeId: LETTERS,
        startedAt: at,
        completedAt: at,
        stars: 1,
        attempts: 1,
        accuracy: 0.4,
      })),
      episodes: [],
      cards: [...lettersCards, 'card:tiger'].map((cardId) => ({ cardId, unlockedAt: at, newSinceLastView: false })),
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
    });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), catchUp: {} });
    const r = visit('quest:stage1-letters-q3', 'card:brush', 1);
    expect(r.outcome).toEqual({ award: null, extras: [], episodeCompleted: null, stageCompleted: null });
    expect(names(r.track)).toEqual(['quest.complete']);
    await useProgressStore.getState().hydrate('p1');
    const cards = owned();
    expect(cards.sort()).toEqual([...lettersCards, 'card:tiger'].sort());
    expect(new Set(cards).size).toBe(cards.length);
    expect(useProgressStore.getState().catchUp['p1']).toBeUndefined();
  });
  it('recordCatchUp with nothing to announce changes nothing and sends nothing', () => {
    const before = useProgressStore.getState();
    useProgressStore.getState().recordCatchUp('p1', []);
    expect(useProgressStore.getState().catchUp).toBe(before.catchUp);
    expect(storeTrack).not.toHaveBeenCalled();
  });
});
