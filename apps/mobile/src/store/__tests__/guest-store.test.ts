import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.3, 6.4, 7.2, GU-D3, GU-D12, CS-G3 (row GU-2, section 19): the guest
 * store. A start closes the grown-up session first for every entry, writes or adopts `hr:guest` under the
 * `hr:profiles` Web Lock and posts `hr-profiles` `changed`, and never selects a profile; a second tab adopts the live
 * record; a write that fails keeps the run in memory; a record that does not parse is no guest. Storage is an
 * in-memory map.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const failing = vi.hoisted(() => ({ write: false, read: false }));
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => parse(key)),
  readJsonStrict: vi.fn(async (key: string) => {
    if (failing.read) throw new Error('read failed');
    try {
      return parse(key);
    } catch {
      return null;
    }
  }),
  readJsonExact: vi.fn(async (key: string) => {
    if (failing.read) throw new Error('read failed');
    return parse(key);
  }),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    if (failing.write && key === 'guest') throw new Error('QuotaExceededError');
    disk.set(key, JSON.stringify(value));
  }),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
const channel = vi.hoisted(() => ({ posts: 0, listener: null as (() => void) | null }));
vi.mock('../../platform/profiles-channel', () => ({
  postProfilesChanged: () => {
    channel.posts += 1;
  },
  subscribeProfilesChanged: (listener: () => void) => {
    channel.listener = listener;
    return () => {
      channel.listener = null;
    };
  },
}));
vi.mock('../../platform/grown-up-tab', () => ({ endGrownUpTab: vi.fn() }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null }));
vi.mock('../../platform/device-uses', () => ({ readDeviceUses: async () => [] }));

import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { endGrownUpTab } from '../../platform/grown-up-tab';
import { activeLearnerIdNow, activeLearnerIdSelector } from '../active-learner';
import { followGuestChanges, isLiveGuestId, liveGuestId, readStoredGuest, useGuestStore } from '../guest-store';
import { hydrateGuest } from '../guest-sweep';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';
import { useAccountStore } from '../account-store';
import { gateOpensDirectlyNow } from '../gate-now';
import { deviceShared, whoMarker } from '../who-chooser';

const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const iso = (ms: number): string => new Date(ms).toISOString();
const stored = (): GuestRecord | null => parse('guest') as GuestRecord | null;
const record = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: 'profile:guest001', startedAt: iso(T0), lastAt: iso(T0), via: 'site', questDone: false, ...patch });
const mina: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };

/** A Web Locks double that records each lock name and runs the step. */
const locked: string[] = [];
const locks = {
  request: vi.fn(async <T>(name: string, step: () => Promise<T>): Promise<T> => {
    locked.push(name);
    return step();
  }),
};

