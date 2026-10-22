import { BROWSE_PASS_SESSION_KEY, GrownUpUnlockSchema, UNLOCK_SESSION_KEY, parseLenient, unlockActive, type GrownUpUnlock } from '@hangul-route/content-schema';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import { clearAdminInvite, keepAdminInviteThroughSignOut } from './admin-invite';
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
  // [OA] A new unlock never inherits the reset leg's stamp of an earlier one (`RESET_LEG_SESSION_KEY`).
  removeItem(storage, RESET_LEG_SESSION_KEY);
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
  removeItem(storage, HIDDEN_AT_SESSION_KEY);
  removeItem(storage, RESET_LEG_SESSION_KEY);
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.4 and 8.5 step 2 (row OA-6): the reset leg's stamp, the `at` of the
 * `signin` unlock that a reset-leg sign-in wrote with a factor the leg accepts (a password, an email or phone code, a
 * Clerk password-reset code, or the router's reverification that refuses a passkey). `/account/pin-reset` counts a
 * `signin` unlock only when this stamp carries its `at`: an unlock from the ordinary leg, whatever its factor, makes
 * the page run its own reverification. A number only, cleared whenever the unlock is.
 */
export const RESET_LEG_SESSION_KEY = 'hr:grownup:resetLeg';

/** [OA] The stamp, or null (absent, corrupt, storage refused). */
export function readResetLegStamp(storage: KeyValueStorage | null = defaultStorage()): number | null {
  const raw = readItem(storage, RESET_LEG_SESSION_KEY);
  if (raw === null) return null;
  const at = Number(raw);
  return raw.trim() !== '' && Number.isFinite(at) ? at : null;
}

/** [OA] Stamps the reset-leg sign-in unlock written at `at`; false when the storage refused it. */
export function writeResetLegStamp(at: number, storage: KeyValueStorage | null = defaultStorage()): boolean {
  return writeItem(storage, RESET_LEG_SESSION_KEY, String(at));
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.6 (OA-D16, CS-14): when this tab was hidden (wall clock, a number
 * only), kept beside the unlock so the 5-minute hidden rule survives a mobile browser discarding the background tab
 * and reloading it when it is shown again. Cleared when the tab is shown and whenever the unlock is.
 */
export const HIDDEN_AT_SESSION_KEY = 'hr:grownup:hiddenAt';

/** [OA] The stored hidden time, or null (absent, corrupt, storage refused). */
export function readHiddenAt(storage: KeyValueStorage | null = defaultStorage()): number | null {
  const raw = readItem(storage, HIDDEN_AT_SESSION_KEY);
  if (raw === null) return null;
  const at = Number(raw);
  return raw.trim() !== '' && Number.isFinite(at) ? at : null;
}

/** [OA] Stores the hidden time; `null` removes it. */
export function writeHiddenAt(at: number | null, storage: KeyValueStorage | null = defaultStorage()): void {
  if (at === null) removeItem(storage, HIDDEN_AT_SESSION_KEY);
  else writeItem(storage, HIDDEN_AT_SESSION_KEY, String(at));
}

/**
 * Back to learning, Open the app on this device and Sign out: this tab keeps no unlock, no
 * console session and no All lessons pass (`hr:browse:pass`, F-BROWSE-001 section 4.3), so a
 * device handed back cannot reopen All lessons from this tab with Back, Forward or a typed
 * `/browse` (F-BROWSE-001 BR-6 review).
 *
 * [SA] It also drops a waiting administrator invite (`hr:admin-invite`, AMENDMENTS-SEATS-ADMINS section 6.6 step 1),
 * so the next person to sign in in a shared tab is never forwarded to someone else's invite. Only the invite page's
 * Use another account and the lock's Sign in again keep it (`keepInvite`): both come straight back to the invite.
 */
export function clearGrownUpTab(storage: KeyValueStorage | null = defaultStorage(), options: { keepInvite?: boolean } = {}): void {
  clearUnlock(storage);
  clearSession(storage);
  removeItem(storage, BROWSE_PASS_SESSION_KEY);
  if (options.keepInvite) keepAdminInviteThroughSignOut();
  else clearAdminInvite(storage);
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.2 moment 3: the spec's `pinOwnerOfferClosed`, the PIN-owner card
 * closed for one `pin` unlock in this tab (Not now, or the first navigation away from the persona home). It holds
 * only that unlock's `at` (a number), so a later unlock offers the card again.
 */
export const PIN_OWNER_OFFER_CLOSED_SESSION_KEY = 'hr:grownup:pinOwnerOfferClosed';

/** [OA] The unlock time the PIN-owner card was closed for, or null (absent, corrupt, storage refused). */
export function readPinOwnerOfferClosed(storage: KeyValueStorage | null = defaultStorage()): number | null {
  const raw = readItem(storage, PIN_OWNER_OFFER_CLOSED_SESSION_KEY);
  if (raw === null) return null;
  const at = Number(raw);
  return raw.trim() !== '' && Number.isFinite(at) ? at : null;
}

/** [OA] Closes the PIN-owner card for the unlock made at `at`. */
export function writePinOwnerOfferClosed(at: number, storage: KeyValueStorage | null = defaultStorage()): void {
  writeItem(storage, PIN_OWNER_OFFER_CLOSED_SESSION_KEY, String(at));
}
