import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7, row DP-2 (test 11 of section 6): a progress write that does not land
 * (`withStored` answers `unsaved`) is tried again after 1 s, 4 s and 15 s, then each time the app comes to the front or
 * goes to the back, and with each new write. Every retry is an ordinary write, so it stores the latest snapshot.
 * `saveFailedFor` holds the profile from the first `unsaved` until a write of it lands. A step that throws
 * (`step-failed`) is never retried and never marks the profile. The store runs on the web storage wrapper over an
 * IndexedDB stand-in holding raw strings, as in `progress-store-durable.test.ts`.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** While set, a write of a key that matches rejects (the read before it works). */
  failingWrite: null as RegExp | null,
  /** Transactions of `hr:progress:p1` that reached their write (landed or not). */
  attempts: 0,
  sets: 0,
}));
vi.mock('idb-keyval', () => {
  const brokenWrite = (k: string): boolean => idb.failingWrite !== null && idb.failingWrite.test(k);
  return {
    get: vi.fn(async (k: string) => idb.mem.get(k)),
    set: vi.fn(async (k: string, v: string) => {
      if (brokenWrite(k)) throw new Error('idb write failed');
      idb.sets += 1;
      idb.mem.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      idb.mem.delete(k);
    }),
    keys: vi.fn(async () => [...idb.mem.keys()]),
    clear: vi.fn(async () => idb.mem.clear()),
    createStore: vi.fn(),
    update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
      await Promise.resolve();
      const value = next(idb.mem.get(k));
      if (k === 'hr:progress:p1') idb.attempts += 1;
      if (brokenWrite(k)) throw new Error('idb write failed');
      idb.sets += 1;
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
/** The app-state listeners the store binds (`followSaveRetries`); a test calls them as the platform would. */
const appState = { listeners: [] as ((active: boolean) => void)[] };
const subscribeAppActive = (listener: (active: boolean) => void): (() => void) => {
  appState.listeners.push(listener);
  return () => {
    appState.listeners = appState.listeners.filter((l) => l !== listener);
  };
};

import { setProgressPersistListener } from '../../logic/sync/persist-hook';
import { setWriteFence } from '../../platform/storage-fence';
import { notifyProfileRemoved } from '../profile-removal';
import { useProfileStore } from '../profile-store';
import { PROGRESS_KEY, SAVE_RETRY_DELAYS_MS, followSaveRetries, useProgressStore } from '../progress-store';

const KEY = `hr:${PROGRESS_KEY('p1')}`;

const saved = (): ProgressSnapshot => ({
  profileId: 'p1',
  updatedAt: '2026-11-01T09:00:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:a', episodeId: 'episode:e', startedAt: '2026-11-01T09:00:00.000Z', completedAt: '2026-11-01T09:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [{ cardId: 'card:book', unlockedAt: '2026-11-01T09:05:00.000Z', newSinceLastView: false }],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 4,
  questDoneAt: { 'quest:a': '2026-11-01T09:05:00.000Z' },
});
const stored = (): ProgressSnapshot => JSON.parse(idb.mem.get(KEY) as string) as ProgressSnapshot;
const storedQuests = (): string[] => stored().quests.map((q) => q.questId).sort();
const finish = (questId: string): void =>
  useProgressStore.getState().recordQuestComplete('p1', { questId, episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
const failing = (): boolean => useProgressStore.getState().saveFailedFor.has('p1');

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

/** Moves the fake clock and lets the writes it starts run. */
async function wait(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
}

async function hydrated(): Promise<void> {
  idb.mem.set(KEY, JSON.stringify(saved()));
  await useProgressStore.getState().hydrate('p1');
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  idb.mem.clear();
  idb.failingWrite = null;
  idb.attempts = 0;
  idb.sets = 0;
  appState.listeners = [];
  setProgressPersistListener(null);
  setWriteFence(null);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({
    byProfile: {},
    hydratedFor: new Set(),
    pendingFor: new Set(),
    pendingVocabEvents: {},
    openSession: null,
    loadFailedFor: new Set(),
    freshFor: new Set(),
    saveFailedFor: new Set(),
  });
});

afterEach(async () => {
  // Let every retry the test left behind run out on a working disk, so none reaches the next test.
  idb.failingWrite = null;
  await wait(60_000);
  vi.useRealTimers();
});

describe('[DP] a write that does not land is tried again (test 11)', () => {
  it('the retry schedule is 1 s, 4 s and 15 s', () => {
    expect(SAVE_RETRY_DELAYS_MS).toEqual([1000, 4000, 15000]);
  });

  it('first write rejects, the retry lands: saveFailedFor is set, then cleared, and the record holds the quest', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    expect(failing()).toBe(true);
    expect(storedQuests()).toEqual(['quest:a']);

    idb.failingWrite = null;
    await wait(999);
    expect(failing()).toBe(true);
    await wait(1);
    expect(failing()).toBe(false);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
  });

  it('keeps trying at 1 s, 4 s and 15 s after each failure, then waits for the next foreground or write', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    expect(idb.attempts).toBe(1);
    await wait(1000);
    expect(idb.attempts).toBe(2);
    await wait(3999);
    expect(idb.attempts).toBe(2);
    await wait(1);
    expect(idb.attempts).toBe(3);
    await wait(15_000);
    expect(idb.attempts).toBe(4);
    // No timed retry after the third one.
    await wait(120_000);
    expect(idb.attempts).toBe(4);
    expect(failing()).toBe(true);
  });

  it('three newer snapshots made while a retry waits: the retry stores the latest one, in one write', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    // Each new write is tried at once and fails too; the timed retry is not doubled.
    finish('quest:c');
    finish('quest:d');
    finish('quest:e');
    await settle();
    expect(failing()).toBe(true);
    idb.failingWrite = null;
    const before = idb.sets;
    await wait(1000);
    expect(idb.sets - before).toBe(1);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:d', 'quest:e']);
    expect(failing()).toBe(false);
  });

  it('a new write that lands clears saveFailedFor and cancels the timed retries', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    idb.failingWrite = null;
    finish('quest:c');
    await settle();
    expect(failing()).toBe(false);
    const attempts = idb.attempts;
    await wait(60_000);
    expect(idb.attempts).toBe(attempts);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });

  it('retries when the app comes to the front (native) and before it goes to the back', async () => {
    const unfollow = followSaveRetries(subscribeAppActive);
    try {
      await hydrated();
      idb.failingWrite = /^hr:progress:p1$/;
      finish('quest:b');
      await settle();
      // Past the three timed retries: only the app state is left.
      await wait(20_000);
      const attempts = idb.attempts;
      for (const l of appState.listeners) l(false);
      await settle();
      expect(idb.attempts).toBe(attempts + 1);
      expect(failing()).toBe(true);

      idb.failingWrite = null;
      for (const l of appState.listeners) l(true);
      await settle();
      expect(failing()).toBe(false);
      expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
    } finally {
      unfollow();
    }
    expect(appState.listeners).toHaveLength(0);
  });

  it('the app state writes nothing for a profile whose saves land', async () => {
    const unfollow = followSaveRetries(subscribeAppActive);
    try {
      await hydrated();
      finish('quest:b');
      await settle();
      const attempts = idb.attempts;
      for (const l of appState.listeners) l(true);
      await settle();
      expect(idb.attempts).toBe(attempts);
    } finally {
      unfollow();
    }
  });

  it("a hydrate whose merged write is 'unsaved' marks the profile and retries it", async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    finish('quest:b');
    idb.failingWrite = /^hr:progress:p1$/;
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(failing()).toBe(true);
    idb.failingWrite = null;
    await wait(1000);
    expect(failing()).toBe(false);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
  });

  it("a step that throws ('step-failed') in a hydrate is not retried and does not mark the profile, even on a full disk", async () => {
    // A stored object the merge cannot read, and a write held in memory to merge with it.
    idb.mem.set(KEY, JSON.stringify({ profileId: 'p1', quests: 5 }));
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await useProgressStore.getState().hydrate('p1');
    await settle();
    // The step threw (the profile is not hydrated): not a failed save.
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(failing()).toBe(false);
    const attempts = idb.attempts;
    await wait(60_000);
    expect(idb.attempts).toBe(attempts);
    expect(failing()).toBe(false);
  });

  it("a step that throws in a later write ('step-failed') is not retried and does not mark the profile", async () => {
    await hydrated();
    // Another tab stored an object the merge cannot read, and this tab holds a change of its own.
    idb.mem.set(KEY, JSON.stringify({ profileId: 'p1', quests: 5 }));
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEY)).toBe(JSON.stringify({ profileId: 'p1', quests: 5 }));
    expect(failing()).toBe(false);
    const attempts = idb.attempts;
    await wait(60_000);
    expect(idb.attempts).toBe(attempts);
  });

  it('a reset that did not land is retried as a reset: what another tab stored meanwhile does not come back', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    useProgressStore.getState().reset('p1');
    await settle();
    expect(failing()).toBe(true);
    // Another tab stores a record with a quest of its own before the retry.
    idb.mem.set(KEY, JSON.stringify({ ...saved(), quests: [...saved().quests, { ...saved().quests[0]!, questId: 'quest:z' }] }));
    idb.failingWrite = null;
    await wait(1000);
    expect(failing()).toBe(false);
    expect(storedQuests()).toEqual([]);
  });

  it('a retry that meets the write fence keeps the mark and the next slot is still tried', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    idb.failingWrite = null;
    setWriteFence(() => false);
    await wait(1000);
    expect(failing()).toBe(true);
    setWriteFence(null);
    await wait(4000);
    expect(failing()).toBe(false);
    expect(storedQuests()).toEqual(['quest:a', 'quest:b']);
  });

  it('a read that fails (loadFailedFor) does not mark saveFailedFor', async () => {
    idb.mem.set(KEY, '{"profileId":"p1",'); // damaged, and the copy cannot be kept
    idb.failingWrite = /^hr:progress-corrupt:p1$/;
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(failing()).toBe(false);
  });

  it('removing the learner takes them out of saveFailedFor and stops the retries', async () => {
    await hydrated();
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    expect(failing()).toBe(true);
    // Last in the file: the learner stays removed in this module for the rest of the run.
    notifyProfileRemoved('p1');
    await settle();
    expect(failing()).toBe(false);
    const attempts = idb.attempts;
    await wait(60_000);
    expect(idb.attempts).toBe(attempts);
  });
});
