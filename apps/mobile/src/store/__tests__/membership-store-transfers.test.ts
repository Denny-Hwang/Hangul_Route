import { TRANSFER_CONSENT_TEXT_VERSION, type InboxTransfer, type ProgressSnapshot } from '@hangul-route/content-schema';
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
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import { classScopeMarker } from '../../logic/transfers/device-scope';
import { apiBaseUrl } from '../../platform/sync-api';
import { track } from '../../platform/telemetry';
import { TRANSFERS_ON_KEY, TRANSFER_SCOPE_KEY, useMembershipStore } from '../membership-store';
import { usePlanStore } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore } from '../sync-store';
import { useTierStore } from '../tier-store';

/*
 * Class moves in the membership store — F-SPACE-002 section 4.12, PR T-7a.
 * `transfersByLearner` is filled from the inbox and never persisted (an
 * offline device cannot show a stale prompt it could answer); an executed
 * move refreshes and syncs at once; the class tablet of the old class learns
 * that it must join again; nothing is ever queued. Inert while locked.
 */

const L = 'profile:a';
const TID = 'transfer:0b6c2f4e-1111-4000-8000-000000000001';
const snap: ProgressSnapshot = { profileId: L, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
const classA = { spaceId: 'space:a', kind: 'class' as const, name: 'Sunday Class A', role: 'student' as const, joinedAt: 't' };
const classB = { spaceId: 'space:b', kind: 'class' as const, name: 'Saturday Class B', role: 'student' as const, joinedAt: 't' };

const req = (over: Partial<InboxTransfer> = {}): InboxTransfer => ({
  id: TID,
  status: 'requested',
  initiator: 'learner_side',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months' },
  learnerState: 'consented',
  sourceState: 'waiting',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'none',
  destinationConsentMode: 'parent',
  relinkAffected: false,
  sourcePlansAffected: false,
  visibleToday: [],
  blockReason: null,
  executeAfter: null,
  expiresAt: '2026-10-25T12:00:00.000Z',
  learnerRoute: 'device',
  canVeto: true,
  endedFrom: null,
  ...over,
});

interface InboxOver {
  memberships?: (typeof classA)[];
  transfersEnabled?: boolean;
  transferDeviceConsent?: boolean;
  selfManaged?: boolean;
  transfers?: InboxTransfer[];
}
const inbox = (over: InboxOver = {}) => ({
  status: 'ok' as const,
  inbox: { rev: 1, plans: [], memberships: [classA], tier: 'free', tierSource: null, tierValidUntil: null, serverTime: 't', transfersEnabled: true, transferDeviceConsent: true, selfManaged: false, transfers: [], notes: [], notePrefs: { classNotes: 'all', acknowledged: false }, ...over },
});

function fakeApi(over: Record<string, unknown> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: L, secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    getInbox: vi.fn(async () => inbox()),
    previewTransfer: vi.fn(),
    createTransfer: vi.fn(),
    approveTransfer: vi.fn(),
    declineTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
    putTransferPrefs: vi.fn(async () => ({ status: 'ok', selfManaged: true })),
    pollRelink: vi.fn(),
    ...over,
  };
}

const store = () => useMembershipStore.getState();
const names = () => vi.mocked(track).mock.calls.map((c) => c[0]);

beforeEach(() => {
  mem.clear();
  vi.mocked(track).mockClear();
  useMembershipStore.setState({ byLearner: {}, transfersByLearner: {}, movedByLearner: {}, rejoinByLearner: {}, executedSeen: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  useSyncStore.setState({ byLearner: {} });
  useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: L, hydrated: true });
  useProgressStore.setState({ byProfile: { [L]: snap }, hydratedFor: new Set([L]) });
  vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
});

const signedIn = (api: ReturnType<typeof fakeApi>, secret = 'sec') => {
  setSyncApiForTests(api as never);
  useSyncStore.getState().adoptCredentials(L, secret, 1);
};

