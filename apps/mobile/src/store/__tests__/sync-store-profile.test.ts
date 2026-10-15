import type { ProgressSnapshot, SyncInbox } from '@hangul-route/content-schema';
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
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import { classScopeMarker } from '../../logic/transfers/device-scope';
import { notifyInboxRead } from '../../platform/inbox-events';
import { notifyProfileEdited, onProfileEdited } from '../profile-edits';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { usePlanStore } from '../plan-store';
import { PROFILE_PUSH_REPAIR_KEY, setSyncApiForTests, useSyncStore } from '../sync-store';

const A = 'profile:a';
const B = 'profile:b';
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });
const learner = (id: string, displayName: string) => ({ id, displayName, ageGroup: '5-7' as const, avatar: 'hoya-orange' as const, role: 'learner' as const, createdAt: 't' });
const registered = (id: string, extra: Record<string, unknown> = {}) => mem.set(`sync:${id}`, { secret: `sec-${id}`, rev: 1, lastSyncedAt: 't', rescueCode: 'TIGER-MOON-4821', ...extra });

type PatchBody = { displayName?: string; ageGroup?: string; avatar?: string; at: string };
function fakeApi(over: Record<string, unknown> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: A, secret: 'sec-new' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 2 })),
    getSnapshot: vi.fn(),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    getInbox: vi.fn(async () => ({ status: 'ok', inbox: inbox() })),
    updateLearnerProfile: vi.fn(async (_id: string, _secret: string, _device: string, _body: PatchBody) => ({ status: 'ok', applied: true })),
    ...over,
  };
}

function inbox(learnerRow?: SyncInbox['learner']): SyncInbox {
  return {
    rev: 0, plans: [], memberships: [], tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 't',
    transfersEnabled: false, transferDeviceConsent: false, selfManaged: false, transfers: [], deviceScope: 'full',
    notes: [], notePrefs: { classes: 'all', acknowledged: false }, classScope: null, classMoves: [],
    ...(learnerRow ? { learner: learnerRow } : {}),
  };
}

