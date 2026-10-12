import { VocabProgressSchema, type ProgressSnapshot, type VocabItemState } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { episodesAll } from '../../content/episodes';
import { setProgressPersistListener } from '../../logic/sync/persist-hook';
import { readJson, writeJson } from '../../platform/storage';
import { placementResult } from '../../logic/placement/__tests__/fixtures';
import { track } from '../../platform/telemetry';
import { useProfileStore } from '../profile-store';
import { notifyProfileRemoved } from '../profile-removal';
import { nextStreak, useProgressStore } from '../progress-store';

function resetStore(): void {
  mem.clear();
  vi.mocked(readJson).mockClear();
  vi.mocked(writeJson).mockClear();
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), pendingVocabEvents: {} });
}

/** Let fire-and-forget hydrations and storage writes settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('progress-store', () => {
  beforeEach(resetStore);

  it('recordQuestComplete adds a quest record', () => {
    useProgressStore.getState().recordQuestComplete('p1', {
      questId: 'q1',
      episodeId: 'e1',
      stars: 3,
      accuracy: 1,
      attempts: 0,
    });
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(1);
    expect(snap?.quests[0]?.questId).toBe('q1');
    expect(snap?.quests[0]?.stars).toBe(3);
    expect(snap?.quests[0]?.completedAt).toBeTruthy();
  });

  it('recordQuestComplete replaces the record for the same quest', () => {
    const { recordQuestComplete } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 1, accuracy: 0.5, attempts: 2 });
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 3, accuracy: 1, attempts: 0 });
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(1);
    expect(snap?.quests[0]?.stars).toBe(3);
  });

  it('unlockCard adds a card and is idempotent', () => {
    const { unlockCard } = useProgressStore.getState();
    unlockCard('p1', 'card:book');
    unlockCard('p1', 'card:book');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.cards).toHaveLength(1);
    expect(snap?.cards[0]?.cardId).toBe('card:book');
    expect(snap?.cards[0]?.newSinceLastView).toBe(true);
  });

  it('beginSession then endSession records a non-negative duration', () => {
    const { beginSession, endSession } = useProgressStore.getState();
    beginSession('p1');
    endSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.sessions).toHaveLength(1);
    expect(snap?.sessions[0]?.endedAt).toBeTruthy();
    expect(snap?.sessions[0]?.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('endSession with no open session is a no-op', () => {
    useProgressStore.getState().endSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap).toBeUndefined();
  });

  it('reset clears a profile snapshot', () => {
    const { recordQuestComplete, unlockCard, reset } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 2, accuracy: 0.8, attempts: 1 });
    unlockCard('p1', 'card:book');
    reset('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(0);
    expect(snap?.cards).toHaveLength(0);
  });

  it('beginSession starts the streak at 1 on first call', () => {
    useProgressStore.getState().beginSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.streakDays).toBe(1);
  });

  it('beginSession twice in the same day keeps the streak at 1', () => {
    const { beginSession, endSession } = useProgressStore.getState();
    beginSession('p1');
    endSession('p1');
    beginSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.streakDays).toBe(1);
  });
});

describe('nextStreak', () => {
  it('seeds the streak at 1 when there is no prior session', () => {
    expect(nextStreak(0, undefined, '2026-05-28')).toBe(1);
  });

  it('keeps the streak (≥ 1) when the same day repeats', () => {
    expect(nextStreak(7, '2026-05-28', '2026-05-28')).toBe(7);
    expect(nextStreak(0, '2026-05-28', '2026-05-28')).toBe(1);
  });

  it('increments the streak by 1 when the next day is reached', () => {
    expect(nextStreak(7, '2026-05-27', '2026-05-28')).toBe(8);
  });

  it('resets to 1 when more than one day has passed', () => {
    expect(nextStreak(7, '2026-05-25', '2026-05-28')).toBe(1);
  });

  it('handles month rollovers correctly', () => {
    expect(nextStreak(3, '2026-04-30', '2026-05-01')).toBe(4);
  });
});

describe('quest completion marks assignments (F-HW-001 §3.4, F-PLAN-001 §3.3)', () => {
  it('sets completedAt on every open assignment for that quest only', () => {
    const store = useProgressStore.getState();
    const base = store.ensure('profile:hw');
    store.replaceSnapshot('profile:hw', {
      ...base,
      homework: [
        { id: 'plan:w3#quest:x', profileId: 'profile:hw', questId: 'quest:x', episodeId: 'episode:e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21' },
        { id: 'hw:old', profileId: 'profile:hw', questId: 'quest:x', episodeId: 'episode:e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-01', completedAt: 'earlier' },
        { id: 'hw:other', profileId: 'profile:hw', questId: 'quest:y', episodeId: 'episode:e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' },
      ],
    });
    useProgressStore.getState().recordQuestComplete('profile:hw', { questId: 'quest:x', episodeId: 'episode:e', stars: 3, attempts: 1, accuracy: 1 });
    const homework = useProgressStore.getState().byProfile['profile:hw']?.homework ?? [];
    expect(homework.find((h) => h.id === 'plan:w3#quest:x')?.completedAt).toBeTruthy();
    expect(homework.find((h) => h.id === 'hw:old')?.completedAt).toBe('earlier');
    expect(homework.find((h) => h.id === 'hw:other')?.completedAt).toBeUndefined();
  });
});

/** What a learner earned in an earlier visit, as it sits in storage. */
const savedSnapshot = (profileId = 'p1'): ProgressSnapshot => ({
  profileId,
  updatedAt: '2026-10-01T09:05:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:a', episodeId: 'episode:e', startedAt: '2026-10-01T09:00:00.000Z', completedAt: '2026-10-01T09:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [{ cardId: 'card:book', unlockedAt: '2026-10-01T09:05:00.000Z', newSinceLastView: false }],
  sessions: [{ id: 'session:2026-10-01T09:00:00.000Z', profileId, startedAt: '2026-10-01T09:00:00.000Z', episodesTouched: [] }],
  homework: [],
  reviews: [],
  streakDays: 1,
});

const stored = (profileId = 'p1'): ProgressSnapshot | undefined => mem.get(`progress:${profileId}`) as ProgressSnapshot | undefined;

