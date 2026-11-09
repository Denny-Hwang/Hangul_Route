import { GUEST_KEY } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
import { pinHashFingerprint } from '../../logic/shell/device-gate';
import { readJsonExact } from '../../platform/storage';
import { PIN_HASH_KEY, useAccountStore } from '../account-store';
import { useGuestStore } from '../guest-store';
import { GATE_RECHECK_MS, nativeGateState, watchNativeGateState } from '../native-gate-state';
import { PROFILES_KEY, useProfileStore } from '../profile-store';

/**
 * F-AUTH-004 section 7.2 (row NS-2; CS-N14): `nativeGateState()` reads the stores and the exact stored values the
 * marker writer reads (the profile list, the PIN hash, the guest record), never the in-memory marker.
 */

const HASH = 'salt:hash';
const CHILD = { id: 'p:mina', displayName: 'Mina', role: 'learner', learnerType: 'child' } as never;

function device(hash: string | null, stored: Record<string, unknown> = {}) {
  useProfileStore.setState({ profiles: [CHILD], hydrated: true });
  useAccountStore.setState({ parentPinHash: hash, pinSetAt: 42, pinHashSeen: pinHashFingerprint(hash), pinHashReadFailed: false, hydrated: true });
  useGuestStore.setState({ record: null, hydrated: true });
  const values: Record<string, unknown> = { [PROFILES_KEY]: [CHILD], [PIN_HASH_KEY]: hash, [GUEST_KEY]: null, ...stored };
  return vi.fn(async (key: string) => {
    const value = values[key];
    if (value instanceof Error) throw value;
    return value ?? null;
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  useProfileStore.setState({ profiles: [], hydrated: false });
  useAccountStore.setState({ parentPinHash: null, pinSetAt: null, pinHashSeen: null, hydrated: false });
  useGuestStore.setState({ record: null, hydrated: false });
});

describe('nativeGateState', () => {
  it('reads the three keys exactly and decides', async () => {
    const read = device(HASH);
    expect(await nativeGateState(read)).toEqual({ state: 'pin', epoch: 42 });
    expect(read.mock.calls.map(([key]) => key).sort()).toEqual([GUEST_KEY, PIN_HASH_KEY, PROFILES_KEY].sort());
    expect(await nativeGateState(device(null))).toEqual({ state: 'nopin' });
  });

  it('before the stores load: unknown, with no read', async () => {
    const read = device(HASH);
    useAccountStore.setState({ hydrated: false });
    expect(await nativeGateState(read)).toEqual({ state: 'unknown' });
    expect(read).not.toHaveBeenCalled();
  });

  it('a read that throws (a failed read, a value that does not parse): unknown', async () => {
    expect(await nativeGateState(device(HASH, { [PROFILES_KEY]: new Error('io') }))).toEqual({ state: 'unknown' });
    expect(await nativeGateState(device(HASH, { [GUEST_KEY]: new SyntaxError('json') }))).toEqual({ state: 'unknown' });
  });

  it('reads through the storage wrapper by default (`readJsonExact`)', async () => {
    device(HASH);
    vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === PIN_HASH_KEY ? HASH : key === PROFILES_KEY ? [CHILD] : null) as never);
    expect(await nativeGateState()).toEqual({ state: 'pin', epoch: 42 });
    // Storage without the PIN memory holds: a write on its way, unknown.
    vi.mocked(readJsonExact).mockImplementation(async () => null);
    expect(await nativeGateState()).toEqual({ state: 'unknown' });
  });
});

describe('watchNativeGateState', () => {
  it('reads again after a store change and stops after the unsubscribe', async () => {
    const read = device(HASH);
    const seen: unknown[] = [];
    const stop = watchNativeGateState((state) => seen.push(state), read);
    useAccountStore.setState({ pinSetAt: 43 });
    await vi.waitFor(() => expect(seen).toEqual([{ state: 'pin', epoch: 43 }]));
    stop();
    useAccountStore.setState({ pinSetAt: 44 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toHaveLength(1);
  });

  it('drops an answer that a newer change overtook', async () => {
    const read = device(HASH);
    const seen: unknown[] = [];
    const stop = watchNativeGateState((state) => seen.push(state), read);
    useProfileStore.setState({ activeId: 'p:mina' } as never);
    useGuestStore.setState({ running: false } as never);
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([{ state: 'pin', epoch: 42 }]);
    stop();
  });

  it('reads once more after an unknown answer (a PIN write on its way), and only once', async () => {
    const values: Record<string, unknown> = { [PROFILES_KEY]: [CHILD], [PIN_HASH_KEY]: null, [GUEST_KEY]: null };
    device(HASH);
    const read = vi.fn(async (key: string) => values[key] ?? null);
    const seen: unknown[] = [];
    const stop = watchNativeGateState((state) => seen.push(state), read);
    useAccountStore.setState({ pinSetAt: 42 });
    await vi.waitFor(() => expect(seen).toEqual([{ state: 'unknown' }]));
    values[PIN_HASH_KEY] = HASH;
    await vi.waitFor(() => expect(seen).toEqual([{ state: 'unknown' }, { state: 'pin', epoch: 42 }]), { timeout: GATE_RECHECK_MS * 4 });
    values[PIN_HASH_KEY] = null;
    useAccountStore.setState({ pinSetAt: 42.5 });
    await vi.waitFor(() => expect(seen).toHaveLength(3));
    await new Promise((resolve) => setTimeout(resolve, GATE_RECHECK_MS * 2));
    // The recheck of the second unknown ran once; a third unknown starts no new timer of its own.
    expect(seen.length).toBeLessThanOrEqual(4);
    stop();
  });
});
