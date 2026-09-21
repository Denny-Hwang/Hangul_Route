import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({
  apiBaseUrl: vi.fn(() => 'https://api.example.com'),
  createSyncApi: vi.fn(),
}));
vi.mock('../../config/flags', () => ({ flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false } }));

import { apiBaseUrl } from '../../platform/sync-api';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore } from '../sync-store';

const snap = (quests: string[]): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: quests.map((questId) => ({ questId, episodeId: 'e', startedAt: 't', completedAt: 't', stars: 2 as const, attempts: 1, accuracy: 0.9 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

function fakeApi(over: Partial<{ register: unknown; putSnapshot: unknown }> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: 'profile:a', secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    getSnapshot: vi.fn(),
    ...over,
  };
}

describe('sync-store (F-SYNC-002)', () => {
  beforeEach(() => {
    mem.clear();
    useSyncStore.setState({ byLearner: {} });
    useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
    useProgressStore.setState({ byProfile: { 'profile:a': snap(['q1']) }, hydratedFor: new Set(['profile:a']) });
    vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
  });

  it('registers on first sync, stores the secret, uploads and records the rev', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile:a', displayName: 'Suni' }), 'device-test');
    expect(api.putSnapshot).toHaveBeenCalledWith('profile:a', expect.objectContaining({ baseRev: 0 }), { deviceId: 'device-test', secret: 'sec' });
    expect(state).toMatchObject({ status: 'synced', rev: 1, secret: 'sec' });
    expect((mem.get('sync:profile:a') as { rev: number }).rev).toBe(1);
  });

  it('applies a merged snapshot back into progress on conflict', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    const api = fakeApi({
      putSnapshot: vi.fn()
        .mockResolvedValueOnce({ status: 'conflict', rev: 7, snapshot: snap(['q2']) })
        .mockResolvedValueOnce({ status: 'ok', rev: 8 }),
    });
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'synced', rev: 8 });
    expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);
    expect(api.register).not.toHaveBeenCalled();
  });

  it('keeps local data and records the error when the transport fails; off when no API', async () => {
    mem.set('sync:profile:a', { secret: 'sec', rev: 3, lastSyncedAt: null });
    setSyncApiForTests(fakeApi({ putSnapshot: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'error', lastError: 'network', rev: 3 });
    expect(useProgressStore.getState().byProfile['profile:a']?.quests).toHaveLength(1);

    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    useSyncStore.setState({ byLearner: {} });
    expect((await useSyncStore.getState().syncNow('profile:a')).status).toBe('off');
  });

  it('a registration conflict marks the learner as registered elsewhere', async () => {
    setSyncApiForTests(fakeApi({ register: vi.fn(async () => ({ status: 'conflict' })) }) as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state).toMatchObject({ status: 'error', lastError: 'registered-elsewhere', secret: null });
  });

  it('syncAll covers every learner and adoptCredentials seeds a learner', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'adopted', 4);
    await useSyncStore.getState().syncAll();
    expect(api.register).not.toHaveBeenCalled();
    expect(api.putSnapshot).toHaveBeenCalledWith('profile:a', expect.objectContaining({ baseRev: 4 }), expect.objectContaining({ secret: 'adopted' }));
  });
});