describe('loading saved progress (audit UX-01 / L16)', () => {
  const notified: string[] = [];

  beforeEach(() => {
    resetStore();
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
  });

  afterEach(() => {
    setProgressPersistListener(null);
  });

  it('hydrate puts the saved snapshot in memory', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    const state = useProgressStore.getState();
    expect(state.byProfile['p1']?.cards.map((c) => c.cardId)).toEqual(['card:book']);
    expect(state.hydratedFor.has('p1')).toBe(true);
  });

  it('a write after hydrate keeps everything saved before it', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:b', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    expect(stored()?.quests.map((q) => q.questId)).toEqual(['quest:a', 'quest:b']);
    expect(stored()?.cards.map((c) => c.cardId)).toEqual(['card:book']);
    expect(notified).toEqual(['p1']);
  });

  it('a saved snapshot that predates placements hydrates and takes writes without gaining the key', async () => {
    mem.set('progress:p1', savedSnapshot());
    expect(mem.get('progress:p1')).not.toHaveProperty('placements');
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:b', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    expect(stored()?.quests.map((q) => q.questId)).toEqual(['quest:a', 'quest:b']);
    expect(stored()).not.toHaveProperty('placements');
  });

  it('a saved snapshot that predates stageDoneAt hydrates and takes writes without gaining the key (F-ROUTE-001 R-W1)', async () => {
    mem.set('progress:p1', savedSnapshot());
    expect(mem.get('progress:p1')).not.toHaveProperty('stageDoneAt');
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:b', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    expect(stored()).not.toHaveProperty('stageDoneAt');
  });

  it('a saved stage latch survives hydrate and later writes (F-ROUTE-001 R-W1)', async () => {
    const latch = { stage1: '2026-10-11T09:30:00.000Z' };
    mem.set('progress:p1', { ...savedSnapshot(), stageDoneAt: latch });
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:b', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    useProgressStore.getState().unlockCard('p1', 'card:new');
    expect(stored()?.stageDoneAt).toEqual(latch);
  });

  it('a blank record from ensure() does not hide the saved snapshot', async () => {
    mem.set('progress:p1', savedSnapshot());
    expect(useProgressStore.getState().ensure('p1').cards).toEqual([]);
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().byProfile['p1']?.cards.map((c) => c.cardId)).toEqual(['card:book']);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('a write before hydrate never overwrites storage: the saved copy is merged in first', async () => {
    mem.set('progress:p1', savedSnapshot());
    useProgressStore.getState().ensure('p1');
    useProgressStore.getState().unlockCard('p1', 'card:hanji');
    // Nothing reached storage yet and sync was not told about a write.
    expect(stored()?.cards.map((c) => c.cardId)).toEqual(['card:book']);
    expect(notified).toEqual([]);

    await settle();

    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(useProgressStore.getState().pendingFor.has('p1')).toBe(false);
    expect(stored()?.cards.map((c) => c.cardId).sort()).toEqual(['card:book', 'card:hanji']);
    expect(stored()?.quests.map((q) => q.questId)).toEqual(['quest:a']);
    expect(useProgressStore.getState().byProfile['p1']).toEqual(stored());
    expect(notified).toEqual(['p1']);
  });

  it('writes made while a hydrate is in flight are merged, not dropped', async () => {
    mem.set('progress:p1', savedSnapshot());
    const loading = useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().beginSession('p1');
    await loading;
    await settle();
    expect(stored()?.sessions).toHaveLength(2);
    expect(stored()?.cards.map((c) => c.cardId)).toEqual(['card:book']);
  });

  it('a profile with nothing saved keeps its first writes once it has loaded', async () => {
    useProgressStore.getState().recordQuestComplete('p-new', { questId: 'quest:a', episodeId: 'episode:e', stars: 3, accuracy: 1, attempts: 1 });
    await settle();
    expect(stored('p-new')?.quests.map((q) => q.questId)).toEqual(['quest:a']);
    expect(notified).toEqual(['p-new']);
  });

  it('hydrate with nothing saved and nothing written leaves no record (nothing to sync)', async () => {
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().byProfile['p1']).toBeUndefined();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('hydrate does not re-read storage once loaded', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().unlockCard('p1', 'card:hanji');
    await useProgressStore.getState().hydrate('p1');
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(useProgressStore.getState().byProfile['p1']?.cards).toHaveLength(2);
  });

  it('hydrates that overlap share one storage read', async () => {
    mem.set('progress:p1', savedSnapshot());
    const first = useProgressStore.getState().hydrate('p1');
    const second = useProgressStore.getState().hydrate('p1');
    await Promise.all([first, second]);
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(useProgressStore.getState().byProfile['p1']?.cards.map((c) => c.cardId)).toEqual(['card:book']);
  });

  it('two quick writes before the saved copy loads trigger one read and both are kept', async () => {
    mem.set('progress:p1', savedSnapshot());
    useProgressStore.getState().unlockCard('p1', 'card:hanji');
    useProgressStore.getState().unlockCard('p1', 'card:kimchi');
    await settle();
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(stored()?.cards.map((c) => c.cardId).sort()).toEqual(['card:book', 'card:hanji', 'card:kimchi']);
  });

  it('a quest finished before the saved copy loads completes its open assignment there', async () => {
    const assignment = (id: string, questId: string) => ({ id, profileId: 'p1', questId, episodeId: 'episode:e', assignedBy: 'parent' as const, assignedAt: '2026-10-01T08:00:00.000Z', targetDate: '2026-10-02' });
    mem.set('progress:p1', { ...savedSnapshot(), homework: [assignment('hw:b', 'quest:b'), assignment('hw:other', 'quest:other')] });
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:b', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    await settle();
    const homework = stored()?.homework ?? [];
    const completedAt = stored()?.quests.find((q) => q.questId === 'quest:b')?.completedAt;
    expect(completedAt).toBeTruthy();
    expect(homework.find((h) => h.id === 'hw:b')?.completedAt).toBe(completedAt);
    expect(homework.find((h) => h.id === 'hw:other')?.completedAt).toBeUndefined();
  });

  it('a snapshot replaced while the read is in flight wins over the stale read', async () => {
    mem.set('progress:p1', savedSnapshot());
    const loading = useProgressStore.getState().hydrate('p1');
    const restored = { ...savedSnapshot(), cards: [{ cardId: 'card:kimchi', unlockedAt: 't', newSinceLastView: true }] };
    useProgressStore.getState().replaceSnapshot('p1', restored);
    await loading;
    expect(useProgressStore.getState().byProfile['p1']?.cards.map((c) => c.cardId)).toEqual(['card:kimchi']);
  });

  it('reset is final: a later hydrate does not bring the old snapshot back', async () => {
    mem.set('progress:p1', savedSnapshot());
    useProgressStore.getState().reset('p1');
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().byProfile['p1']?.cards).toEqual([]);
    expect(stored()?.cards).toEqual([]);
  });
});

