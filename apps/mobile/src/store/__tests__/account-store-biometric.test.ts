import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (sections 8.2, 8.3, 8.6, 15; CS-8, CS-18): the face or fingerprint
 * opt-in in the account store. Valid only for its PIN epoch; any new PIN turns it off and deletes the item; an
 * invalidated read turns it off; a cancel is not a miss and leaves a pause as it is; a success resets the strikes.
 */
const disk = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? structuredClone(disk.get(key)) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    disk.set(key, structuredClone(value));
  }),
}));

const port = vi.hoisted(() => ({
  available: vi.fn(async () => true),
  write: vi.fn(async (_prompt: string): Promise<'written' | 'cancelled' | 'unavailable'> => 'written'),
  read: vi.fn(async (_prompt: string): Promise<'ok' | 'invalidated' | 'cancelled'> => 'ok'),
  remove: vi.fn(async () => undefined),
}));
vi.mock('../../platform/biometric', () => ({ biometric: port }));

const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(event);
    return true;
  }),
}));

import { PIN_SET_AT_KEY } from '@hangul-route/content-schema';
import { flags } from '../../config/flags';
import { readJson, writeJson } from '../../platform/storage';
import { INITIAL_ATTEMPT_STATE, type AttemptState } from '../../logic/profiles/pin-hash';
import { useAccountStore } from '../account-store';

const EPOCH = 1_800_000_000_000;
const PROMPT = 'Use face or fingerprint';
const RECORD_KEY = 'account:biometricShortcut';

function reset(pinAttempts: AttemptState = INITIAL_ATTEMPT_STATE): void {
  disk.clear();
  tracked.length = 0;
  useAccountStore.setState({ parentPinHash: 'h:1234', pinSetAt: EPOCH, pinAttempts, biometricShortcut: null, pinHashReadFailed: false, pinHashSeen: null });
}

const changes = () => tracked.filter((e) => e.name === 'pin.biometric_changed').map((e) => e.payload);

beforeEach(() => {
  vi.clearAllMocks();
  port.write.mockResolvedValue('written');
  port.read.mockResolvedValue('ok');
  reset();
});

describe('[OA] turning it on (fresh PIN in the Grown-up area)', () => {
  it('writes the token first, then the record for the current epoch (no token), and emits on/user', async () => {
    expect(await useAccountStore.getState().enableBiometricShortcut(PROMPT, () => EPOCH + 9)).toBe('written');
    expect(port.write).toHaveBeenCalledWith(PROMPT);
    const record = { v: 1, enabledAt: EPOCH + 9, epoch: EPOCH };
    expect(useAccountStore.getState().biometricShortcut).toEqual(record);
    expect(disk.get(RECORD_KEY)).toEqual(record);
    expect(changes()).toEqual([{ on: true, reason: 'user' }]);
  });

  it('a cancelled or unavailable write turns nothing on', async () => {
    for (const result of ['cancelled', 'unavailable'] as const) {
      port.write.mockResolvedValueOnce(result);
      expect(await useAccountStore.getState().enableBiometricShortcut(PROMPT)).toBe(result);
      expect(useAccountStore.getState().biometricShortcut).toBeNull();
      expect(disk.has(RECORD_KEY)).toBe(false);
    }
    expect(changes()).toEqual([]);
  });

  it('never without a PIN', async () => {
    useAccountStore.setState({ parentPinHash: null });
    expect(await useAccountStore.getState().enableBiometricShortcut(PROMPT)).toBe('unavailable');
    expect(port.write).not.toHaveBeenCalled();
  });
});

describe('[OA] opt-in validity by epoch (section 8.6)', () => {
  it('any PIN change turns it off and deletes the item (pin_changed)', async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    tracked.length = 0;
    useAccountStore.getState().setParentPinHash('h:9999');
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(disk.get(RECORD_KEY)).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(changes()).toEqual([{ on: false, reason: 'pin_changed' }]);
  });

  it('a new PIN without the shortcut on emits nothing', () => {
    useAccountStore.getState().setParentPinHash('h:9999');
    expect(changes()).toEqual([]);
  });

  it('a new PIN deletes an item left without a record (the app stopped before the record write)', () => {
    useAccountStore.getState().setParentPinHash('h:9999');
    expect(port.remove).toHaveBeenCalled();
    expect(disk.has(RECORD_KEY)).toBe(false);
    expect(changes()).toEqual([]);
  });

  it('an epoch an older bundle moved deletes the item even with no record, emitting nothing', () => {
    useAccountStore.setState({ pinHashSeen: 'fp:other' });
    useAccountStore.getState().reconcilePinEpoch(EPOCH + 60_000);
    expect(port.remove).toHaveBeenCalled();
    expect(changes()).toEqual([]);
  });

  it('an epoch an older bundle moved turns it off at reconcile', async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    tracked.length = 0;
    // The stored hash is not the one last seen: the epoch moves.
    useAccountStore.setState({ pinHashSeen: 'fp:other' });
    useAccountStore.getState().reconcilePinEpoch(EPOCH + 60_000);
    expect(useAccountStore.getState().pinSetAt).toBe(EPOCH + 60_000);
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(changes()).toEqual([{ on: false, reason: 'pin_changed' }]);
  });

  it('hydrate keeps a record for the current epoch and turns off one for another', async () => {
    disk.set('account:parentPinHash', 'h:1234');
    disk.set(PIN_SET_AT_KEY, EPOCH);
    disk.set(RECORD_KEY, { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH });
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().biometricShortcut).toEqual({ v: 1, enabledAt: EPOCH + 1, epoch: EPOCH });
    expect(changes()).toEqual([]);

    disk.set(RECORD_KEY, { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH - 5 });
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(disk.get(RECORD_KEY)).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(changes()).toEqual([{ on: false, reason: 'pin_changed' }]);
  });

  it('hydrate keeps any record while the PIN hash cannot be read, and emits nothing', async () => {
    disk.set('account:parentPinHash', 42);
    disk.set(PIN_SET_AT_KEY, EPOCH);
    disk.set(RECORD_KEY, { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH - 5 });
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().pinHashReadFailed).toBe(true);
    expect(useAccountStore.getState().biometricShortcut).toEqual({ v: 1, enabledAt: EPOCH + 1, epoch: EPOCH - 5 });
    expect(disk.get(RECORD_KEY)).toEqual({ v: 1, enabledAt: EPOCH + 1, epoch: EPOCH - 5 });
    expect(port.remove).not.toHaveBeenCalled();
    expect(changes()).toEqual([]);
    // It opens nothing meanwhile.
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('off');
  });

  it('off then on again at once: the new token is written only after the delete', async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    const order: string[] = [];
    let finishRemove: () => void = () => undefined;
    port.remove.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishRemove = () => {
            order.push('remove');
            resolve(undefined);
          };
        }),
    );
    port.write.mockImplementationOnce(async () => {
      order.push('write');
      return 'written';
    });
    useAccountStore.getState().disableBiometricShortcut('user');
    const enabling = useAccountStore.getState().enableBiometricShortcut(PROMPT);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);
    finishRemove();
    expect(await enabling).toBe('written');
    expect(order).toEqual(['remove', 'write']);
    expect(useAccountStore.getState().biometricShortcut).not.toBeNull();
  });

  it('a stale record does nothing on the PIN screen', async () => {
    useAccountStore.setState({ biometricShortcut: { v: 1, enabledAt: 1, epoch: EPOCH - 1 } });
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('off');
    expect(port.read).not.toHaveBeenCalled();
  });
});

