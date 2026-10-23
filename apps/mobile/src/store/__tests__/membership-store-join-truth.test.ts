import type { LearnerMembership, ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: vi.fn(() => 'https://api.example.com'), createSyncApi: vi.fn() }));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false, routeEnabled: true },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import { apiBaseUrl } from '../../platform/sync-api';
import { readJson } from '../../platform/storage';
import { TRANSFER_SCOPE_KEY, classScopeMarker } from '../../logic/transfers/device-scope';
import { useMembershipStore } from '../membership-store';
import { usePlanStore } from '../plan-store';
import { useTierStore } from '../tier-store';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';
import { useAccountStore } from '../account-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore } from '../sync-store';

/**
 * Owner report 2026-10-23: a learner moved from class A to class B showed in both on the device. The join answer's
 * list replaces the cache (never merged into a stale one), and an inbox read that a newer join, leave or read
 * overtook is dropped, so an older [A] never writes over a newer [B].
 */

const snap: ProgressSnapshot = { profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
const rowA: LearnerMembership = { spaceId: 'space:a', kind: 'class', name: 'Class A', role: 'student', joinedAt: 't' };
const rowB: LearnerMembership = { spaceId: 'space:b', kind: 'class', name: 'Class B', role: 'student', joinedAt: 't2' };
const offline = { status: 'error', code: 'network' } as const;
const inbox = (memberships: LearnerMembership[], extra: Record<string, unknown> = {}) => ({
  status: 'ok' as const,
  inbox: { rev: 1, plans: [], memberships, tier: 'premium', tierSource: null, tierValidUntil: '2099-01-01T00:00:00.000Z', serverTime: 't', ...extra },
});

function fakeApi(over: Record<string, unknown> = {}) {
  return {
    register: vi.fn(async () => ({ status: 'ok', learnerId: 'profile:a', secret: 'sec' })),
    putSnapshot: vi.fn(async () => ({ status: 'ok', rev: 1 })),
    getSnapshot: vi.fn(),
    joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: rowB, memberships: [rowB] })),
    leaveSpace: vi.fn(async () => ({ status: 'ok', left: true })),
    getInbox: vi.fn(async () => offline),
    ...over,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const ids = (rows: readonly LearnerMembership[] | null | undefined) => (rows ?? []).map((r) => r.spaceId);

beforeEach(() => {
  mem.clear();
  useMembershipStore.setState({ byLearner: {}, transfersByLearner: {}, movedByLearner: {}, rejoinByLearner: {}, executedSeen: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  useSyncStore.setState({ byLearner: {} });
  useUiStore.setState({ parentGateOpenedAt: null });
  useAccountStore.setState({ parentPinHash: null });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: { 'profile:a': snap }, hydratedFor: new Set(['profile:a']) });
  vi.mocked(apiBaseUrl).mockReturnValue('https://api.example.com');
  useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
});

describe('membership-store join: the answer\'s list is the truth (owner report 2026-10-23)', () => {
  it('a cache of [A] and a join answering memberships [B] leave [B], in memory and on disk, even with the inbox read offline', async () => {
    mem.set('memberships:profile:a', [rowA]);
    const api = fakeApi();
    setSyncApiForTests(api as never);
    const result = await useMembershipStore.getState().join('profile:a', 'space:b', 'K7M2X9');
    expect(result).toMatchObject({ ok: true, membership: rowB });
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
    expect(ids(mem.get('memberships:profile:a') as LearnerMembership[])).toEqual(['space:b']);
  });

  it('an older Worker (no memberships) still merges the one row into the cache', async () => {
    mem.set('memberships:profile:a', [rowA]);
    setSyncApiForTests(fakeApi({ joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: rowB })) }) as never);
    await useMembershipStore.getState().join('profile:a', 'space:b', 'K7M2X9');
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:a', 'space:b']);
  });

  it('a join answer with the list keeps the order rule (sorted by name)', async () => {
    const rowC: LearnerMembership = { ...rowA, spaceId: 'space:c', name: 'Art club' };
    setSyncApiForTests(fakeApi({ joinSpace: vi.fn(async () => ({ status: 'ok', alreadyMember: false, membership: rowB, memberships: [rowB, rowC] })) }) as never);
    await useMembershipStore.getState().join('profile:a', 'space:b', 'K7M2X9');
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:c', 'space:b']);
  });
});

