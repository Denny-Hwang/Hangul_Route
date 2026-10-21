import type { BiometricPort } from '../logic/profiles/biometric-shortcut';

/**
 * [OA] Face or fingerprint (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.6, row OA-9): the web build and the tests.
 * A web page has no local biometric check a server does not verify (the console's way is a passkey, section 7.4),
 * so this reports unavailable and never reads or writes anything. iOS and Android resolve `biometric.native.ts`
 * instead, so `expo-local-authentication` and `expo-secure-store` stay out of the web bundle.
 */
export const biometric: BiometricPort = {
  available: async () => false,
  write: async () => 'unavailable',
  read: async () => 'cancelled',
  remove: async () => undefined,
};
