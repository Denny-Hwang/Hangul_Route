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

import { setProgressPersistListener } from '../../logic/sync/persist-hook';
import { readJson, writeJson } from '../../platform/storage';
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