describe('stars never go down (F-STORY-003 PR 3.6, D3)', () => {
  beforeEach(resetStore);

  it('a replay with fewer stars keeps the best result and counts the attempt', () => {
    const { recordQuestComplete } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 3, accuracy: 1, attempts: 1 });
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 1, accuracy: 0.3, attempts: 1 });
    const quests = useProgressStore.getState().byProfile['p1']?.quests ?? [];
    expect(quests).toHaveLength(1);
    expect(quests[0]).toMatchObject({ stars: 3, accuracy: 1, attempts: 2 });
  });

  it('a replay with more stars raises the stored result', () => {
    const { recordQuestComplete } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 1, accuracy: 0.3, attempts: 1 });
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 3, accuracy: 1, attempts: 1 });
    expect(useProgressStore.getState().byProfile['p1']?.quests[0]).toMatchObject({ stars: 3, attempts: 2 });
  });

  it('a legacy saved snapshot still loads and a lower replay does not take its stars away', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:a', episodeId: 'episode:e', stars: 1, accuracy: 0.3, attempts: 1 });
    expect(stored()?.quests).toHaveLength(1);
    expect(stored()?.quests[0]).toMatchObject({ stars: 3, accuracy: 1, startedAt: '2026-10-01T09:00:00.000Z', attempts: 2 });
  });

  it('a lower replay finished before the saved snapshot loads does not hide the saved stars', async () => {
    mem.set('progress:p1', savedSnapshot());
    useProgressStore.getState().recordQuestComplete('p1', { questId: 'quest:a', episodeId: 'episode:e', stars: 1, accuracy: 0.3, attempts: 1 });
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().byProfile['p1']?.quests[0]?.stars).toBe(3);
    expect(stored()?.quests[0]?.stars).toBe(3);
  });
});

describe('recordPlacement (F-PLC-001 section 3.8)', () => {
  const notified: string[] = [];

  beforeEach(() => {
    resetStore();
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
  });

  afterEach(() => {
    setProgressPersistListener(null);
  });

  it('appends to placements only: no quests, cards, homework, sessions, streak or episodes', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    const before = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;
    const result = placementResult({ placedOutQuestIds: ['quest:a', 'quest:b'] });
    expect(useProgressStore.getState().recordPlacement('p1', result)).toBe(true);
    const after = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;
    expect(after.placements).toEqual([result]);
    // The only other key it may add is the null default of F-PLAN-002's selfRoute (withSnapshotDefaults).
    expect(after.selfRoute).toBeNull();
    const { placements: _p, updatedAt: _u, selfRoute: _r, ...restAfter } = after;
    const { placements: _q, updatedAt: _v, ...restBefore } = before;
    expect(restAfter).toEqual(restBefore);
    expect(stored()?.placements).toEqual([result]);
    expect(notified).toEqual(['p1']);
  });

  it('works on a legacy snapshot without the key and keeps earlier results', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    const first = placementResult({ id: 'placement:one', completedAt: '2026-10-01T00:00:00Z' });
    const second = placementResult({ id: 'placement:two', completedAt: '2026-10-02T00:00:00Z' });
    useProgressStore.getState().recordPlacement('p1', second);
    useProgressStore.getState().recordPlacement('p1', first);
    expect(stored()?.placements?.map((r) => r.id)).toEqual(['placement:one', 'placement:two']);
  });

  it('never stores a result with zero responses', () => {
    const empty = placementResult({ responses: [] });
    expect(useProgressStore.getState().recordPlacement('p1', empty)).toBe(false);
    expect(useProgressStore.getState().byProfile['p1']).toBeUndefined();
    expect(notified).toEqual([]);
  });

  it('never stores a result the Worker schema would refuse (it would block every later sync)', () => {
    const tooMany = placementResult({ placedOutQuestIds: Array.from({ length: 41 }, (_, i) => `quest:q${i}`) });
    expect(useProgressStore.getState().recordPlacement('p1', tooMany)).toBe(false);
    expect(useProgressStore.getState().recordPlacement('p1', placementResult({ id: 'not-a-placement-id' }))).toBe(false);
    expect(useProgressStore.getState().byProfile['p1']).toBeUndefined();
    expect(notified).toEqual([]);
  });

  it('recording the same result twice keeps one copy', async () => {
    await useProgressStore.getState().hydrate('p1');
    const result = placementResult();
    useProgressStore.getState().recordPlacement('p1', result);
    useProgressStore.getState().recordPlacement('p1', result);
    expect(useProgressStore.getState().byProfile['p1']?.placements).toHaveLength(1);
  });
});

