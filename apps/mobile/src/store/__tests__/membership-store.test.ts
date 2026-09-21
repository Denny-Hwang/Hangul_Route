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
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: vi.fn(() => 'https://api.example.com'), createSyncApi: vi.fn() }));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('../../config/flags', () => ({ flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false } }));

import { apiBaseUrl } from '../../platform/sync-api';
import { track } from '../../platform/telemetry';
import { useMembershipStore } from '../membership-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore } from '../sync-store';

const snap: ProgressSnapshot = { profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
const classRow = { spaceId: 'space:cls', kind: 'class' as const, name: 'Sunday Class A', role: 'student' as const, joinedAt: 't' };
const familyRow = { spaceId: 'space:fam', kind: 'family' as const, name: 'Kim family', role: 'student' as const, joinedAt: 't' };

function fakeApi(over: Record<string, unknown> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: 'profile:a', secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    getSnapshot: vi.fn(),
    lookupSpace: vi.fn(async () => ({ status: 'ok', space: { id: 'space:cls', kind: 'class', name: 'Sunday Class A' }, full: false })),
    joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: classRow })),
    leaveSpace: vi.fn(async () => ({ status: 'ok', left: true })),
    getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 1, plans: [], memberships: [familyRow, classRow], tier: 'free', serverTime: 't' } })),
    ...over,
  };
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useMembershipStore.setState({ byLearner: {} });
  useSyncStore.setState({ byLearner: {} });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: { 'profile:a': snap }, hydratedFor: new Set(['profile:a']) });
  vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
});

describe('membership-store (F-SPACE-001 §3.5)', () => {
  it('hydrates from the cache and refreshes from the inbox once the learner has credentials', async () => {
    mem.set('memberships:profile:a', [classRow]);
    expect(await useMembershipStore.getState().hydrate('profile:a')).toEqual([classRow]);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    // never synced → no secret → nothing to refresh with
    expect(await useMembershipStore.getState().refresh('profile:a')).toBeNull();
    expect(api.getInbox).not.toHaveBeenCalled();
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const rows = await useMembershipStore.getState().refresh('profile:a');
    expect(rows?.map((r) => r.name)).toEqual(['Kim family', 'Sunday Class A']); // sorted by name
    expect(api.getInbox).toHaveBeenCalledWith('profile:a', { deviceId: 'device-test', secret: 'sec' });
    expect(mem.get('memberships:profile:a')).toEqual(rows);
    setSyncApiForTests(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    expect(await useMembershipStore.getState().refresh('profile:a')).toBeNull();
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual(rows); // last known rows stay
  });

  it('looks up a code and maps errors, including no API', async () => {
    setSyncApiForTests(fakeApi() as never);
    expect(await useMembershipStore.getState().lookup('K7M2X9')).toEqual({ ok: true, space: { id: 'space:cls', kind: 'class', name: 'Sunday Class A' }, full: false });
    setSyncApiForTests(fakeApi({ lookupSpace: vi.fn(async () => ({ status: 'error', code: 'code_expired' })) }) as never);
    expect(await useMembershipStore.getState().lookup('K7M2X9')).toEqual({ ok: false, error: 'code_expired' });
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    expect(await useMembershipStore.getState().lookup('K7M2X9')).toEqual({ ok: false, error: 'off' });
    expect(await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9')).toEqual({ ok: false, error: 'off' });
    expect(await useMembershipStore.getState().leave('profile:a', 'space:cls')).toBe(false);
  });

  it('registers a never-synced learner first, then joins and caches the membership', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    const result = await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Suni K');
    expect(api.register).toHaveBeenCalledTimes(1);
    expect(api.joinSpace).toHaveBeenCalledWith('space:cls', { code: 'K7M2X9', learnerId: 'profile:a', displayName: 'Suni K' }, { deviceId: 'device-test', secret: 'sec' });
    expect(result).toEqual({ ok: true, alreadyMember: false, membership: classRow });
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual([classRow]);
    expect(mem.get('memberships:profile:a')).toEqual([classRow]);
    expect(vi.mocked(track).mock.calls.map((c) => c[0].name)).toEqual(['space.join.attempted', 'space.join.succeeded']);
    // joining the same space again replaces rather than duplicates
    await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9');
    expect(useMembershipStore.getState().byLearner['profile:a']).toHaveLength(1);
  });

  it('reports join failures without touching the cache', async () => {
    mem.set('memberships:profile:a', [familyRow]);
    setSyncApiForTests(fakeApi({ register: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    expect(await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9')).toEqual({ ok: false, error: 'network' });
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi({ joinSpace: vi.fn(async () => ({ status: 'error', code: 'cap_class' })) }) as never);
    expect(await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9')).toEqual({ ok: false, error: 'cap_class' });
    expect(await useMembershipStore.getState().hydrate('profile:a')).toEqual([familyRow]);
    expect(vi.mocked(track).mock.calls.filter((c) => c[0].name === 'space.join.failed')).toHaveLength(2);
  });

  it('leaves a space and forgets it locally', async () => {
    mem.set('memberships:profile:a', [familyRow, classRow]);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    expect(await useMembershipStore.getState().leave('profile:a', 'space:cls')).toBe(true);
    expect(api.leaveSpace).toHaveBeenCalledWith('space:cls', 'profile:a', { deviceId: 'device-test', secret: 'sec' });
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual([familyRow]);
    setSyncApiForTests(fakeApi({ leaveSpace: vi.fn(async () => ({ status: 'error', code: 'http_500' })) }) as never);
    expect(await useMembershipStore.getState().leave('profile:a', 'space:fam')).toBe(false);
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual([familyRow]);
  });
});
