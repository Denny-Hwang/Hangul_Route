import { BROWSE_PASS_SESSION_KEY, GrownUpUnlockSchema, UNLOCK_SESSION_KEY, parseLenient, unlockActive, type GrownUpUnlock } from '@hangul-route/content-schema';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import { clearSession } from './session';

/**
 * The grown-up unlock of this tab (F-APP-001 section 3.9): `sessionStorage`
 * `hr:grownup:unlock`, per tab and per origin, so it survives same-tab navigations (the round
 * trip to Stripe Checkout included) and nothing else. The learner app writes a PIN unlock with
 * the marker epoch; a secret-proving sign-in writes a sign-in unlock. Behind the guarded
 * wrapper (`lib/i18n/safe-storage`): SSR, private windows and blocked storage read as absent.
 */

/** `seen` is refreshed at most this often. */
export const UNLOCK_TOUCH_MS = 60_000;

function defaultStorage(): KeyValueStorage | null {
  return browserStorage('session');
}

/** Lenient: corrupt, foreign or a PIN record without `pinEpoch` read as absent. */
export function readUnlock(storage: KeyValueStorage | null = defaultStorage()): GrownUpUnlock | null {
  return parseLenient(GrownUpUnlockSchema, readItem(storage, UNLOCK_SESSION_KEY));
}

function writeUnlock(record: GrownUpUnlock, storage: KeyValueStorage | null): boolean {
  return writeItem(storage, UNLOCK_SESSION_KEY, JSON.stringify(record));
}

/** The unlock a secret-proving sign-in writes in this tab: `src: 'signin'`, no epoch. */
export function writeSignInUnlock(now: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  return writeUnlock({ v: 1, at: now, seen: now, src: 'signin' }, storage);
}

/**
 * Refreshes `seen` of an active unlock (on navigation and interaction), at most once a minute;
 * an expired or absent unlock is never revived. True when it wrote.
 */
export function touchUnlock(now: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  const record = readUnlock(storage);
  if (!record || !unlockActive(record, now) || now - record.seen < UNLOCK_TOUCH_MS) return false;
  return writeUnlock({ ...record, seen: now }, storage);
}

export function clearUnlock(storage: KeyValueStorage | null = defaultStorage()): void {
  removeItem(storage, UNLOCK_SESSION_KEY);
}

/**
 * Back to learning, Open the app on this device and Sign out: this tab keeps no unlock, no
 * console session and no All lessons pass (`hr:browse:pass`, F-BROWSE-001 section 4.3), so a
 * device handed back cannot reopen All lessons from this tab with Back, Forward or a typed
 * `/browse` (F-BROWSE-001 BR-6 review).
 */
export function clearGrownUpTab(storage: KeyValueStorage | null = defaultStorage()): void {
  clearUnlock(storage);
  clearSession(storage);
  removeItem(storage, BROWSE_PASS_SESSION_KEY);
}