describe('refresh fills transfersByLearner (section 4.12)', () => {
  it('keeps the inbox fields in memory only, with the device scope', async () => {
    signedIn(fakeApi({ getInbox: vi.fn(async () => inbox({ transfers: [req()] })) }));
    await store().refresh(L);
    expect(store().transfersByLearner[L]).toEqual({ enabled: true, deviceConsent: true, selfManaged: false, scope: 'full', requests: [req()] });
    // Only the on switch is kept across restarts: no request, no prompt.
    expect([...mem.keys()].filter((k) => /transfer/i.test(k))).toEqual([TRANSFERS_ON_KEY(L)]);
    expect(mem.get(TRANSFERS_ON_KEY(L))).toBe(true);
  });

  it('while locked it holds the off state and calls nothing else (inert)', async () => {
    const api = fakeApi({ getInbox: vi.fn(async () => inbox({ transfersEnabled: false, transferDeviceConsent: false })) });
    signedIn(api);
    useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't', learnerType: 'self' }] });
    await store().refresh(L);
    expect(store().transfersByLearner[L]).toMatchObject({ enabled: false, deviceConsent: false, requests: [] });
    expect(api.putTransferPrefs).not.toHaveBeenCalled();
    expect(names()).toEqual([]);
  });

  it('an inbox from an older Worker (no transfer fields) reads off and empty', async () => {
    const old = inbox();
    const { transfersEnabled: _a, transferDeviceConsent: _b, selfManaged: _c, transfers: _d, ...rest } = old.inbox;
    signedIn(fakeApi({ getInbox: vi.fn(async () => ({ status: 'ok', inbox: rest })) }));
    await store().refresh(L);
    expect(store().transfersByLearner[L]).toEqual({ enabled: false, deviceConsent: false, selfManaged: false, scope: 'full', requests: [] });
  });

  it('reads the class scope from the marker written for this secret', async () => {
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    signedIn(fakeApi());
    await store().refresh(L);
    expect(store().transfersByLearner[L]?.scope).toBe('class');
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('an-older-secret'));
    await store().refresh(L);
    expect(store().transfersByLearner[L]?.scope).toBe('full');
  });
});

describe('an executed move (section 4.12, app-sheets.md Moved)', () => {
  it('a move the device sees happen leaves the list, refreshes again, syncs and records the one-off', async () => {
    const getInbox = vi
      .fn()
      .mockResolvedValueOnce(inbox({ transfers: [req({ status: 'approved' })] }))
      // The Worker settled (and moved) after it read the memberships: they are stale in this answer.
      .mockResolvedValueOnce(inbox({ memberships: [classA], transfers: [req({ status: 'executed' })] }))
      .mockResolvedValueOnce(inbox({ memberships: [classB], transfers: [req({ status: 'executed' })] }));
    signedIn(fakeApi({ getInbox }));
    const requestSync = vi.spyOn(useSyncStore.getState(), 'requestSync');
    await store().refresh(L);
    expect(store().transfersByLearner[L]?.requests).toHaveLength(1);
    const rows = await store().refresh(L);
    expect(getInbox).toHaveBeenCalledTimes(3);
    expect(rows?.map((r) => r.spaceId)).toEqual(['space:b']);
    expect(store().byLearner[L]?.map((r) => r.spaceId)).toEqual(['space:b']);
    expect(store().transfersByLearner[L]?.requests).toEqual([]);
    expect(store().movedByLearner[L]).toMatchObject({ id: TID, to: { name: 'Saturday Class B' } });
    expect(requestSync).toHaveBeenCalledWith(L);
    expect(names()).toEqual([{ name: 'space.transfer.completed', payload: {} }]);
    store().clearMoved(L);
    expect(store().movedByLearner[L]).toBeNull();
    // Seen once: a later inbox that still lists it changes nothing.
    getInbox.mockResolvedValue(inbox({ memberships: [classB], transfers: [req({ status: 'executed' })] }));
    requestSync.mockClear();
    await store().refresh(L);
    expect(getInbox).toHaveBeenCalledTimes(4);
    expect(store().movedByLearner[L]).toBeNull();
    expect(names()).toHaveLength(1);
    requestSync.mockRestore();
  });

  it('a move done long ago (already in the memberships, never seen open here) is not announced', async () => {
    const getInbox = vi.fn(async () => inbox({ memberships: [classB], transfers: [req({ status: 'executed' })] }));
    signedIn(fakeApi({ getInbox }));
    await store().refresh(L);
    expect(getInbox).toHaveBeenCalledTimes(1);
    expect(store().movedByLearner[L] ?? null).toBeNull();
    expect(names()).toEqual([]);
  });

  it('a move whose memberships are already current is announced without a second read', async () => {
    const getInbox = vi.fn().mockResolvedValueOnce(inbox({ transfers: [req()] })).mockResolvedValueOnce(inbox({ memberships: [classB], transfers: [req({ status: 'executed' })] }));
    signedIn(fakeApi({ getInbox }));
    await store().refresh(L);
    await store().refresh(L);
    expect(getInbox).toHaveBeenCalledTimes(2);
    expect(store().movedByLearner[L]).toMatchObject({ id: TID });
  });

  it('stale memberships twice in a row read the inbox at most once more', async () => {
    const getInbox = vi.fn(async () => inbox({ memberships: [classA], transfers: [req({ status: 'executed' })] }));
    signedIn(fakeApi({ getInbox }));
    await store().refresh(L);
    expect(getInbox).toHaveBeenCalledTimes(2);
  });
});

