import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.3 (row DP-1b; tests 6 to 9 of section 6): the profile records are read
 * under the read contract (`durableRead`). A list that could not be read never shows first run and is never written
 * over; tombstones or the active key failing alone never bring back a removed learner or open a sibling's record.
 * The store runs on the web storage wrapper over an IndexedDB stand-in holding raw strings.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** Keys whose reads (on any connection) and writes reject. */
  failing: new Set<string>(),
  /** Every key written or removed, in order. */
  writes: [] as string[],
  /** [DP] Row DP-1e: told after each read of a key (another tab's write in between two reads). */
  afterGet: null as ((k: string) => void) | null,
  /** [DP] Row DP-1e: keys whose writes reject while their reads work (a full disk). */
  failingWrites: new Set<string>(),
  /** [DP] Row DP-1e: told after each write of a key. */
  afterSet: null as ((k: string) => void) | null,
}));
vi.mock('idb-keyval', () => {
  const check = (k: string): void => {
    if (idb.failing.has(k)) throw new Error('idb read failed');
  };
  return {
    get: vi.fn(async (k: string) => {
      check(k);
      const value = idb.mem.get(k);
      idb.afterGet?.(k);
      return value;
    }),
    set: vi.fn(async (k: string, v: string) => {
      check(k);
      if (idb.failingWrites.has(k)) throw new Error('idb write failed');
      idb.writes.push(k);
      idb.mem.set(k, v);
      idb.afterSet?.(k);
    }),
    del: vi.fn(async (k: string) => {
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

/** A fresh store module per test: changes a test leaves waiting (a held write) never reach the next one. */
let useProfileStore: typeof ProfileStore.useProfileStore;
let PROFILES_CORRUPT_KEY: string;
let TOMBSTONES_CORRUPT_KEY: string;
let TOMBSTONE_LOCK_WAIT_MS: number;

const LIST = 'hr:profiles';
const ACTIVE = 'hr:profiles:active';
const TOMBSTONES = 'hr:profiles:tombstones';
const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
let n = 0;
/** Ids are unique per test: the store remembers every id this module has seen. */
const id = (name: string): string => `profile:${name}${(n += 1)}`;
const profile = (pid: string, displayName = 'Jin') => ({ id: pid, displayName, ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' });
const guestRecord = (): GuestRecord => ({ v: 1, id: id('guest'), startedAt: '2026-11-01T00:00:00.000Z', lastAt: '2026-11-01T00:00:00.000Z', via: 'site', questDone: true });
const storeList = (list: unknown[]): void => void idb.mem.set(LIST, JSON.stringify(list));
const shown = (): string[] => useProfileStore.getState().profiles.map((p) => p.id);
const profileWrites = (): string[] => idb.writes.filter((k) => k === LIST || k === ACTIVE || k === TOMBSTONES);
/** Lets every queued write run (the store's queue and the storage calls are promise chains). */
const drain = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('[DP] profile records under the read contract (AMENDMENTS-DURABLE-PROGRESS section 3.3)', () => {
  beforeEach(async () => {
    await drain();
    idb.mem.clear();
    idb.failing.clear();
    idb.writes.length = 0;
    idb.afterGet = null;
    idb.failingWrites.clear();
    idb.afterSet = null;
    vi.resetModules();
    ({ useProfileStore, PROFILES_CORRUPT_KEY, TOMBSTONES_CORRUPT_KEY, TOMBSTONE_LOCK_WAIT_MS } = await import('../profile-store'));
  });

  describe('test 6: a list that could not be read', () => {
    it('stays not hydrated with loadFailed read, and writes no profile record', async () => {
      const a = id('a');
      const gone = id('gone');
      storeList([profile(a)]);
      idb.mem.set(ACTIVE, JSON.stringify(a));
      // A removed learner whose keys are still here: the sweep would remove them.
      idb.mem.set(TOMBSTONES, JSON.stringify({ v: 1, ids: [gone], at: { [gone]: Date.now() } }));
      idb.mem.set(`hr:progress:${gone}`, '{}');
      idb.failing.add(LIST);

      await useProfileStore.getState().hydrate();
      const s = useProfileStore.getState();
      expect(s.hydrated).toBe(false);
      expect(s.loadFailed).toBe('read');
      expect(s.profiles).toEqual([]);

      // Creating a profile, picking, refreshing and saving a guest write nothing.
      const made = useProfileStore.getState().createProfile(input);
      useProfileStore.getState().setActive(made.id);
      useProfileStore.getState().updateProfile(made.id, { displayName: 'Mimi' });
      await useProfileStore.getState().refresh();
      const guest = guestRecord();
      const promoted = await useProfileStore
        .getState()
        .promoteGuest(guest, { displayName: 'Sora', ageGroup: '8-9', avatar: 'hoya-blue', learnerType: 'child' });
      await drain();
      expect(promoted).toEqual({ kind: 'failed' });
      expect(profileWrites()).toEqual([]);
      // The sweep was skipped: the removed learner's key is still there.
      expect(idb.mem.has(`hr:progress:${gone}`)).toBe(true);
      expect(idb.writes).toEqual([]);
    });

    it('bytes that do not parse: loadFailed parse, the bytes are kept at profiles-corrupt and never written over', async () => {
      idb.mem.set(LIST, '[{"id":"profile:a"');
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'parse', listCopyKept: true, profiles: [] });
      expect(idb.mem.get(`hr:${PROFILES_CORRUPT_KEY}`)).toBe('[{"id":"profile:a"');
      useProfileStore.getState().createProfile(input);
      await drain();
      expect(idb.mem.get(LIST)).toBe('[{"id":"profile:a"');
      expect(profileWrites()).toEqual([]);
    });

    it('a failed read keeps no copy (listCopyKept false)', async () => {
      idb.failing.add(LIST);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ loadFailed: 'read', listCopyKept: false });
      expect(idb.mem.has(`hr:${PROFILES_CORRUPT_KEY}`)).toBe(false);
    });

    it('while loadFailed is set nothing writes, even once the list reads again (before Try again)', async () => {
      const a = id('a');
      const b = id('b');
      storeList([profile(a), profile(b, 'Bo')]);
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, JSON.stringify({ v: 1, ids: [], at: {} }));
      idb.failing.add(LIST);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState().loadFailed).toBe('read');
      // The fault passes; nobody has pressed Try again yet.
      idb.failing.clear();
      const removed: string[] = [];
      const { onProfileRemoved } = await import('../profile-removal');
      const off = onProfileRemoved((pid) => removed.push(pid));
      const made = useProfileStore.getState().createProfile(input);
      useProfileStore.getState().updateProfile(made.id, { displayName: 'Mimi' });
      useProfileStore.getState().applyServerProfile(made.id, { displayName: 'Kaia', ageGroup: '8-9', avatar: 'hoya-blue' });
      useProfileStore.getState().adoptProfile(profile(id('c'), 'Cy') as Profile);
      useProfileStore.getState().setActive(made.id);
      useProfileStore.getState().remove(a);
      await useProfileStore.getState().refresh();
      const promoted = await useProfileStore
        .getState()
        .promoteGuest(guestRecord(), { displayName: 'Sora', ageGroup: '8-9', avatar: 'hoya-blue', learnerType: 'child' });
      await drain();
      off();
      expect(promoted).toEqual({ kind: 'failed' });
      expect(removed).toEqual([]);
      expect(profileWrites()).toEqual([]);
      // Try again reads the stored list, untouched: nothing made meanwhile is in it.
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
      expect(shown()).toEqual([a, b]);
    });

    it('a later hydrate that fails (Try again after a success) keeps nothing of the earlier read', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(ACTIVE, JSON.stringify(a));
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, activeId: a });
      idb.failing.add(LIST);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [], activeId: null });
    });

    it('the next hydrate that reads the list heals it', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.failing.add(LIST);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState().loadFailed).toBe('read');
      idb.failing.clear();
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: null });
      expect(shown()).toEqual([a]);
    });

    it('an absent list is a new device, not a failure', async () => {
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, profiles: [] });
    });
  });

  describe('test 7: list bytes that turn unparsable after launch', () => {
    it('a list write does not overwrite them (was: merged as empty), and profiles-corrupt holds them', async () => {
      const a = id('a');
      storeList([profile(a)]);
      await useProfileStore.getState().hydrate();
      expect(shown()).toEqual([a]);
      idb.mem.set(LIST, '[{"id":"damaged"');
      idb.writes.length = 0;

      useProfileStore.getState().createProfile(input);
      await drain();
      expect(idb.mem.get(LIST)).toBe('[{"id":"damaged"');
      expect(idb.mem.get(`hr:${PROFILES_CORRUPT_KEY}`)).toBe('[{"id":"damaged"');
      expect(idb.writes).not.toContain(LIST);
      // A refresh reads the same bytes and writes nothing over them either.
      await useProfileStore.getState().refresh().catch(() => undefined);
      await drain();
      expect(idb.mem.get(LIST)).toBe('[{"id":"damaged"');
    });

    it('promoteGuest over damaged list bytes saves nothing and keeps the guest', async () => {
      storeList([]);
      await useProfileStore.getState().hydrate();
      idb.mem.set(LIST, '{damaged');
      const guest = guestRecord();
      const promoted = await useProfileStore
        .getState()
        .promoteGuest(guest, { displayName: 'Sora', ageGroup: '8-9', avatar: 'hoya-blue', learnerType: 'child' });
      expect(promoted).toEqual({ kind: 'failed' });
      expect(idb.mem.get(LIST)).toBe('{damaged');
      expect(shown()).toEqual([]);
    });

    it('damaged tombstone bytes are not merged as empty: a removed learner stays removed and the list is not written', async () => {
      const a = id('a');
      const b = id('b');
      storeList([profile(a), profile(b, 'Bo')]);
      await useProfileStore.getState().hydrate();
      idb.mem.set(TOMBSTONES, '{damaged');
      idb.writes.length = 0;
      useProfileStore.getState().updateProfile(a, { displayName: 'Ana' });
      await drain();
      expect(idb.writes).not.toContain(LIST);
      expect(idb.mem.get(TOMBSTONES)).toBe('{damaged');
    });
  });

  describe('test 8: the tombstones fail alone', () => {
    it('a swept learner is not shown, the sweep is skipped and no list write lands until a tombstone read works', async () => {
      const swept = id('swept');
      const kept = id('kept');
      const leftover = id('leftover');
      // `swept` was removed elsewhere and its keys are gone; an older bundle wrote it back into the list.
      storeList([profile(swept, 'Old'), profile(kept, 'Kim')]);
      idb.mem.set(`hr:progress:${kept}`, '{}');
      idb.mem.set(TOMBSTONES, JSON.stringify({ v: 1, ids: [swept, leftover], at: { [swept]: Date.now(), [leftover]: Date.now() } }));
      idb.mem.set(`hr:progress:${leftover}`, '{}');
      idb.failing.add(TOMBSTONES);

      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null });
      expect(shown()).toEqual([kept]);
      await drain();
      // Sweep skipped (it would have removed the leftover key).
      expect(idb.mem.has(`hr:progress:${leftover}`)).toBe(true);

      // A change is held: the list is not written while the tombstones cannot be read.
      const made = useProfileStore.getState().createProfile(input);
      await drain();
      expect(idb.writes).not.toContain(LIST);
      expect(shown()).toEqual([kept, made.id]);

      // The tombstones read again: the held change lands, and the removed learner stays removed.
      idb.failing.clear();
      useProfileStore.getState().updateProfile(made.id, { displayName: 'Mimi' });
      await drain();
      const list = JSON.parse(idb.mem.get(LIST) as string) as { id: string }[];
      expect(list.map((p) => p.id)).toEqual([kept, made.id]);
      expect(shown()).toEqual([kept, made.id]);
    });

    it('fails closed when the keys cannot be listed either', async () => {
      const kept = id('kept');
      storeList([profile(kept)]);
      idb.failing.add(TOMBSTONES);
      const { keys } = await import('idb-keyval');
      vi.mocked(keys).mockRejectedValueOnce(new Error('keys failed'));
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [] });
    });

    it('any per-profile key keeps a learner shown, not only a progress record', async () => {
      const kept = id('kept');
      const synced = id('synced');
      storeList([profile(kept), profile(synced, 'Sy')]);
      idb.mem.set(`hr:progress:${kept}`, '{}');
      idb.mem.set(`hr:sync:${synced}`, '{}');
      idb.failing.add(TOMBSTONES);
      await useProfileStore.getState().hydrate();
      expect(shown()).toEqual([kept, synced]);
    });

    it('an active learner hidden here (never played: no keys yet) is never replaced by a sibling: the chooser decides', async () => {
      const played = id('played');
      const fresh = id('fresh');
      const other = id('other');
      storeList([profile(played), profile(fresh, 'Fe'), profile(other, 'Ot')]);
      idb.mem.set(`hr:progress:${played}`, '{}');
      idb.mem.set(`hr:progress:${other}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(fresh));
      idb.failing.add(TOMBSTONES);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: null });
      expect(shown()).toEqual([played, other]);
    });

    it('fails closed rather than show first run when no learner of a stored list would be left', async () => {
      const fresh = id('fresh');
      storeList([profile(fresh)]);
      idb.failing.add(TOMBSTONES);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [] });
    });
  });

  /**
   * [DP] Owner decision OD-DP5 (row DP-1e): tombstone bytes that do not parse never parse again, so holding list writes
   * until they read would hold them for good. Their raw bytes are kept at `tombstones-corrupt` first; the set is then
   * rebuilt from the device (a learner of the stored list with no per-profile key left is tombstoned), written, and the
   * hold is released. A read that failed keeps holding and is read again at the next hydrate.
   */
  describe('OD-DP5: tombstones whose bytes do not parse', () => {
    const DAMAGED = '{"v":1,"ids":["profile:';
    const storedTombstones = (): { v: number; ids: string[]; at: Record<string, number> } =>
      JSON.parse(idb.mem.get(TOMBSTONES) as string) as { v: number; ids: string[]; at: Record<string, number> };
    const storedIds = (): string[] => (JSON.parse(idb.mem.get(LIST) as string) as { id: string }[]).map((p) => p.id);

    it('keeps the raw bytes first, tombstones the learners with no per-profile key, writes the set and releases the hold', async () => {
      const played = id('played');
      const synced = id('synced');
      const swept = id('swept');
      // `swept` was removed and its keys are gone; an older bundle wrote it back into the list. `synced` has only a sync record.
      storeList([profile(played), profile(swept, 'Old'), profile(synced, 'Sy')]);
      idb.mem.set(`hr:progress:${played}`, '{}');
      idb.mem.set(`hr:sync:${synced}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(played));
      idb.mem.set(TOMBSTONES, DAMAGED);

      const before = Date.now();
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: played });
      expect(shown()).toEqual([played, synced]);
      // The copy holds the very bytes, and was written before the tombstones were.
      expect(idb.mem.get(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBe(DAMAGED);
      expect(idb.writes.indexOf(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBeGreaterThan(-1);
      expect(idb.writes.indexOf(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBeLessThan(idb.writes.indexOf(TOMBSTONES));
      const rebuilt = storedTombstones();
      expect(rebuilt.v).toBe(1);
      expect(rebuilt.ids).toEqual([swept]);
      expect(rebuilt.at[swept]).toBeGreaterThanOrEqual(before);
      // The other tabs are told, so their held list writes land.
      const { postProfilesChanged } = await import('../../platform/profiles-channel');
      expect(vi.mocked(postProfilesChanged)).toHaveBeenCalled();

      // The hold is released: the list is written without the removed learner (a list write that merges with the new
      // set), and the active key is left as it was.
      await drain();
      expect(profileWrites()).toEqual([TOMBSTONES, LIST]);
      expect(storedIds()).toEqual([played, synced]);
      const made = useProfileStore.getState().createProfile(input);
      await drain();
      expect(storedIds()).toEqual([played, synced, made.id]);
      expect(shown()).toEqual([played, synced, made.id]);
    });

    it('a learner the rebuild tombstoned never comes back after its tombstone is pruned (31 days later)', async () => {
      const a = id('a');
      const swept = id('swept');
      storeList([profile(a), profile(swept, 'Old')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      await drain();
      expect(storedIds()).toEqual([a]);

      // 31 days on, the next launch: the tombstone is pruned at the next list write, and the learner stays out.
      const later = Date.now() + 31 * 24 * 60 * 60_000;
      const clock = vi.spyOn(Date, 'now').mockReturnValue(later);
      try {
        vi.resetModules();
        ({ useProfileStore } = await import('../profile-store'));
        await useProfileStore.getState().hydrate();
        useProfileStore.getState().updateProfile(a, { displayName: 'Ana' });
        await drain();
        expect(storedIds()).toEqual([a]);
        expect(storedTombstones().ids).toEqual([]);
        expect(shown()).toEqual([a]);
      } finally {
        clock.mockRestore();
      }
    });

    it('the learner the active key names is never tombstoned (a removal moves the active key away): it stays, and active', async () => {
      const a = id('a');
      const b = id('b');
      const fresh = id('fresh');
      const gone = id('gone');
      // `fresh` was just made (no per-profile key yet) and is in use; `gone` has nothing left and is not active.
      storeList([profile(a), profile(b, 'Bo'), profile(fresh, 'Fe'), profile(gone, 'Go')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(`hr:progress:${b}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(fresh));
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: fresh });
      expect(shown()).toEqual([a, b, fresh]);
      expect(storedTombstones().ids).toEqual([gone]);
    });

    it('a key written for a learner after the rebuild listed the keys is not swept by this launch', async () => {
      const a = id('a');
      const gone = id('gone');
      storeList([profile(a), profile(gone, 'Go')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, DAMAGED);
      // A tab where `gone` is in use saves its first progress just after the rebuild wrote the tombstones.
      idb.afterSet = (k) => {
        if (k !== TOMBSTONES) return;
        idb.afterSet = null;
        idb.mem.set(`hr:progress:${gone}`, '{"saved":true}');
      };
      await useProfileStore.getState().hydrate();
      await drain();
      expect(storedTombstones().ids).toEqual([gone]);
      expect(idb.mem.get(`hr:progress:${gone}`)).toBe('{"saved":true}');
    });

    it('nothing to tombstone: an empty set is written and the hold is released', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
      expect(storedTombstones()).toEqual({ v: 1, ids: [], at: {} });
      useProfileStore.getState().updateProfile(a, { displayName: 'Ana' });
      await drain();
      expect((JSON.parse(idb.mem.get(LIST) as string) as { displayName: string }[])[0]?.displayName).toBe('Ana');
    });

    it('the copy cannot be kept: nothing is rewritten and list writes stay held, as for a read that failed', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, DAMAGED);
      idb.failing.add(`hr:${TOMBSTONES_CORRUPT_KEY}`);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
      expect(idb.mem.has(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBe(false);
      // The list write is held (the active key, which holds nothing earned, is not).
      useProfileStore.getState().createProfile(input);
      await drain();
      expect(idb.writes).not.toContain(LIST);
      expect(idb.writes).not.toContain(TOMBSTONES);
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
    });

    it('fails closed, writing nothing over them, when no learner of a non-empty stored list would be left', async () => {
      const keyless = id('keyless');
      storeList([profile(keyless)]);
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [] });
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
      expect(profileWrites()).toEqual([]);
    });

    it('learners are counted: a legacy grown-up row with a key left over does not stop it failing closed', async () => {
      const keyless = id('keyless');
      const parent = id('parent');
      storeList([profile(keyless), { ...profile(parent, 'Pa'), role: 'parent' }]);
      idb.mem.set(`hr:settings:${parent}`, '{}');
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [] });
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
    });

    it('a rebuild whose write fails changes nothing: the bytes stay and list writes stay held', async () => {
      const a = id('a');
      const gone = id('gone');
      storeList([profile(a), profile(gone, 'Go')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(ACTIVE, JSON.stringify(a));
      idb.mem.set(TOMBSTONES, DAMAGED);
      idb.failingWrites.add(TOMBSTONES);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
      expect(shown()).toEqual([a]);
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
      expect(idb.mem.get(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBe(DAMAGED);
      useProfileStore.getState().updateProfile(a, { displayName: 'Ana' });
      await drain();
      expect(idb.writes).not.toContain(LIST);
    });

    it('the active key cannot be read: no rebuild (the learner in use cannot be told), list writes held', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(TOMBSTONES, DAMAGED);
      idb.failing.add(ACTIVE);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
    });

    it('a stored list that is not a list is never a reason to forget the removed ids: nothing rewritten', async () => {
      idb.mem.set(LIST, JSON.stringify({ not: 'a list' }));
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
    });

    it('a lock that is never given back does not hold the boot: after the wait, list writes are held for this launch', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.stubGlobal('navigator', { locks: { request: () => new Promise(() => undefined) } });
      try {
        const a = id('a');
        storeList([profile(a)]);
        idb.mem.set(`hr:progress:${a}`, '{}');
        idb.mem.set(ACTIVE, JSON.stringify(a));
        idb.mem.set(TOMBSTONES, DAMAGED);
        let done = false;
        const hydrating = useProfileStore
          .getState()
          .hydrate()
          .then(() => {
            done = true;
          });
        await vi.advanceTimersByTimeAsync(TOMBSTONE_LOCK_WAIT_MS - 1);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await hydrating;
        expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
        expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
      } finally {
        vi.unstubAllGlobals();
        vi.useRealTimers();
      }
    });

    it('fails closed, writing nothing over them, when the keys cannot be listed', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(TOMBSTONES, DAMAGED);
      const { keys } = await import('idb-keyval');
      vi.mocked(keys).mockRejectedValueOnce(new Error('keys failed')).mockRejectedValueOnce(new Error('keys failed'));
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: false, loadFailed: 'read', profiles: [] });
      expect(idb.mem.get(TOMBSTONES)).toBe(DAMAGED);
      expect(profileWrites()).toEqual([]);
    });

    it('tombstones another tab wrote meanwhile are read inside the lock and never written over', async () => {
      const a = id('a');
      const gone = id('gone');
      storeList([profile(a), profile(gone, 'Go')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(`hr:progress:${gone}`, '{}');
      idb.mem.set(TOMBSTONES, DAMAGED);
      // Another tab rebuilt them (holding `gone` as removed) right after this tab read them and kept its copy (the
      // second read of the key is the copy's).
      const theirs = JSON.stringify({ v: 1, ids: [gone], at: { [gone]: Date.now() } });
      let reads = 0;
      idb.afterGet = (k) => {
        if (k !== TOMBSTONES || (reads += 1) < 2) return;
        idb.afterGet = null;
        idb.mem.set(TOMBSTONES, theirs);
      };
      await useProfileStore.getState().hydrate();
      expect(idb.mem.get(TOMBSTONES)).toBe(theirs);
      expect(idb.writes).not.toContain(TOMBSTONES);
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null });
      expect(shown()).toEqual([a]);
    });

    it('a second damage keeps the first copy (never overwritten) and is rebuilt again', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(TOMBSTONES, DAMAGED);
      await useProfileStore.getState().hydrate();
      idb.mem.set(TOMBSTONES, '{second');
      await useProfileStore.getState().hydrate();
      expect(idb.mem.get(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBe(DAMAGED);
      expect(storedTombstones()).toEqual({ v: 1, ids: [], at: {} });
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null });
    });

    it('a read that failed keeps holding (no copy, nothing rewritten) and the next hydrate reads them again', async () => {
      const a = id('a');
      const gone = id('gone');
      storeList([profile(a), profile(gone, 'Go')]);
      idb.mem.set(`hr:progress:${a}`, '{}');
      idb.mem.set(`hr:progress:${gone}`, '{}');
      const removed = JSON.stringify({ v: 1, ids: [gone], at: { [gone]: Date.now() } });
      idb.mem.set(TOMBSTONES, removed);
      idb.failing.add(TOMBSTONES);
      await useProfileStore.getState().hydrate();
      // `gone` still has keys, so the read path cannot tell it is removed: shown, and list writes held.
      expect(shown()).toEqual([a, gone]);
      useProfileStore.getState().updateProfile(a, { displayName: 'Ana' });
      await drain();
      expect(profileWrites()).toEqual([]);
      expect(idb.mem.has(`hr:${TOMBSTONES_CORRUPT_KEY}`)).toBe(false);

      // The fault passes: the next hydrate reads the tombstones, and the removed learner goes.
      idb.failing.clear();
      await useProfileStore.getState().hydrate();
      expect(shown()).toEqual([a]);
      expect(idb.mem.get(TOMBSTONES)).toBe(removed);
    });
  });

  describe('test 9: the active key fails alone', () => {
    it('counts learners: one learner and a legacy grown-up row make that learner active', async () => {
      const a = id('a');
      const parent = id('parent');
      storeList([{ ...profile(parent, 'Pa'), role: 'parent' }, profile(a)]);
      idb.failing.add(ACTIVE);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, activeId: a });
    });

    it('with two profiles nobody is active (the chooser opens), and a pick writes the key again', async () => {
      const a = id('a');
      const b = id('b');
      storeList([profile(a), profile(b, 'Bo')]);
      idb.mem.set(ACTIVE, JSON.stringify(b));
      idb.failing.add(ACTIVE);
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: null });
      expect(shown()).toEqual([a, b]);

      idb.failing.clear();
      useProfileStore.getState().setActive(a);
      await drain();
      expect(JSON.parse(idb.mem.get(ACTIVE) as string)).toBe(a);
    });

    it('with one profile, that profile is active', async () => {
      const a = id('a');
      storeList([profile(a)]);
      idb.mem.set(ACTIVE, '{damaged');
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState()).toMatchObject({ hydrated: true, loadFailed: null, activeId: a });
    });
  });
});
