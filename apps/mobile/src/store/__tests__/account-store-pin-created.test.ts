import { PIN_SET_AT_KEY } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import { INITIAL_ATTEMPT_STATE } from '../../logic/profiles/pin-hash';
import { pinHashFingerprint } from '../../logic/shell/device-gate';
import { readJson, writeJson } from '../../platform/storage';
import { PIN_CREATED_AT_KEY, useAccountStore } from '../account-store';

/*
 * `account:pinCreatedAt` — F-SPACE-002 section 4.11 (device rules), PR T-7a.
 * When the current grown-up PIN was made, so a PIN made less than a day ago
 * cannot attest a class move. Absent on a PIN that predates this feature,
 * which counts as old enough.
 */

const written = (key: string): unknown[] =>
  vi
    .mocked(writeJson)
    .mock.calls.filter(([k]) => k === key)
    .map(([, v]) => v);

describe('account-store pinCreatedAt', () => {
  beforeEach(() => {
    useAccountStore.setState({ parentPinHash: null, pinSetAt: null, pinCreatedAt: null, pinHashSeen: null, pinHashReadFailed: false, pinAttempts: INITIAL_ATTEMPT_STATE, pinResetRequestedAt: null, hydrated: false });
    vi.mocked(writeJson).mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(readJson).mockImplementation(async () => null);
  });

  it('the key name is fixed', () => {
    expect(PIN_CREATED_AT_KEY).toBe('account:pinCreatedAt');
  });

  it('every new PIN (first set, change, Forgot PIN reset) writes its creation time', () => {
    vi.setSystemTime(1_000);
    useAccountStore.getState().setParentPinHash('a:1');
    expect(useAccountStore.getState().pinCreatedAt).toBe(1_000);
    vi.setSystemTime(2_000);
    useAccountStore.getState().requestPinReset();
    useAccountStore.getState().setParentPinHash('b:2');
    expect(useAccountStore.getState().pinCreatedAt).toBe(2_000);
    expect(written(PIN_CREATED_AT_KEY)).toEqual([1_000, 2_000]);
  });

  it('removing the PIN keeps the time and writes nothing (there is no PIN to attest with)', () => {
    useAccountStore.setState({ parentPinHash: 'a:1', pinCreatedAt: 5 });
    useAccountStore.getState().setParentPinHash(null);
    expect(useAccountStore.getState().pinCreatedAt).toBe(5);
    expect(written(PIN_CREATED_AT_KEY)).toEqual([]);
  });

  it('hydrate reads it; absent or unreadable reads as null (a PIN older than this feature)', async () => {
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === PIN_CREATED_AT_KEY ? 1_760_000_000_000 : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBe(1_760_000_000_000);
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === PIN_CREATED_AT_KEY ? 'yesterday' : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBeNull();
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === PIN_CREATED_AT_KEY ? -4 : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBeNull();
    vi.mocked(readJson).mockImplementation(async () => null);
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBeNull();
  });

  it('hydrate falls back to the PIN epoch for a PIN made after it but before this key, so it still waits its day', async () => {
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === PIN_SET_AT_KEY ? 1_760_000_000_000 : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBe(1_760_000_000_000);
    // The creation time wins when both are known.
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === PIN_SET_AT_KEY ? 5 : key === PIN_CREATED_AT_KEY ? 9 : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinCreatedAt).toBe(9);
    expect(written(PIN_CREATED_AT_KEY)).toEqual([]);
  });

  it('a PIN an older bundle changed counts as made now (the epoch moves, so does the creation time)', () => {
    useAccountStore.setState({ parentPinHash: 'new:hash', pinSetAt: 5, pinCreatedAt: 5, pinHashSeen: pinHashFingerprint('old:hash') });
    useAccountStore.getState().reconcilePinEpoch(9_000);
    expect(useAccountStore.getState().pinCreatedAt).toBe(9_000);
    expect(written(PIN_CREATED_AT_KEY)).toEqual([9_000]);
  });

  it('the first look at a PIN from before these keys leaves it absent (old enough)', () => {
    useAccountStore.setState({ parentPinHash: 'old:hash', pinSetAt: null, pinCreatedAt: null, pinHashSeen: null });
    useAccountStore.getState().reconcilePinEpoch(9_000);
    expect(useAccountStore.getState().pinCreatedAt).toBeNull();
    expect(written(PIN_CREATED_AT_KEY)).toEqual([]);
  });
});