describe('recordVocab (F-VOC-005 section 3.2)', () => {
  const notified: string[] = [];
  const APPLE = 'vocab:sagwa-apple';
  const EYE = 'vocab:nun-eye';
  const T1 = new Date('2026-10-11T15:00:00.000Z');
  const word = (over: Partial<VocabItemState> = {}): VocabItemState => ({
    id: APPLE,
    first: '2026-10-01',
    seen: 4,
    right: 3,
    bestBox: 3,
    last: '2026-10-08',
    box: 3,
    due: '2026-10-15',
    at: '2026-10-08T10:00:00.000Z',
    ...over,
  });
  const withVocab = (items: VocabItemState[]): ProgressSnapshot => ({ ...savedSnapshot(), vocab: { v: 1, items, topics: [] } });
  const vocabIn = (snap: ProgressSnapshot | undefined, id = APPLE) => snap?.vocab?.items.find((w) => w.id === id);

  beforeEach(() => {
    resetStore();
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
  });

  afterEach(() => {
    setProgressPersistListener(null);
  });

  it('applies the events, saves once hydrated and tells sync; nothing else changes', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    const before = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: APPLE }, { type: 'session', topicKey: 'food', kind: 'cards' }], T1);
    const after = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;
    expect(vocabIn(after)).toMatchObject({ box: 1, due: '2026-10-12', first: '2026-10-11' });
    expect(after.vocab?.topics.map((t) => t.topic)).toEqual(['food']);
    expect(after.updatedAt).toBe(T1.toISOString());
    const { vocab: _v, updatedAt: _u, ...restAfter } = after;
    const { updatedAt: _w, ...restBefore } = before;
    expect(restAfter).toEqual(restBefore);
    expect(stored()).toEqual(after);
    expect(notified).toEqual(['p1']);
  });

  it('writes nothing when every event is ignored', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    vi.mocked(writeJson).mockClear();
    const before = useProgressStore.getState().byProfile['p1'];
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: 'not-an-id' }], T1);
    useProgressStore.getState().recordVocab('p1', [], T1);
    expect(useProgressStore.getState().byProfile['p1']).toBe(before);
    expect(writeJson).not.toHaveBeenCalled();
    expect(notified).toEqual([]);
  });

  it('defaults the clock to now', async () => {
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: APPLE }]);
    expect(vocabIn(useProgressStore.getState().byProfile['p1'])?.box).toBe(1);
  });

  it('before hydration it queues the events and replays them onto the saved slice, never over it', async () => {
    mem.set('progress:p1', withVocab([word()]));
    // A fresh `introduced` stamp would win a last-writer-wins merge over the saved box 3.
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: APPLE }, { type: 'answer', id: EYE, correct: true, source: 'speed' }], T1);
    expect(useProgressStore.getState().pendingVocabEvents['p1']).toHaveLength(1);
    expect(stored()?.vocab?.items).toHaveLength(1);
    expect(notified).toEqual([]);

    await settle();

    const snap = useProgressStore.getState().byProfile['p1'];
    expect(vocabIn(snap)).toEqual(word());
    expect(vocabIn(snap, EYE)).toMatchObject({ box: 2, seen: 1, right: 1 });
    expect(snap?.quests.map((q) => q.questId)).toEqual(['quest:a']);
    expect(stored()).toEqual(snap);
    expect(useProgressStore.getState().pendingVocabEvents['p1']).toBeUndefined();
    expect(notified).toEqual(['p1']);
  });

  it('an answer queued before hydration moves the saved box, in order with later batches', async () => {
    mem.set('progress:p1', withVocab([word()]));
    useProgressStore.getState().recordVocab('p1', [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], T1);
    useProgressStore.getState().recordVocab('p1', [{ type: 'answer', id: APPLE, correct: false, source: 'speed' }], new Date('2026-10-11T15:01:00.000Z'));
    await settle();
    expect(vocabIn(useProgressStore.getState().byProfile['p1'])).toMatchObject({ box: 3, bestBox: 4, seen: 6, right: 4, due: '2026-10-12' });
  });

  it('with nothing saved, the queued events count once', async () => {
    useProgressStore.getState().recordVocab('p-new', [{ type: 'answer', id: APPLE, correct: true, source: 'speed' }], T1);
    await settle();
    expect(vocabIn(stored('p-new'))).toMatchObject({ seen: 1, right: 1, box: 2 });
    expect(useProgressStore.getState().pendingVocabEvents['p-new']).toBeUndefined();
  });

  it('a saved slice that fails the schema is rebuilt from the events (section 3.10)', async () => {
    mem.set('progress:p1', withVocab([word({ box: 9 })]));
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: EYE }], T1);
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.vocab?.items.map((w) => w.id)).toEqual([EYE]);
    expect(VocabProgressSchema.safeParse(snap?.vocab).success).toBe(true);
  });

  it('a restore that lands before the saved copy loads drops the queue with the rest', async () => {
    mem.set('progress:p1', withVocab([word()]));
    useProgressStore.getState().recordVocab('p1', [{ type: 'introduced', id: EYE }], T1);
    useProgressStore.getState().replaceSnapshot('p1', savedSnapshot());
    await settle();
    expect(useProgressStore.getState().pendingVocabEvents['p1']).toBeUndefined();
    expect(useProgressStore.getState().byProfile['p1']?.vocab).toBeUndefined();
  });

  it('reset writes the empty slice for a profile that held one, so the server copy is replaced (behaviour 15)', async () => {
    mem.set('progress:p1', withVocab([word()]));
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().reset('p1');
    expect(useProgressStore.getState().byProfile['p1']?.vocab).toEqual({ v: 1, items: [], topics: [] });
    expect(stored()?.vocab).toEqual({ v: 1, items: [], topics: [] });
    expect(stored()?.quests).toEqual([]);
  });

  it('reset keeps a profile that never held a slice free of the key', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().reset('p1');
    expect(stored() && 'vocab' in stored()!).toBe(false);
  });
});

describe('applyPlacementOverride (F-PLC-001 section 3.9)', () => {
  const notified: string[] = [];

  beforeEach(() => {
    resetStore();
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
  });

  afterEach(() => {
    setProgressPersistListener(null);
  });

  it('stores the override on that result only, persists and notifies sync', async () => {
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    const older = placementResult({ id: 'placement:old', completedAt: '2026-10-01T00:00:00Z' });
    const newer = placementResult({ id: 'placement:new', completedAt: '2026-10-02T00:00:00Z' });
    useProgressStore.getState().recordPlacement('p1', older);
    useProgressStore.getState().recordPlacement('p1', newer);
    notified.length = 0;
    const before = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;

    expect(useProgressStore.getState().applyPlacementOverride('p1', 'placement:new', 'quest:q2')).toBe(true);
    const after = useProgressStore.getState().byProfile['p1'] as ProgressSnapshot;
    const changed = after.placements?.find((r) => r.id === 'placement:new');
    expect(changed?.override).toMatchObject({ by: 'parent', startQuestId: 'quest:q2' });
    expect(changed?.override?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(after.placements?.find((r) => r.id === 'placement:old')?.override).toBeUndefined();
    // Nothing but the placement record changes: no quest, card, homework or streak.
    const { placements: _p, updatedAt: _u, ...restAfter } = after;
    const { placements: _q, updatedAt: _v, ...restBefore } = before;
    expect(restAfter).toEqual(restBefore);
    expect(stored()?.placements?.find((r) => r.id === 'placement:new')?.override?.startQuestId).toBe('quest:q2');
    expect(notified).toEqual(['p1']);
  });

  it('a second override replaces the first', async () => {
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().recordPlacement('p1', placementResult());
    useProgressStore.getState().applyPlacementOverride('p1', 'placement:a1', 'quest:q2');
    useProgressStore.getState().applyPlacementOverride('p1', 'placement:a1', 'quest:q5');
    expect(useProgressStore.getState().byProfile['p1']?.placements?.[0]?.override?.startQuestId).toBe('quest:q5');
  });

  it('changes nothing for an unknown result, a profile without results or an empty quest id', async () => {
    expect(useProgressStore.getState().applyPlacementOverride('p1', 'placement:a1', 'quest:q2')).toBe(false);
    mem.set('progress:p1', savedSnapshot());
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().applyPlacementOverride('p1', 'placement:a1', 'quest:q2')).toBe(false);
    useProgressStore.getState().recordPlacement('p1', placementResult());
    notified.length = 0;
    expect(useProgressStore.getState().applyPlacementOverride('p1', 'placement:other', 'quest:q2')).toBe(false);
    expect(useProgressStore.getState().applyPlacementOverride('p1', 'placement:a1', '')).toBe(false);
    expect(useProgressStore.getState().byProfile['p1']?.placements?.[0]?.override).toBeUndefined();
    expect(notified).toEqual([]);
  });
});

