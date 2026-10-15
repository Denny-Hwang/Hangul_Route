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
// The free-tier switch stays off, as in the node lane (plan derivation reads quest access, F-ENT-003 section 3.6).
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false, routeEnabled: true },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import { readJson } from '../../platform/storage';
import { apiBaseUrl } from '../../platform/sync-api';
import { track } from '../../platform/telemetry';
import { flags } from '../../config/flags';
import { classScopeMarker } from '../../logic/transfers/device-scope';
import { TRANSFER_SCOPE_KEY, rederiveAllLocal, repaceAfterSync, useMembershipStore } from '../membership-store';
import { usePlanStore } from '../plan-store';
import { useTierStore } from '../tier-store';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';
import { useAccountStore } from '../account-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore, type LearnerSyncState } from '../sync-store';

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

const realUpdateProfile = useProfileStore.getState().updateProfile;
/** Wraps the store's own updateProfile, so the profile still changes and the call is seen. */
function spyUpdateProfile() {
  const update = vi.fn(realUpdateProfile);
  useProfileStore.setState({ updateProfile: update });
  return update;
}
function restoreUpdateProfile(): void {
  useProfileStore.setState({ updateProfile: realUpdateProfile });
}
/** A grown-up opened the PIN gate a moment ago (the session the PIN screen starts). */
function openGate(): void {
  useUiStore.setState({ parentGateOpenedAt: Date.now() });
}

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useMembershipStore.setState({ byLearner: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  useSyncStore.setState({ byLearner: {} });
  useUiStore.setState({ parentGateOpenedAt: null });
  useAccountStore.setState({ parentPinHash: null });
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

  it('reports whether the device holds a space for the learner to the tier store, on hydrate and on every change (F-ENT-003 section 3.4 rule 3)', async () => {
    expect(await useMembershipStore.getState().hydrate('profile:a')).toEqual([]);
    expect(useTierStore.getState().spaceMembers['profile:a']).toBe(false);
    useMembershipStore.setState({ byLearner: {} });
    mem.set('memberships:profile:a', [classRow]);
    await useMembershipStore.getState().hydrate('profile:a');
    expect(useTierStore.getState().spaceMembers['profile:a']).toBe(true);

    setSyncApiForTests(fakeApi() as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    expect(await useMembershipStore.getState().leave('profile:a', 'space:cls')).toBe(true);
    expect(useTierStore.getState().spaceMembers['profile:a']).toBe(false);
    await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9');
    expect(useTierStore.getState().spaceMembers['profile:a']).toBe(true);
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

  it('asks for a sync when the first inbox or a goal-only plan change can move summary.routeGoal (Learning Route LR-6)', async () => {
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const plan = (items: { kind: 'quest'; id: string }[]) => ({ id: 'plan:w3', spaceId: 'space:cls', spaceKind: 'class', spaceName: 'Sunday Class A', title: 'Week 3', items, publishedAt: 't', updatedAt: 't' });
    const inbox = (plans: unknown[]) => ({ status: 'ok', inbox: { rev: 1, plans, memberships: [classRow], tier: 'free', serverTime: 't' } });
    const getInbox = vi.fn().mockResolvedValueOnce(inbox([])).mockResolvedValueOnce(inbox([])).mockResolvedValueOnce(inbox([plan([])]));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    // The first inbox, even an empty one, changes no homework but lets the upload name the goal.
    await useMembershipStore.getState().refresh('profile:a');
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockClear();
    await useMembershipStore.getState().refresh('profile:a');
    expect(requestSync).not.toHaveBeenCalled();
    // A plan with no homework to derive still moves what the goal reads.
    await useMembershipStore.getState().refresh('profile:a');
    expect(useProgressStore.getState().byProfile['profile:a']?.homework).toEqual([]);
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockRestore();
  });

  it('asks for a sync when a refresh only moves a pending item to a new date (F-PLAN-002 section 3.6 rule 2)', async () => {
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const plan = (targetDate: string) => ({ id: 'plan:w3', spaceId: 'space:cls', spaceKind: 'class', spaceName: 'Sunday Class A', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate }], publishedAt: 't', updatedAt: 't' });
    const inbox = (targetDate: string) => ({ status: 'ok', inbox: { rev: 1, plans: [plan(targetDate)], memberships: [classRow], tier: 'free', serverTime: 't' } });
    const getInbox = vi.fn().mockResolvedValueOnce(inbox('2026-09-28')).mockResolvedValueOnce(inbox('2026-09-30'));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    await useMembershipStore.getState().refresh('profile:a');
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    await useMembershipStore.getState().refresh('profile:a');
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.targetDate)).toEqual(['2026-09-30']);
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockRestore();
  });

  it('derives from the cached plans when the inbox cannot be read, and for every learner on demand (F-PLAN-002 section 3.6 rule 1)', async () => {
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    mem.set('plans:profile:a', [{ id: 'plan:w3', spaceId: 'space:cls', spaceKind: 'class', spaceName: 'Sunday Class A', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-09-28' }], publishedAt: 't', updatedAt: 't' }]);
    setSyncApiForTests(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    expect(await useMembershipStore.getState().refresh('profile:a')).toBeNull();
    expect(useProgressStore.getState().byProfile['profile:a']?.homework.map((h) => h.id)).toEqual(['plan:w3#quest:stage1-letters-q1']);
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockClear();
    await rederiveAllLocal();
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

  it('a saved copy read while a refresh lands does not replace the newer rows', async () => {
    let release: (value: unknown) => void = () => undefined;
    vi.mocked(readJson).mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const pending = useMembershipStore.getState().hydrate('profile:a');
    setSyncApiForTests(fakeApi() as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const fresh = await useMembershipStore.getState().refresh('profile:a');
    release([]);
    expect(await pending).toEqual(fresh);
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual(fresh);
    expect(useTierStore.getState().spaceMembers['profile:a']).toBe(true);
  });

  it('a join reads the inbox at once, so the new tier and plans arrive before the next sync (F-ENT-003 section 3.4)', async () => {
    // The learner was free before joining: a cached free tier, so the no-cache rule cannot open anything.
    useTierStore.getState().applyInbox('profile:a', { tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 'before' });
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const plan = { id: 'plan:w1', spaceId: 'space:cls', spaceKind: 'class', spaceName: 'Sunday Class A', title: 'Week 1', items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], publishedAt: 't', updatedAt: 't' };
    const api = fakeApi({
      getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 1, plans: [plan], memberships: [classRow], tier: 'premium', tierSource: { kind: 'class', spaceId: 'space:cls', name: 'Sunday Class A' }, tierValidUntil: '2099-01-01T00:00:00.000Z', serverTime: 'after' } })),
    });
    setSyncApiForTests(api as never);
    const result = await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9');
    expect(result.ok).toBe(true);
    expect(api.getInbox).toHaveBeenCalledTimes(1);
    expect(useTierStore.getState().byLearner['profile:a']).toMatchObject({ tier: 'premium', fetchedAt: 'after' });
    expect(usePlanStore.getState().byLearner['profile:a']?.map((p) => p.id)).toEqual(['plan:w1']);
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual([classRow]);
  });

  it('a join still succeeds when the inbox read after it fails', async () => {
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) }) as never);
    expect(await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9')).toEqual({ ok: true, alreadyMember: false, membership: classRow });
    expect(useMembershipStore.getState().byLearner['profile:a']).toEqual([classRow]);
  });

  it('registers a never-synced learner first, then joins and caches the membership', async () => {
    // After the join the server lists the new class; the inbox read right after it says so.
    const api = fakeApi({ getInbox: vi.fn(async () => ({ status: 'ok', inbox: { rev: 1, plans: [], memberships: [classRow], tier: 'free', serverTime: 't' } })) });
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

  it('a join under a changed name makes it the profile name (F-LEARN-001 section 3.11)', async () => {
    openGate();
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi() as never);
    const update = spyUpdateProfile();
    try {
      await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', '  Sungjoo ');
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith('profile:a', { displayName: 'Sungjoo' });
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo');
      // The edit is pending for the server like any profile edit (PATCH /api/sync/learners/:id on the next sync).
      await vi.waitFor(() => expect(useSyncStore.getState().byLearner['profile:a']?.pendingProfile?.fields).toEqual({ displayName: 'Sungjoo' }));
    } finally {
      restoreUpdateProfile();
    }
  });

  it('a join that was already a member still makes a changed name the profile name', async () => {
    openGate();
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi({ joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: true, membership: classRow })) }) as never);
    await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Sungjoo');
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo');
  });

  it('a join under the same name, no name, or a refused join leaves the profile alone', async () => {
    openGate();
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const update = spyUpdateProfile();
    try {
      setSyncApiForTests(fakeApi() as never);
      await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', ' Suni ');
      await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9');
      setSyncApiForTests(fakeApi({ joinSpace: vi.fn(async () => ({ status: 'error', code: 'cap_class' })) }) as never);
      await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Sungjoo');
      expect(update).not.toHaveBeenCalled();
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Suni');
      expect(useSyncStore.getState().byLearner['profile:a']?.pendingProfile ?? null).toBeNull();
    } finally {
      restoreUpdateProfile();
    }
  });

  it('a join name the profile rule refuses never throws and never reaches the profile', async () => {
    openGate();
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi() as never);
    expect((await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Suni 🐯')).ok).toBe(true);
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Suni');
  });

  it('a stored name that predates the rule joins as it is and stays the profile name', async () => {
    openGate();
    // 15 characters: longer than today's 12-character rule, saved before the rule existed.
    const legacy = 'Suni from Busan';
    useProfileStore.setState({ profiles: [{ ...useProfileStore.getState().profiles[0]!, displayName: legacy }] });
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    const joinSpace = vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: classRow }));
    setSyncApiForTests(fakeApi({ joinSpace }) as never);
    const update = spyUpdateProfile();
    try {
      expect((await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', legacy)).ok).toBe(true);
      expect(joinSpace).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe(legacy);
      expect(useSyncStore.getState().byLearner['profile:a']?.pendingProfile ?? null).toBeNull();
    } finally {
      restoreUpdateProfile();
    }
  });

  it('with the grown-up gate closed, a join never renames the profile (a rename goes through Edit profile and the PIN)', async () => {
    // A family device with a PIN and no open grown-up session.
    useAccountStore.setState({ parentPinHash: 'pin-hash' });
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    setSyncApiForTests(fakeApi() as never);
    const update = spyUpdateProfile();
    try {
      expect((await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Sungjoo')).ok).toBe(true);
      expect(update).not.toHaveBeenCalled();
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Suni');
      // Once a grown-up opens the gate, the same join renames.
      openGate();
      await useMembershipStore.getState().join('profile:a', 'space:cls', 'K7M2X9', 'Sungjoo');
      expect(update).toHaveBeenCalledWith('profile:a', { displayName: 'Sungjoo' });
    } finally {
      restoreUpdateProfile();
    }
  });

  it('says whether this device holds a class-scoped credential for the learner (F-LEARN-001 section 3.11)', async () => {
    // Never synced: no secret, so the device is not a class tablet for this learner.
    expect(await useMembershipStore.getState().deviceScope('profile:a')).toBe('full');
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    expect(await useMembershipStore.getState().deviceScope('profile:a')).toBe('full');
    mem.set(TRANSFER_SCOPE_KEY('profile:a'), classScopeMarker('sec'));
    expect(await useMembershipStore.getState().deviceScope('profile:a')).toBe('class');
    // A marker written for another secret (a later rescue-code claim) no longer applies.
    mem.set(TRANSFER_SCOPE_KEY('profile:a'), classScopeMarker('older'));
    expect(await useMembershipStore.getState().deviceScope('profile:a')).toBe('full');
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

describe('app start and foreground: the automatic re-pace (F-PLAN-002 section 3.7)', () => {
  async function planTenDaysAgo(): Promise<void> {
    const { CATALOG, generateCurriculum } = await import('@hangul-route/content-schema');
    const { useRouteStore } = await import('../route-store');
    const { dayKey } = await import('../../logic/homework/mission-builder');
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    const draft = generateCurriculum(
      { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: dayKey(tenDaysAgo.toISOString()), weeks: 12, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
      CATALOG,
    );
    useRouteStore.setState({ ui: {} });
    await useRouteStore.getState().create('profile:a', draft, { from: 'setup', changed: false }, tenDaysAgo);
  }
  const routeOf = () => useProgressStore.getState().byProfile['profile:a']?.selfRoute;

  it('with sync on, syncs first and moves the plan along only once the sync merged, then pushes it', async () => {
    const { dayKey } = await import('../../logic/homework/mission-builder');
    setSyncApiForTests(fakeApi() as never);
    await planTenDaysAgo();
    const syncNow = vi.spyOn(useSyncStore.getState(), 'syncNow').mockImplementation(async (id) => ({ ...(useSyncStore.getState().byLearner[id] as LearnerSyncState), status: 'synced' }));
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
    const before = routeOf()?.updatedAt;
    await rederiveAllLocal();
    // A stale copy is never re-paced before the server's copy is merged: the onSynced listener does it.
    expect(routeOf()?.updatedAt).toBe(before);
    expect(syncNow).toHaveBeenCalledWith('profile:a');
    syncNow.mockClear();
    expect(await repaceAfterSync('profile:a')).toBe(true);
    expect(routeOf()?.meta.repacedAt?.slice(0, 10)).toBe(dayKey(new Date().toISOString()));
    expect(requestSync).toHaveBeenCalledWith('profile:a');
    requestSync.mockClear();
    // Once a day: the next sync and the next foreground the same day leave the plan alone.
    const moved = routeOf()?.updatedAt;
    expect(await repaceAfterSync('profile:a')).toBe(false);
    await rederiveAllLocal();
    expect(routeOf()?.updatedAt).toBe(moved);
    expect(syncNow).not.toHaveBeenCalled();
    expect(requestSync).not.toHaveBeenCalled();
    syncNow.mockRestore();
    requestSync.mockRestore();
  });

  it.each([
    ['offline (the upload fails)', 'error'],
    ['a conflict to retry later', 'idle'],
  ] as const)('with sync on but %s, moves the plan along on this copy the same day', async (_label, status) => {
    const { dayKey } = await import('../../logic/homework/mission-builder');
    setSyncApiForTests(fakeApi() as never);
    await planTenDaysAgo();
    const syncNow = vi.spyOn(useSyncStore.getState(), 'syncNow').mockImplementation(async (id) => ({ ...(useSyncStore.getState().byLearner[id] as LearnerSyncState), status }));
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
    await rederiveAllLocal();
    expect(routeOf()?.meta.repacedAt?.slice(0, 10)).toBe(dayKey(new Date().toISOString()));
    // Once that day.
    const moved = routeOf()?.updatedAt;
    await rederiveAllLocal();
    expect(routeOf()?.updatedAt).toBe(moved);
    syncNow.mockRestore();
    requestSync.mockRestore();
  });

  it('with sync on and the upload failing for real (offline), still moves the plan along', async () => {
    const { dayKey } = await import('../../logic/homework/mission-builder');
    setSyncApiForTests(fakeApi({ putSnapshot: vi.fn(async () => Promise.reject(new Error('offline'))) }) as never);
    await planTenDaysAgo();
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync').mockImplementation(() => undefined);
    await rederiveAllLocal();
    expect(routeOf()?.meta.repacedAt?.slice(0, 10)).toBe(dayKey(new Date().toISOString()));
    requestSync.mockRestore();
  });

  it('without sync, moves the plan along straight away', async () => {
    const { dayKey } = await import('../../logic/homework/mission-builder');
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    await planTenDaysAgo();
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    await rederiveAllLocal();
    expect(routeOf()?.meta.repacedAt?.slice(0, 10)).toBe(dayKey(new Date().toISOString()));
    expect(requestSync).not.toHaveBeenCalled();
    requestSync.mockRestore();
  });

  it('with flags.routeEnabled off, a synced plan is left alone: no re-pace, no event, no sync', async () => {
    await planTenDaysAgo();
    vi.mocked(track).mockClear();
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    const before = routeOf();
    flags.routeEnabled = false;
    try {
      await rederiveAllLocal();
      expect(await repaceAfterSync('profile:a')).toBe(false);
    } finally {
      flags.routeEnabled = true;
    }
    expect(routeOf()).toEqual(before);
    expect(requestSync).not.toHaveBeenCalled();
    expect(vi.mocked(track).mock.calls.some(([e]) => (e as { name: string }).name === 'route.repaced')).toBe(false);
    requestSync.mockRestore();
  });
});