describe('membership-store refresh: an overtaken inbox read is dropped (owner report 2026-10-23)', () => {
  it('an older read answering [A] after the join put [B] changes nothing', async () => {
    const first = deferred<ReturnType<typeof inbox>>();
    const getInbox = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(offline);
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    const pending = useMembershipStore.getState().refresh('profile:a');
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1));
    await useMembershipStore.getState().join('profile:a', 'space:b', 'K7M2X9');
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
    first.resolve(inbox([rowA]));
    expect(ids(await pending)).toEqual(['space:b']);
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
    expect(ids(mem.get('memberships:profile:a') as LearnerMembership[])).toEqual(['space:b']);
    // Nothing else of the overtaken answer was applied either: its tier never reached the tier store.
    expect(useTierStore.getState().byLearner['profile:a']).toBeUndefined();
  });

  it('an older read answering [A, B] after a leave of A changes nothing', async () => {
    useMembershipStore.setState({ byLearner: { 'profile:a': [rowA, rowB] } });
    const first = deferred<ReturnType<typeof inbox>>();
    const getInbox = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(offline);
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    const pending = useMembershipStore.getState().refresh('profile:a');
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1));
    expect(await useMembershipStore.getState().leave('profile:a', 'space:a')).toBe(true);
    first.resolve(inbox([rowA, rowB]));
    await pending;
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
  });

  it('of two overlapping reads, the newer one wins whichever answers last', async () => {
    const first = deferred<ReturnType<typeof inbox>>();
    const second = deferred<ReturnType<typeof inbox>>();
    const getInbox = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    const older = useMembershipStore.getState().refresh('profile:a');
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1));
    const newer = useMembershipStore.getState().refresh('profile:a');
    await vi.waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2));
    second.resolve(inbox([rowB]));
    expect(ids(await newer)).toEqual(['space:b']);
    first.resolve(inbox([rowA]));
    expect(ids(await older)).toEqual(['space:b']);
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
  });

  it('a revoked class tablet: a join that lands while the 401 read is still checking the device is not wiped', async () => {
    // The 401 branch reads the device scope after the answer; a join that lands in that window bumps the counter.
    mem.set(TRANSFER_SCOPE_KEY('profile:a'), classScopeMarker('sec'));
    useMembershipStore.setState({
      byLearner: { 'profile:a': [rowA] },
      transfersByLearner: { 'profile:a': { enabled: true, deviceConsent: false, selfManaged: false, scope: 'class', requests: [] } },
    });
    const gate = deferred<void>();
    let gated = false;
    vi.mocked(readJson).mockImplementation(async (k: string) => {
      if (k === TRANSFER_SCOPE_KEY('profile:a') && !gated) {
        gated = true;
        await gate.promise;
      }
      return (mem.get(k) ?? null) as never;
    });
    try {
      const getInbox = vi.fn().mockResolvedValueOnce({ status: 'error', code: 'http_401' }).mockResolvedValue(inbox([rowB]));
      setSyncApiForTests(fakeApi({ getInbox }) as never);
      const pending = useMembershipStore.getState().refresh('profile:a');
      await vi.waitFor(() => expect(gated).toBe(true));
      await useMembershipStore.getState().join('profile:a', 'space:b', 'K7M2X9');
      expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
      gate.resolve();
      await pending;
      expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
      expect(useMembershipStore.getState().rejoinByLearner['profile:a']).toBeUndefined();
    } finally {
      vi.mocked(readJson).mockImplementation(async (k: string) => (mem.get(k) ?? null) as never);
    }
  });

  it('a read nothing overtook still applies as before', async () => {
    setSyncApiForTests(fakeApi({ getInbox: vi.fn(async () => inbox([rowA])) }) as never);
    expect(ids(await useMembershipStore.getState().refresh('profile:a'))).toEqual(['space:a']);
    expect(useTierStore.getState().byLearner['profile:a']).toMatchObject({ tier: 'premium' });
  });
});

