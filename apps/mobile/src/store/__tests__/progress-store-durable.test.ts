import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS row DP-1a (section 3.2; tests 2, 4 and 5 of section 6): AU-3's unread set is store
 * state (`loadFailedFor`), `withStored` tells a failed read, a write that did not land, a step that threw and a damaged
 * record started fresh apart, a fresh start enters `freshFor`, and `whenWritten` lets a restore wait for its write.
 * The store runs on the web storage wrapper over an IndexedDB stand-in holding raw strings, as in
 * `progress-store-unreadable.test.ts`.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** While set, every read and every transaction of a key that matches rejects. */
  failing: null as RegExp | null,
  /** While set, a write of a key that matches rejects (the read before it works). */
  failingWrite: null as RegExp | null,
  /** While set, a transaction of a key that matches waits for it before it writes. */
  gate: null as { key: RegExp; until: Promise<void> } | null,
  sets: 0,
}));
vi.mock('idb-keyval', () => {
  const broken = (k: string): boolean => idb.failing !== null && idb.failing.test(k);
  const brokenWrite = (k: string): boolean => idb.failingWrite !== null && idb.failingWrite.test(k);
  return {
    get: vi.fn(async (k: string) => {
      if (broken(k)) throw new Error('idb read failed');
      return idb.mem.get(k);
    }),
    set: vi.fn(async (k: string, v: string) => {
      if (broken(k) || brokenWrite(k)) throw new Error('idb write failed');
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
      if (broken(k)) throw new Error('idb read failed');
      const value = next(idb.mem.get(k));
      if (idb.gate && idb.gate.key.test(k)) await idb.gate.until;
      if (brokenWrite(k)) throw new Error('idb write failed');
      idb.sets += 1;
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
const tracked = vi.hoisted(() => [] as { name: string }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));

import { setProgressPersistListener } from '../../logic/sync/persist-hook';
import { setWriteFence } from '../../platform/storage-fence';
import { useProfileStore } from '../profile-store';
import { PROGRESS_CORRUPT_KEY, PROGRESS_KEY, useProgressStore, withStored } from '../progress-store';

const KEY = `hr:${PROGRESS_KEY('p1')}`;
const KEPT = `hr:${PROGRESS_CORRUPT_KEY('p1')}`;

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
const TRUNCATED = JSON.stringify(saved()).slice(0, 60);
const stored = (): ProgressSnapshot => JSON.parse(idb.mem.get(KEY) as string) as ProgressSnapshot;
const finish = (questId: string): void =>
  useProgressStore.getState().recordQuestComplete('p1', { questId, episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
const restored = (): ProgressSnapshot => ({
  ...saved(),
  quests: [{ questId: 'quest:r', episodeId: 'episode:e', startedAt: '2026-11-02T09:00:00.000Z', completedAt: '2026-11-02T09:05:00.000Z', stars: 2, attempts: 1, accuracy: 0.9 }],
  cards: [{ cardId: 'card:moon', unlockedAt: '2026-11-02T09:05:00.000Z', newSinceLastView: true }],
  questDoneAt: { 'quest:r': '2026-11-02T09:05:00.000Z' },
});

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

/** A promise and the call that resolves it. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  idb.mem.clear();
  idb.failing = null;
  idb.failingWrite = null;
  idb.gate = null;
  idb.sets = 0;
  tracked.length = 0;
  setWriteFence(null);
  setProgressPersistListener(null);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({
    byProfile: {},
    hydratedFor: new Set(),
    pendingFor: new Set(),
    pendingVocabEvents: {},
    openSession: null,
    loadFailedFor: new Set(),
    freshFor: new Set(),
  });
});

describe('[DP] loadFailedFor is store state (test 2)', () => {
  it('a subscriber sees the profile enter on a failed read and leave on the next successful hydrate', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /progress:p1/;
    const seen: boolean[] = [];
    const unsubscribe = useProgressStore.subscribe((s, prev) => {
      if (s.loadFailedFor !== prev.loadFailedFor) seen.push(s.loadFailedFor.has('p1'));
    });
    try {
      await useProgressStore.getState().hydrate('p1');
      expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
      expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);
      idb.failing = null;
      await useProgressStore.getState().hydrate('p1');
      expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
      expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
      expect(seen).toEqual([true, false]);
    } finally {
      unsubscribe();
    }
  });

  it('a damaged record whose copy cannot be kept leaves the profile in loadFailedFor', async () => {
    idb.mem.set(KEY, TRUNCATED);
    idb.failing = /progress-corrupt/;
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);
  });
});

describe("[DP] withStored's answers (test 5)", () => {
  const step = (): ProgressSnapshot => saved();

  it("'done' when the read works and the step's value is stored, or there is nothing to store", async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await expect(withStored('p1', step)).resolves.toBe('done');
    await expect(withStored('p1', () => undefined)).resolves.toBe('done');
  });

  it("'unread' for a rejected read: the step does not run and nothing is written", async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /progress:p1/;
    const spy = vi.fn(step);
    await expect(withStored('p1', spy)).resolves.toBe('unread');
    expect(spy).not.toHaveBeenCalled();
  });

  it("'unsaved' for a storage write that rejects after the step returned (exact transaction)", async () => {
    const raw = JSON.stringify(saved());
    idb.mem.set(KEY, raw);
    idb.failingWrite = /^hr:progress:p1$/;
    await expect(withStored('p1', () => ({ ...saved(), streakDays: 9 }))).resolves.toBe('unsaved');
    expect(idb.mem.get(KEY)).toBe(raw);
  });

  it("'unsaved' for a storage write that rejects on the damaged path, after the copy was kept", async () => {
    idb.mem.set(KEY, TRUNCATED);
    idb.failingWrite = /^hr:progress:p1$/;
    await expect(withStored('p1', step)).resolves.toBe('unsaved');
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);
  });

  it("'step-failed' when the step throws (exact transaction and damaged path): no write, no retry, no write_failed", async () => {
    const raw = JSON.stringify(saved());
    idb.mem.set(KEY, raw);
    const thrower = (): ProgressSnapshot => {
      throw new Error('merge cannot read this');
    };
    await expect(withStored('p1', thrower)).resolves.toBe('step-failed');
    idb.mem.set(KEY, TRUNCATED);
    await expect(withStored('p1', thrower)).resolves.toBe('step-failed');
    const writes = idb.sets;
    await settle();
    // Only the damaged copy was written; nothing is retried afterwards.
    expect(idb.sets).toBe(writes);
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);
    expect(tracked.map((e) => e.name)).not.toContain('storage.write_failed');
  });

  it("'fresh' for damaged bytes that were kept and replaced (was 'done')", async () => {
    idb.mem.set(KEY, TRUNCATED);
    await expect(withStored('p1', step)).resolves.toBe('fresh');
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:a']);
  });

  it("'fenced' under the write fence (unchanged)", async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    setWriteFence(() => false);
    await expect(withStored('p1', step)).resolves.toBe('fenced');
  });
});

describe('[DP] what hydrate and a write do with the answers', () => {
  it("a hydrate whose write is 'unsaved' leaves the profile hydrated (only its write is pending), not in loadFailedFor", async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    finish('quest:b');
    idb.failingWrite = /^hr:progress:p1$/;
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
    expect(useProgressStore.getState().byProfile['p1']?.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b']);
  });

  it("a hydrate whose step throws ('step-failed') leaves the profile out of hydratedFor and in loadFailedFor", async () => {
    // A stored object the merge cannot read, and a write held in memory to merge with it.
    idb.mem.set(KEY, JSON.stringify({ profileId: 'p1', quests: 5 }));
    finish('quest:b');
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(idb.mem.get(KEY)).toBe(JSON.stringify({ profileId: 'p1', quests: 5 }));
  });

  it('a damaged record started fresh by a hydrate puts the profile in freshFor; clearFresh takes it out', async () => {
    idb.mem.set(KEY, TRUNCATED);
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().freshFor.has('p1')).toBe(true);
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
    useProgressStore.getState().clearFresh('p1');
    expect(useProgressStore.getState().freshFor.has('p1')).toBe(false);
  });

  it('a record damaged after it was read, started fresh by the next write, puts the profile in freshFor', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().freshFor.has('p1')).toBe(false);
    idb.mem.set(KEY, TRUNCATED);
    finish('quest:b');
    await settle();
    expect(useProgressStore.getState().freshFor.has('p1')).toBe(true);
    expect(stored().quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b']);
  });

  it('a record that reads normally never enters freshFor', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    finish('quest:b');
    await settle();
    expect(useProgressStore.getState().freshFor.size).toBe(0);
  });
});

describe('[DP] whenWritten and a restore (test 4, store half)', () => {
  it('resolves at once for a profile with no write chain', async () => {
    let done = false;
    void useProgressStore
      .getState()
      .whenWritten('p-none')
      .then(() => {
        done = true;
      });
    await settle();
    expect(done).toBe(true);
  });

  it('resolves only once the restore write has run, and the snapshot is stored by then', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    const gate = deferred();
    idb.gate = { key: /^hr:progress:p1$/, until: gate.promise };
    useProgressStore.getState().replaceSnapshot('p1', restored());
    let done = false;
    void useProgressStore
      .getState()
      .whenWritten('p1')
      .then(() => {
        done = true;
      });
    await settle();
    expect(done).toBe(false);
    gate.resolve();
    await settle();
    expect(done).toBe(true);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:r']);
  });

  it('never rejects, also when the write does not land', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    idb.failingWrite = /^hr:progress:p1$/;
    useProgressStore.getState().replaceSnapshot('p1', restored());
    await expect(useProgressStore.getState().whenWritten('p1')).resolves.toBeUndefined();
  });

  it('for a learner in loadFailedFor: the restore is held (nothing written), whenWritten resolves, and the next good read merges it', async () => {
    const raw = JSON.stringify(saved());
    idb.mem.set(KEY, raw);
    idb.failing = /progress:p1/;
    await useProgressStore.getState().hydrate('p1');
    useProgressStore.getState().replaceSnapshot('p1', restored());
    await expect(useProgressStore.getState().whenWritten('p1')).resolves.toBeUndefined();
    expect(idb.mem.get(KEY)).toBe(raw);
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);

    idb.failing = null;
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
    expect(stored().quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:r']);
    expect(stored().cards.map((c) => c.cardId).sort()).toEqual(['card:book', 'card:moon']);
  });
});
