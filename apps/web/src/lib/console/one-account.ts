import {
  APP_ORIGIN,
  DeviceUsesSchema,
  GROWN_UP_BACKGROUND_MS,
  GROWN_UP_FRESH_PIN_MS,
  GrownUpLockMessageSchema,
  PinOwnerSchema,
  usesFor,
  type DeviceUses,
  type GrownUpUnlock,
  type PinOwner,
  type SpaceKind,
  type SpaceRole,
} from '@hangul-route/content-schema';
import { isSiteOrigin, pinPathUrl, type DeviceGateRead } from './grown-up-lock';
import { isKnownSpaceKind } from './routing';

/**
 * [OA] The console side of one account, many users (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.1 to 7.4 and 7.6,
 * row OA-3). Pure decisions, 100 % covered; the frame, the router, the lock and the persona homes wire them to the
 * browser (`shell-store.ts` keeps the records).
 *
 * - `deviceUses`: the account's grown-up uses for the learner app's chooser, never a name, an email or an id.
 * - `pinOwner`: the account that proved the current PIN in this browser. A new or different owner needs a fresh PIN
 *   followed by that account's own password or code in the same tab (moments 1 and 3); the lock's PIN path only
 *   refreshes the same owner (moment 2); a sign-in alone, a passkey or the reset leg never writes it (CS-10).
 * - Use a passkey on the lock: only where the browser offers a platform authenticator and the marker is not `pin`
 *   (CS-17).
 * - A tab hidden for 5 minutes, or told by `hr-grownup` that the chooser opened, drops its unlock (CS-14, CS-2).
 */

/** The `deviceUses` record of the spaces the frame holds (`GET /api/spaces`); kinds this bundle does not know are skipped. */
export function deviceUsesOf(items: readonly { space: { kind: SpaceKind }; role: SpaceRole }[], now: number): DeviceUses {
  const uses = usesFor(items.filter((item) => isKnownSpaceKind(item.space.kind)).map((item) => ({ kind: item.space.kind, role: item.role })));
  // The schema strips anything else, so the record can only ever hold codes and a time.
  return DeviceUsesSchema.parse({ v: 1, uses, at: now });
}

/** The factors that name a PIN owner (section 7.2): a password or a code. Never a passkey, never OAuth. */
export const PIN_OWNER_FACTORS: ReadonlySet<string> = new Set(['password', 'email_code', 'phone_code']);

/** The factors the reset leg accepts (section 7.4, OQ-21): a password, a code, or a Clerk password-reset code. */
export const RESET_LEG_FACTORS: ReadonlySet<string> = new Set(['password', 'email_code', 'phone_code', 'reset_password_email_code', 'reset_password_phone_code']);

/** The sign-in reset page (section 7.5, row OA-6). */
export const PIN_RESET_PATH = '/account/pin-reset';

/** A `next` on the reset leg: `/account/pin-reset`, with or without a trailing slash, `.html` or a query. */
export function isResetLeg(next: string | null | undefined): boolean {
  if (typeof next !== 'string' || !next.startsWith(PIN_RESET_PATH)) return false;
  const rest = next.slice(PIN_RESET_PATH.length);
  return rest === '' || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('.html') || rest.startsWith('#');
}

/** The epoch of a readable `pin` marker that names a real PIN (never `0`), else null. */
export function realPinEpoch(device: DeviceGateRead): number | null {
  if (!device.readable || device.marker?.gate !== 'pin') return null;
  const epoch = device.marker.pinEpoch;
  return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
}

/** A `pin` unlock for `epoch`, written by the learner app's hand-off less than `GROWN_UP_FRESH_PIN_MS` ago. */
export function freshPinUnlock(unlock: GrownUpUnlock | null | undefined, epoch: number, now: number): boolean {
  if (!unlock || unlock.src !== 'pin' || unlock.pinEpoch !== epoch) return false;
  const age = now - unlock.at;
  return age >= 0 && age < GROWN_UP_FRESH_PIN_MS;
}