describe('[OA] using it (CS-8, CS-18)', () => {
  const paused = (): AttemptState => ({ failures: [], lockedUntil: Date.now() + 15 * 60_000, strikes: 4, lastMissAt: Date.now() });

  beforeEach(async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    tracked.length = 0;
  });

  it('a success during a pause counts as a correct PIN: no pause, strikes back to 0', async () => {
    useAccountStore.setState({ pinAttempts: paused() });
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('ok');
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
    expect(disk.get('account:pinAttempts')).toEqual(INITIAL_ATTEMPT_STATE);
    // It never sets, changes or resets the PIN.
    expect(useAccountStore.getState().parentPinHash).toBe('h:1234');
    expect(useAccountStore.getState().pinSetAt).toBe(EPOCH);
  });

  it('a refresh still reading the paused state when the success lands cannot bring the pause back (CS-8)', async () => {
    const state = paused();
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    // The Face ID sheet hands the app back: the refresh reads the stored pause, and its read is slow.
    vi.mocked(readJson).mockImplementationOnce(async (key: string) => {
      const value = structuredClone(disk.get(key));
      await gate;
      return value as never;
    });
    const refreshing = useAccountStore.getState().refreshAttempts();
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('ok');
    release();
    await refreshing;
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
    expect(disk.get('account:pinAttempts')).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('a cancel or failed match is not a miss and leaves the pause as it is', async () => {
    const state = paused();
    useAccountStore.setState({ pinAttempts: state });
    port.read.mockResolvedValueOnce('cancelled');
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('cancelled');
    expect(useAccountStore.getState().pinAttempts).toEqual(state);
    expect(disk.has('account:pinAttempts')).toBe(false);
    expect(useAccountStore.getState().biometricShortcut).not.toBeNull();
    expect(changes()).toEqual([]);
  });

  it('with EXPO_PUBLIC_BIOMETRIC_SHORTCUT off a stored opt-in opens nothing and reads nothing', async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    flags.biometricShortcutEnabled = false;
    try {
      expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('off');
      expect(port.read).not.toHaveBeenCalled();
    } finally {
      flags.biometricShortcutEnabled = true;
    }
  });

  it('a strike reset that did not reach storage is written once more (CS-8)', async () => {
    await useAccountStore.getState().enableBiometricShortcut(PROMPT);
    const state = paused();
    disk.set('account:pinAttempts', state);
    useAccountStore.setState({ pinAttempts: state });
    vi.mocked(writeJson).mockImplementationOnce(async () => {
      throw new Error('disk full');
    });
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('ok');
    expect(disk.get('account:pinAttempts')).toEqual(INITIAL_ATTEMPT_STATE);
    await useAccountStore.getState().refreshAttempts();
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('a cancel before any pause adds no miss either', async () => {
    port.read.mockResolvedValueOnce('cancelled');
    await useAccountStore.getState().verifyBiometricShortcut(PROMPT);
    expect(useAccountStore.getState().pinAttempts.failures).toEqual([]);
  });

  it('an invalidated SecureStore read turns the shortcut off and deletes the item (enrolment_changed)', async () => {
    port.read.mockResolvedValueOnce('invalidated');
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('invalidated');
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(disk.get(RECORD_KEY)).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(changes()).toEqual([{ on: false, reason: 'enrolment_changed' }]);
    // The PIN is asked from now on.
    expect(await useAccountStore.getState().verifyBiometricShortcut(PROMPT)).toBe('off');
  });

  it('the grown-up turning it off deletes the item (user)', () => {
    useAccountStore.getState().disableBiometricShortcut('user');
    expect(useAccountStore.getState().biometricShortcut).toBeNull();
    expect(port.remove).toHaveBeenCalled();
    expect(changes()).toEqual([{ on: false, reason: 'user' }]);
  });
});
