import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The one-time profile repair (hr:profilePushedV1, F-SYNC-001 section 3.7 #10) over the real storage wrapper, with
 * AsyncStorage itself failing: the other sync-store tests replace the wrapper, so a failed device read looks the same
 * as a missing key there.
 */
const disk = vi.hoisted(() => ({ mem: new Map<string, string>(), failing: new Set<string>() }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => {
      if (disk.failing.has(k)) throw new Error('storage unavailable');
      return disk.mem.get(k) ?? null;
    }),
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

/** The inbox cannot be read, so a queued repair stays queued where the test can see it. */
function fakeApi() {
  return {
    register: vi.fn(async (body: { id: string }) => ({ status: 'ok', learnerId: body.id, secret: 'sec-new' })),
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
    vi.mocked(AsyncStorage.getItem).mockClear();
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'Sungjoo'), learner(B, 'Mina'), learner(C, 'Jun')], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A), [B]: snap(B), [C]: snap(C) }, hydratedFor: new Set([A, B, C]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
  });

  it('leaves the marker unset and caches no blank record for a learner whose record cannot be read', async () => {
    registered(A);
    registered(B);
    // The read fails once (the repair's own read); the sync that follows reads the record as usual.
    disk.failing.add(syncKey(B));
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (k: string) => {
      if (disk.failing.delete(k)) throw new Error('storage unavailable');
      return disk.mem.get(k) ?? null;
    });
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();

    expect(disk.mem.has(MARKER)).toBe(false);
    // No blank record was cached for B: its sync found the stored secret and did not register it again.
    expect(useSyncStore.getState().byLearner[B]).toMatchObject({ secret: `sec-${B}` });
    expect(api.register.mock.calls.map(([body]) => body.id)).not.toContain(B);
    // Nothing was queued for B, and nothing past it either.
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
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(true);
  });

  it('a learner with no record at all is skipped and does not hold back the marker', async () => {
    registered(A);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(JSON.parse(disk.mem.get(MARKER) ?? 'null')).toBe(true);
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.repair).toMatchObject({ displayName: 'Sungjoo' });
    // C was not registered: the repair queued nothing for it, and it registers with its current name instead.
    expect(api.updateLearnerProfile).not.toHaveBeenCalledWith(C, expect.anything(), expect.anything(), expect.anything());
    expect(useSyncStore.getState().byLearner[C]?.pendingProfile?.repair).toBeUndefined();
  });
});
