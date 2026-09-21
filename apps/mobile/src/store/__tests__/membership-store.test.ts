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
import { usePlanStore } from '../plan-store';
import { useTierStore } from '../tier-store';
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
    lookupSpace: vi.fn(async () => ({ status: 'ok', space: { id: 'space:cls', kind: 'class', name: 'Sunday Class A' }, full: false, roster: [{ learnerId: 'profile:m', name: 'Minho' }] })),
    createRelink: vi.fn(async () => ({ status: 'ok', requestId: 'relink:1', expiresAt: 'e' })),
    pollRelink: vi.fn(async () => ({ status: 'ok', state: 'pending', expiresAt: 'e' })),
    joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: classRow })),
    leaveSpace: vi.fn(async () => ({ status: 'ok', left: true })),
    getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 1, plans: [], memberships: [familyRow, classRow], tier: 'premium', tierSource: { kind: 'class', spaceId: 'space:cls', name: 'Sunday Class A' }, tierValidUntil: '2099-01-01T00:00:00.000Z', serverTime: 't' } })),
    ...over,
  };
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useMembershipStore.setState({ byLearner: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {} });
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
    expect(useTierStore.getState().byLearner['profile:a']).toMatchObject({ tier: 'premium', source: { name: 'Sunday Class A' } });
    setSyncApiForTests(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    expect(await useMembershipStore.getState().refresh('profile:a')).toBeNull();
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual(rows); // last known rows stay
  });

  it('applies inbox plans on refresh and asks for a sync when homework changed', async () => {
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const plan = { id: 'plan:w3', spaceId: 'space:cls', spaceKind: 'class', spaceName: 'Sunday Class A', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], publishedAt: 't', updatedAt: 't' };
    const api = fakeApi({ getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 1, plans: [plan], memberships: [classRow], tier: 'free', serverTime: 't' } })) });
    setSyncApiForTests(api as never);
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    await useMembershipStore.getState().refresh('profile:a');
    expect(usePlanStore.getState().byLearner['profile:a']).toEqual([plan]);
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.id)).toEqual(['plan:w3#quest:stage1-letters-q1']);
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockClear();
    await useMembershipStore.getState().refresh('profile:a');
    expect(requestSync).not.toHaveBeenCalled();
    requestSync.mockRestore();
  });

  it('looks up a code and maps errors, including no API', async () => {
    setSyncApiForTests(fakeApi() as never);
    expect(await useMembershipStore.getState().lookup('K7M2X9')).toEqual({ ok: true, space: { id: 'space:cls', kind: 'class', name: 'Sunday Class A' }, full: false, roster: [{ learnerId: 'profile:m', name: 'Minho' }] });
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

describe('re-link on a new device (F-TCH-001 §10.1)', () => {
  it('requests, polls, and adopts the learner on approval', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
    const api = fakeApi({
      pollRelink: vi.fn()
        .mockResolvedValueOnce({ status: 'ok', state: 'pending', expiresAt: 'e' })
        .mockResolvedValueOnce({ status: 'ok', state: 'approved', learner: { id: 'profile:m', displayName: 'Minho', ageGroup: '8-9', avatar: 'hoya-blue' }, secret: 'ms', snapshot: { rev: 3, snapshot: { ...snap, profileId: 'profile:m', cards: [{ cardId: 'card:book', unlockedAt: 't', newSinceLastView: false }] }, summary: null } }),
      getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 3, plans: [], memberships: [classRow], tier: 'free', serverTime: 't' } })),
    });
    setSyncApiForTests(api as never);
    const req = await useMembershipStore.getState().requestRelink('space:cls', 'K7M2X9', 'profile:m');
    expect(req).toEqual({ ok: true, requestId: 'relink:1', expiresAt: 'e' });
    expect(api.createRelink).toHaveBeenCalledWith('space:cls', { code: 'K7M2X9', learnerId: 'profile:m', deviceId: 'device-test' });
    expect(await useMembershipStore.getState().pollRelink('space:cls', 'relink:1')).toEqual({ state: 'pending' });
    const approved = await useMembershipStore.getState().pollRelink('space:cls', 'relink:1');
    expect(approved.state).toBe('approved');
    if (approved.state === 'approved') expect(approved.plan).toMatchObject({ action: 'create', added: { cards: 1 } });
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual(['profile:m']);
    expect(useSyncStore.getState().byLearner['profile:m']).toMatchObject({ secret: 'ms', rev: 3 });
    expect(useMembershipStore.getState().byLearner['profile:m']).toEqual([classRow]);
    expect(vi.mocked(track).mock.calls.map((c) => c[0].name)).toEqual(['space.relink.requested', 'space.relink.approved']);
  });

  it('maps denied, expired, request errors and no API', async () => {
    setSyncApiForTests(fakeApi({ createRelink: vi.fn(async () => ({ status: 'error', code: 'already_bound' })), pollRelink: vi.fn().mockResolvedValueOnce({ status: 'ok', state: 'denied', expiresAt: 'e' }).mockResolvedValueOnce({ status: 'ok', state: 'expired', expiresAt: 'e' }).mockResolvedValueOnce({ status: 'error', code: 'not_found' }) }) as never);
    expect(await useMembershipStore.getState().requestRelink('space:cls', 'K7M2X9', 'profile:m')).toEqual({ ok: false, error: 'already_bound' });
    expect(await useMembershipStore.getState().pollRelink('space:cls', 'relink:1')).toEqual({ state: 'denied' });
    expect(await useMembershipStore.getState().pollRelink('space:cls', 'relink:1')).toEqual({ state: 'expired' });
    expect(await useMembershipStore.getState().pollRelink('space:cls', 'relink:1')).toEqual({ state: 'error', error: 'not_found' });
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    expect(await useMembershipStore.getState().requestRelink('space:cls', 'K7M2X9', 'profile:m')).toEqual({ ok: false, error: 'off' });
    expect(await useMembershipStore.getState().pollRelink('space:cls', 'relink:1')).toEqual({ state: 'error', error: 'off' });
  });
});
