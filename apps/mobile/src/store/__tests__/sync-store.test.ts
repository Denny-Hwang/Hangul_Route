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
import { onSynced, setSyncApiForTests, useSyncStore } from '../sync-store';

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

function fakeApi(over: Partial<{ register: unknown; putSnapshot: unknown; issueRescueCode: unknown; claimRescueCode: unknown }> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: 'profile:a', secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    getSnapshot: vi.fn(),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
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

describe('synced listeners (F-PLAN-001 §3.3)', () => {
  it('fires after a successful sync and stops after unsubscribe', async () => {
    setSyncApiForTests(fakeApi() as never);
    const seen: string[] = [];
    const off = onSynced((id) => seen.push(id));
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    off();
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    setSyncApiForTests(fakeApi({ putSnapshot: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    const late = onSynced((id) => seen.push(`late:${id}`));
    await useSyncStore.getState().syncNow('profile:a');
    expect(seen).toEqual(['profile:a']);
    late();
  });
});

describe('rescue code lifecycle (F-RESTORE-001)', () => {
  beforeEach(() => {
    mem.clear();
    useSyncStore.setState({ byLearner: {} });
    useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
    useProgressStore.setState({ byProfile: { 'profile:a': snap(['q1']) }, hydratedFor: new Set(['profile:a']) });
    vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
  });

  it('issues a rescue code after the first successful sync and keeps it locally', async () => {
    const api = { ...fakeApi(), issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })), claimRescueCode: vi.fn() };
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow('profile:a');
    expect(state.rescueCode).toBe('TIGER-MOON-4821');
    expect(api.issueRescueCode).toHaveBeenCalledWith('profile:a', { deviceId: 'device-test', secret: 'sec' });
    expect((mem.get('sync:profile:a') as { rescueCode: string }).rescueCode).toBe('TIGER-MOON-4821');
    // a second sync does not re-issue
    await useSyncStore.getState().syncNow('profile:a');
    expect(api.issueRescueCode).toHaveBeenCalledTimes(1);
    // explicit rotation does
    const rotated = { ...api, issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'OTTER-RAIN-0001' })) };
    setSyncApiForTests(rotated as never);
    expect(await useSyncStore.getState().issueRescueCode('profile:a')).toBe('OTTER-RAIN-0001');
  });

  it('claim adopts a learner that is new to this device and seeds its credentials', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
    const api = {
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({
        status: 'ok',
        learner: { id: 'profile:z', displayName: 'Zed', ageGroup: '8-9', avatar: 'hoya-blue' },
        secret: 'zs',
        snapshot: { rev: 4, snapshot: { ...snap(['q7']), profileId: 'profile:z' }, summary: null },
      })),
    };
    setSyncApiForTests(api as never);
    const result = await useSyncStore.getState().claimRescueCode('tiger moon 4821');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.action).toBe('create');
      expect(result.plan.added.quests).toBe(1);
    }
    expect(api.claimRescueCode).toHaveBeenCalledWith('tiger moon 4821', 'device-test');
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual(['profile:z']);
    expect(useProgressStore.getState().byProfile['profile:z']?.quests[0]?.questId).toBe('q7');
    expect(useSyncStore.getState().byLearner['profile:z']).toMatchObject({ secret: 'zs', rev: 4, rescueCode: 'TIGER-MOON-4821' });
    // The next sync must not rotate the code the parent wrote down.
    await useSyncStore.getState().syncNow('profile:z');
    expect(api.issueRescueCode).not.toHaveBeenCalled();
    expect(useSyncStore.getState().byLearner['profile:z']?.rescueCode).toBe('TIGER-MOON-4821');
  });

  it('claim merges into an existing local profile and maps errors', async () => {
    const api = {
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({
        status: 'ok',
        learner: { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
        secret: 'as',
        snapshot: { rev: 2, snapshot: snap(['q2']), summary: null },
      })),
    };
    setSyncApiForTests(api as never);
    const result = await useSyncStore.getState().claimRescueCode('TIGER-MOON-4821');
    expect(result.ok && result.plan.action).toBe('merge');
    expect(useProgressStore.getState().byProfile['profile:a']?.quests.map((q) => q.questId)).toEqual(['q1', 'q2']);

    setSyncApiForTests({ ...fakeApi(), claimRescueCode: vi.fn(async () => ({ status: 'error', code: 'code_not_found' })) } as never);
    expect(await useSyncStore.getState().claimRescueCode('X-Y-0000')).toEqual({ ok: false, error: 'code_not_found' });
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    expect(await useSyncStore.getState().claimRescueCode('X-Y-0000')).toEqual({ ok: false, error: 'off' });
  });

  it('claim with no server snapshot keeps or creates a blank local snapshot', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
    setSyncApiForTests({
      ...fakeApi(),
      claimRescueCode: vi.fn(async () => ({ status: 'ok', learner: { id: 'profile:n', displayName: 'New', ageGroup: '5-7', avatar: 'hoya-pink' }, secret: 'ns', snapshot: null })),
    } as never);
    const result = await useSyncStore.getState().claimRescueCode('A-B-0000');
    expect(result.ok && result.plan.action).toBe('create');
    expect(useProgressStore.getState().byProfile['profile:n']?.quests).toEqual([]);
  });
});
