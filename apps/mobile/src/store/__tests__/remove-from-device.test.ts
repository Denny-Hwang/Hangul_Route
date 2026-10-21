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

import { listKeys } from '../../platform/storage';
import { PER_PROFILE_KEYS } from '../profile-keys';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { removeFromDevice, savedNow, syncThenCheck } from '../remove-from-device';
import { useSyncStore, type LearnerSyncState } from '../sync-store';
import { useUiStore } from '../ui-store';

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
const syncActions = { hydrate: useSyncStore.getState().hydrate, syncNow: useSyncStore.getState().syncNow };

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
  JSON.stringify({ secret: 'device-secret', rev: 1, lastSyncedAt: LATER, rescueCode: null, pendingProfile: null, profileAt: null, ...patch });
const progress = (id: string, updatedAt: string): string =>
  JSON.stringify({ profileId: id, quests: [], cards: [], sessions: [], homework: [], reviews: [], placements: [], updatedAt });

describe('[OA] the saved check (10.4: registered and nothing pending)', () => {
  it('registered, nothing queued and the last push after the last write: saved', async () => {
    const { jun } = learners();
    disk.set(`sync:${jun}`, syncRecord({}));
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    expect(await savedNow(jun)).toBe(true);
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
    expect(await syncThenCheck(jun)).toBe(true);
    expect(syncNow).toHaveBeenCalledWith(jun);
  });

  it('a sync that fails (offline, or sync off in this build) leaves the learner unsaved', async () => {
    const { jun } = learners();
    disk.set(`progress:${jun}`, progress(jun, '2026-10-21T09:00:00.000Z'));
    expect(await syncThenCheck(jun)).toBe(false);
    useSyncStore.setState({ syncNow: () => Promise.reject(new Error('offline')) });
    expect(await syncThenCheck(jun)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('[OA] removeFromDevice (OA-D13, CS-12)', () => {
  it('checking and unsaved never remove: the unsaved sheet needs its second step', async () => {
    const { jun } = learners();
    expect(removeFromDevice(jun, 'checking')).toBeNull();
    expect(removeFromDevice(jun, 'unsaved')).toBeNull();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toContain(jun);
    expect(sent).toEqual([]);
  });

  it('a non-active learner: removed, the app stays, profile.removed without a profile id', async () => {
    const { mina, jun } = learners();
    expect(removeFromDevice(jun, 'saved')).toBe('stay');
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([mina]);
    expect(useProfileStore.getState().activeId).toBe(mina);
    expect(sent).toEqual([{ name: 'profile.removed', payload: { saved: true, wasActive: false, anyway: false } }]);
    expect(removeFromDevice(jun, 'saved')).toBeNull();
  });

  it('the active learner: the chooser opens and the grown-up session ends (OA-D5b)', async () => {
    const { mina } = learners();
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    expect(removeFromDevice(mina, 'anyway')).toBe('chooser');
    expect(sent.at(-1)).toEqual({ name: 'profile.removed', payload: { saved: false, wasActive: true, anyway: true } });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
  });

  it('the last learner: Welcome', async () => {
    const { mina, jun } = learners();
    removeFromDevice(jun, 'saved');
    expect(removeFromDevice(mina, 'saved')).toBe('welcome');
    expect(useProfileStore.getState().profiles).toEqual([]);
  });

  it('the lock entry goes and a tombstone is written in the same write sequence', async () => {
    const { mina, jun } = learners();
    disk.set('profiles:locks', JSON.stringify({ v: 1, ids: [mina, jun] }));
    removeFromDevice(jun, 'saved');
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

    removeFromDevice(jun, 'anyway');
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
    removeFromDevice(jun, 'anyway');
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
    removeFromDevice(jun, 'anyway');
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