describe('stage latch writer (F-ROUTE-001 R-1b, runs with flags.myRouteEnabled off)', () => {
  const notified: string[] = [];
  /** The live Stage 1 grid quests; no count is pinned here. */
  const stage1 = episodesAll
    .filter((e) => e.stage === 'stage1' && (e.placement ?? 'grid') === 'grid' && (e.status === 'shipped' || e.status === 'ready'))
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id })));
  const finish = (profileId: string, q: { questId: string; episodeId: string }) =>
    useProgressStore.getState().recordQuestComplete(profileId, { ...q, stars: 1, accuracy: 1, attempts: 1 });
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const savedWith = (done: { questId: string; episodeId: string }[], extra: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
    ...savedSnapshot(),
    quests: done.map((q) => ({ ...q, startedAt: '2026-10-01T09:00:00.000Z', completedAt: '2026-10-01T09:05:00.000Z', stars: 1 as const, attempts: 1, accuracy: 1 })),
    ...extra,
  });

  beforeEach(() => {
    resetStore();
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
  });

  afterEach(() => {
    setProgressPersistListener(null);
  });

  it('writes stageDoneAt once, in the same save as the quest result that completes the stage', async () => {
    mem.set('progress:p1', savedWith(stage1.slice(0, -1)));
    await useProgressStore.getState().hydrate('p1');
    expect(stored()).not.toHaveProperty('stageDoneAt');
    vi.mocked(writeJson).mockClear();
    finish('p1', stage1[stage1.length - 1] as (typeof stage1)[number]);
    expect(writeJson).toHaveBeenCalledTimes(1);
    const at = stored()?.stageDoneAt?.stage1;
    expect(at).toMatch(ISO);
    expect(useProgressStore.getState().byProfile['p1']?.stageDoneAt).toEqual({ stage1: at });
    expect(notified).toEqual(['p1']);
  });

  it('never moves a latch on a later write (a replay of the last quest)', async () => {
    const latch = { stage1: '2026-10-01T09:10:00.000Z' };
    mem.set('progress:p1', savedWith(stage1, { stageDoneAt: latch }));
    await useProgressStore.getState().hydrate('p1');
    finish('p1', stage1[0] as (typeof stage1)[number]);
    expect(stored()?.stageDoneAt).toEqual(latch);
  });

  it('latches on app start (hydrate) a stage completed before the writer shipped, keeping other keys', async () => {
    mem.set('progress:p1', savedWith(stage1, { stageDoneAt: { stage9: 'from-a-newer-build' } }));
    await useProgressStore.getState().hydrate('p1');
    expect(stored()?.stageDoneAt?.stage9).toBe('from-a-newer-build');
    expect(stored()?.stageDoneAt?.stage1).toMatch(ISO);
    expect(notified).toEqual(['p1']);
  });

  it('writes nothing on hydrate when no stage is newly complete', async () => {
    mem.set('progress:p1', savedWith(stage1.slice(0, 2)));
    await useProgressStore.getState().hydrate('p1');
    expect(writeJson).not.toHaveBeenCalled();
    expect(notified).toEqual([]);
  });

  it('does not latch on a snapshot that has not loaded yet; hydrate latches the merged copy', async () => {
    mem.set('progress:p1', savedWith(stage1.slice(0, -1)));
    finish('p1', stage1[stage1.length - 1] as (typeof stage1)[number]);
    expect(useProgressStore.getState().byProfile['p1']).not.toHaveProperty('stageDoneAt');
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(stored()?.quests).toHaveLength(stage1.length);
    expect(stored()?.stageDoneAt?.stage1).toMatch(ISO);
  });

  it('latches a completed stage that arrives by sync or restore (replaceSnapshot) and announces it so it uploads', () => {
    useProgressStore.getState().replaceSnapshot('p1', savedWith(stage1));
    expect(stored()?.stageDoneAt?.stage1).toMatch(ISO);
    expect(useProgressStore.getState().byProfile['p1']?.stageDoneAt?.stage1).toMatch(ISO);
    expect(notified).toEqual(['p1']);
  });

  it('replaceSnapshot keeps an incoming latch and does not announce when nothing is added', () => {
    const latch = { stage1: '2026-10-01T09:10:00.000Z' };
    useProgressStore.getState().replaceSnapshot('p1', savedWith(stage1, { stageDoneAt: latch }));
    expect(stored()?.stageDoneAt).toEqual(latch);
    expect(notified).toEqual([]);
  });

  it('a malformed saved snapshot (no quests) still hydrates: the latch never blocks app start', async () => {
    mem.set('progress:p1', { ...savedSnapshot(), quests: undefined });
    await expect(useProgressStore.getState().hydrate('p1')).resolves.toBeUndefined();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('never latches a taste stage', async () => {
    const taste = episodesAll
      .filter((e) => e.stage === 'stage2' && e.status === 'shipped')
      .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id })));
    mem.set('progress:p1', savedWith(taste));
    await useProgressStore.getState().hydrate('p1');
    finish('p1', taste[0] as (typeof taste)[number]);
    expect(stored()).not.toHaveProperty('stageDoneAt');
  });
});

