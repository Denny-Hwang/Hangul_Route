import type { Profile } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));

import { INITIAL_ATTEMPT_STATE } from '../../logic/profiles/pin-hash';
import { NO_PIN_SEEN, pinHashFingerprint } from '../../logic/shell/device-gate';
import { readJsonStrict, writeJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';
import { bindDeviceGateMarker, currentDeviceGateMarker } from '../device-gate';
import { useProfileStore } from '../profile-store';

/**
 * F-APP-001 section 3.9 (A-6): the learner app writes `hr:device:gate` on boot and whenever the
 * profiles or the PIN change, independent of the flag, so the console's grown-up lock knows
 * whether this browser holds learner profiles behind a PIN.
 */
const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90:0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const T0 = 1_760_000_000_000;

function profile(id: string, learnerType: 'child' | 'self' = 'child'): Profile {
  return {
    id: `profile:${id}`,
    displayName: id,
    ageGroup: '8-9',
    avatar: 'hoya-orange',
    role: 'learner',
    learnerType,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

function resetStores(): void {
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
  useAccountStore.setState({
    parentEmail: null,
    consentAcceptedAt: null,
    guardianConsentAcceptedAt: null,
    selfConsentAcceptedAt: null,
    pinResetRequestedAt: null,
    subscription: null,
    parentPinHash: null,
    pinSetAt: null,
    pinHashSeen: null,
    pinAttempts: INITIAL_ATTEMPT_STATE,
    hydrated: false,
  });
}

const markerWrites = (): unknown[] => vi.mocked(writeJson).mock.calls.filter(([key]) => key === 'device:gate').map(([, value]) => value);
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('device gate marker writer', () => {
  let unbind: () => void = () => undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    resetStores();
    vi.mocked(writeJson).mockClear();
    vi.mocked(readJsonStrict).mockReset();
    vi.mocked(readJsonStrict).mockImplementation(async () => null);
  });

  afterEach(() => {
    unbind();
    vi.useRealTimers();
  });

  it('writes nothing before both stores have loaded (an empty store must not say "none")', async () => {
    unbind = bindDeviceGateMarker();
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    await flush();
    expect(currentDeviceGateMarker()).toBeNull();
    expect(markerWrites()).toEqual([]);
  });

  it('on boot: writes the marker once both stores are in (pin, with the epoch from pinSetAt)', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: HASH, pinSetAt: T0 - 5, pinHashSeen: pinHashFingerprint(HASH), hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'pin', pinEpoch: T0 - 5 }]);
    expect(currentDeviceGateMarker()).toEqual({ v: 1, gate: 'pin', pinEpoch: T0 - 5 });
  });

  it('a device with no learner profile says none; adding a child without a PIN says nopin', async () => {
    unbind = bindDeviceGateMarker();
    useAccountStore.setState({ hydrated: true });
    useProfileStore.setState({ hydrated: true });
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    useProfileStore.setState({ profiles: [profile('a')] });
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }, { v: 1, gate: 'nopin' }]);
  });

  it('a change that leaves the marker as it is writes nothing more', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: HASH, pinSetAt: T0, pinHashSeen: pinHashFingerprint(HASH), hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    useProfileStore.setState({ profiles: [profile('a'), profile('b')], activeId: 'profile:b' });
    useAccountStore.setState({ parentEmail: 'x@example.com' });
    await flush();
    expect(markerWrites()).toHaveLength(1);
  });

  it('a new PIN moves the epoch to now and the marker follows', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: HASH, pinSetAt: T0 - 1000, pinHashSeen: pinHashFingerprint(HASH), hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    vi.setSystemTime(T0 + 60_000);
    useAccountStore.getState().setParentPinHash('ff:ee');
    await flush();
    expect(markerWrites()).toEqual([
      { v: 1, gate: 'pin', pinEpoch: T0 - 1000 },
      { v: 1, gate: 'pin', pinEpoch: T0 + 60_000 },
    ]);
  });

  it('first boot with a PIN set before A-6: records the fingerprint, keeps epoch 0', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: HASH, pinSetAt: null, pinHashSeen: null, hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'pin', pinEpoch: 0 }]);
    expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', pinHashFingerprint(HASH));
    expect(writeJson).not.toHaveBeenCalledWith('account:pinSetAt', expect.anything());
  });

  it('a PIN changed by an older bundle since the last boot: the epoch becomes now before the marker is written', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: 'new:hash', pinSetAt: T0 - 99_000, pinHashSeen: pinHashFingerprint(HASH), hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'pin', pinEpoch: T0 }]);
    expect(writeJson).toHaveBeenCalledWith('account:pinSetAt', T0);
    expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', pinHashFingerprint('new:hash'));
  });

  it('a device without a PIN records that it saw none', async () => {
    useProfileStore.setState({ profiles: [profile('a', 'self')], hydrated: true });
    useAccountStore.setState({ hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', NO_PIN_SEEN);
    expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
  });

  it('unbinding stops the writer', async () => {
    unbind = bindDeviceGateMarker();
    unbind();
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ hydrated: true });
    await flush();
    expect(markerWrites()).toEqual([]);
  });

  it('a failed write is swallowed, and the next change tries again', async () => {
    vi.mocked(writeJson).mockImplementationOnce(async () => {
      throw new Error('QuotaExceeded');
    });
    useProfileStore.setState({ profiles: [], hydrated: true });
    useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
    unbind = bindDeviceGateMarker();
    await flush();
    useProfileStore.setState({ profiles: [profile('a')] });
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }, { v: 1, gate: 'nopin' }]);
  });

  describe('a none marker is written only when the stored list agrees (no fail-open on a failed read)', () => {
    it('the store looks empty but the stored list holds a learner (the profile read failed at boot): nothing is written', async () => {
      vi.mocked(readJsonStrict).mockImplementation(async (key: string) => (key === 'profiles' ? [profile('a')] : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
      expect(readJsonStrict).toHaveBeenCalledWith('profiles');
      // The device as the app sees it is still reported to the hand-off.
      expect(currentDeviceGateMarker()).toEqual({ v: 1, gate: 'none' });
    });

    it('a strict read that fails writes nothing', async () => {
      vi.mocked(readJsonStrict).mockImplementation(async () => {
        throw new Error('UnknownError');
      });
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
    });

    it('a stored list of grown-up profiles only, or none at all, agrees: none is written', async () => {
      vi.mocked(readJsonStrict).mockImplementation(async () => [{ role: 'parent' }]);
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    });

    it('pin and nopin never wait for the stored list (they only make the lock stricter)', async () => {
      vi.mocked(readJsonStrict).mockImplementation(async () => {
        throw new Error('UnknownError');
      });
      useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }]);
      expect(readJsonStrict).not.toHaveBeenCalled();
    });

    it('the last learner removed in this session: none once the stored list agrees', async () => {
      useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      useProfileStore.setState({ profiles: [] });
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }, { v: 1, gate: 'none' }]);
    });

    it('a newer marker that arrives while none waits for its read wins, and none is never written after it', async () => {
      let release: (value: unknown) => void = () => undefined;
      vi.mocked(readJsonStrict).mockImplementation(() => new Promise((resolve) => (release = resolve)));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      useProfileStore.setState({ profiles: [profile('a')] });
      await flush();
      release(null);
      await flush();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }]);
    });
  });

  it('a profile list several stores change in one task is written once', async () => {
    useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
    useAccountStore.setState({ parentPinHash: HASH, pinSetAt: T0, pinHashSeen: pinHashFingerprint(HASH), hydrated: true });
    unbind = bindDeviceGateMarker();
    useProfileStore.setState({ profiles: [profile('a'), profile('b')] });
    useAccountStore.setState({ parentEmail: 'x@example.com' });
    await flush();
    expect(markerWrites()).toEqual([{ v: 1, gate: 'pin', pinEpoch: T0 }]);
  });
});
