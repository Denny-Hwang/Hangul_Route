import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  BIOMETRIC_SHORTCUT_ITEM_KEY,
  BIOMETRIC_SHORTCUT_SERVICE,
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
 * - Every read checks the strong class again first (CS-13): a biometry lockout (iOS `canEvaluatePolicy` then fails)
 *   or a weaker enrolment on Android never reaches the keychain, so the system cannot offer the device passcode to
 *   lift the lockout. Such a tap reads as a cancel: nothing opens and the pad stays.
 * - The item has its own keychain service (`hr.biometric`), so no other SecureStore item can stand in for it.
 */

function options(prompt: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    keychainService: BIOMETRIC_SHORTCUT_SERVICE,
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
      if (!(await strongClass())) return 'cancelled';
    } catch {
      return 'cancelled';
    }
    try {
      return classifyShortcutRead({ value: await SecureStore.getItemAsync(BIOMETRIC_SHORTCUT_ITEM_KEY, options(prompt)) });
    } catch (error) {
      return classifyShortcutRead({ error });
    }
  },

  remove: async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_SHORTCUT_ITEM_KEY, { keychainService: BIOMETRIC_SHORTCUT_SERVICE });
    } catch {
      // Already gone, or the store is unavailable: the account record is what turns the shortcut off.
    }
  },
};