/**
 * Moment 1 (section 7.2): the epoch to record for the account that just signed in, or null. Only a password or a code,
 * off the reset leg, in a tab that held a fresh `pin` unlock for the marker's real epoch before the sign-in wrote its
 * own (`earlier`, read first).
 */
export function pinOwnerAtSignIn(input: { earlier: GrownUpUnlock | null; device: DeviceGateRead; factor: string | null | undefined; resetLeg: boolean; now: number }): number | null {
  if (input.resetLeg || typeof input.factor !== 'string' || !PIN_OWNER_FACTORS.has(input.factor)) return null;
  const epoch = realPinEpoch(input.device);
  return epoch !== null && freshPinUnlock(input.earlier, epoch, input.now) ? epoch : null;
}

/** Moment 2 (section 7.2): the refreshed record for the same owner at the current epoch, or null (write nothing). */
export function pinOwnerRefresh(input: { stored: PinOwner | null; owner: string | null; epoch: number }): PinOwner | null {
  const { stored, owner, epoch } = input;
  if (!stored || !owner || stored.owner !== owner || stored.epoch === epoch) return null;
  const next = PinOwnerSchema.safeParse({ v: 1, owner, epoch });
  return next.success ? next.data : null;
}

/** Whether the account `owner` already owns the PIN of `epoch`. */
export function ownsPin(stored: PinOwner | null, owner: string | null, epoch: number): boolean {
  return !!stored && !!owner && stored.owner === owner && stored.epoch === epoch;
}

/**
 * Moment 3 (section 7.2, design D13): the persona home offers Let this account reset the PIN here while the tab's
 * `pin` unlock is under 2 minutes old for the marker's real epoch and this account is not the owner of that epoch.
 * Returns the epoch the offer is for, or null.
 */
export function pinOwnerOffer(input: { unlock: GrownUpUnlock | null; device: DeviceGateRead; stored: PinOwner | null; owner: string | null; now: number }): number | null {
  const epoch = realPinEpoch(input.device);
  if (epoch === null || !input.owner || !freshPinUnlock(input.unlock, epoch, input.now)) return null;
  return ownsPin(input.stored, input.owner, epoch) ? null : epoch;
}

/** The record moments 1 and 3 write, or null when the fingerprint or the epoch is not valid. */
export function pinOwnerRecord(owner: string | null, epoch: number): PinOwner | null {
  const record = PinOwnerSchema.safeParse({ v: 1, owner, epoch });
  return record.success ? record.data : null;
}

interface Digest {
  digest: (algorithm: string, data: Uint8Array) => Promise<ArrayBuffer>;
}

function defaultDigest(): Digest | null {
  const subtle = (globalThis as { crypto?: { subtle?: Digest } }).crypto?.subtle;
  return subtle && typeof subtle.digest === 'function' ? subtle : null;
}

/** The first 16 hex digits of SHA-256 of the Clerk user id (section 7.2); null without Web Crypto or an id. */
export async function pinOwnerFingerprint(userId: string | null | undefined, subtle: Digest | null = defaultDigest()): Promise<string | null> {
  if (!userId || !subtle) return null;
  try {
    const bytes = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(userId)));
    return Array.from(bytes.slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Use a passkey on the lock (section 7.4, OA-D10): the flag, a platform authenticator, and a device read that says the
 * marker is not `pin`. Only a read `nopin` marker qualifies: a failed read, or a missing marker on a device with
 * profiles (a learner app older than A-6), may be a `pin` browser, so both hide it (fail closed, CS-17); `none` and a
 * device without learner data never show the lock at all.
 */
export function passkeyButtonShown(input: { flag: boolean; available: boolean; device: DeviceGateRead | null }): boolean {
  const { flag, available, device } = input;
  if (!flag || !available || !device?.readable) return false;
  return device.marker?.gate === 'nopin';
}

interface PublicKeyCredentialLike {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
}

/** `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` resolved exactly true; anything else is false. */
export async function platformAuthenticatorAvailable(win: { PublicKeyCredential?: PublicKeyCredentialLike } | null | undefined): Promise<boolean> {
  try {
    const check = win?.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof check !== 'function') return false;
    return (await check.call(win?.PublicKeyCredential)) === true;
  } catch {
    return false;
  }
}