describe('card awards in the store (F-STORY-006 PR 6.4a)', () => {
  const CREATED = '2026-09-01T08:00:00.000Z';
  const T = '2026-10-01T09:05:00.000Z';
  const T2 = '2026-10-02T09:05:00.000Z';
  const RITES = ['card:chuseok', 'card:sebae', 'card:seollal', 'card:songpyeon', 'card:tteokguk'];
  const STAGE1_QUESTS: readonly (readonly [string, string])[] = [
    ['quest:stage1-letters-q1', 'episode:stage1-letters'],
    ['quest:stage1-letters-q2', 'episode:stage1-letters'],
    ['quest:stage1-letters-q3', 'episode:stage1-letters'],
    ['quest:stage1-life-q1', 'episode:stage1-life'],
    ['quest:stage1-life-q2', 'episode:stage1-life'],
    ['quest:stage1-life-q3', 'episode:stage1-life'],
    ['quest:stage1-rites-q1', 'episode:stage1-rites'],
    ['quest:stage1-nature-q1', 'episode:stage1-nature'],
    ['quest:stage1-crafts-q1', 'episode:stage1-crafts'],
  ];
  const STAGE1_QUEST_CARDS = ['card:book', 'card:hanji', 'card:brush', 'card:kimchi', 'card:family-table', 'card:kimbap', 'card:seollal', 'card:magpie', 'card:yutnori'];
  const notified: string[] = [];

  const quest = (questId: string, episodeId: string, stars: 0 | 1 | 2 | 3, completedAt = T): ProgressSnapshot['quests'][number] => ({
    questId,
    episodeId,
    startedAt: completedAt,
    completedAt,
    stars,
    attempts: 1,
    accuracy: 1,
  });
  const snapshotWith = (over: Partial<ProgressSnapshot> = {}, profileId = 'profile:a'): ProgressSnapshot => ({
    profileId,
    updatedAt: T,
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...over,
  });
  const ritesDone = (stars: 0 | 1 | 2 | 3 = 1): ProgressSnapshot => snapshotWith({ quests: [quest('quest:stage1-rites-q1', 'episode:stage1-rites', stars)] });
  const stage1Done = (): ProgressSnapshot =>
    snapshotWith({
      quests: STAGE1_QUESTS.map(([q, e]) => quest(q, e, 2)),
      cards: STAGE1_QUEST_CARDS.map((cardId) => ({ cardId, unlockedAt: T, newSinceLastView: false })),
    });
  const cardsOf = (snap: ProgressSnapshot | undefined): string[] => (snap?.cards ?? []).map((c) => c.cardId).sort();
  const storedA = (): ProgressSnapshot | undefined => mem.get('progress:profile:a') as ProgressSnapshot | undefined;
  const writesTo = (profileId: string): number => vi.mocked(writeJson).mock.calls.filter(([k]) => k === `progress:${profileId}`).length;

  beforeEach(() => {
    resetStore();
    useProgressStore.setState({ catchUp: {} });
    useProfileStore.setState({
      profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: CREATED }],
      activeId: 'profile:a',
      hydrated: true,
    });
    notified.length = 0;
    setProgressPersistListener((id) => notified.push(id));
    vi.mocked(track).mockClear();
  });

  afterEach(() => {
    setProgressPersistListener(null);
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
  });

  describe('unlockCards', () => {
    it('adds several cards with one storage write and returns the ids it added', async () => {
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith() }, hydratedFor: new Set(['profile:a']) });
      const added = useProgressStore.getState().unlockCards('profile:a', [{ cardId: 'card:rice', unlockedAt: T }, { cardId: 'card:kimbap' }]);
      expect(added).toEqual(['card:rice', 'card:kimbap']);
      expect(writesTo('profile:a')).toBe(1);
      expect(notified).toEqual(['profile:a']);
      const cards = storedA()?.cards ?? [];
      expect(cards.find((c) => c.cardId === 'card:rice')).toEqual({ cardId: 'card:rice', unlockedAt: T, newSinceLastView: true });
      expect(cards.find((c) => c.cardId === 'card:kimbap')?.newSinceLastView).toBe(true);
      expect(Number.isFinite(Date.parse(cards.find((c) => c.cardId === 'card:kimbap')?.unlockedAt ?? ''))).toBe(true);
    });

    it('skips owned and repeated ids and never changes an owned card', () => {
      const ownedCard = { cardId: 'card:rice', unlockedAt: T, newSinceLastView: false };
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: [ownedCard] }) }, hydratedFor: new Set(['profile:a']) });
      const added = useProgressStore.getState().unlockCards('profile:a', [{ cardId: 'card:rice', unlockedAt: T2 }, { cardId: 'card:kimbap' }, { cardId: 'card:kimbap' }]);
      expect(added).toEqual(['card:kimbap']);
      const cards = useProgressStore.getState().byProfile['profile:a']?.cards ?? [];
      expect(cards.filter((c) => c.cardId === 'card:kimbap')).toHaveLength(1);
      expect(cards.find((c) => c.cardId === 'card:rice')).toEqual(ownedCard);
    });

    it('writes nothing when every card is already owned', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: [{ cardId: 'card:rice', unlockedAt: T, newSinceLastView: true }] }) }, hydratedFor: new Set(['profile:a']) });
      expect(useProgressStore.getState().unlockCards('profile:a', [{ cardId: 'card:rice' }])).toEqual([]);
      expect(useProgressStore.getState().unlockCards('profile:a', [])).toEqual([]);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('cards unlocked before the saved copy loads are merged with it, never written over it', async () => {
      mem.set('progress:profile:a', snapshotWith({ cards: [{ cardId: 'card:book', unlockedAt: T, newSinceLastView: false }] }));
      useProgressStore.getState().unlockCards('profile:a', [{ cardId: 'card:rice', unlockedAt: T2 }]);
      expect(cardsOf(storedA())).toEqual(['card:book']);
      await settle();
      expect(cardsOf(storedA())).toEqual(['card:book', 'card:rice', 'card:tiger']);
    });
  });

  describe('reconcileAwards', () => {
    it('adds every derived card the snapshot lacks, with deterministic times, and returns them', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': ritesDone(1) }, hydratedFor: new Set(['profile:a']) });
      const added = useProgressStore.getState().reconcileAwards('profile:a');
      expect(added.map((a) => a.cardId).sort()).toEqual([...RITES, 'card:tiger'].sort());
      const cards = useProgressStore.getState().byProfile['profile:a']?.cards ?? [];
      for (const id of RITES) expect(cards.find((c) => c.cardId === id)).toEqual({ cardId: id, unlockedAt: T, newSinceLastView: true });
      expect(cards.find((c) => c.cardId === 'card:tiger')).toEqual({ cardId: 'card:tiger', unlockedAt: CREATED, newSinceLastView: true });
      expect(cardsOf(storedA())).toEqual(cardsOf(useProgressStore.getState().byProfile['profile:a']));
      expect(writesTo('profile:a')).toBe(1);
      expect(notified).toEqual(['profile:a']);
    });

    it('sends one card.catchup_granted with the counts by source and no per-card telemetry (§3.5)', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': ritesDone(1) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().reconcileAwards('profile:a');
      expect(vi.mocked(track).mock.calls.map(([e]) => e)).toEqual([
        { name: 'card.catchup_granted', profileId: 'profile:a', payload: { count: 6, episode: 5, stage: 0, welcome: 1, quest: 0, set: 0 } },
      ]);
    });

    it('a second run sends nothing', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': ritesDone(1) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().reconcileAwards('profile:a');
      vi.mocked(track).mockClear();
      useProgressStore.getState().reconcileAwards('profile:a');
      expect(track).not.toHaveBeenCalled();
    });

    it('is idempotent: a second run adds nothing and writes nothing', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': ritesDone(1) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().reconcileAwards('profile:a');
      vi.mocked(writeJson).mockClear();
      const before = useProgressStore.getState().byProfile['profile:a'];
      expect(useProgressStore.getState().reconcileAwards('profile:a')).toEqual([]);
      expect(useProgressStore.getState().byProfile['profile:a']).toBe(before);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('never takes a card away: owned cards, unknown ids and seen flags stay as they are', () => {
      const keep = [
        { cardId: 'card:rice', unlockedAt: T2, newSinceLastView: false },
        { cardId: 'card:retired-in-a-later-build', unlockedAt: T, newSinceLastView: true },
      ];
      // The rites quest was later replayed with fewer stars: nothing is removed.
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: keep }) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().reconcileAwards('profile:a');
      const cards = useProgressStore.getState().byProfile['profile:a']?.cards ?? [];
      for (const c of keep) expect(cards).toContainEqual(c);
    });

    it('leaves a snapshot alone when its profile is unknown (no creation time for the welcome card)', () => {
      useProgressStore.setState({ byProfile: { 'profile:ghost': ritesDone(1) }, hydratedFor: new Set(['profile:ghost']) });
      expect(useProgressStore.getState().reconcileAwards('profile:ghost')).toEqual([]);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('does nothing for a profile with no snapshot in memory', () => {
      expect(useProgressStore.getState().reconcileAwards('profile:a')).toEqual([]);
      expect(useProgressStore.getState().byProfile['profile:a']).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
    });
  });

  describe('catch-up for existing learners (§3.5)', () => {
    it('hydrate ends with a reconcile: a learner who finished Stage 1 receives the 21 other cards once', async () => {
      mem.set('progress:profile:a', stage1Done());
      await useProgressStore.getState().hydrate('profile:a');
      const snap = useProgressStore.getState().byProfile['profile:a'];
      expect(snap?.cards).toHaveLength(30);
      const added = (snap?.cards ?? []).filter((c) => !STAGE1_QUEST_CARDS.includes(c.cardId));
      expect(added).toHaveLength(21);
      expect(added.every((c) => c.newSinceLastView)).toBe(true);
      expect(added.find((c) => c.cardId === 'card:hangul-day')?.unlockedAt).toBe(T);
      expect(added.find((c) => c.cardId === 'card:tiger')?.unlockedAt).toBe(CREATED);
      expect(storedA()?.cards).toHaveLength(30);
      expect([...(useProgressStore.getState().catchUp['profile:a'] ?? [])].sort()).toEqual(added.map((c) => c.cardId).sort());
      // One aggregate event, never a per-card card.unlocked for a retro card.
      expect(vi.mocked(track).mock.calls.map(([e]) => e)).toEqual([
        { name: 'card.catchup_granted', profileId: 'profile:a', payload: { count: 21, episode: 17, stage: 3, welcome: 1, quest: 0, set: 0 } },
      ]);
    });

    it('the next launch adds nothing and shows no catch-up', async () => {
      mem.set('progress:profile:a', stage1Done());
      await useProgressStore.getState().hydrate('profile:a');
      const first = storedA();
      // A new app session: memory is empty, storage holds the reconciled copy.
      useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), catchUp: {} });
      vi.mocked(writeJson).mockClear();
      await useProgressStore.getState().hydrate('profile:a');
      expect(useProgressStore.getState().byProfile['profile:a']).toEqual(first);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
      expect(vi.mocked(track).mock.calls.filter(([e]) => e.name === 'card.catchup_granted')).toHaveLength(1);
    });

    it('a reconcile that adds only the welcome card is not a catch-up and sends no event', async () => {
      mem.set('progress:profile:a', snapshotWith());
      await useProgressStore.getState().hydrate('profile:a');
      expect(cardsOf(useProgressStore.getState().byProfile['profile:a'])).toEqual(['card:tiger']);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(track).not.toHaveBeenCalled();
    });

    it('lists the welcome card with the others when it arrives in the same catch-up', async () => {
      mem.set('progress:profile:a', ritesDone(1));
      await useProgressStore.getState().hydrate('profile:a');
      expect([...(useProgressStore.getState().catchUp['profile:a'] ?? [])].sort()).toEqual([...RITES, 'card:tiger'].sort());
    });

    it('accumulates over the session without repeating a card', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': ritesDone(1) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().reconcileAwards('profile:a');
      const crafts = quest('quest:stage1-crafts-q1', 'episode:stage1-crafts', 1, T2);
      const snap = useProgressStore.getState().byProfile['profile:a'] as ProgressSnapshot;
      useProgressStore.getState().replaceSnapshot('profile:a', { ...snap, quests: [...snap.quests, crafts] });
      const list = useProgressStore.getState().catchUp['profile:a'] ?? [];
      expect(new Set(list).size).toBe(list.length);
      expect(list).toEqual(expect.arrayContaining([...RITES, 'card:tiger', 'card:yutnori', 'card:pottery']));
    });

    it('a reset clears the catch-up list: it never announces cards the learner no longer holds', async () => {
      mem.set('progress:profile:a', ritesDone(1));
      await useProgressStore.getState().hydrate('profile:a');
      expect(useProgressStore.getState().catchUp['profile:a']).toBeDefined();
      useProgressStore.getState().reset('profile:a');
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
    });

    it('removing the profile drops its catch-up list', async () => {
      mem.set('progress:profile:a', ritesDone(1));
      await useProgressStore.getState().hydrate('profile:a');
      notifyProfileRemoved('profile:a');
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
    });

    it('a malformed saved record is loaded as it is: the rules add nothing and the read still lands', async () => {
      mem.set('progress:profile:a', { profileId: 'profile:a', updatedAt: T });
      await expect(useProgressStore.getState().hydrate('profile:a')).resolves.toBeUndefined();
      expect(useProgressStore.getState().hydratedFor.has('profile:a')).toBe(true);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
      expect(() => useProgressStore.getState().replaceSnapshot('profile:a', { profileId: 'profile:a' } as ProgressSnapshot)).not.toThrow();
    });

    it('cards earned before the saved copy loads are merged with it and saved with one write', async () => {
      mem.set('progress:profile:a', snapshotWith({ quests: [quest('quest:stage1-life-q1', 'episode:stage1-life', 3)], cards: [{ cardId: 'card:kimchi', unlockedAt: T, newSinceLastView: false }] }));
      useProgressStore.getState().recordQuestComplete('profile:a', { questId: 'quest:stage1-rites-q1', episodeId: 'episode:stage1-rites', stars: 1, accuracy: 0.5, attempts: 1 });
      await settle();
      const stored = storedA();
      expect(stored?.quests.map((q) => q.questId).sort()).toEqual(['quest:stage1-life-q1', 'quest:stage1-rites-q1']);
      expect(cardsOf(stored)).toEqual(['card:kimchi', ...RITES, 'card:tiger'].sort());
      expect(stored?.cards.find((c) => c.cardId === 'card:kimchi')?.newSinceLastView).toBe(false);
      expect(writesTo('profile:a')).toBe(1);
      expect(notified).toEqual(['profile:a']);
    });

    it('cards the live path unlocked in the same tick are not taken over by a later reconcile', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: [{ cardId: 'card:tiger', unlockedAt: CREATED, newSinceLastView: false }] }) }, hydratedFor: new Set(['profile:a']) });
      const store = useProgressStore.getState();
      store.recordQuestComplete('profile:a', { questId: 'quest:stage1-rites-q1', episodeId: 'episode:stage1-rites', stars: 2, accuracy: 1, attempts: 1 });
      store.unlockCards('profile:a', RITES.map((cardId) => ({ cardId })));
      expect(store.reconcileAwards('profile:a')).toEqual([]);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(vi.mocked(track).mock.calls.filter(([e]) => e.name === 'card.catchup_granted')).toEqual([]);
    });

    it('an old saved snapshot keeps its shape: no new key is added', async () => {
      const legacy = ritesDone(1);
      mem.set('progress:profile:a', legacy);
      await useProgressStore.getState().hydrate('profile:a');
      expect(Object.keys(storedA() ?? {}).sort()).toEqual(Object.keys(legacy).sort());
    });
  });

  describe('replaceSnapshot', () => {
    it('reconciles the merged snapshot a sync or restore hands back', () => {
      useProgressStore.getState().replaceSnapshot('profile:a', ritesDone(1));
      expect(cardsOf(useProgressStore.getState().byProfile['profile:a'])).toEqual([...RITES, 'card:tiger'].sort());
      expect(cardsOf(storedA())).toEqual([...RITES, 'card:tiger'].sort());
      expect(vi.mocked(track).mock.calls.map(([e]) => e.name)).toEqual(['card.catchup_granted']);
    });

    it('a completion by sync is a catch-up: one aggregate event, the next pass sends none', () => {
      const withTiger = snapshotWith({ cards: [{ cardId: 'card:tiger', unlockedAt: CREATED, newSinceLastView: false }] });
      useProgressStore.getState().replaceSnapshot('profile:a', { ...withTiger, quests: [quest('quest:stage1-crafts-q1', 'episode:stage1-crafts', 3)] });
      expect(vi.mocked(track).mock.calls.map(([e]) => e)).toEqual([
        { name: 'card.catchup_granted', profileId: 'profile:a', payload: { count: 5, episode: 4, stage: 0, welcome: 0, quest: 1, set: 0 } },
      ]);
      vi.mocked(track).mockClear();
      useProgressStore.getState().replaceSnapshot('profile:a', useProgressStore.getState().byProfile['profile:a'] as ProgressSnapshot);
      expect(track).not.toHaveBeenCalled();
    });

    it('a replacement that adds cards is saved with one write and asks sync once; the next pass adds nothing', () => {
      useProgressStore.getState().replaceSnapshot('profile:a', ritesDone(1));
      expect(writesTo('profile:a')).toBe(1);
      expect(notified).toEqual(['profile:a']);
      const merged = useProgressStore.getState().byProfile['profile:a'] as ProgressSnapshot;
      notified.length = 0;
      useProgressStore.getState().replaceSnapshot('profile:a', merged);
      expect(notified).toEqual([]);
      expect(useProgressStore.getState().byProfile['profile:a']).toBe(merged);
    });

    it('does not tell sync about a replacement that added nothing', () => {
      const done = useProgressStore.getState();
      done.replaceSnapshot('profile:a', ritesDone(1));
      notified.length = 0;
      const snap = useProgressStore.getState().byProfile['profile:a'] as ProgressSnapshot;
      done.replaceSnapshot('profile:a', snap);
      expect(notified).toEqual([]);
    });
  });

  describe('ensure', () => {
    it('a new blank snapshot receives the welcome card at the profile creation time, in memory only', () => {
      useProgressStore.setState({ hydratedFor: new Set(['profile:a']) });
      const snap = useProgressStore.getState().ensure('profile:a');
      expect(snap.cards).toEqual([{ cardId: 'card:tiger', unlockedAt: CREATED, newSinceLastView: true }]);
      expect(useProgressStore.getState().byProfile['profile:a']).toBe(snap);
      // Never written on its own: a read that failed looks like "nothing saved", and a blank record would replace real progress.
      expect(writeJson).not.toHaveBeenCalled();
      expect(notified).toEqual([]);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(track).not.toHaveBeenCalled();
    });

    it('the first real write saves the welcome card with it', () => {
      useProgressStore.setState({ hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().ensure('profile:a');
      useProgressStore.getState().beginSession('profile:a');
      expect(storedA()?.cards).toEqual([{ cardId: 'card:tiger', unlockedAt: CREATED, newSinceLastView: true }]);
      expect(storedA()?.sessions).toHaveLength(1);
    });

    it('a profile with no record gets a blank snapshot and nothing is written', () => {
      useProfileStore.setState({ profiles: [] });
      useProgressStore.setState({ hydratedFor: new Set(['profile:a']) });
      const snap = useProgressStore.getState().ensure('profile:a');
      expect(snap.cards).toEqual([]);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('an existing snapshot is returned as it is', () => {
      const existing = ritesDone(1);
      useProgressStore.setState({ byProfile: { 'profile:a': existing }, hydratedFor: new Set(['profile:a']) });
      expect(useProgressStore.getState().ensure('profile:a')).toBe(existing);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('before the saved copy loads, it reads the saved copy and reconciles that instead of writing a blank over it', async () => {
      mem.set('progress:profile:a', { ...ritesDone(1), placements: [] });
      expect(useProgressStore.getState().ensure('profile:a').cards).toEqual([]);
      expect(writeJson).not.toHaveBeenCalled();
      await settle();
      const snap = useProgressStore.getState().byProfile['profile:a'];
      expect(snap?.quests.map((q) => q.questId)).toEqual(['quest:stage1-rites-q1']);
      expect(snap).toHaveProperty('placements', []);
      expect(cardsOf(snap)).toEqual([...RITES, 'card:tiger'].sort());
    });

    it('a profile created this session with nothing saved gets the welcome card once its read lands, without a write', async () => {
      useProgressStore.getState().ensure('profile:a');
      await settle();
      expect(cardsOf(useProgressStore.getState().byProfile['profile:a'])).toEqual(['card:tiger']);
      expect(storedA()).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
    });
  });

  describe('markCardsSeen', () => {
    const fresh = (cardId: string, newSinceLastView = true) => ({ cardId, unlockedAt: T, newSinceLastView });

    it('clears the New flag of the listed owned cards with one write', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: [fresh('card:rice'), fresh('card:kimbap'), fresh('card:hanbok')] }) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().markCardsSeen('profile:a', ['card:rice', 'card:kimbap', 'card:not-owned']);
      const cards = useProgressStore.getState().byProfile['profile:a']?.cards ?? [];
      expect(cards).toEqual([fresh('card:rice', false), fresh('card:kimbap', false), fresh('card:hanbok')]);
      expect(storedA()?.cards).toEqual(cards);
      expect(writesTo('profile:a')).toBe(1);
      expect(notified).toEqual(['profile:a']);
      expect(useProgressStore.getState().byProfile['profile:a']?.updatedAt).not.toBe(T);
    });

    it('writes nothing when no listed card is new', () => {
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: [fresh('card:rice', false)] }) }, hydratedFor: new Set(['profile:a']) });
      useProgressStore.getState().markCardsSeen('profile:a', ['card:rice', 'card:other']);
      useProgressStore.getState().markCardsSeen('profile:ghost', ['card:rice']);
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('clears the catch-up list even when a sync merge already cleared the flags, without a write', () => {
      const seenElsewhere = RITES.map((cardId) => fresh(cardId, false));
      useProgressStore.setState({ byProfile: { 'profile:a': snapshotWith({ cards: seenElsewhere }) }, hydratedFor: new Set(['profile:a']), catchUp: { 'profile:a': [...RITES] } });
      useProgressStore.getState().markCardsSeen('profile:a', RITES);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
      expect(notified).toEqual([]);
    });

    it('takes the seen cards off the catch-up list, and drops the list once it is empty', async () => {
      mem.set('progress:profile:a', ritesDone(1));
      await useProgressStore.getState().hydrate('profile:a');
      useProgressStore.getState().markCardsSeen('profile:a', ['card:sebae']);
      expect(useProgressStore.getState().catchUp['profile:a']).not.toContain('card:sebae');
      useProgressStore.getState().markCardsSeen('profile:a', [...RITES, 'card:tiger']);
      expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
    });
  });
});