/** Drop the in-memory sync records: the next read comes from storage, as after an app restart. */
const restart = () => useSyncStore.setState({ byLearner: {} });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('profile edits reach the server (F-PROF-001)', () => {
  beforeEach(() => {
    mem.clear();
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'test')], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A) }, hydratedFor: new Set([A]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    mem.set(PROFILE_PUSH_REPAIR_KEY, true);
  });

  it('an edit made offline is queued, survives a restart, is sent once back online and then cleared', async () => {
    registered(A);
    const offline = fakeApi({
      updateLearnerProfile: vi.fn(async () => ({ status: 'error', code: 'network' })),
      putSnapshot: vi.fn(async () => ({ status: 'error', code: 'network' })),
    });
    setSyncApiForTests(offline as never);
    useProfileStore.getState().updateProfile(A, { displayName: 'Sungjoo' });
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.fields).toEqual({ displayName: 'Sungjoo' });
    await useSyncStore.getState().syncNow(A);
    expect(offline.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect((mem.get(`sync:${A}`) as { pendingProfile: unknown }).pendingProfile).toMatchObject({ fields: { displayName: 'Sungjoo' } });

    restart();
    const online = fakeApi();
    setSyncApiForTests(online as never);
    const state = await useSyncStore.getState().syncNow(A);
    expect(online.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect(online.updateLearnerProfile.mock.calls[0]?.slice(0, 3)).toEqual([A, `sec-${A}`, 'device-test']);
    expect(online.updateLearnerProfile.mock.calls[0]?.[3]).toMatchObject({ displayName: 'Sungjoo' });
    expect(state.pendingProfile).toBeNull();
    expect(state.status).toBe('synced');
    await useSyncStore.getState().syncNow(A);
    expect(online.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect((mem.get(`sync:${A}`) as { pendingProfile: unknown }).pendingProfile).toBeNull();
  });

  it('only the changed server fields are queued; who is learning never is', async () => {
    registered(A);
    setSyncApiForTests(fakeApi() as never);
    useProfileStore.getState().updateProfile(A, { learnerType: 'self' });
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile ?? null).toBeNull();
    useProfileStore.getState().updateProfile(A, { ageGroup: '8-9', avatar: 'hoya-orange', learnerType: 'child' });
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.fields).toEqual({ ageGroup: '8-9' });
  });

  it('a grown-up profile edit is never queued', async () => {
    useProfileStore.setState({ profiles: [learner(A, 'test'), { ...learner('profile:p', 'Mom'), role: 'parent' }], activeId: A, hydrated: true });
    setSyncApiForTests(fakeApi() as never);
    useProfileStore.getState().updateProfile('profile:p', { displayName: 'Mother' });
    await flush();
    expect(useSyncStore.getState().byLearner['profile:p']).toBeUndefined();
  });

  it('a 2xx with applied false still clears the edit (the server holds a newer one)', async () => {
    registered(A);
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: false })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    expect((await useSyncStore.getState().syncNow(A)).pendingProfile).toBeNull();
  });

  it('applied false adopts the server learner (a legacy name too), clears the edit and never retries', async () => {
    registered(A);
    const server = { displayName: 'Alexandria Mae', ageGroup: '8-9', avatar: 'hoya-blue' };
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: false, profileUpdatedAt: '2026-10-14T10:00:00.000Z', learner: server })) });
    setSyncApiForTests(api as never);
    useProfileStore.getState().updateProfile(A, { displayName: 'Sungjoo' });
    await vi.waitFor(() => expect(useSyncStore.getState().byLearner[A]?.pendingProfile).not.toBeNull());
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.pendingProfile).toBeNull();
    expect(useProfileStore.getState().profiles[0]).toMatchObject(server);
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile ?? null).toBeNull();
    await useSyncStore.getState().syncNow(A);
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
  });

  it('a class tablet (403 scope_limited) drops the edit with no retry and records it', async () => {
    registered(A);
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'scope_limited' })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.pendingProfile).toBeNull();
    expect(state.lastError).toBe('scope_limited');
    await useSyncStore.getState().syncNow(A);
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
  });

  it('a value the Worker refuses (422) is dropped with no retry, recorded as a fixed code only', async () => {
    registered(A);
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'invalid', code: 'bad_request' })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.pendingProfile).toBeNull();
    expect(state.lastError).toBe('profile_invalid');
    expect(JSON.stringify(useSyncStore.getState().byLearner[A])).not.toContain('Sungjoo');
    await useSyncStore.getState().syncNow(A);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
  });

  it('a 5xx keeps the edit for the next sync', async () => {
    registered(A);
    const updateLearnerProfile = vi.fn().mockResolvedValueOnce({ status: 'error', code: 'http_503' }).mockResolvedValueOnce({ status: 'ok', applied: true });
    setSyncApiForTests(fakeApi({ updateLearnerProfile }) as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    expect((await useSyncStore.getState().syncNow(A)).pendingProfile).not.toBeNull();
    expect((await useSyncStore.getState().syncNow(A)).pendingProfile).toBeNull();
    expect(updateLearnerProfile).toHaveBeenCalledTimes(2);
  });

  it('an edit made while the PATCH is in flight is kept and sent on the next pass', async () => {
    registered(A);
    let release: (v: unknown) => void = () => undefined;
    const updateLearnerProfile = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue({ status: 'ok', applied: true });
    setSyncApiForTests(fakeApi({ updateLearnerProfile }) as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    const run = useSyncStore.getState().syncNow(A);
    await vi.waitFor(() => expect(updateLearnerProfile).toHaveBeenCalledTimes(1));
    await useSyncStore.getState().markProfileDirty(A, { avatar: 'hoya-orange' });
    release({ status: 'ok', applied: true });
    await run;
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.fields).toEqual({ displayName: 'Sungjoo', avatar: 'hoya-orange' });
    await useSyncStore.getState().syncNow(A);
    expect(updateLearnerProfile).toHaveBeenCalledTimes(2);
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).toBeNull();
  });

  it('a learner not registered yet sends the edit with its registration: the queued edit clears, no PATCH', async () => {
    const api = fakeApi();
    setSyncApiForTests(api as never);
    useProfileStore.getState().updateProfile(A, { displayName: 'Sungjoo' });
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).not.toBeNull();
    const state = await useSyncStore.getState().syncNow(A);
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Sungjoo' }), 'device-test');
    expect(api.updateLearnerProfile).not.toHaveBeenCalled();
    expect(state.pendingProfile).toBeNull();
  });

  it('a legacy name an older build stored (longer than the edit-screen rule) still goes up', async () => {
    registered(A);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Alexandria Mae' });
    await useSyncStore.getState().syncNow(A);
    expect(api.updateLearnerProfile.mock.calls[0]?.[3]).toEqual({ displayName: 'Alexandria Mae', at: expect.any(String) });
  });

  it('a name no server rule takes stays on the device; the rest goes up', async () => {
    registered(A);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sun\u202EJoo', ageGroup: '8-9' });
    await useSyncStore.getState().syncNow(A);
    const body = api.updateLearnerProfile.mock.calls[0]?.[3];
    expect(body).toEqual({ ageGroup: '8-9', at: expect.any(String) });
  });
});