/** A passkey as Clerk's user resource lists it (`id` and `lastUsedAt` only are read). */
export interface PasskeyLike {
  id?: string | null;
  lastUsedAt?: Date | number | null;
}

/** Each passkey's `lastUsedAt` (milliseconds, or null when never used), keyed by its id. */
export type PasskeySnapshot = ReadonlyMap<string, number | null>;

const stampOf = (at: Date | number | null | undefined): number | null => {
  const ms = at instanceof Date ? at.getTime() : at;
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
};
const keyOf = (passkey: PasskeyLike, index: number): string => (typeof passkey.id === 'string' && passkey.id ? passkey.id : `#${index}`);

/** The account's passkeys before a Clerk reverification opens its dialog; null when the account could not be read. */
export function passkeySnapshot(passkeys: readonly PasskeyLike[] | null | undefined): PasskeySnapshot | null {
  if (!Array.isArray(passkeys)) return null;
  return new Map(passkeys.map((passkey, index) => [keyOf(passkey, index), stampOf(passkey.lastUsedAt)]));
}

/**
 * Whether a passkey of the account was used by the Clerk reverification that just ran (sections 7.2 and 7.4), whose
 * factor Clerk does not name: a passkey whose `lastUsedAt` moved since the snapshot taken before the dialog, or a new
 * one already used. Server stamps are compared with server stamps, never with this device's clock. Fails closed: no
 * snapshot (the account was not loaded), or an account that holds a passkey and could not be read again, counts as a
 * passkey.
 */
export function passkeyUsedDuring(before: PasskeySnapshot | null, after: readonly PasskeyLike[] | null | undefined): boolean {
  if (before === null) return true;
  if (!Array.isArray(after)) return before.size > 0;
  return after.some((passkey, index) => {
    const stamp = stampOf(passkey.lastUsedAt);
    if (stamp === null) return false;
    const earlier = before.get(keyOf(passkey, index));
    return earlier === undefined || earlier === null || stamp > earlier;
  });
}

/** Section 7.6 (OA-D16, CS-14): a tab hidden since `hiddenAt` drops its unlock once 5 minutes passed (wall clock; a clock that ran backwards drops it too). */
export function hiddenTooLong(hiddenAt: number | null, now: number): boolean {
  if (hiddenAt === null) return false;
  const hidden = now - hiddenAt;
  return hidden < 0 || hidden >= GROWN_UP_BACKGROUND_MS;
}

/** Section 7.6: the one message on `hr-grownup`, `{ v: 1, kind: 'lock' }`, and nothing else. */
export function isGrownUpLockMessage(data: unknown): boolean {
  return GrownUpLockMessageSchema.safeParse(data).success;
}

/** Section 7.6: the set-a-PIN card on a persona home, once per browser, only on a `nopin` browser. */
export function pinPromptShown(device: DeviceGateRead | null, seen: boolean | null): boolean {
  return seen === false && !!device?.readable && device.marker?.gate === 'nopin';
}

/**
 * The set-a-PIN card's Open the app: the learner app's grown-up gate with this persona home as `next`
 * (`/?gate=grown-up&next=%2Fparent`), which opens the PIN screen and, on a `nopin` device, runs setup; the learner app
 * drops a `gate=grown-up` that has no `next`. On a site origin it is the app host's address.
 */
export function pinPromptTarget(origin: string, home: string): string {
  const path = pinPathUrl(home);
  return isSiteOrigin(origin) ? `${APP_ORIGIN}${path}` : path;
}
