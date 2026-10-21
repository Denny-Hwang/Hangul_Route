import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  BIOMETRIC_SHORTCUT_ITEM_KEY,
  SHORTCUT_TOKEN_BYTES,
  classifyShortcutRead,
  tokenOf,
  type BiometricPort,
} from '../logic/profiles/biometric-shortcut';

/**
 * [OA] Face or fingerprint on iOS and Android (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D10, section 8.6, row OA-9;
 * CS-13, CS-18). The only entry to `expo-local-authentication` and `expo-secure-store`.
 *
 * - Availability (`expo-local-authentication`, never its `authenticateAsync`): hardware, an enrolled face or
 *   fingerprint, a face, fingerprint or iris type, and the strong class: `BIOMETRIC_STRONG` on Android, and on iOS
 *   the biometrics-only policy (`canUseBiometricAuthentication`, Face ID or Touch ID).
 * - The shortcut is a random token under `hr.biometricShortcut`, written with `requireAuthentication: true`. On iOS
 *   expo-secure-store binds the keychain item to `biometryCurrentSet`, so reading it asks for face or fingerprint
 *   with **no device passcode** to fall back on and an enrolment change voids it; `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`
 *   keeps it off backups and other devices. On Android the key needs a `BIOMETRIC_STRONG` prompt whose only other
 *   button is Cancel, and a new enrolment invalidates it.
 * - A read the platform voided comes back null, a cancel or failed match throws: `classifyShortcutRead` tells the two
 *   apart. Nothing here counts a PIN miss or touches the PIN.
 */

function options(prompt: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    authenticationPrompt: prompt,
  };
}

const STRONG_TYPES: ReadonlySet<LocalAuthentication.AuthenticationType> = new Set([
  LocalAuthentication.AuthenticationType.FINGERPRINT,
  LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  LocalAuthentication.AuthenticationType.IRIS,
]);

async function strongClass(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return (await LocalAuthentication.getEnrolledLevelAsync()) >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  }
  return SecureStore.canUseBiometricAuthentication();
}

export const biometric: BiometricPort = {
  available: async () => {
    try {
      if (!(await LocalAuthentication.hasHardwareAsync())) return false;
      if (!(await LocalAuthentication.isEnrolledAsync())) return false;
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (!types.some((t) => STRONG_TYPES.has(t))) return false;
      return await strongClass();
    } catch {
      return false;
    }
  },

  write: async (prompt) => {
    try {
      if (!(await SecureStore.isAvailableAsync())) return 'unavailable';
      const token = tokenOf(await Crypto.getRandomBytesAsync(SHORTCUT_TOKEN_BYTES));
      await SecureStore.setItemAsync(BIOMETRIC_SHORTCUT_ITEM_KEY, token, options(prompt));
      return 'written';
    } catch {
      // A cancelled prompt (Android asks on the write), a missing Face ID permission string: nothing is on.
      return 'cancelled';
    }
  },

  read: async (prompt) => {
    try {
      return classifyShortcutRead({ value: await SecureStore.getItemAsync(BIOMETRIC_SHORTCUT_ITEM_KEY, options(prompt)) });
    } catch (error) {
      return classifyShortcutRead({ error });
    }
  },

  remove: async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_SHORTCUT_ITEM_KEY);
    } catch {
      // Already gone, or the store is unavailable: the account record is what turns the shortcut off.
    }
  },
};
