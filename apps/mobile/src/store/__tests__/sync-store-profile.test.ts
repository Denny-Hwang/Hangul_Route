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

import { notifyInboxRead } from '../../platform/inbox-events';
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

  it('a value the Worker refuses (422) is dropped with no retry', async () => {
    registered(A);
    const api = fakeApi({ updateLearnerProfile: vi.fn(async () => ({ status: 'invalid', code: 'bad_request' })) });
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'Sungjoo' });
    const state = await useSyncStore.getState().syncNow(A);
    expect(state.pendingProfile).toBeNull();
    expect(state.lastError).toBe('profile_invalid');
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

  it('a name an older build stored that the shared rule refuses stays on the device; the rest goes up', async () => {
    registered(A);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().markProfileDirty(A, { displayName: 'A name far too long', ageGroup: '8-9' });
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
    expect(useSyncStore.getState().byLearner[A]?.pendingProfile?.fields).toMatchObject({ displayName: 'test' });
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

  it('a server name the local rule refuses is skipped; the other fields still apply', async () => {
    await useSyncStore.getState().applyInboxLearner(A, row('A name far too long'));
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
