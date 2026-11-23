import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d; tests 7 and 10 of section 6): a damaged profile list is
 * kept at `profiles-corrupt`, and only a grown-up's Start fresh (`recoverProfileList`) writes past the section 3.3
 * guards: once, only over damaged bytes whose copy is kept, never over a list that reads. The copy goes 30 days after
 * the list reads again or the recovery replaced it. The store runs on the web storage wrapper over an IndexedDB
 * stand-in holding raw strings (as `profile-store-durable.test.ts`).
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** Keys whose reads and writes reject. */
  failing: new Set<string>(),
  /** Every key written or removed, in order. */
  writes: [] as string[],
}));
vi.mock('idb-keyval', () => {
  const check = (k: string): void => {
    if (idb.failing.has(k)) throw new Error('idb failed');
  };
  return {
    get: vi.fn(async (k: string) => {
      check(k);
      return idb.mem.get(k);
    }),
    set: vi.fn(async (k: string, v: string) => {
      check(k);
      idb.writes.push(k);
      idb.mem.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      check(k);
      idb.writes.push(k);
      idb.mem.delete(k);
    }),
    keys: vi.fn(async () => [...idb.mem.keys()]),
    clear: vi.fn(async () => idb.mem.clear()),
    createStore: vi.fn(() => vi.fn(async () => undefined)),
    update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
      check(k);
      const value = next(idb.mem.get(k));
      idb.writes.push(k);
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../grown-up-session', () => ({ closeGrownUpSession: vi.fn() }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: vi.fn(), subscribeProfilesChanged: vi.fn(() => () => undefined) }));

import type * as ProfileStore from '../profile-store';

let store: typeof ProfileStore;

const LIST = 'hr:profiles';
const ACTIVE = 'hr:profiles:active';
const TOMBSTONES = 'hr:profiles:tombstones';
const COPY = 'hr:profiles-corrupt';
const SETTLED = 'hr:profiles-corrupt:settled';
const DAMAGED = '[{"id":"profile:mina","displayName":"Mi';
const DAY = 24 * 60 * 60_000;
const profile = (id: string, displayName = 'Jin') => ({ id, displayName, ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' });
const writesTo = (key: string): number => idb.writes.filter((k) => k === key).length;
/** Lets every queued step run (the store's queue and the storage calls are promise chains). */
const drain = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A launch: a fresh store module reads what is stored (the queued copy step included). */
async function launch(): Promise<void> {
  await drain();
  vi.resetModules();
  store = await import('../profile-store');
  await store.useProfileStore.getState().hydrate();
  await drain();
}

describe('[DP] a damaged profile list, kept and recoverable by a grown-up (section 3.6)', () => {
  beforeEach(async () => {
    await drain();
    idb.mem.clear();
    idb.failing.clear();
    idb.writes.length = 0;
    vi.restoreAllMocks();
    vi.resetModules();
    store = await import('../profile-store');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('test 10: recoverProfileList', () => {
    it('with the copy kept: writes the empty list once, clears loadFailed, and leaves every other record alone', async () => {
      idb.mem.set(LIST, DAMAGED);
      idb.mem.set(ACTIVE, JSON.stringify('profile:mina'));
      idb.mem.set(TOMBSTONES, JSON.stringify({ v: 1, ids: [], at: {} }));
      idb.mem.set('hr:progress:profile:mina', '{"profileId":"profile:mina"}');
      idb.mem.set('hr:sync:profile:mina', '{"rev":3}');
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'parse', listCopyKept: true });
      idb.writes.length = 0;

      await expect(store.recoverProfileList()).resolves.toBe(true);
      await drain();
      expect(writesTo(LIST)).toBe(1);
      expect(JSON.parse(idb.mem.get(LIST) as string)).toEqual([]);
      // Test 7: the damaged bytes are still kept, word for word.
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, listCopyKept: false, profiles: [], activeId: null });
      // Per-profile keys, the active key and the tombstones are not written.
      expect(idb.mem.get('hr:progress:profile:mina')).toBe('{"profileId":"profile:mina"}');
      expect(idb.mem.get('hr:sync:profile:mina')).toBe('{"rev":3}');
      expect(writesTo(ACTIVE)).toBe(0);
      expect(writesTo(TOMBSTONES)).toBe(0);
    });

    it('refuses without profiles-corrupt (the copy could not be made): nothing written, still held', async () => {
      idb.mem.set(LIST, DAMAGED);
      idb.failing.add(COPY);
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState()).toMatchObject({ loadFailed: 'parse', listCopyKept: false });
      idb.writes.length = 0;
      await expect(store.recoverProfileList()).resolves.toBe(false);
      await drain();
      expect(idb.mem.get(LIST)).toBe(DAMAGED);
      expect(idb.writes).toEqual([]);
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'parse' });
    });

    it('refuses for a list that could not be read (read), or one that reads: never a write over a list it cannot see or that is there', async () => {
      idb.mem.set(LIST, JSON.stringify([profile('profile:a')]));
      idb.failing.add(LIST);
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState().loadFailed).toBe('read');
      await expect(store.recoverProfileList()).resolves.toBe(false);

      idb.failing.clear();
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null });
      idb.writes.length = 0;
      await expect(store.recoverProfileList()).resolves.toBe(false);
      await drain();
      expect(writesTo(LIST)).toBe(0);
      expect(JSON.parse(idb.mem.get(LIST) as string)).toEqual([profile('profile:a')]);
    });

    it('bytes that read again before the grown-up confirms (another tab, an older bundle) are not written over', async () => {
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState().loadFailed).toBe('parse');
      idb.mem.set(LIST, JSON.stringify([profile('profile:b', 'Bo')]));
      idb.writes.length = 0;
      await expect(store.recoverProfileList()).resolves.toBe(false);
      await drain();
      expect(writesTo(LIST)).toBe(0);
      expect(JSON.parse(idb.mem.get(LIST) as string)).toEqual([profile('profile:b', 'Bo')]);
    });

    it('writes once: a second Start fresh after the first finds nothing to recover', async () => {
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      const [first, second] = await Promise.all([store.recoverProfileList(), store.recoverProfileList()]);
      await drain();
      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(writesTo(LIST)).toBe(1);
    });

    it('a write that fails changes nothing: still held, the bytes and the copy stay', async () => {
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      const { set } = await import('idb-keyval');
      vi.mocked(set).mockRejectedValueOnce(new Error('disk full'));
      await expect(store.recoverProfileList()).resolves.toBe(false);
      expect(idb.mem.get(LIST)).toBe(DAMAGED);
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'parse' });
    });
  });

  describe('the copy of an earlier damage that has settled gives way at a confirmed Start fresh only', () => {
    it('a second damage while a settled copy waits out its 30 days: the boot touches nothing; Start fresh keeps the new bytes first', async () => {
      const OLD = '[{"id":"profile:old"';
      idb.mem.set(COPY, OLD);
      idb.mem.set(SETTLED, JSON.stringify({ v: 1, at: Date.now() - 3 * DAY }));
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      await drain();
      expect(store.useProfileStore.getState()).toMatchObject({ loadFailed: 'parse', listCopyKept: true });
      // Nothing is removed at launch, with no grown-up action.
      expect(idb.mem.get(COPY)).toBe(OLD);
      expect(idb.mem.has(SETTLED)).toBe(true);
      await expect(store.recoverProfileList()).resolves.toBe(true);
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
      expect(JSON.parse(idb.mem.get(LIST) as string)).toEqual([]);
    });

    it('a settled copy is never touched when the list reads by the time the grown-up confirms (another tab repaired it)', async () => {
      const OLD = '[{"id":"profile:old"';
      idb.mem.set(COPY, OLD);
      idb.mem.set(SETTLED, JSON.stringify({ v: 1, at: Date.now() - DAY }));
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      idb.mem.set(LIST, '[]');
      idb.writes.length = 0;
      await expect(store.recoverProfileList()).resolves.toBe(false);
      expect(idb.mem.get(COPY)).toBe(OLD);
      expect(idb.mem.has(SETTLED)).toBe(true);
      expect(idb.writes).toEqual([]);
    });

    it('a settled copy that cannot be removed: nothing is written over the list', async () => {
      idb.mem.set(COPY, '[{"id":"profile:old"');
      idb.mem.set(SETTLED, JSON.stringify({ v: 1, at: Date.now() - DAY }));
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      const { del } = await import('idb-keyval');
      vi.mocked(del).mockRejectedValueOnce(new Error('disk'));
      await expect(store.recoverProfileList()).resolves.toBe(false);
      expect(idb.mem.get(LIST)).toBe(DAMAGED);
    });

    it('a mark that cannot be read: no grown-up way out, and Start fresh writes nothing', async () => {
      idb.mem.set(COPY, '[{"id":"profile:old"');
      idb.mem.set(LIST, DAMAGED);
      idb.failing.add(SETTLED);
      await store.useProfileStore.getState().hydrate();
      expect(store.useProfileStore.getState()).toMatchObject({ loadFailed: 'parse', listCopyKept: false });
      await expect(store.recoverProfileList()).resolves.toBe(false);
      expect(idb.mem.get(LIST)).toBe(DAMAGED);
    });
  });

  describe('holdsListCopy (the guest sweep keeps an id\'s keys while a list copy is kept)', () => {
    it('true while a copy is kept or its key cannot be read; false with none', async () => {
      await expect(store.holdsListCopy()).resolves.toBe(false);
      idb.mem.set(COPY, DAMAGED);
      await expect(store.holdsListCopy()).resolves.toBe(true);
      idb.mem.delete(COPY);
      idb.failing.add(COPY);
      await expect(store.holdsListCopy()).resolves.toBe(true);
    });
  });

  describe('the copy goes 30 days after the list reads again or a recovery replaced it', () => {
    it('after Start fresh the copy is marked at the next read, kept for 30 days, then removed with its mark', async () => {
      const start = Date.parse('2026-11-23T12:00:00.000Z');
      const now = vi.spyOn(Date, 'now').mockReturnValue(start);
      idb.mem.set(LIST, DAMAGED);
      await store.useProfileStore.getState().hydrate();
      await store.recoverProfileList();
      await drain();
      expect(JSON.parse(idb.mem.get(SETTLED) as string)).toEqual({ v: 1, at: start });

      now.mockReturnValue(start + 29 * DAY);
      await launch();
      expect(idb.mem.get(COPY)).toBe(DAMAGED);

      now.mockReturnValue(start + 30 * DAY);
      await launch();
      expect(idb.mem.has(COPY)).toBe(false);
      expect(idb.mem.has(SETTLED)).toBe(false);
      expect(store.useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null });
    });

    it('a list that reads again by itself (no recovery) starts the 30 days too', async () => {
      const start = Date.parse('2026-11-23T12:00:00.000Z');
      vi.spyOn(Date, 'now').mockReturnValue(start);
      idb.mem.set(COPY, DAMAGED);
      idb.mem.set(LIST, JSON.stringify([profile('profile:a')]));
      await launch();
      expect(JSON.parse(idb.mem.get(SETTLED) as string)).toEqual({ v: 1, at: start });
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
    });

    it('a list damaged again before the step runs is not settled: its copy stays the live one, unmarked', async () => {
      idb.mem.set(COPY, DAMAGED);
      idb.mem.set(LIST, JSON.stringify([profile('profile:a')]));
      await store.useProfileStore.getState().hydrate();
      idb.mem.set(LIST, '{damaged again');
      await drain();
      expect(idb.mem.has(SETTLED)).toBe(false);
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
    });

    it('a launch with no copy writes nothing; a copy that cannot be read is left alone', async () => {
      idb.mem.set(LIST, JSON.stringify([profile('profile:a')]));
      await launch();
      expect(idb.writes).toEqual([]);
      idb.mem.set(COPY, DAMAGED);
      idb.failing.add(COPY);
      await launch();
      expect(idb.writes).toEqual([]);
    });

    it('a launch whose list could not be read leaves the copy and its mark alone', async () => {
      idb.mem.set(COPY, DAMAGED);
      idb.mem.set(SETTLED, JSON.stringify({ v: 1, at: Date.now() - 40 * DAY }));
      idb.mem.set(LIST, JSON.stringify([profile('profile:a')]));
      idb.failing.add(LIST);
      await launch();
      expect(idb.mem.get(COPY)).toBe(DAMAGED);
      expect(idb.mem.has(SETTLED)).toBe(true);
    });

    it('dropListCopy removes the copy and its mark (Remove from this device: the copy may hold a name)', async () => {
      idb.mem.set(COPY, DAMAGED);
      idb.mem.set(SETTLED, JSON.stringify({ v: 1, at: Date.now() }));
      await store.dropListCopy();
      expect(idb.mem.has(COPY)).toBe(false);
      expect(idb.mem.has(SETTLED)).toBe(false);
      // Never throws.
      idb.failing.add(COPY);
      await expect(store.dropListCopy()).resolves.toBeUndefined();
    });
  });
});