beforeEach(() => {
  disk.clear();
  failing.write = false;
  failing.read = false;
  channel.posts = 0;
  locked.length = 0;
  vi.stubGlobal('navigator', { locks });
  vi.mocked(endGrownUpTab).mockClear();
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startGuestRun (5.3, CS-G3)', () => {
  it.each(['site', 'chooser', 'welcome'] as const)('via %s with a grown-up session open: the session closes first and the hr-grownup lock is posted', async (via) => {
    useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
    const started = await useGuestStore.getState().startGuestRun(via, T0);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
    expect(started).toMatchObject({ resumed: false, record: { via, questDone: false, startedAt: iso(T0), lastAt: iso(T0) } });
    expect(started!.record.id).toMatch(/^profile:[a-z0-9]{8}$/);
    expect(stored()).toEqual(started!.record);
    expect(useGuestStore.getState()).toMatchObject({ running: true, memoryOnly: false });
  });

  it('a reopen with a grown-up session open: the session closes and the live record resumes', async () => {
    disk.set('guest', JSON.stringify(record()));
    useUiStore.setState({ parentGateOpenedAt: T0, lastPinVerifiedAt: T0 });
    const started = await useGuestStore.getState().startGuestRun('reopen', T0 + 60_000);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(endGrownUpTab).toHaveBeenCalledTimes(1);
    // GU-D12, GU-D13: a reopen is no play: `lastAt` stays, and nothing is written.
    expect(started).toEqual({ resumed: true, record: record() });
    expect(stored()).toEqual(record());
    expect(channel.posts).toBe(0);
    expect(useGuestStore.getState().running).toBe(true);
  });

  it('a reopen or an adopt never moves lastAt, so a record never lives longer without play (GU-D13)', async () => {
    disk.set('guest', JSON.stringify(record({ questDone: true })));
    for (const via of ['reopen', 'welcome', 'chooser', 'site'] as const) {
      useGuestStore.setState({ record: null, running: false });
      const started = await useGuestStore.getState().startGuestRun(via, T0 + 20 * 60_000);
      expect(started).toEqual({ resumed: true, record: record({ questDone: true }) });
    }
    expect(stored()!.lastAt).toBe(iso(T0));
    // Only play moves it.
    await useGuestStore.getState().recordGuestPlay({}, T0 + 25 * 60_000);
    expect(stored()!.lastAt).toBe(iso(T0 + 25 * 60_000));
  });

  it('a reopen with no live record starts nothing (the session still closes)', async () => {
    useUiStore.setState({ parentGateOpenedAt: T0 });
    expect(await useGuestStore.getState().startGuestRun('reopen', T0)).toBeNull();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(stored()).toBeNull();
    expect(useGuestStore.getState().running).toBe(false);
  });

  it('writes under the hr:profiles lock, posts hr-profiles changed, and never selects a profile', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    const setActive = vi.spyOn(useProfileStore.getState(), 'setActive');
    await useGuestStore.getState().startGuestRun('chooser', T0);
    expect(locked).toEqual(['hr:profiles']);
    expect(channel.posts).toBe(1);
    expect(setActive).not.toHaveBeenCalled();
    expect(useProfileStore.getState().activeId).toBe(mina.id);
    // The active learner is the guest while the run lasts, then the profile again.
    expect(activeLearnerIdNow()).toBe(useGuestStore.getState().record!.id);
    useGuestStore.getState().endGuestRun();
    expect(activeLearnerIdNow()).toBe(mina.id);
    expect(useGuestStore.getState().record).not.toBeNull();
  });

  it('a fresh id is never a profile id already on the device', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValue(0.25);
    const taken = `profile:${(0.5).toString(36).slice(2, 10).padEnd(8, '0')}`;
    useProfileStore.setState({ profiles: [{ ...mina, id: taken }] });
    const started = await useGuestStore.getState().startGuestRun('chooser', T0);
    random.mockRestore();
    expect(started!.record.id).not.toBe(taken);
  });

  it('a stored record of a saved guest (its id a profile) is not adopted: a new run starts', async () => {
    disk.set('guest', JSON.stringify(record()));
    useProfileStore.setState({ profiles: [{ ...mina, id: 'profile:guest001' }] });
    const started = await useGuestStore.getState().startGuestRun('chooser', T0);
    expect(started!.resumed).toBe(false);
    expect(started!.record.id).not.toBe('profile:guest001');
  });
});

describe('one guest per device (GU-D3): a second tab adopts the live record', () => {
  it('the second start adopts the stored record and keeps its id, via and start', async () => {
    const first = await useGuestStore.getState().startGuestRun('site', T0);
    // Another tab: its memory is empty, the storage is shared.
    useGuestStore.setState({ record: null, running: false });
    const second = await useGuestStore.getState().startGuestRun('welcome', T0 + 5_000);
    expect(second).toEqual({ resumed: true, record: first!.record });
    expect(stored()!.id).toBe(first!.record.id);
  });

  it('a record another tab wrote is read again on hr-profiles; a saved or removed record ends this tab\'s run', async () => {
    const stop = followGuestChanges();
    disk.set('guest', JSON.stringify(record()));
    channel.listener!();
    await vi.waitFor(() => expect(useGuestStore.getState().record).toEqual(record()));
    expect(useGuestStore.getState().running).toBe(false);

    await useGuestStore.getState().startGuestRun('welcome', T0 + 1000);
    expect(useGuestStore.getState().running).toBe(true);
    // Saved in the other tab: the id is a profile and hr:guest is gone.
    disk.delete('guest');
    useProfileStore.setState({ profiles: [{ ...mina, id: 'profile:guest001' }] });
    channel.listener!();
    await vi.waitFor(() => expect(useGuestStore.getState().running).toBe(false));
    expect(useGuestStore.getState().record).toBeNull();
    stop();
    expect(channel.listener).toBeNull();
  });

  it('another tab started a different run: this tab\'s run ends and it holds the new record', async () => {
    await useGuestStore.getState().startGuestRun('site', T0);
    disk.set('guest', JSON.stringify(record({ id: 'profile:other001' })));
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState()).toMatchObject({ running: false, record: { id: 'profile:other001' } });
  });

  it('refresh reads nothing before the boot read, and changes nothing when the storage cannot be read', async () => {
    useGuestStore.setState({ hydrated: false });
    disk.set('guest', JSON.stringify(record()));
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState().record).toBeNull();
    useGuestStore.setState({ hydrated: true, record: record(), running: true });
    failing.read = true;
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState()).toMatchObject({ record: record(), running: true });
  });
});