describe('the class tablet of the old class (section 4.6, 4.12)', () => {
  it('a 401 on the inbox of a class-scoped device clears its classes and asks to join again', async () => {
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    signedIn(fakeApi({ getInbox: vi.fn().mockResolvedValueOnce(inbox()).mockResolvedValue({ status: 'error', code: 'http_401' }) }));
    expect(await store().refresh(L)).toEqual([classA]);
    expect(await store().refresh(L)).toBeNull();
    expect(store().byLearner[L]).toEqual([]);
    expect(store().rejoinByLearner[L]).toBe(true);
    expect(store().transfersByLearner[L]).toBeUndefined();
    store().clearRejoin(L);
    expect(store().rejoinByLearner[L]).toBe(false);
  });

  it('after a cold start, a class tablet revoked while the app was closed learns it on the first read', async () => {
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    mem.set(TRANSFERS_ON_KEY(L), true);
    mem.set(`memberships:${L}`, [classA]);
    signedIn(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'http_401' })) }));
    await store().hydrate(L);
    await store().refresh(L);
    expect(store().byLearner[L]).toEqual([]);
    expect(store().rejoinByLearner[L]).toBe(true);
  });

  it('an inbox that says moves are off again (a rollback) records it, and a later 401 changes nothing', async () => {
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    signedIn(fakeApi({ getInbox: vi.fn().mockResolvedValueOnce(inbox()).mockResolvedValueOnce(inbox({ transfersEnabled: false })).mockResolvedValue({ status: 'error', code: 'http_401' }) }));
    await store().refresh(L);
    await store().refresh(L);
    expect(mem.get(TRANSFERS_ON_KEY(L))).toBe(false);
    useMembershipStore.setState({ transfersByLearner: {} });
    await store().refresh(L);
    expect(store().byLearner[L]).toEqual([classA]);
  });

  it('while transfers are locked a class tablet keeps its classes on a 401, as before', async () => {
    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    signedIn(fakeApi({ getInbox: vi.fn().mockResolvedValueOnce(inbox({ transfersEnabled: false })).mockResolvedValue({ status: 'error', code: 'http_401' }) }));
    await store().refresh(L);
    await store().refresh(L);
    expect(store().byLearner[L]).toEqual([classA]);
    expect(store().rejoinByLearner[L] ?? false).toBe(false);
  });

  it('a full device keeps its classes on a 401 (nothing to re-join)', async () => {
    mem.set(`memberships:${L}`, [classA]);
    signedIn(fakeApi({ getInbox: vi.fn(async () => ({ status: 'error', code: 'http_401' })) }));
    await store().hydrate(L);
    await store().refresh(L);
    expect(store().byLearner[L]).toEqual([classA]);
    expect(store().rejoinByLearner[L] ?? false).toBe(false);
  });
});