describe('one-time repair of renames that never synced (hr:profilePushedV1)', () => {
  beforeEach(() => {
    mem.clear();
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'Sungjoo'), learner(B, 'Mina'), { ...learner('profile:p', 'Mom'), role: 'parent' }], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A), [B]: snap(B) }, hydratedFor: new Set([A, B]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
  });

  it('queues every registered learner exactly once, then the marker holds', async () => {
    registered(A);
    const register = vi.fn(async () => ({ status: 'ok', learnerId: B, secret: 'sec-b' }));
    const api = fakeApi({ register });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(mem.get(PROFILE_PUSH_REPAIR_KEY)).toBe(true);
    // Only the registered learner is patched; the other one registers with its current name.
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect(api.updateLearnerProfile.mock.calls[0]?.[0]).toBe(A);
    expect(api.updateLearnerProfile.mock.calls[0]?.[3]).toMatchObject({ displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange' });
    expect(register).toHaveBeenCalledTimes(1);
    restart();
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
  });

  it('waits for profiles to load before it marks itself done', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    setSyncApiForTests(fakeApi() as never);
    await useSyncStore.getState().syncAll();
    expect(mem.get(PROFILE_PUSH_REPAIR_KEY)).toBeUndefined();
  });

  it('a learner another device already edited on the server takes that edit instead of overwriting it', async () => {
    registered(A);
    useProfileStore.setState({ profiles: [learner(A, 'test')], activeId: A, hydrated: true });
    const getInbox = vi.fn(async () => ({ status: 'ok', inbox: inbox({ displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: '2026-10-13T10:00:00.000Z' }) }));
    const api = fakeApi({ getInbox });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).not.toHaveBeenCalled();
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo');
    expect(useSyncStore.getState().byLearner[A]).toMatchObject({ pendingProfile: null, profileAt: '2026-10-13T10:00:00.000Z' });
  });

  it('a repair that cannot read the inbox waits for the next sync', async () => {
    registered(A);
    useProfileStore.setState({ profiles: [learner(A, 'test')], activeId: A, hydrated: true });
    const api = fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).not.toHaveBeenCalled();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.repair).toMatchObject({ displayName: 'test' });
  });

  it('a row a join named but no PATCH edited (unstamped) does not stop the rename: it goes up and stays', async () => {
    registered(A);
    // Joined on the older build as 'test' (the join sets the name, never the edit time), renamed on the device after.
    const getInbox = vi.fn(async () => ({ status: 'ok', inbox: inbox({ displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: null }) }));
    const api = fakeApi({ getInbox });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
    // Only the field that differs from the server goes up.
    expect(api.updateLearnerProfile.mock.calls[0]?.[3]).toEqual({ displayName: 'Sungjoo', at: expect.any(String) });
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo');
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).toBeNull();
  });

  it('a different name typed at join on an older build gives way to the device profile name (one name everywhere, F-SYNC-001 §3.7 #10)', async () => {
    registered(A);
    // The older Join screen let a grown-up type 'Mina' for the class while the profile kept 'Mina Kim-Park'; the join
    // wrote 'Mina' and left the row unstamped. The device cannot tell this from a rename that never synced, and the
    // rule is one name for the learner everywhere: the profile name goes up. Edit profile changes it on purpose.
    useProfileStore.setState({ profiles: [learner(A, 'Mina Kim-Park')], activeId: A, hydrated: true });
    const getInbox = vi.fn(async () => ({ status: 'ok', inbox: inbox({ displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: null }) }));
    const api = fakeApi({ getInbox });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect(api.updateLearnerProfile.mock.calls[0]?.[3]).toEqual({ displayName: 'Mina Kim-Park', at: expect.any(String) });
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina Kim-Park');
  });

  it('a class tablet settles the one-time check quietly: no PATCH, no error recorded', async () => {
    registered(A);
    registered(B);
    mem.set(`transfer-scope:${A}`, classScopeMarker(`sec-${A}`));
    mem.set(`transfer-scope:${B}`, classScopeMarker(`sec-${B}`));
    const api = fakeApi({ getInbox: vi.fn(async () => ({ status: 'ok', inbox: { ...inbox(), deviceScope: 'class' } })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).not.toHaveBeenCalled();
    for (const id of [A, B]) expect(useSyncStore.getState().byLearner[id]).toMatchObject({ pendingProfile: null, lastError: null });
    expect(mem.get(PROFILE_PUSH_REPAIR_KEY)).toBe(true);
  });

  it('values that already match the server send nothing (a device that never saw the rename stamps nothing)', async () => {
    registered(A);
    const getInbox = vi.fn(async () => ({ status: 'ok', inbox: inbox({ displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: null }) }));
    const api = fakeApi({ getInbox });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(api.updateLearnerProfile).not.toHaveBeenCalled();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).toBeNull();
  });

  it('an edit made after the repair queued keeps the repair check for the fields it did not touch', async () => {
    registered(A);
    const offline = fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) });
    setSyncApiForTests(offline as never);
    await useSyncStore.getState().syncAll();
        await useSyncStore.getState().markProfileDirty(A, { ageGroup: '8-9' });
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).toMatchObject({ fields: { ageGroup: '8-9' }, repair: { displayName: 'Sungjoo', avatar: 'hoya-orange' } });
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.repair).not.toHaveProperty('ageGroup');

    // Another device renamed the learner on the server meanwhile: its name wins, only the level edited here goes up.
    const getInbox = vi.fn(async () => ({ status: 'ok', inbox: inbox({ displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: '2026-10-13T10:00:00.000Z' }) }));
    const api = fakeApi({ getInbox });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncNow(A);
    expect(api.updateLearnerProfile).toHaveBeenCalledTimes(1);
    expect(api.updateLearnerProfile.mock.calls[0]?.[3]).toEqual({ ageGroup: '8-9', at: expect.any(String) });
    expect(useProfileStore.getState().profiles[0]).toMatchObject({ displayName: 'Mina' });
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile).toBeNull();
  });
});

