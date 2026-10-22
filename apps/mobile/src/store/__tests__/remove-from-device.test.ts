import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] Remove from this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, section 10.4, row OA-7a; section 20; CS-12,
 * CS-20): the saved check, sync first, the removal with its lock entry and tombstone, `profile.removed`, and the key
 * sweep: every store seeded for one learner, the learner removed, and no stored key containing its id left anywhere
 * in the storage namespace (so a store that forgets to subscribe to `onProfileRemoved` fails here). Storage is an
 * in-memory map; nothing may reach the network.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => parse(key)),
  readJsonStrict: vi.fn(async (key: string) => parse(key)),
  readJsonExact: vi.fn(async (key: string) => parse(key)),
  readJsonExactFresh: vi.fn(async (key: string) => parse(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  updateJson: vi.fn(async (key: string, next: (current: unknown) => unknown) => {
    const value = next(parse(key));
    if (value === undefined) return false;
    disk.set(key, JSON.stringify(value));
    return true;
  }),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
  setWriteFence: vi.fn(),
  requestPersistence: vi.fn(async () => false),
}));
const sent = vi.hoisted(() => [] as { name: string; payload?: unknown; profileId?: string }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    sent.push(event);
    return true;
  }),
}));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null }));

import { listKeys, removeKey } from '../../platform/storage';
import { onProfileRemoved } from '../profile-removal';
import { PER_PROFILE_KEYS } from '../profile-keys';
import { onActiveRemovedElsewhere, useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { removalCheck, removeFromDevice, savedNow, syncThenCheck } from '../remove-from-device';
import { useSyncStore, type LearnerSyncState } from '../sync-store';
import { useUiStore } from '../ui-store';
import { bindRemovedElsewhere } from '../who-chooser';
import { useGuestStore } from '../guest-store';
import { hydrateGuest } from '../guest-sweep';

const fetchSpy = vi.fn(async () => {
  throw new Error('no network in this test');
});

const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function learners(): { mina: string; jun: string } {
  const mina = useProfileStore.getState().createProfile(input).id;
  const jun = useProfileStore.getState().createProfile({ ...input, displayName: 'Jun' }).id;
  useProfileStore.getState().setActive(mina);
  return { mina, jun };
}

/** Every per-profile key of `id` written, as the stores would hold them. */
function seedAll(id: string): void {
  for (const template of Object.values(PER_PROFILE_KEYS)) disk.set(template(id), JSON.stringify({ seeded: true }));
  disk.set(PER_PROFILE_KEYS.sync!(id), JSON.stringify({ secret: 'device-secret', rev: 3, lastSyncedAt: '2026-10-21T10:00:00.000Z', rescueCode: 'TIGER-MOON-RIVER', pendingProfile: { fields: { displayName: 'Jun' }, at: '2026-10-21T10:00:00.000Z' }, profileAt: null }));
}

/** The sync store's own actions, put back before each test (some tests stand in for `hydrate` or `syncNow`). */
const syncActions = {
  hydrate: useSyncStore.getState().hydrate,
  syncNow: useSyncStore.getState().syncNow,
  syncBusy: useSyncStore.getState().syncBusy,
  issueRescueCode: useSyncStore.getState().issueRescueCode,
};

beforeEach(async () => {
  useSyncStore.setState(syncActions);
  disk.clear();
  sent.length = 0;
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
  useSyncStore.setState({ byLearner: {} });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  await settle();
});

/** A push acknowledged after every write of the test (a hydrate may stamp the welcome card's write now). */
const LATER = '2099-01-01T00:00:00.000Z';
const syncRecord = (patch: Partial<LearnerSyncState>): string =>
  JSON.stringify({ secret: 'device-secret', rev: 1, lastSyncedAt: LATER, rescueCode: 'TIGER-MOON-RIVER', pendingProfile: null, profileAt: null, ...patch });
const progress = (id: string, updatedAt: string): string =>
  JSON.stringify({ profileId: id, quests: [], cards: [], sessions: [], homework: [], reviews: [], placements: [], updatedAt });

describe('[OA] the saved check (10.4: registered and nothing pending)', () => {
  it('registered, nothing queued and the last push after the last write: saved', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({}));
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    expect(await savedNow(jun)).toBe(true);
    expect(await removalCheck(jun)).toEqual({ saved: true, rescueCode: 'TIGER-MOON-RIVER' });
  });

  it('saved on the server but no Rescue Code on this device: not saved for the one-step Remove (the code is shown first)', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({ rescueCode: null }));
    expect(await removalCheck(jun)).toEqual({ saved: false, rescueCode: null });
  });

  it('a push running, due to run again or queued: not saved (a write may not be on the server yet)', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({}));
    const busy = vi.fn(() => true);
    useSyncStore.setState({ syncBusy: busy });
    expect(await savedNow(jun)).toBe(false);
    expect(busy).toHaveBeenCalledWith(jun);
  });

  it('a queued edit, a write after the push, or no registration: not saved', async () => {
    const { mina, jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({ pendingProfile: { fields: { avatar: 'hoya-green' }, at: '2026-10-21T10:00:00.000Z' } }));
    expect(await savedNow(jun)).toBe(false);
    disk.set(`sync:${mina}`, syncRecord({ lastSyncedAt: '2026-10-21T10:00:00.000Z' }));
    disk.set(`progress:${mina}`, progress(mina, '2026-10-21T11:00:00.000Z'));
    expect(await savedNow(mina)).toBe(false);
    expect(await savedNow('profile:nobody0')).toBe(false);
  });

  it('a record storage cannot read is not saved', async () => {
    const { jun } = learners();
    useSyncStore.setState({ hydrate: () => Promise.reject(new Error('read failed')) });
    expect(await savedNow(jun)).toBe(false);
  });
});