describe('membership-store refresh: a teacher move the memberships do not show yet is read again (owner report 2026-10-23)', () => {
  const move = { id: 'move:1', to: { spaceId: 'space:b', name: 'Class B' }, from: { spaceId: 'space:a', name: 'Class A' }, executedAt: '2026-10-23T00:00:00.000Z' };

  it('memberships still in the source: one extra read, whose list stands', async () => {
    const getInbox = vi.fn().mockResolvedValueOnce(inbox([rowA], { classMoves: [move] })).mockResolvedValueOnce(inbox([rowB], { classMoves: [move] }));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    expect(ids(await useMembershipStore.getState().refresh('profile:a'))).toEqual(['space:b']);
    expect(getInbox).toHaveBeenCalledTimes(2);
    expect(ids(useMembershipStore.getState().byLearner['profile:a'])).toEqual(['space:b']);
  });

  it('the destination missing (an older Worker that sends no from): one extra read', async () => {
    const { from: _from, ...noFrom } = move;
    const getInbox = vi.fn().mockResolvedValueOnce(inbox([], { classMoves: [noFrom] })).mockResolvedValueOnce(inbox([rowB], { classMoves: [noFrom] }));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    expect(ids(await useMembershipStore.getState().refresh('profile:a'))).toEqual(['space:b']);
    expect(getInbox).toHaveBeenCalledTimes(2);
  });

  it('never loops: a second stale answer stands, and the same move is not read again later in the session', async () => {
    const getInbox = vi.fn().mockResolvedValue(inbox([rowA], { classMoves: [move] }));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    await useMembershipStore.getState().refresh('profile:a');
    expect(getInbox).toHaveBeenCalledTimes(2);
    await useMembershipStore.getState().refresh('profile:a');
    expect(getInbox).toHaveBeenCalledTimes(3);
  });

  it('a move first seen stale during the extra read a transfer started gets its own read at the next refresh', async () => {
    const t = { id: 'tr:1', status: 'executed', from: { spaceId: 'space:a', name: 'Class A' }, to: { spaceId: 'space:b', name: 'Class B' }, createdAt: 't', expiresAt: '2099-01-01T00:00:00.000Z' };
    const toC = { id: 'move:c', to: { spaceId: 'space:c', name: 'Class C' }, from: { spaceId: 'space:b', name: 'Class B' }, executedAt: '2026-10-23T00:00:00.000Z' };
    const rowC: LearnerMembership = { ...rowA, spaceId: 'space:c', name: 'Class C' };
    const getInbox = vi
      .fn()
      // The transfer is stale here (still in A): one extra read, which shows B but not yet the teacher move to C.
      .mockResolvedValueOnce(inbox([rowA], { transfers: [t] }))
      .mockResolvedValueOnce(inbox([rowB], { transfers: [t], classMoves: [toC] }))
      // The next refresh still sees the move to C stale: it gets its one read now.
      .mockResolvedValueOnce(inbox([rowB], { transfers: [t], classMoves: [toC] }))
      .mockResolvedValue(inbox([rowC], { transfers: [t], classMoves: [toC] }));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    await useMembershipStore.getState().refresh('profile:a');
    expect(getInbox).toHaveBeenCalledTimes(2);
    expect(ids(await useMembershipStore.getState().refresh('profile:a'))).toEqual(['space:c']);
    expect(getInbox).toHaveBeenCalledTimes(4);
  });

  it('memberships that already show the newest move: no extra read; an older move is not looked at', async () => {
    const back = { id: 'move:2', to: { spaceId: 'space:a', name: 'Class A' }, from: { spaceId: 'space:b', name: 'Class B' }, executedAt: '2026-10-24T00:00:00.000Z' };
    const getInbox = vi.fn().mockResolvedValue(inbox([rowB], { classMoves: [move] }));
    setSyncApiForTests(fakeApi({ getInbox }) as never);
    await useMembershipStore.getState().refresh('profile:a');
    expect(getInbox).toHaveBeenCalledTimes(1);
    // Moved A to B, then back B to A: the memberships show A, which the newest move explains.
    getInbox.mockResolvedValue(inbox([rowA], { classMoves: [move, back] }));
    await useMembershipStore.getState().refresh('profile:a');
    expect(getInbox).toHaveBeenCalledTimes(2);
  });
});
