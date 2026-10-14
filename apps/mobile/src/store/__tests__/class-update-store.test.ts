import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
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
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

import { track } from '../../platform/telemetry';
import { resetClassUpdateForTests, useClassUpdateStore } from '../class-update-store';
import { notifyProfileRemoved } from '../profile-removal';
import { setSyncApiForTests, useSyncStore } from '../sync-store';

/**
 * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4, TV-D5, TV-D10: the class update and the one-time move notices.
 * The inbox fields stay in memory; the seen notices are kept per profile; the acknowledgement is sent online only.
 */

const L = 'profile:a';
const scope = { needed: true, current: 'class-scope-2026-10' };
const move = { id: 'move:1', to: { spaceId: 'space:b', name: 'Saturday Class B' }, executedAt: 't' };

beforeEach(() => {
  mem.clear();
  resetClassUpdateForTests();
  vi.mocked(track).mockClear();
  setSyncApiForTests(null);
});

describe('class-update store', () => {
  it('keeps the inbox fields per learner, in memory; an older Worker reads as nothing', () => {
    useClassUpdateStore.getState().applyInbox(L, { classScope: scope, classMoves: [move] });
    expect(useClassUpdateStore.getState().scopeByLearner[L]).toEqual(scope);
    expect(useClassUpdateStore.getState().movesByLearner[L]).toEqual([move]);
    useClassUpdateStore.getState().applyInbox(L, {});
    expect(useClassUpdateStore.getState().scopeByLearner[L]).toBeNull();
    expect(useClassUpdateStore.getState().movesByLearner[L]).toEqual([]);
    expect(mem.size).toBe(0);
  });

  it('a notice is marked seen once, stored per profile, and read back in a later session', async () => {
    expect(await useClassUpdateStore.getState().hydrateSeen(L)).toEqual([]);
    await useClassUpdateStore.getState().markSeen(L, 'move:1');
    expect(mem.get('class-moves-seen:profile:a')).toEqual(['move:1']);
    expect(track).toHaveBeenCalledWith({ name: 'space.move.notice_seen', payload: { seenOn: 'device' } });
    resetClassUpdateForTests();
    expect(await useClassUpdateStore.getState().hydrateSeen(L)).toEqual(['move:1']);
    // the second read in a session answers from memory
    mem.set('class-moves-seen:profile:a', ['other']);
    expect(await useClassUpdateStore.getState().hydrateSeen(L)).toEqual(['move:1']);
  });

  it('a removed profile leaves no key behind', async () => {
    await useClassUpdateStore.getState().markSeen(L, 'move:1');
    notifyProfileRemoved(L);
    await Promise.resolve();
    expect(mem.has('class-moves-seen:profile:a')).toBe(false);
  });

  it('acknowledges with the version the inbox named and clears the line; offline, stale and failures say so', async () => {
    const putClassScopeAck = vi.fn();
    setSyncApiForTests({ putClassScopeAck } as never);
    vi.spyOn(useSyncStore.getState(), 'hydrate').mockResolvedValue({ learnerId: L, secret: 's3cret' } as never);
    useClassUpdateStore.getState().applyInbox(L, { classScope: scope, classMoves: [] });

    putClassScopeAck.mockResolvedValueOnce({ status: 'error', http: -1, code: 'network' });
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('offline');
    putClassScopeAck.mockResolvedValueOnce({ status: 'error', http: 422, code: 'class_scope_stale' });
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('stale');
    putClassScopeAck.mockResolvedValueOnce({ status: 'error', http: 403, code: 'scope_limited' });
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('failed');
    expect(useClassUpdateStore.getState().scopeByLearner[L]?.needed).toBe(true);

    putClassScopeAck.mockResolvedValueOnce({ status: 'ok' });
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('ok');
    expect(putClassScopeAck).toHaveBeenLastCalledWith(L, 'class-scope-2026-10', { deviceId: 'device-test', secret: 's3cret' });
    expect(useClassUpdateStore.getState().scopeByLearner[L]?.needed).toBe(false);
  });

  it('cannot acknowledge without an inbox, an API or device credentials', async () => {
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('failed');
    useClassUpdateStore.getState().applyInbox(L, { classScope: scope });
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('failed');
    setSyncApiForTests({ putClassScopeAck: vi.fn() } as never);
    vi.spyOn(useSyncStore.getState(), 'hydrate').mockResolvedValue({ learnerId: L, secret: null } as never);
    expect(await useClassUpdateStore.getState().acknowledge(L)).toBe('failed');
  });
});
