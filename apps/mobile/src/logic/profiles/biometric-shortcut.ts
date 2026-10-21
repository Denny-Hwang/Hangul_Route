/**
 * [OA] Face or fingerprint for grown-ups (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D10, section 8.6, row OA-9; CS-8,
 * CS-13, CS-18). Pure: the screens and the account store pass the stored record, the PIN epoch, the flag and what
 * the platform reported; `platform/biometric.native.ts` does the reading and writing.
 *
 * The shortcut is a SecureStore item (`hr.biometricShortcut`, a random token) written with
 * `requireAuthentication: true`, so reading it runs the system's face or fingerprint check with no device passcode
 * to fall back on, and the platform voids it when the enrolled faces or fingerprints change. The account record
 * `account:biometricShortcut` = `{ v: 1, enabledAt, epoch }` says it is on and for which PIN; it never holds the token.
 * It is valid only while `epoch` equals the current PIN epoch, so any new PIN turns it off.
 */

/** [OA] The SecureStore key of the shortcut item (section 13.1). SecureStore keys allow letters, digits, `.`, `-`, `_`. */
export const BIOMETRIC_SHORTCUT_ITEM_KEY = 'hr.biometricShortcut';

/**
 * [OA] The shortcut's own keychain service (iOS) and key alias (Android), so no other SecureStore item, and no write of
 * this key without `requireAuthentication` under the default service, can stand in for the token.
 */
export const BIOMETRIC_SHORTCUT_SERVICE = 'hr.biometric';

/** [OA] The token: 32 random bytes as lower-case hex. A read that returns anything else is not the shortcut. */
export const SHORTCUT_TOKEN_BYTES = 32;
const TOKEN_RE = new RegExp(`^[0-9a-f]{${SHORTCUT_TOKEN_BYTES * 2}}$`);

/** [OA] `account:biometricShortcut`: on since `enabledAt`, for the PIN of `epoch` (`account:pinSetAt`, 0 when absent). */
export interface BiometricShortcutRecord {
  v: 1;
  enabledAt: number;
  epoch: number;
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** A stored record, read strictly: anything that is not a version 1 record reads as off. */
export function biometricShortcutOf(raw: unknown): BiometricShortcutRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !isTime(r.enabledAt) || !isTime(r.epoch)) return null;
  return { v: 1, enabledAt: r.enabledAt, epoch: r.epoch };
}

/** The PIN epoch the record is bound to: `account:pinSetAt`, or 0 for a PIN set before that key (F-APP-001 section 3.9). */
export function pinEpochOf(pinSetAt: number | null): number {
  return pinSetAt ?? 0;
}

export function shortcutRecord(now: number, pinSetAt: number | null): BiometricShortcutRecord {
  return { v: 1, enabledAt: now, epoch: pinEpochOf(pinSetAt) };
}

/** The shortcut stands for this PIN: a record for the current epoch, and a PIN to stand in for. */
export function shortcutValid(record: BiometricShortcutRecord | null, pinSetAt: number | null, hasPin: boolean): boolean {
  return record !== null && hasPin && record.epoch === pinEpochOf(pinSetAt);
}

/**
 * A record left from an older PIN (or with no PIN at all): turned off and its item deleted at the next look
 * (`pin.biometric_changed { on: false, reason: 'pin_changed' }`).
 */
export function shortcutStale(record: BiometricShortcutRecord | null, pinSetAt: number | null, hasPin: boolean): boolean {
  return record !== null && !shortcutValid(record, pinSetAt, hasPin);
}

export interface ShortcutContext {
  /** `EXPO_PUBLIC_BIOMETRIC_SHORTCUT`; off hides the switch and ignores a stored opt-in. */
  flagOn: boolean;
  /** Strong face or fingerprint enrolled on this device (`biometricAvailable`); always false on the web. */
  available: boolean;
  record: BiometricShortcutRecord | null;
  pinSetAt: number | null;
  hasPin: boolean;
}

/** The PIN screen in verify mode offers Use face or fingerprint (above the pad, which stays). */
export function shortcutOffered(c: ShortcutContext): boolean {
  return c.flagOn && c.available && shortcutValid(c.record, c.pinSetAt, c.hasPin);
}

/**
 * The Grown-up area switch: `hidden` with the flag off; `needsPin` (disabled, with `needsPinFirst` as its hint)
 * while there is no PIN (section 8.2); else `on` or `off`. Without strong biometrics right now (a lockout, Face ID
 * refused for the app, no finger enrolled for a moment) it is hidden unless it is on: an on switch stays, so a
 * grown-up can always turn it off.
 */
export type ShortcutSwitch = 'hidden' | 'needsPin' | 'off' | 'on';

export function shortcutSwitch(c: ShortcutContext): ShortcutSwitch {
  if (!c.flagOn) return 'hidden';
  const on = shortcutValid(c.record, c.pinSetAt, c.hasPin);
  if (!c.available) return on ? 'on' : 'hidden';
  if (!c.hasPin) return 'needsPin';
  return on ? 'on' : 'off';
}

/**
 * What a tap on Use face or fingerprint read: `ok` only when the item came back as a token (the system check
 * passed); `invalidated` when the item is gone or unreadable without asking (an enrolment change voids it, on iOS
 * and on Android alike SecureStore then returns null), or holds something that is not a token; `cancelled` for a
 * cancel, a failed match or a locked-out sensor, which the platform reports by throwing. A thrown error that names
 * an invalidated key (older Android builds) counts as `invalidated`.
 */
export type ShortcutReadResult = 'ok' | 'invalidated' | 'cancelled';

export type ShortcutRead = { value: string | null } | { error: unknown };

export function classifyShortcutRead(read: ShortcutRead): ShortcutReadResult {
  if ('error' in read) return /invalidat/i.test(errorText(read.error)) ? 'invalidated' : 'cancelled';
  if (read.value === null) return 'invalidated';
  return TOKEN_RE.test(read.value) ? 'ok' : 'invalidated';
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return typeof error === 'string' ? error : '';
}

/** Lower-case hex of the random bytes, for the token. */
export function tokenOf(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** What turning the shortcut on wrote: `written`, or nothing (a cancelled prompt, an unavailable store). */
export type ShortcutWrite = 'written' | 'cancelled' | 'unavailable';

/** The platform port (`platform/biometric.ts` on the web and in tests, `platform/biometric.native.ts` on iOS and Android). */
export interface BiometricPort {
  /** Strong face or fingerprint is set up on this device. */
  available(): Promise<boolean>;
  /** Writes a new random token under `BIOMETRIC_SHORTCUT_ITEM_KEY`, readable only after the system check. */
  write(prompt: string): Promise<ShortcutWrite>;
  /** Reads the item (the system check runs, with no passcode fallback). */
  read(prompt: string): Promise<ShortcutReadResult>;
  /** Deletes the item; never throws. */
  remove(): Promise<void>;
}