describe('[OA] sync first (10.4: a pending queue tries syncNow)', () => {
  it('runs syncNow for the learner, then checks again: saved once the push landed', async () => {
    const { jun } = learners();
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    const syncNow = vi.fn(async (id: string): Promise<LearnerSyncState> => {
      disk.set(`sync:${id}`, syncRecord({}));
      useSyncStore.setState({ byLearner: {} });
      return { learnerId: id, secret: 'device-secret', rev: 1, lastSyncedAt: '2026-10-21T10:00:00.000Z', lastError: null, status: 'synced', rescueCode: null, pendingProfile: null, profileAt: null };
    });
    useSyncStore.setState({ syncNow });
    expect(await syncThenCheck(jun)).toEqual({ saved: true, rescueCode: 'TIGER-MOON-RIVER' });
    expect(syncNow).toHaveBeenCalledWith(jun);
  });

  it('a learner the check registers without a code: the code is asked for, and the check answers it to show', async () => {
    const { jun } = learners();
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    useSyncStore.setState({
      syncNow: vi.fn(async (id: string) => {
        disk.set(`sync:${id}`, syncRecord({ rescueCode: null }));
        return JSON.parse(syncRecord({ rescueCode: null })) as LearnerSyncState;
      }),
      issueRescueCode: vi.fn(async (id: string) => {
        disk.set(`sync:${id}`, syncRecord({ rescueCode: 'NEW-CODE-ONE-TWO 123456' }));
        useSyncStore.setState({ byLearner: {} });
        return 'NEW-CODE-ONE-TWO 123456';
      }),
    });
    expect(await syncThenCheck(jun)).toEqual({ saved: true, rescueCode: 'NEW-CODE-ONE-TWO 123456' });
  });

  it('no answer within the time limit: unsaved (the safe side), the sheet does not wait on a slow network', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({}));
    useSyncStore.setState({ syncNow: vi.fn(() => new Promise<LearnerSyncState>(() => undefined)) });
    expect(await syncThenCheck(jun, 20)).toEqual({ saved: false, rescueCode: null });
  });

  it('a sync that fails (offline, or sync off in this build) leaves the learner unsaved', async () => {
    const { jun } = learners();
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    expect((await syncThenCheck(jun)).saved).toBe(false);
    useSyncStore.setState({ syncNow: () => Promise.reject(new Error('offline')) });
    expect((await syncThenCheck(jun)).saved).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('[OA] removeFromDevice (OA-D13, CS-12)', () => {
  it('checking and unsaved never remove: the unsaved sheet needs its second step', async () => {
    const { jun } = learners();
    expect(await removeFromDevice(jun, 'checking')).toBeNull();
    expect(await removeFromDevice(jun, 'unsaved')).toBeNull();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toContain(jun);
    expect(sent).toEqual([]);
  });

  it('a non-active learner: removed, the app stays, profile.removed without a profile id', async () => {
    const { mina, jun } = learners();
    expect(await removeFromDevice(jun, 'saved')).toBe('stay');
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([mina]);
    expect(useProfileStore.getState().activeId).toBe(mina);
    expect(sent).toEqual([{ name: 'profile.removed', payload: { saved: true, wasActive: false, anyway: false } }]);
    expect(await removeFromDevice(jun, 'saved')).toBeNull();
  });

  it('the active learner: the chooser opens and the grown-up session ends (OA-D5b)', async () => {
    const { mina } = learners();
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    expect(await removeFromDevice(mina, 'anyway')).toBe('chooser');
    expect(sent.at(-1)).toEqual({ name: 'profile.removed', payload: { saved: false, wasActive: true, anyway: true } });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
  });

  it('the last learner: Welcome', async () => {
    const { mina, jun } = learners();
    await removeFromDevice(jun, 'saved');
    expect(await removeFromDevice(mina, 'saved')).toBe('welcome');
    expect(useProfileStore.getState().profiles).toEqual([]);
  });

  it('the lock entry goes and a tombstone is written in the same write sequence', async () => {
    const { mina, jun } = learners();
    disk.set('profiles:locks', JSON.stringify({ v: 1, ids: [mina, jun] }));
    await removeFromDevice(jun, 'saved');
    await settle();
    expect(parse('profiles:locks')).toEqual({ v: 1, ids: [mina] });
    expect((parse('profiles:tombstones') as { ids: string[] }).ids).toEqual([jun]);
    expect((parse('profiles') as { id: string }[]).map((p) => p.id)).toEqual([mina]);
  });
});

describe('[OA] the key sweep (CS-20)', () => {
  it('every store seeded for one learner: after the removal no stored key contains its id; the other learner keeps every key', async () => {
    const { mina, jun } = learners();
    seedAll(jun);
    seedAll(mina);
    // The stores hold the learner in memory too, as after a session.
    await useSyncStore.getState().hydrate(jun);
    await useProgressStore.getState().hydrate(jun);
    useSyncStore.getState().requestSync(jun);

    await removeFromDevice(jun, 'anyway');
    await settle();

    const keys = await listKeys();
    expect(keys.filter((k) => k.includes(jun))).toEqual([]);
    for (const template of Object.values(PER_PROFILE_KEYS)) expect(keys, template(mina)).toContain(template(mina));
    // The device secret and the Rescue Code of that learner are gone from memory too.
    expect(useSyncStore.getState().byLearner[jun]).toBeUndefined();
    expect(useProgressStore.getState().byProfile[jun]).toBeUndefined();
    // No server call (CS-12).
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a sync record written by a run still in flight after the removal is not written back', async () => {
    const { jun } = learners();
    seedAll(jun);
    await useSyncStore.getState().hydrate(jun);
    await removeFromDevice(jun, 'anyway');
    // A run that started before the removal and lands now (here: its credential write).
    useSyncStore.getState().markProfileDirty(jun, { displayName: 'Jun' }).catch(() => undefined);
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
    // A restore through the Rescue Code adopts the learner again and its record is written.
    useSyncStore.getState().adoptCredentials(jun, 'new-secret', 0);
    await settle();
    expect(parse(`sync:${jun}`)).toMatchObject({ secret: 'new-secret' });
  });

  it('a progress write still in flight for a removed learner is not written back; a restored profile saves again', async () => {
    const { jun } = learners();
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    await removeFromDevice(jun, 'anyway');
    await settle();
    useProgressStore.getState().replaceSnapshot(jun, JSON.parse(progress(jun, '2026-10-21T12:00:00.000Z')));
    await settle();
    expect(disk.has(`progress:${jun}`)).toBe(false);
    useProfileStore.getState().adoptProfile({ id: jun, displayName: 'Jun', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-21T00:00:00.000Z' });
    useProgressStore.getState().replaceSnapshot(jun, JSON.parse(progress(jun, '2026-10-21T12:00:00.000Z')));
    await settle();
    expect(disk.has(`progress:${jun}`)).toBe(true);
  });
});

describe('[OA] every store forgets on its own, and the sweep catches what is left (CS-20, review round 1)', () => {
  it('profile-store.remove alone (no sweep): every per-profile store deleted its own key (a store that forgets to subscribe fails)', async () => {
    const { mina, jun } = learners();
    seedAll(jun);
    useProfileStore.getState().remove(jun);
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([mina]);
  });

  it('a store whose listener throws never keeps the others from forgetting the learner', async () => {
    const { jun } = learners();
    seedAll(jun);
    const off = onProfileRemoved(() => {
      throw new Error('a broken store');
    });
    await expect(removeFromDevice(jun, 'anyway')).resolves.toBe('stay');
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
    off();
  });

  it('a delete that fails once: the sweep after the removal looks again and deletes it', async () => {
    const { jun } = learners();
    seedAll(jun);
    vi.mocked(removeKey).mockImplementationOnce(async () => {
      throw new Error('IndexedDB busy');
    });
    await removeFromDevice(jun, 'anyway');
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
  });

  it('at launch, a key written back for a tombstoned learner (an older bundle) goes; a learner on the list keeps its keys', async () => {
    const { mina, jun } = learners();
    await removeFromDevice(jun, 'anyway');
    await settle();
    seedAll(jun);
    seedAll(mina);
    await useProfileStore.getState().hydrate();
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
    expect(await listKeys()).toContain(`settings:${mina}`);
  });

  it('a learner removed, then restored with its Rescue Code on this device: it stays through a refresh and a launch, and its record is kept', async () => {
    const { mina, jun } = learners();
    const saved = useProfileStore.getState().profiles.find((p) => p.id === jun)!;
    seedAll(jun);
    await removeFromDevice(jun, 'saved');
    await settle();
    useProfileStore.getState().adoptProfile(saved);
    useSyncStore.getState().adoptCredentials(jun, 'new-secret', 2);
    await settle();
    await useProfileStore.getState().refresh();
    await useProfileStore.getState().hydrate();
    await settle();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([mina, jun]);
    expect((parse('profiles') as { id: string }[]).map((p) => p.id)).toEqual([mina, jun]);
    expect(parse(`sync:${jun}`)).toMatchObject({ secret: 'new-secret' });
  });

  it('removed in another tab: this tab forgets the learner too (no sync record written back) and, when it was active here, the chooser is asked for', async () => {
    const { mina, jun } = learners();
    useProfileStore.getState().setActive(jun);
    await settle();
    seedAll(jun);
    await useSyncStore.getState().hydrate(jun);
    const opened = vi.fn();
    const off = onActiveRemovedElsewhere(opened);
    // Another tab removed Jun: its list and tombstone are what this tab reads.
    disk.set('profiles', JSON.stringify((parse('profiles') as { id: string }[]).filter((p) => p.id !== jun)));
    disk.set('profiles:tombstones', JSON.stringify({ v: 1, ids: [jun], at: { [jun]: Date.now() } }));
    await useProfileStore.getState().refresh();
    await settle();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([mina]);
    expect(opened).toHaveBeenCalledWith({ learnersLeft: 1 });
    expect(useSyncStore.getState().byLearner[jun]).toBeUndefined();
    // A queued edit or a sync landing here afterwards writes nothing for Jun.
    await useSyncStore.getState().markProfileDirty(jun, { displayName: 'Jun' }).catch(() => undefined);
    await settle();
    expect((await listKeys()).filter((k) => k.includes(jun))).toEqual([]);
    off();
  });

  it('the learner app opens the chooser alone (trigger manual), or Welcome when no learner is left; nothing with the flag off', async () => {
    const nav = { isReady: () => true, dispatch: vi.fn() };
    let flag = true;
    const off = bindRemovedElsewhere(nav, () => flag);
    const { mina, jun } = learners();
    const removeElsewhere = async (id: string): Promise<void> => {
      const list = (parse('profiles') as { id: string }[]).filter((p) => p.id !== id);
      const tomb = (parse('profiles:tombstones') as { ids: string[]; at: Record<string, number> } | null) ?? { ids: [], at: {} };
      disk.set('profiles', JSON.stringify(list));
      disk.set('profiles:tombstones', JSON.stringify({ v: 1, ids: [...tomb.ids, id], at: { ...tomb.at, [id]: Date.now() } }));
      await useProfileStore.getState().refresh();
      await settle();
    };
    await settle();
    await removeElsewhere(mina);
    expect(nav.dispatch).toHaveBeenLastCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'manual' } }] } });
    await removeElsewhere(jun);
    expect(nav.dispatch).toHaveBeenLastCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Onboarding', params: { screen: 'Welcome' } }] } });
    expect(nav.dispatch).toHaveBeenCalledTimes(2);
    flag = false;
    const kai = useProfileStore.getState().createProfile({ ...input, displayName: 'Kai' }).id;
    await settle();
    await removeElsewhere(kai);
    expect(nav.dispatch).toHaveBeenCalledTimes(2);
    off();
  });

  it('a Rescue Code is never asked for a learner removed from this device (CS-12)', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({ rescueCode: null }));
    await removeFromDevice(jun, 'anyway');
    expect(await useSyncStore.getState().issueRescueCode(jun)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-D13 (row GU-2, section 19): the boot's sweep of a never-saved guest goes through
// the same removal: every per-profile store forgets the id (`notifyProfileRemoved`) and the key sweep deletes what is
// left, so no stored key of the guest's id remains; a learner on the list keeps every key; nothing reaches a server.
describe('[GU] the boot sweep of a never-saved guest (GU-D13), seeded with a guest', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const STARTED = Date.parse('2026-09-01T10:00:00.000Z');
  const guest = { v: 1, id: 'profile:guest001', startedAt: new Date(STARTED).toISOString(), lastAt: new Date(STARTED).toISOString(), via: 'site', questDone: true };

  it('30 days without play on a device with no profile: every key of the guest id goes, guest.expired is sent without an id', async () => {
    seedAll(guest.id);
    disk.set('guest', JSON.stringify(guest));
    // The stores hold the guest in memory too, as after a run.
    await useProgressStore.getState().hydrate(guest.id);
    useGuestStore.setState({ hydrated: false });

    expect(await hydrateGuest(STARTED + 30 * DAY + 1)).toBe('sweep');
    await settle();

    expect((await listKeys()).filter((k) => k.includes(guest.id))).toEqual([]);
    expect(disk.has('guest')).toBe(false);
    expect(useProgressStore.getState().byProfile[guest.id]).toBeUndefined();
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false, hydrated: true });
    expect(sent).toEqual([{ name: 'guest.expired', payload: { questDone: true } }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('7 days on a device with learner profiles; the learners keep every key, and a younger guest is kept', async () => {
    const { mina } = learners();
    seedAll(mina);
    seedAll(guest.id);
    disk.set('guest', JSON.stringify(guest));

    expect(await hydrateGuest(STARTED + 7 * DAY)).toBe('keep');
    expect(useGuestStore.getState().record).toMatchObject({ id: guest.id });
    expect(await hydrateGuest(STARTED + 7 * DAY + 1)).toBe('sweep');
    await settle();

    const keys = await listKeys();
    expect(keys.filter((k) => k.includes(guest.id))).toEqual([]);
    for (const template of Object.values(PER_PROFILE_KEYS)) expect(keys, template(mina)).toContain(template(mina));
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toContain(mina);
  });

  it('a record that has not parsed for 30 days goes with the keys of its id; one with no time goes at once', async () => {
    seedAll(guest.id);
    disk.set('guest', JSON.stringify({ ...guest, v: 3 }));
    expect(await hydrateGuest(STARTED + 30 * DAY + 1)).toBe('sweep');
    await settle();
    expect((await listKeys()).filter((k) => k.includes(guest.id))).toEqual([]);
    expect(sent).toEqual([{ name: 'guest.expired', payload: { questDone: true } }]);

    disk.set('guest', JSON.stringify({ v: 3 }));
    expect(await hydrateGuest(STARTED)).toBe('sweep');
    expect(disk.has('guest')).toBe(false);
  });

  it('a broken record naming a learner on the list never sweeps that learner\'s keys', async () => {
    const { mina } = learners();
    seedAll(mina);
    disk.set('guest', JSON.stringify({ id: mina }));
    expect(await hydrateGuest(STARTED)).toBe('sweep');
    await settle();
    const keys = await listKeys();
    for (const template of Object.values(PER_PROFILE_KEYS)) expect(keys, template(mina)).toContain(template(mina));
    expect(disk.has('guest')).toBe(false);
  });
});