describe('the server clock orders profile edits', () => {
  beforeEach(() => {
    mem.clear();
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'test')], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A) }, hydratedFor: new Set([A]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    mem.set(PROFILE_PUSH_REPAIR_KEY, true);
    registered(A);
  });

  it('a device clock 1 h ahead records the time the server stored, so a newer edit from another device still comes down', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-14T11:00:00.000Z'));
      const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: true, profileUpdatedAt: '2026-10-14T10:00:00.000Z', learner: null })) });
      setSyncApiForTests(api as never);
      await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
      await useSyncStore.getState().syncNow(A);
      expect(useSyncStore.getState().byLearner[A]?.profileAt).toBe('2026-10-14T10:00:00.000Z');
      await useSyncStore.getState().applyInboxLearner(A, { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: '2026-10-14T10:30:00.000Z' });
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a device clock 1 h behind: the server keeps the newer edit and the device shows it at once (applied false)', async () => {
    const api = fakeApi({
      updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: false, profileUpdatedAt: '2026-10-14T10:00:00.000Z', learner: { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' } })),
    });
    setSyncApiForTests(api as never);
    useProfileStore.getState().updateProfile(A, { displayName: 'Sungjoo' });
    await vi.waitFor(() => expect(useSyncStore.getState().byLearner[A]?.pendingProfile).not.toBeNull());
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.pendingProfile).toBeNull();
    expect(state.profileAt).toBe('2026-10-14T10:00:00.000Z');
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
    // Not queued again: the server row is the newest.
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile ?? null).toBeNull();
  });

  it('a Worker that answers no stored time falls back to the edit time, and applied false then takes the next inbox row', async () => {
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: false, profileUpdatedAt: null, learner: null })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    expect((await useSyncStore.getState().syncNow(A)).profileAt).toBeNull();
    await useSyncStore.getState().applyInboxLearner(A, { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: '2026-10-14T10:00:00.000Z' });
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
  });

  it('a dropped edit is recorded even when the snapshot upload meets a conflict', async () => {
    const api = fakeApi({
      updateLearnerProfile: vi.fn(async () => ({ status: 'scope_limited' })),
      putSnapshot: vi.fn(async () => ({ status: 'conflict', rev: 3, snapshot: snap(A) })),
    });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.lastError).toBe('scope_limited');
    expect(state.pendingProfile).toBeNull();
  });
});