describe('storage blocked (7.2): the run goes on in memory', () => {
  it('a write that fails keeps the run in memory only; quest steps stay in memory', async () => {
    failing.write = true;
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    expect(started!.resumed).toBe(false);
    expect(useGuestStore.getState()).toMatchObject({ running: true, memoryOnly: true });
    expect(stored()).toBeNull();
    expect(channel.posts).toBe(0);
    await useGuestStore.getState().recordGuestPlay({ questDone: true }, T0 + 1000);
    expect(useGuestStore.getState().record).toMatchObject({ questDone: true, lastAt: iso(T0 + 1000) });
    // A refresh from another tab's post does not drop the memory run while storage holds nothing.
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState().running).toBe(true);
    // A second start in this tab resumes the memory run (the same id).
    const again = await useGuestStore.getState().startGuestRun('welcome', T0 + 2000);
    expect(again).toMatchObject({ resumed: true, record: { id: started!.record.id } });
  });

  it('a storage that cannot be read is never written over: the run is in memory', async () => {
    failing.read = true;
    disk.set('guest', JSON.stringify(record({ id: 'profile:unseen01' })));
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    expect(started!.record.id).not.toBe('profile:unseen01');
    expect(stored()!.id).toBe('profile:unseen01');
    expect(useGuestStore.getState().memoryOnly).toBe(true);
  });

  it('a step write that fails moves the run to memory', async () => {
    await useGuestStore.getState().startGuestRun('site', T0);
    failing.write = true;
    await useGuestStore.getState().recordGuestPlay({}, T0 + 1000);
    expect(useGuestStore.getState().memoryOnly).toBe(true);
  });
});

describe('a record that does not parse (7.2) is no guest and is overwritten by the next start', () => {
  it('readStoredGuest: missing, not JSON, unreadable', async () => {
    expect(await readStoredGuest()).toEqual({ ok: true, raw: null });
    disk.set('guest', '{not json');
    expect(await readStoredGuest()).toEqual({ ok: true, raw: undefined });
    failing.read = true;
    expect(await readStoredGuest()).toEqual({ ok: false });
  });

  it('a start over a damaged record that names an unsaved id removes that id\'s keys first; a learner\'s keys stay', async () => {
    disk.set('guest', JSON.stringify({ v: 9, id: 'profile:old00001', startedAt: iso(T0) }));
    disk.set('progress:profile:old00001', '{}');
    disk.set('plans:profile:old00001', '{}');
    disk.set('progress:profile:mina0001', '{}');
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    expect(started!.record.id).not.toBe('profile:old00001');
    expect(disk.has('progress:profile:old00001')).toBe(false);
    expect(disk.has('plans:profile:old00001')).toBe(false);
    expect(disk.has('progress:profile:mina0001')).toBe(true);
    expect(stored()).toEqual(started!.record);

    // The id is a learner's on the stored list (the list in memory missed it), removed (tombstoned), or the lists do
    // not read: nothing is deleted.
    for (const setup of [
      () => disk.set('profiles', JSON.stringify([{ id: 'profile:old00001' }])),
      () => disk.set('profiles:tombstones', JSON.stringify({ v: 1, ids: ['profile:old00001'], at: {} })),
      () => disk.set('profiles', JSON.stringify({ not: 'a list' })),
      () => disk.set('profiles', '{not json'),
    ]) {
      disk.clear();
      useGuestStore.setState({ record: null, running: false });
      disk.set('guest', JSON.stringify({ v: 9, id: 'profile:old00001' }));
      disk.set('progress:profile:old00001', '{}');
      setup();
      await useGuestStore.getState().startGuestRun('site', T0);
      expect(disk.has('progress:profile:old00001')).toBe(true);
    }
  });

  it('a start over a damaged record writes a new one', async () => {
    disk.set('guest', JSON.stringify({ v: 2, id: 'profile:guest001' }));
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    expect(started!.resumed).toBe(false);
    expect(stored()).toEqual(started!.record);
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState().record).toEqual(started!.record);
  });
});

