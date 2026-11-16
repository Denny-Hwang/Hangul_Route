import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-3 (audit FUNC-2): a progress record that cannot be read is never written
 * over. The store runs here on the web storage wrapper itself (`storage.web.ts`), over an IndexedDB stand-in that
 * holds raw strings and can be made to fail, so the tests see the bytes that are stored.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** While set, every read and every transaction of a key that matches rejects, as a broken IndexedDB does. */
  failing: null as RegExp | null,
  /** While set, a write of a key that matches rejects (the read before it works). */
  failingWrite: null as RegExp | null,
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
      idb.mem.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      idb.mem.delete(k);
    }),
    keys: vi.fn(async () => [...idb.mem.keys()]),
    clear: vi.fn(async () => idb.mem.clear()),
    createStore: vi.fn(),
    // The read and the write in one transaction; a throw from the callback writes nothing.
    update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
      await Promise.resolve();
      if (broken(k)) throw new Error('idb read failed');
      const value = next(idb.mem.get(k));
      if (brokenWrite(k)) throw new Error('idb write failed');
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

import { setProgressPersistListener } from '../../logic/sync/persist-hook';
import { setWriteFence } from '../../platform/storage-fence';
import { notifyProfileRemoved } from '../profile-removal';
import { useProfileStore } from '../profile-store';
import { PROGRESS_CORRUPT_KEY, PROGRESS_KEY, useProgressStore } from '../progress-store';

const KEY = `hr:${PROGRESS_KEY('p1')}`;
const KEPT = `hr:${PROGRESS_CORRUPT_KEY('p1')}`;
const QUEST = { owner: 'quest:q1', streak: true } as const;

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

/** The truncated record of the audit's repro: the first 60 bytes of a real one. */
const TRUNCATED = JSON.stringify(saved()).slice(0, 60);

const stored = (): ProgressSnapshot => JSON.parse(idb.mem.get(KEY) as string) as ProgressSnapshot;
const finish = (questId: string): void =>
  useProgressStore.getState().recordQuestComplete('p1', { questId, episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });

/** Let the storage transactions in flight land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

beforeEach(() => {
  idb.mem.clear();
  idb.failing = null;
  idb.failingWrite = null;
  setWriteFence(null);
  setProgressPersistListener(null);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), pendingVocabEvents: {}, openSession: null });
});

describe('[AU] a stored snapshot that does not parse (row AU-3)', () => {
  it('the audit repro: the truncated record is copied to hr:progress-corrupt:<id> byte for byte, and stays there when the next quest is saved', async () => {
    idb.mem.set(KEY, TRUNCATED);
    await useProgressStore.getState().hydrate('p1');
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    // The learner starts from a fresh snapshot; nothing is stored for it until something is earned.
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(useProgressStore.getState().byProfile['p1']).toBeUndefined();
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);

    useProgressStore.getState().beginSession('p1', QUEST);
    finish('quest:b');
    await settle();
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:b']);
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
  });

  it('a copy already kept is never replaced by a later damaged record', async () => {
    idb.mem.set(KEPT, '{"first":');
    idb.mem.set(KEY, TRUNCATED);
    await useProgressStore.getState().hydrate('p1');
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEPT)).toBe('{"first":');
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:b']);
  });

  it.each([['a list', '[1,2,3]'], ['a bare string', '"progress"'], ['a number', '42']])('a value that parses but is no snapshot (%s) is kept aside the same way', async (_name, raw) => {
    idb.mem.set(KEY, raw);
    await useProgressStore.getState().hydrate('p1');
    expect(idb.mem.get(KEPT)).toBe(raw);
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    finish('quest:b');
    await settle();
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:b']);
    expect(idb.mem.get(KEPT)).toBe(raw);
  });

  it('a write made before the damaged record was read is saved only after the copy is kept', async () => {
    idb.mem.set(KEY, TRUNCATED);
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:b']);
  });

  it('when the copy cannot be kept, nothing is written over the damaged record and the profile stays un-hydrated', async () => {
    idb.mem.set(KEY, TRUNCATED);
    idb.failing = /progress-corrupt/;
    finish('quest:b');
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);
    expect(idb.mem.has(KEPT)).toBe(false);
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);
    // The storage works again: the copy is kept, then the write made meanwhile is saved.
    idb.failing = null;
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:b']);
  });

  it('a record damaged after it was read is kept aside before the next write replaces it', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    idb.mem.set(KEY, TRUNCATED);
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    // What this tab held in memory is what is stored now: nothing it had read is lost.
    expect(stored().quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b']);
  });

  it('the kept copy goes with the learner (Remove from this device)', async () => {
    // Another id: a removed learner stays fenced for the rest of the file.
    idb.mem.set('hr:progress:p9', TRUNCATED);
    await useProgressStore.getState().hydrate('p9');
    expect(idb.mem.get('hr:progress-corrupt:p9')).toBe(TRUNCATED);
    notifyProfileRemoved('p9');
    await settle();
    expect(idb.mem.has('hr:progress-corrupt:p9')).toBe(false);
    expect(idb.mem.has('hr:progress:p9')).toBe(false);
  });
});

describe('[AU] a storage read that fails (row AU-3)', () => {
  it('leaves the profile un-hydrated: hydrate does not reject, and a session and a finished quest write nothing', async () => {
    const raw = JSON.stringify(saved());
    idb.mem.set(KEY, raw);
    idb.failing = /progress:p1/;
    const notified: string[] = [];
    setProgressPersistListener((id) => notified.push(id));

    await expect(useProgressStore.getState().hydrate('p1')).resolves.toBeUndefined();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);

    const sessionId = useProgressStore.getState().beginSession('p1', QUEST);
    await useProgressStore.getState().hydrate('p1');
    finish('quest:b');
    useProgressStore.getState().unlockCards('p1', [{ cardId: 'card:rice' }]);
    useProgressStore.getState().endSession('p1', sessionId as string);
    await settle();

    expect(idb.mem.get(KEY)).toBe(raw);
    expect(idb.mem.has(KEPT)).toBe(false);
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);
    // Sync is not told about a write that was not saved.
    expect(notified).toEqual([]);
    // The learner keeps what was earned meanwhile, in memory.
    expect(useProgressStore.getState().byProfile['p1']?.quests.map((q) => q.questId)).toEqual(['quest:b']);
  });

  it('the next hydrate reads again and merges the writes made meanwhile with the saved record', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /progress:p1/;
    await useProgressStore.getState().hydrate('p1');
    finish('quest:b');
    await settle();

    idb.failing = null;
    await useProgressStore.getState().hydrate('p1');
    await settle();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:a', 'quest:b']);
    expect(stored().cards.map((c) => c.cardId)).toEqual(['card:book']);
    expect(idb.mem.has(KEPT)).toBe(false);
  });

  it('replaceSnapshot (sync, restore, a plan) is not final while the record is unread: nothing is written, and the next read merges it', async () => {
    const raw = JSON.stringify(saved());
    idb.mem.set(KEY, raw);
    idb.failing = /progress:p1/;
    await useProgressStore.getState().hydrate('p1');
    const blankBased: ProgressSnapshot = { ...saved(), quests: [], cards: [{ cardId: 'card:moon', unlockedAt: '2026-11-02T09:00:00.000Z', newSinceLastView: true }], questDoneAt: {} };
    useProgressStore.getState().replaceSnapshot('p1', blankBased);
    await settle();
    expect(idb.mem.get(KEY)).toBe(raw);
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(false);

    // The storage answers again, even without a new hydrate call from a screen: the replacement asked for the read.
    idb.failing = null;
    useProgressStore.getState().replaceSnapshot('p1', blankBased);
    await settle();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:a']);
    expect(stored().cards.map((c) => c.cardId)).toEqual(['card:book', 'card:moon']);
  });

  it('a read that fails at write time writes nothing; the next write saves everything held in memory', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    const before = idb.mem.get(KEY);
    idb.failing = /progress:p1/;
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEY)).toBe(before);
    idb.failing = null;
    finish('quest:c');
    await settle();
    expect(stored().quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });

  it('a write that does not land (the read worked) leaves the stored record as it was and does not stop later writes', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    await useProgressStore.getState().hydrate('p1');
    const before = idb.mem.get(KEY);
    idb.failingWrite = /progress:p1/;
    finish('quest:b');
    await settle();
    expect(idb.mem.get(KEY)).toBe(before);
    expect(idb.mem.has(KEPT)).toBe(false);
    idb.failingWrite = null;
    finish('quest:c');
    await settle();
    expect(stored().quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });
});

describe('[AU] under the write fence (All lessons, F-BROWSE-001 section 4.10)', () => {
  it('the saved snapshot is still read into memory, and nothing is written or kept aside', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    setWriteFence(() => false);
    await useProgressStore.getState().hydrate('p1');
    expect(useProgressStore.getState().byProfile['p1']?.quests.map((q) => q.questId)).toEqual(['quest:a']);
    finish('quest:b');
    await settle();
    expect(stored().quests.map((q) => q.questId)).toEqual(['quest:a']);
  });

  it('a damaged record reads as nothing stored and is left exactly as it is', async () => {
    idb.mem.set(KEY, TRUNCATED);
    setWriteFence(() => false);
    await useProgressStore.getState().hydrate('p1');
    finish('quest:b');
    await settle();
    expect(useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(idb.mem.get(KEY)).toBe(TRUNCATED);
    expect(idb.mem.has(KEPT)).toBe(false);
  });
});
