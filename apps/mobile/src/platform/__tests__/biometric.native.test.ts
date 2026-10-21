import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (section 8.6, CS-13, CS-18): the native face or fingerprint wrapper.
 * Strong biometrics only; the item is written and read with `requireAuthentication: true` and nothing that lets the
 * device passcode stand in; `authenticateAsync` (which can fall back to the passcode) is never called; a voided item
 * reads as invalidated and a cancel as cancelled.
 */

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));
vi.mock('react-native', () => ({ Platform: platform }));

const la = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(async () => true),
  isEnrolledAsync: vi.fn(async () => true),
  supportedAuthenticationTypesAsync: vi.fn(async () => [2] as number[]),
  getEnrolledLevelAsync: vi.fn(async () => 3),
  authenticateAsync: vi.fn(async () => ({ success: true })),
}));
vi.mock('expo-local-authentication', () => ({
  ...la,
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

const store = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  canUseBiometricAuthentication: vi.fn(() => true),
  setItemAsync: vi.fn(async (_key: string, _value: string, _options?: unknown) => undefined),
  getItemAsync: vi.fn(async (_key: string, _options?: unknown): Promise<string | null> => null),
  deleteItemAsync: vi.fn(async (_key: string, _options?: unknown) => undefined),
}));
vi.mock('expo-secure-store', () => ({ ...store, WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 6 }));

vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn(async (n: number) => new Uint8Array(n).fill(0xab)) }));

import { biometric } from '../biometric.native';

const PROMPT = 'Use face or fingerprint';
const TOKEN = 'ab'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  platform.OS = 'ios';
  la.hasHardwareAsync.mockResolvedValue(true);
  la.isEnrolledAsync.mockResolvedValue(true);
  la.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
  la.getEnrolledLevelAsync.mockResolvedValue(3);
  store.isAvailableAsync.mockResolvedValue(true);
  store.canUseBiometricAuthentication.mockReturnValue(true);
});

describe('[OA] availability: strong face or fingerprint only', () => {
  it('iOS: hardware, an enrolment, a face or fingerprint type and the biometrics-only policy', async () => {
    expect(await biometric.available()).toBe(true);
    store.canUseBiometricAuthentication.mockReturnValue(false);
    expect(await biometric.available()).toBe(false);
  });

  it('no hardware, nothing enrolled or no biometric type is unavailable', async () => {
    la.hasHardwareAsync.mockResolvedValueOnce(false);
    expect(await biometric.available()).toBe(false);
    la.isEnrolledAsync.mockResolvedValueOnce(false);
    expect(await biometric.available()).toBe(false);
    la.supportedAuthenticationTypesAsync.mockResolvedValueOnce([]);
    expect(await biometric.available()).toBe(false);
  });

  it('Android needs the strong class: a weak face unlock is not enough', async () => {
    platform.OS = 'android';
    la.supportedAuthenticationTypesAsync.mockResolvedValue([1, 2]);
    expect(await biometric.available()).toBe(true);
    la.getEnrolledLevelAsync.mockResolvedValue(2);
    expect(await biometric.available()).toBe(false);
    la.getEnrolledLevelAsync.mockResolvedValue(1);
    expect(await biometric.available()).toBe(false);
  });

  it('a platform error is unavailable, never a throw', async () => {
    la.hasHardwareAsync.mockRejectedValueOnce(new Error('module missing'));
    expect(await biometric.available()).toBe(false);
  });
});

describe('[OA] no passcode fallback (CS-13)', () => {
  it('writes a random token under hr.biometricShortcut with requireAuthentication and no fallback flag', async () => {
    expect(await biometric.write(PROMPT)).toBe('written');
    expect(store.setItemAsync).toHaveBeenCalledTimes(1);
    const [key, value, options] = store.setItemAsync.mock.calls[0]!;
    expect(key).toBe('hr.biometricShortcut');
    expect(value).toBe(TOKEN);
    expect(options).toEqual({ requireAuthentication: true, keychainAccessible: 6, authenticationPrompt: PROMPT });
  });

  it('reads with the same options, and never asks expo-local-authentication to authenticate', async () => {
    store.getItemAsync.mockResolvedValueOnce(TOKEN);
    expect(await biometric.read(PROMPT)).toBe('ok');
    expect(store.getItemAsync).toHaveBeenCalledWith('hr.biometricShortcut', { requireAuthentication: true, keychainAccessible: 6, authenticationPrompt: PROMPT });
    await biometric.available();
    await biometric.write(PROMPT);
    expect(la.authenticateAsync).not.toHaveBeenCalled();
    for (const call of [...store.setItemAsync.mock.calls, ...store.getItemAsync.mock.calls]) {
      const options = call[call.length - 1] as Record<string, unknown>;
      expect(Object.keys(options).some((k) => /fallback|passcode|devicecredential/i.test(k))).toBe(false);
    }
  });

  it('a write the store refuses or the prompt cancels turns nothing on', async () => {
    store.isAvailableAsync.mockResolvedValueOnce(false);
    expect(await biometric.write(PROMPT)).toBe('unavailable');
    store.setItemAsync.mockRejectedValueOnce(new Error('User canceled the authentication'));
    expect(await biometric.write(PROMPT)).toBe('cancelled');
  });
});

describe('[OA] reading the item (CS-18)', () => {
  it('a voided item (an enrolment change) reads as invalidated', async () => {
    store.getItemAsync.mockResolvedValueOnce(null);
    expect(await biometric.read(PROMPT)).toBe('invalidated');
  });

  it('a cancel or a failed match is cancelled', async () => {
    store.getItemAsync.mockRejectedValueOnce(new Error('User canceled the authentication'));
    expect(await biometric.read(PROMPT)).toBe('cancelled');
    store.getItemAsync.mockRejectedValueOnce(new Error('Could not authenticate the user'));
    expect(await biometric.read(PROMPT)).toBe('cancelled');
  });

  it('remove deletes the item and never throws', async () => {
    await biometric.remove();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('hr.biometricShortcut');
    store.deleteItemAsync.mockRejectedValueOnce(new Error('gone'));
    await expect(biometric.remove()).resolves.toBeUndefined();
  });
});
