import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON CS-G7 (row GU-2, section 19): sync never sees the guest. The real storage wrapper
 * holds `hr:guest` and the guest's per-profile keys next to a saved learner's; the real sync entry points
 * (`syncAll`, `syncNow`, `requestSync`) run with sync on and a transport that records every call. The learner is
 * synced; no call, and no sync record, carries the guest's id.
 */
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      disk.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...disk.keys()]),
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
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null }));

import type { GuestRecord, ProgressSnapshot } from '@hangul-route/content-schema';
import { useGuestStore } from '../guest-store';
import { hydrateGuest } from '../guest-sweep';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import type { SyncApiClient } from '../../platform/sync-api';
import { setSyncApiForTests, useSyncStore } from '../sync-store';

const NOW = Date.parse('2026-10-22T10:00:00.000Z');
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: new Date(NOW).toISOString(), lastAt: new Date(NOW).toISOString(), via: 'site', questDone: true };
const MINA = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: '2026-10-01T00:00:00.000Z' };
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: '2026-10-22T09:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });

/** Every call the transport is given, by method, with its arguments; each answers as a network failure. */
const calls: { method: string; args: unknown[] }[] = [];
const recordingApi = new Proxy(
  {},
  {
    get: (_target, method) =>
      async (...args: unknown[]) => {
        calls.push({ method: String(method), args });
        return { status: 'error', code: 'network' };
      },
  },
) as unknown as SyncApiClient;

beforeEach(async () => {
  disk.clear();
  calls.length = 0;
  setSyncApiForTests(recordingApi);
  disk.set('hr:profiles', JSON.stringify([MINA]));
  disk.set('hr:profiles:active', JSON.stringify(MINA.id));
  disk.set('hr:guest', JSON.stringify(GUEST));
  disk.set(`hr:progress:${MINA.id}`, JSON.stringify(snap(MINA.id)));
  disk.set(`hr:progress:${GUEST.id}`, JSON.stringify(snap(GUEST.id)));
  useSyncStore.setState({ byLearner: {} });
  useGuestStore.setState({ record: null, running: false, hydrated: false, memoryOnly: false });
  await useProfileStore.getState().hydrate();
  expect(await hydrateGuest(NOW)).toBe('keep');
  await useProgressStore.getState().hydrate(MINA.id);
  await useProgressStore.getState().hydrate(GUEST.id);
});

describe('[GU] sync never sees the guest (CS-G7)', () => {
  it('syncAll, syncNow and requestSync: the learner goes to the transport, the guest id never does', async () => {
    useGuestStore.setState({ running: true });
    await useSyncStore.getState().syncAll();
    useSyncStore.getState().requestSync(GUEST.id);
    await useSyncStore.getState().syncNow(GUEST.id);
    await useSyncStore.getState().syncNow(MINA.id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(calls)).toContain(MINA.id);
    expect(JSON.stringify(calls)).not.toContain(GUEST.id);
    expect(disk.has(`hr:sync:${GUEST.id}`)).toBe(false);
    expect(useSyncStore.getState().byLearner[GUEST.id]).toBeUndefined();
  });
});