describe('the learner switch (guard 13)', () => {
  const self = () => useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '10-11', avatar: 'hoya-orange', role: 'learner', createdAt: 't', learnerType: 'self' }] });

  it('a self profile sends selfManaged when the inbox says it differs, then reads it back', async () => {
    self();
    const api = fakeApi();
    signedIn(api);
    await store().refresh(L);
    expect(api.putTransferPrefs).toHaveBeenCalledWith(L, { selfManaged: true }, { deviceId: 'device-test', secret: 'sec' });
    expect(store().transfersByLearner[L]?.selfManaged).toBe(true);
  });

  it('nothing is sent when the server already agrees, for a managed profile, or from a class tablet', async () => {
    self();
    const agreed = fakeApi({ getInbox: vi.fn(async () => inbox({ selfManaged: true })) });
    signedIn(agreed);
    await store().refresh(L);
    expect(agreed.putTransferPrefs).not.toHaveBeenCalled();

    mem.set(TRANSFER_SCOPE_KEY(L), classScopeMarker('sec'));
    const tablet = fakeApi();
    signedIn(tablet);
    await store().refresh(L);
    expect(tablet.putTransferPrefs).not.toHaveBeenCalled();
    mem.clear();

    useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }] });
    const managed = fakeApi();
    signedIn(managed);
    await store().refresh(L);
    expect(managed.putTransferPrefs).not.toHaveBeenCalled();
  });

  it('a profile changed back to child clears the switch; a profile with no learner type leaves it', async () => {
    const api = fakeApi({ getInbox: vi.fn(async () => inbox({ selfManaged: true })), putTransferPrefs: vi.fn(async () => ({ status: 'ok', selfManaged: false })) });
    signedIn(api);
    useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't', learnerType: 'child' }] });
    await store().refresh(L);
    expect(api.putTransferPrefs).toHaveBeenCalledWith(L, { selfManaged: false }, { deviceId: 'device-test', secret: 'sec' });
    expect(store().transfersByLearner[L]?.selfManaged).toBe(false);
    api.putTransferPrefs.mockClear();
    useProfileStore.setState({ profiles: [{ id: L, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }] });
    await store().refresh(L);
    expect(api.putTransferPrefs).not.toHaveBeenCalled();
  });

  it('a refused switch leaves the inbox value', async () => {
    self();
    signedIn(fakeApi({ putTransferPrefs: vi.fn(async () => ({ status: 'error', http: -1, code: 'network' })) }));
    await store().refresh(L);
    expect(store().transfersByLearner[L]?.selfManaged).toBe(false);
  });
});

