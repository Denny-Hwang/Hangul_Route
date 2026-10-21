import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The one-time profile repair (hr:profilePushedV1, F-SYNC-001 section 3.7 #10) over the real storage wrapper, with
 * AsyncStorage itself failing: the other sync-store tests replace the wrapper, so a failed device read looks the same
 * as a missing key there. A key in `disk.failing` fails every read until it is removed (writes still land).
 */
const disk = vi.hoisted(() => ({ mem: new Map<string, string>(), failing: new Set<string>() }));
const readItem = vi.hoisted(() => async (k: string) => {
  if (disk.failing.has(k)) throw new Error('storage unavailable');
  return disk.mem.get(k) ?? null;
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(readItem),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.mem.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      disk.mem.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...disk.mem.keys()]),
  },
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({
  apiBaseUrl: vi.fn(() => 'https://api.example.com'),
  createSyncApi: vi.fn(),
}));
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { usePlanStore } from '../plan-store';
import { PROFILE_PUSH_REPAIR_KEY, setSyncApiForTests, useSyncStore } from '../sync-store';

const A = 'profile:a';
const B = 'profile:b';
const C = 'profile:c';
const MARKER = `hr:${PROFILE_PUSH_REPAIR_KEY}`;
const syncKey = (id: string) => `hr:sync:${id}`;
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });
const learner = (id: string, displayName: string) => ({ id, displayName, ageGroup: '5-7' as const, avatar: 'hoya-orange' as const, role: 'learner' as const, createdAt: 't' });
const registered = (id: string) => disk.mem.set(syncKey(id), JSON.stringify({ secret: `sec-${id}`, rev: 1, lastSyncedAt: 't', rescueCode: 'TIGER-MOON-4821' }));
const stored = (id: string) => JSON.parse(disk.mem.get(syncKey(id)) ?? 'null') as { secret: string | null } | null;

/**
 * The inbox cannot be read, so a queued repair stays queued where the test can see it. A registration answers
 * `conflict` (the learner is already registered on the server), the answer that once saved a blank record over the
 * stored one.
 */
function fakeApi() {
  return {
    register: vi.fn(async (_body: { id: string }) => ({ status: 'conflict' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 2 })),
    getSnapshot: vi.fn(),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })),
    updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: true })),
  };
}

/** Drop the in-memory sync records: the next read comes from storage, as after an app restart. */
const restart = () => useSyncStore.setState({ byLearner: {} });

describe('the profile-push repair while a sync record cannot be read (F-SYNC-001 section 3.7 #10)', () => {
  beforeEach(() => {
    disk.mem.clear();
    disk.failing.clear();
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.getItem).mockImplementation(readItem);
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'Sungjoo'), learner(B, 'Mina'), learner(C, 'Jun')], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A), [B]: snap(B), [C]: snap(C) }, hydratedFor: new Set([A, B, C]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
  });

  it('a read that fails for the whole session: no marker, nothing queued, no registration and the stored record kept', async () => {
    registered(A);
    registered(B);
    registered(C);
    disk.failing.add(syncKey(B));
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();

    expect(disk.mem.has(MARKER)).toBe(false);
    // Every record is read before anything is queued: neither the learner before B nor the one after it is queued.
    for (const id of [A, C]) expect(useSyncStore.getState().byLearner[id]?.pendingProfile ?? null).toBeNull();
    // Nothing is cached for B, B is not registered again, and its stored secret is untouched.
    expect(useSyncStore.getState().byLearner[B]).toBeUndefined();
    expect(api.register).not.toHaveBeenCalled();
    expect(stored(B)).toMatchObject({ secret: `sec-${B}`, rescueCode: 'TIGER-MOON-4821' });
    // A later hydrate while storage still fails caches nothing either.
    expect(await useSyncStore.getState().hydrate(B)).toMatchObject({ secret: null, status: 'error' });
    expect(useSyncStore.getState().byLearner[B]).toBeUndefined();
  });

  it('a read that fails once (the repair read): the sync that follows still finds the stored secret', async () => {
    registered(A);
    registered(B);
    // Only B's first read fails (the repair's own read); every later read of it succeeds.
    let failed = false;
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (k: string) => {
      if (k === syncKey(B) && !failed) {
        failed = true;
        throw new Error('storage unavailable');
      }
      return readItem(k);
    });
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();

    expect(failed).toBe(true);
    expect(disk.mem.has(MARKER)).toBe(false);
    expect(useSyncStore.getState().byLearner[B]).toMatchObject({ secret: `sec-${B}` });
    expect(api.register.mock.calls.map(([body]) => body.id)).not.toContain(B);
    expect(useSyncStore.getState().byLearner[B]?.pendingProfile ?? null).toBeNull();
  });

  it('runs again once storage recovers: queues the learner it skipped, then writes the marker', async () => {
    registered(A);
    registered(B);
    disk.failing.add(syncKey(B));
    setSyncApiForTests(fakeApi() as never);
    await useSyncStore.getState().syncAll();
    expect(disk.mem.has(MARKER)).toBe(false);

    // The next start: storage reads again.
    disk.failing.clear();
    restart();
    await useSyncStore.getState().syncAll();
    expect(useSyncStore.getState().byLearner[B]?.pendingProfile?.repair).toMatchObject({ displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' });
    expect(stored(B)).toMatchObject({ secret: `sec-${B}` });
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(true);
  });

  it('an edit made while the record cannot be read saves nothing over it and has the next start repair the values', async () => {
    registered(B);
    disk.mem.set(MARKER, 'true');
    disk.failing.add(syncKey(B));
    setSyncApiForTests(fakeApi() as never);
    await useSyncStore.getState().markProfileDirty(B, { displayName: 'Mina Kim' });

    expect(useSyncStore.getState().byLearner[B]).toBeUndefined();
    expect(stored(B)).toMatchObject({ secret: `sec-${B}` });
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(false);

    // The next start: storage reads again, and the repair queues the profile's current values.
    disk.failing.clear();
    restart();
    useProfileStore.setState({ profiles: [learner(B, 'Mina Kim')], activeId: B, hydrated: true });
    await useSyncStore.getState().syncAll();
    expect(useSyncStore.getState().byLearner[B]?.pendingProfile?.repair).toMatchObject({ displayName: 'Mina Kim' });
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(true);
  });

  it('a learner with no record at all is skipped and does not hold back the marker', async () => {
    registered(A);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(true);
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.repair).toMatchObject({ displayName: 'Sungjoo' });
    // B and C were not registered: the repair queued nothing for them, and they register with their current names instead.
    expect(api.updateLearnerProfile).not.toHaveBeenCalledWith(C, expect.anything(), expect.anything(), expect.anything());
    expect(useSyncStore.getState().byLearner[C]?.pendingProfile?.repair).toBeUndefined();
  });
});
