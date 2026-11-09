import { WHEN_UNLOCKED_THIS_DEVICE_ONLY, deleteItemAsync, getItemAsync, setItemAsync, type SecureStoreOptions } from 'expo-secure-store';
import type { NativeGateState } from '../logic/account/gate-state';
import { INSTALLED_KEY, runInstallSweep, sweepComplete, type InstallSweepResult } from '../logic/account/install-sweep';
import { CLERK_KEYCHAIN_SERVICE, createTokenCache, tokenStepFor, type SecureItemPort, type TokenCacheController } from '../logic/account/token-cache';
import { readJsonExact, writeJson } from './storage';

/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7): Clerk's token cache on iOS and Android, the install sweep, and the rule
 * that a Clerk session is kept only on a device whose gate state is `pin`. The only file that touches the `hr.clerk`
 * SecureStore service; `logic/account/token-cache.ts` holds the rules.
 *
 * - Items live under the keychain service (iOS) and key alias (Android) `hr.clerk`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
 *   (never in iCloud Keychain, never restored to another device) and with no `requireAuthentication` (a token read
 *   never asks for a face). The expo-secure-store config plugin's `configureAndroidBackup` keeps them out of Android
 *   Auto Backup and device transfer (`app.json`).
 * - Nothing of Clerk's goes to AsyncStorage, the `hr:` storage wrapper, a log, a crash report or telemetry: only the
 *   install record `hr:grownup:installed` (`{ v: 1, at }`, no account data) is written there.
 *
 * Imported only by the native Grown-up area stack and the files it loads, never by a learner screen or the web.
 */

const OPTIONS: SecureStoreOptions = { keychainService: CLERK_KEYCHAIN_SERVICE, keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const port: SecureItemPort = {
  get: (key) => getItemAsync(key, OPTIONS),
  set: (key, value) => setItemAsync(key, value, OPTIONS),
  remove: (key) => deleteItemAsync(key, OPTIONS),
};

/** The one token cache of this run (Clerk's singleton keeps the first `tokenCache` it is given). */
export const clerkTokens: TokenCacheController = createTokenCache(port);

let sweep: Promise<InstallSweepResult> | null = null;

/**
 * The install sweep, once per run: resolves true once it is complete (`installed` or `swept`). A failed sweep is tried
 * again at the next call, so a device unlocked after a restart can still sign in in this run.
 */
export function ensureInstallSweep(): Promise<boolean> {
  if (sweep === null) {
    sweep = runInstallSweep({
      readRecord: () => readJsonExact<unknown>(INSTALLED_KEY),
      writeRecord: (record) => writeJson(INSTALLED_KEY, record),
      wipe: () => clerkTokens.wipe(),
      now: () => Date.now(),
    });
  }
  const run = sweep;
  return run.then((result) => {
    if (result === 'failed' && sweep === run) sweep = null;
    return sweepComplete(result);
  });
}

/**
 * Section 6.2, "persisted session only with a PIN": at the Grown-up area's mount (`mount`) and at every change of the
 * gate state while it is open (`change`), the token storage follows the gate (`tokenStepFor`). Resolves to whether
 * every delete it made answered.
 */
export async function applyGateToTokens(gate: NativeGateState, phase: 'mount' | 'change'): Promise<boolean> {
  const step = tokenStepFor(gate.state, phase, clerkTokens.storage());
  if (step === 'use_secure') {
    // A memory item at this point is from a run's session on a device without a PIN: it is never kept (ND-9).
    clerkTokens.endMemorySession();
    return clerkTokens.useSecure();
  }
  if (step === 'use_memory') return clerkTokens.useMemory();
  if (step === 'wipe') return clerkTokens.wipe().then(async (wiped) => (await clerkTokens.useMemory()) && wiped);
  return true;
}