describe('the server name comes down (inbox pull, restore)', () => {
  beforeEach(() => {
    mem.clear();
    restart();
    useProfileStore.setState({ profiles: [learner(A, 'test')], activeId: A, hydrated: true });
    useProgressStore.setState({ byProfile: { [A]: snap(A) }, hydratedFor: new Set([A]) });
    usePlanStore.setState({ byLearner: {}, notReady: {} });
    mem.set(PROFILE_PUSH_REPAIR_KEY, true);
    registered(A);
    setSyncApiForTests(fakeApi() as never);
  });

  const row = (displayName: string, at: string | null = '2026-10-13T10:00:00.000Z') => ({ displayName, ageGroup: '8-9' as const, avatar: 'hoya-orange', profileUpdatedAt: at });

  it('an inbox with a newer server row updates the profile without queuing it again', async () => {
    notifyInboxRead(A, inbox(row('Sungjoo')));
    await vi.waitFor(() => expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo'));
    expect(useProfileStore.getState().profiles[0]?.ageGroup).toBe('8-9');
    await flush();
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile ?? null).toBeNull();
    expect(useSyncStore.getState().byLearner[A]?.profileAt).toBe('2026-10-13T10:00:00.000Z');
  });

  it('an inbox read while the sync record first loads never writes over an edit made meanwhile', async () => {
    restart();
    // The pull starts and waits for the stored record; the learner renames before the edit itself is queued.
    const pull = useSyncStore.getState().applyInboxLearner(A, row('Sungjoo'));
    useProfileStore.getState().updateProfile(A, { displayName: 'Local' });
    await pull;
    await flush();
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Local');
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.fields).toEqual({ displayName: 'Local' });
  });

  it('a local edit still waiting wins over the inbox', async () => {
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Local' });
    useProfileStore.getState().updateProfile(A, { displayName: 'Local' });
    await useSyncStore.getState().applyInboxLearner(A, row('Sungjoo'));
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Local');
  });

  it('a row never edited on the server, or no newer than the last sent, is left alone', async () => {
    await useSyncStore.getState().applyInboxLearner(A, row('Sungjoo', null));
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('test');
    useSyncStore.setState({ byLearner: { [A]: { ...useSyncStore.getState().byLearner[A]!, profileAt: '2026-10-13T11:00:00.000Z' } } });
    await useSyncStore.getState().applyInboxLearner(A, row('Sungjoo'));
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('test');
  });

  it('a server name no server rule takes is skipped; the other fields still apply', async () => {
    await useSyncStore.getState().applyInboxLearner(A, row('Sun\u202EJoo'));
    expect(useProfileStore.getState().profiles[0]).toMatchObject({ displayName: 'test', ageGroup: '8-9' });
  });

  it('a restore over an existing profile takes the server values when no edit waits', async () => {
    await useSyncStore.getState().adoptServerLearner({ learner: { id: A, displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-orange' }, secret: 'sec-2', snapshot: null });
    expect(useProfileStore.getState().profiles[0]).toMatchObject({ displayName: 'Sungjoo', ageGroup: '8-9' });
  });

  it('a restore over an existing profile with an edit waiting keeps the local values and the edit', async () => {
    useProfileStore.getState().updateProfile(A, { displayName: 'Local' });
    await vi.waitFor(() => expect(useSyncStore.getState().byLearner[A]?.pendingProfile).not.toBeNull());
    await useSyncStore.getState().adoptServerLearner({ learner: { id: A, displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-orange' }, secret: 'sec-2', snapshot: null });
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Local');
    expect(useSyncStore.getState().byLearner[A]).toMatchObject({ secret: 'sec-2', pendingProfile: { fields: { displayName: 'Local' } } });
  });
});

describe('profile edit listeners', () => {
  it('a listener that throws never reaches the edit; the other listeners still run', () => {
    const seen: string[] = [];
    const offBad = onProfileEdited(() => {
      throw new Error('boom');
    });
    const offGood = onProfileEdited((id) => seen.push(id));
    expect(() => notifyProfileEdited(A, { displayName: 'Sungjoo' })).not.toThrow();
    expect(seen).toEqual([A]);
    offBad();
    offGood();
  });
});