describe('the boot\'s repair and sweep tell the other tabs (section 6.4)', () => {
  it('a sweep or a repair posts hr-profiles changed, and a second tab\'s run of that record ends on its refresh', async () => {
    // This tab is the second one: its run is of the record the boot in the first tab finds.
    await useGuestStore.getState().startGuestRun('site', T0);
    const live = useGuestStore.getState().record!;
    const runningTab = useGuestStore.getState();
    channel.posts = 0;

    // The first tab's boot, 40 days later: the never-saved record is swept.
    useGuestStore.setState({ record: null, running: false, hydrated: false });
    expect(await hydrateGuest(T0 + 40 * 24 * 60 * 60 * 1000)).toBe('sweep');
    expect(channel.posts).toBe(1);
    expect(stored()).toBeNull();

    // Back in the second tab: the post reads hr:guest again, and the run ends.
    useGuestStore.setState({ record: live, running: runningTab.running, hydrated: true, memoryOnly: false });
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false });

    // A repair posts too.
    disk.set('guest', JSON.stringify(record()));
    useProfileStore.setState({ profiles: [{ ...mina, id: 'profile:guest001' }] });
    channel.posts = 0;
    expect(await hydrateGuest(T0)).toBe('repair');
    expect(channel.posts).toBe(1);
  });
});

describe('recordGuestPlay (GU-D12) and the end of a run', () => {
  it('moves lastAt and latches questDone, under the lock; nothing without a live record', async () => {
    await useGuestStore.getState().recordGuestPlay({ questDone: true }, T0);
    expect(stored()).toBeNull();
    await useGuestStore.getState().startGuestRun('site', T0);
    locked.length = 0;
    channel.posts = 0;
    await useGuestStore.getState().recordGuestPlay({ questDone: true }, T0 + 1000);
    expect(stored()).toMatchObject({ questDone: true, lastAt: iso(T0 + 1000) });
    expect(locked).toEqual(['hr:profiles']);
    expect(channel.posts).toBe(1);
    await useGuestStore.getState().recordGuestPlay(undefined, T0 + 2000);
    expect(stored()).toMatchObject({ questDone: true, lastAt: iso(T0 + 2000) });
  });

  it('endGuestRun keeps the record; liveGuestId and isLiveGuestId name it until it is saved', async () => {
    useGuestStore.getState().endGuestRun();
    expect(useGuestStore.getState().running).toBe(false);
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    useGuestStore.getState().endGuestRun();
    expect(useGuestStore.getState().record).toEqual(started!.record);
    expect(liveGuestId()).toBe(started!.record.id);
    expect(isLiveGuestId(started!.record.id)).toBe(true);
    expect(isLiveGuestId(mina.id)).toBe(false);
    useProfileStore.setState({ profiles: [{ ...mina, id: started!.record.id }] });
    expect(liveGuestId()).toBeNull();
  });

  it('forgetSavedGuest deletes hr:guest of that id only, ends the run and posts changed', async () => {
    const started = await useGuestStore.getState().startGuestRun('site', T0);
    channel.posts = 0;
    await useGuestStore.getState().forgetSavedGuest('profile:another1');
    expect(stored()).toEqual(started!.record);
    expect(useGuestStore.getState().running).toBe(true);
    await useGuestStore.getState().forgetSavedGuest(started!.record.id);
    expect(stored()).toBeNull();
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false });
    expect(channel.posts).toBe(2);
    // Nothing stored any more: nothing to delete, nothing breaks.
    await useGuestStore.getState().forgetSavedGuest(started!.record.id);
  });
});

describe('activeLearnerIdSelector (5.3)', () => {
  it('the guest id while running, else the active profile; a run with no record is no learner', () => {
    expect(activeLearnerIdSelector({ record: record(), running: true }, { activeId: mina.id })).toBe('profile:guest001');
    expect(activeLearnerIdSelector({ record: record(), running: false }, { activeId: mina.id })).toBe(mina.id);
    expect(activeLearnerIdSelector({ record: null, running: true }, { activeId: mina.id })).toBeNull();
    expect(activeLearnerIdSelector({ record: null, running: false }, { activeId: null })).toBeNull();
  });
});

describe('the stores\' gates read the live guest (GU-D14)', () => {
  const sam: Profile = { ...mina, id: 'profile:sam00001', learnerType: 'self' };

  it('a self-only device without a PIN: the grown-up gate asks while the guest lives and opens directly after the sweep', () => {
    useProfileStore.setState({ profiles: [sam], activeId: sam.id });
    useAccountStore.setState({ parentPinHash: null });
    useGuestStore.setState({ record: record() });
    expect(gateOpensDirectlyNow(T0)).toBe(false);
    expect(whoMarker()).toBe('nopin');
    expect(deviceShared()).toBe(true);
    useGuestStore.setState({ record: null });
    expect(gateOpensDirectlyNow(T0)).toBe(true);
    expect(whoMarker()).toBe('none');
    expect(deviceShared()).toBe(false);
  });
});