describe('the device calls (online only, never queued)', () => {
  const consent = { textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' as const, attest: 'grown_up_pin' as const };
  const move = { fromSpaceId: 'space:a', destinationSpaceId: 'space:b', code: 'BBBBBB', consent };

  it('preview answers the sheet or the refusal', async () => {
    const preview = { destination: { id: 'space:b', name: 'B', ownerName: null, schoolName: null, ageBucket: null, learnerCount: null }, premiumChange: 'none', destinationConsentMode: 'parent', relinkAffected: false, sourcePlansAffected: false, visibleToday: [], termsDigest: null, blockReason: null };
    const api = fakeApi({ previewTransfer: vi.fn().mockResolvedValueOnce({ status: 'ok', preview }).mockResolvedValueOnce({ status: 'error', http: 429, code: 'cooldown', retryAfterSeconds: 60 }) });
    signedIn(api);
    expect(await store().previewMove(L, 'space:a', 'BBBBBB')).toEqual({ ok: true, preview });
    expect(api.previewTransfer).toHaveBeenCalledWith(L, { fromSpaceId: 'space:a', code: 'BBBBBB' }, { deviceId: 'device-test', secret: 'sec' });
    expect(await store().previewMove(L, 'space:a', 'BBBBBB')).toEqual({ ok: false, error: 'cooldown', retryAfterSeconds: 60 });
    expect(names()).toEqual([]);
  });

  it('start sends the move, reports it without a profile id, and reads the inbox again', async () => {
    const api = fakeApi({ createTransfer: vi.fn().mockResolvedValueOnce({ status: 'ok', created: true, request: req() }).mockResolvedValueOnce({ status: 'ok', created: false, request: req() }) });
    signedIn(api);
    expect(await store().startMove(L, move)).toEqual({ ok: true, request: req() });
    expect(api.createTransfer).toHaveBeenCalledWith(L, move, { deviceId: 'device-test', secret: 'sec' });
    expect(api.getInbox).toHaveBeenCalledTimes(1);
    expect(names()).toEqual([
      { name: 'space.transfer.requested', payload: { initiator: 'learner_side' } },
      { name: 'space.transfer.consented', payload: { slot: 'learner', basis: 'device_attested' } },
    ]);
    // A repeated create (a lost answer) reports nothing twice.
    expect(await store().startMove(L, move)).toEqual({ ok: true, request: req() });
    expect(names()).toHaveLength(2);
  });

  it('approve, decline and cancel report their slot and read the inbox again', async () => {
    const api = fakeApi({
      approveTransfer: vi.fn(async () => ({ status: 'ok', request: req() })),
      declineTransfer: vi.fn(async () => ({ status: 'ok', request: req({ status: 'declined' }) })),
      cancelTransfer: vi.fn(async () => ({ status: 'ok', request: req({ status: 'cancelled' }) })),
    });
    signedIn(api);
    expect(await store().approveMove(L, TID, consent)).toMatchObject({ ok: true });
    expect(api.approveTransfer).toHaveBeenCalledWith(L, TID, { consent }, { deviceId: 'device-test', secret: 'sec' });
    expect(await store().declineMove(L, TID)).toMatchObject({ ok: true, request: { status: 'declined' } });
    expect(await store().cancelMove(L, TID)).toMatchObject({ ok: true, request: { status: 'cancelled' } });
    expect(api.getInbox).toHaveBeenCalledTimes(3);
    expect(names()).toEqual([
      { name: 'space.transfer.consented', payload: { slot: 'learner', basis: 'device_attested' } },
      { name: 'space.transfer.declined', payload: { slot: 'learner' } },
      { name: 'space.transfer.cancelled', payload: {} },
    ]);
    expect(vi.mocked(track).mock.calls.every(([e]) => e.profileId === undefined)).toBe(true);
  });

  it('refusals keep their code and who started the open request; nothing is reported', async () => {
    signedIn(
      fakeApi({
        createTransfer: vi.fn(async () => ({ status: 'error', http: 409, code: 'already_open', startedBy: 'class' })),
        declineTransfer: vi.fn(async () => ({ status: 'error', http: 409, code: 'not_open' })),
      }),
    );
    expect(await store().startMove(L, move)).toEqual({ ok: false, error: 'already_open', startedBy: 'class' });
    expect(await store().declineMove(L, TID)).toEqual({ ok: false, error: 'not_open' });
    expect(names()).toEqual([]);
  });

  it('a 403 scope_limited marks this device class-scoped for its secret', async () => {
    signedIn(fakeApi({ previewTransfer: vi.fn(async () => ({ status: 'error', http: 403, code: 'scope_limited' })) }));
    expect(await store().previewMove(L, 'space:a', 'BBBBBB')).toEqual({ ok: false, error: 'scope_limited' });
    expect(mem.get(TRANSFER_SCOPE_KEY(L))).toEqual(classScopeMarker('sec'));
  });

  it('no API: off; no credentials: network (nothing is queued)', async () => {
    vi.mocked(apiBaseUrl).mockReturnValue(null);
    setSyncApiForTests(null);
    expect(await store().previewMove(L, 'space:a', 'BBBBBB')).toEqual({ ok: false, error: 'off' });
    expect(await store().cancelMove(L, TID)).toEqual({ ok: false, error: 'off' });
    vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
    const api = fakeApi();
    setSyncApiForTests(api as never);
    expect(await store().startMove(L, move)).toEqual({ ok: false, error: 'network' });
    expect(await store().approveMove(L, TID, consent)).toEqual({ ok: false, error: 'network' });
    expect(api.createTransfer).not.toHaveBeenCalled();
  });
});

describe('a class re-link marks the device class-scoped (variant a)', () => {
  it('the approved re-link writes the marker for the secret it was minted with', async () => {
    const api = fakeApi({
      pollRelink: vi.fn(async () => ({ status: 'ok', state: 'approved', learner: { id: 'profile:m', displayName: 'Minho', ageGroup: '8-9', avatar: 'hoya-blue' }, secret: 'class-secret', snapshot: null })),
      getSnapshot: vi.fn(async () => ({ status: 'none' })),
    });
    setSyncApiForTests(api as never);
    const approved = await store().pollRelink('space:cls', 'relink:1');
    expect(approved.state).toBe('approved');
    expect(mem.get(TRANSFER_SCOPE_KEY('profile:m'))).toEqual(classScopeMarker('class-secret'));
  });
});
