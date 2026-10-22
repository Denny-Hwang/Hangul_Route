import type { Profile } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));

import { INITIAL_ATTEMPT_STATE } from '../../logic/profiles/pin-hash';
import { NO_PIN_SEEN, pinHashFingerprint } from '../../logic/shell/device-gate';
import { readJsonExact, writeJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';
import { bindDeviceGateMarker, currentDeviceGateMarker } from '../device-gate';
import { useGuestStore } from '../guest-store';
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
  // [GU] Row GU-2: `hr:guest` read at boot with no guest, unless a test says otherwise.
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
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
    pinHashReadFailed: false,
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
    vi.mocked(readJsonExact).mockReset();
    vi.mocked(readJsonExact).mockImplementation(async () => null);
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
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [profile('a')] : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
      expect(readJsonExact).toHaveBeenCalledWith('profiles');
      // The device as the app sees it is still reported to the hand-off.
      expect(currentDeviceGateMarker()).toEqual({ v: 1, gate: 'none' });
    });

    it('a strict read that fails writes nothing', async () => {
      vi.mocked(readJsonExact).mockImplementation(async () => {
        throw new Error('UnknownError');
      });
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
    });

    it('a stored list of grown-up profiles only, or none at all, agrees: none is written', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [{ role: 'parent' }] : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    });

    it('a self-only device without a PIN: the stored self profile agrees, none is written', async () => {
      const self = profile('me', 'self');
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [self] : null));
      useProfileStore.setState({ profiles: [self], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    });

    it('a refused none is not read again on every store change, only after the marker changed', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [profile('a')] : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      useAccountStore.setState({ parentEmail: 'x@example.com' });
      useProfileStore.setState({ activeId: null });
      await flush();
      expect(readJsonExact).toHaveBeenCalledTimes(2);
      expect(markerWrites()).toEqual([]);

      // The device says something else (a child, no PIN), then none again: checked again, and now it agrees.
      useProfileStore.setState({ profiles: [profile('b')] });
      await flush();
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [] : null));
      useProfileStore.setState({ profiles: [] });
      await flush();
      // The list and the hash, then [GU] `hr:guest` once the two agree.
      expect(readJsonExact).toHaveBeenCalledTimes(5);
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }, { v: 1, gate: 'none' }]);
    });

    it('pin and nopin never wait for the stored list (they only make the lock stricter)', async () => {
      vi.mocked(readJsonExact).mockImplementation(async () => {
        throw new Error('UnknownError');
      });
      useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }]);
      expect(readJsonExact).not.toHaveBeenCalled();
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
      vi.mocked(readJsonExact).mockImplementation((key: string) => (key === 'profiles' ? new Promise((resolve) => (release = resolve)) : Promise.resolve(null)));
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

  describe('a PIN hash that could not be read never says less than the device holds (A-6 review)', () => {
    it('a self-only device whose stored hash is there while the store lost it: none is not written', async () => {
      const self = profile('me', 'self');
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'profiles') return [self];
        if (key === 'account:parentPinHash') return HASH;
        return null;
      });
      useProfileStore.setState({ profiles: [self], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(readJsonExact).toHaveBeenCalledWith('account:parentPinHash');
      expect(markerWrites()).toEqual([]);
    });

    it('a failed PIN hash read at hydrate: no marker, no reconcile, no pinHashSeen, nothing for the hand-off', async () => {
      const self = profile('me', 'self');
      useProfileStore.setState({ profiles: [self], hydrated: true });
      useAccountStore.setState({ pinSetAt: T0 - 5, pinHashSeen: pinHashFingerprint(HASH), pinHashReadFailed: true, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
      expect(writeJson).not.toHaveBeenCalled();
      expect(currentDeviceGateMarker()).toBeNull();
      expect(useAccountStore.getState().pinHashSeen).toBe(pinHashFingerprint(HASH));
    });

    it('a PIN set after the failed read: the writer resumes with the new epoch', async () => {
      useProfileStore.setState({ profiles: [profile('a')], hydrated: true });
      useAccountStore.setState({ pinHashSeen: pinHashFingerprint(HASH), pinHashReadFailed: true, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      useAccountStore.getState().setParentPinHash('ff:ee');
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'pin', pinEpoch: T0 }]);
    });

    it('a stored PIN hash that is not a string refuses none', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:parentPinHash' ? 7 : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
    });

    it('a stored profile list that does not parse (the exact read throws) refuses none', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'profiles') throw new SyntaxError('Unexpected token');
        return null;
      });
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
    });

    it('a stored profile value that is not a list refuses none', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? { a: 1 } : null));
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
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

  // [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-D14, CS-G6 (row GU-2): a live guest counts as a learner read as a child.
  describe('[GU] a live guest keeps the marker off none (CS-G6)', () => {
    const guest = { v: 1 as const, id: 'profile:guest001', startedAt: '2026-10-01T00:00:00.000Z', lastAt: '2026-10-01T00:00:00.000Z', via: 'site' as const, questDone: false };

    it('a device with only a guest: nopin; with a PIN: pin; never none', async () => {
      useGuestStore.setState({ record: guest });
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }]);
      useAccountStore.setState({ parentPinHash: HASH, pinSetAt: T0, pinHashSeen: pinHashFingerprint(HASH) });
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }, { v: 1, gate: 'pin', pinEpoch: T0 }]);
    });

    it('a self-only device without a PIN reads nopin while the guest lives, and none once it is swept', async () => {
      const self = profile('me', 'self');
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [self] : null));
      useGuestStore.setState({ record: guest });
      useProfileStore.setState({ profiles: [self], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }]);
      useGuestStore.setState({ record: null });
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'nopin' }, { v: 1, gate: 'none' }]);
    });

    it('a saved guest (its id is a profile) counts as that profile only', async () => {
      const self = { ...profile('me', 'self'), id: guest.id };
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'profiles' ? [self] : key === 'guest' ? guest : null));
      useGuestStore.setState({ record: guest });
      useProfileStore.setState({ profiles: [self], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    });

    it('nothing is written before hr:guest has been read (an unread guest store must not say none)', async () => {
      useGuestStore.setState({ hydrated: false });
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(currentDeviceGateMarker()).toBeNull();
      expect(markerWrites()).toEqual([]);
      useGuestStore.setState({ hydrated: true });
      await flush();
      expect(markerWrites()).toEqual([{ v: 1, gate: 'none' }]);
    });

    it('none is refused while the stored hr:guest holds a live guest, or a record that does not parse', async () => {
      useProfileStore.setState({ profiles: [], hydrated: true });
      useAccountStore.setState({ pinHashSeen: NO_PIN_SEEN, hydrated: true });
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'guest' ? guest : null));
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
      unbind();
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'guest') throw new SyntaxError('not JSON');
        return null;
      });
      unbind = bindDeviceGateMarker();
      await flush();
      expect(markerWrites()).toEqual([]);
    });
  });
});
