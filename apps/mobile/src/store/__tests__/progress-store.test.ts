import type { ProgressSnapshot } from '@hangul-route/content-schema';
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
import { nextStreak, useProgressStore } from '../progress-store';

function resetStore(): void {
  mem.clear();
  vi.mocked(readJson).mockClear();
  vi.mocked(writeJson).mockClear();
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
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
    const { placements: _p, updatedAt: _u, ...restAfter } = after;
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
