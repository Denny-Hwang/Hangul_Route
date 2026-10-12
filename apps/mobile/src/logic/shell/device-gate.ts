import type { DeviceGateMarker, LearnerType, ProfileRole } from '@hangul-route/content-schema';
import { gateRequired } from '../profiles/learner-type';

/**
 * The device gate marker (F-APP-001 section 3.9). The learner app writes `hr:device:gate`
 * (`DEVICE_GATE_KEY` through `platform/storage`) on boot and whenever the profiles or the PIN
 * change; the console's grown-up lock reads it (A-4a `lib/console/device-marker.ts`). Pure: no
 * storage, no clock.
 *
 * | Device state                                                        | Marker                     |
 * | at least one learner profile, gate required, a PIN stored           | `pin` with `pinEpoch`      |
 * | at least one learner profile, gate required, no PIN (family device) | `nopin`                    |
 * | otherwise (no learner profile, or a self-only device without a PIN) | `none`                     |
 *
 * `pinEpoch` is the time the current PIN was set (`account:pinSetAt`); a PIN set before A-6 has
 * none and reads as `0`, which the console never trusts. The marker holds no name, no count and
 * no profile data.
 */

/** Device key of the fingerprint of the PIN hash the learner app last saw (never the hash). */
export const PIN_HASH_SEEN_KEY = 'account:pinHashSeen';
/** The fingerprint recorded while no PIN is stored. */
export const NO_PIN_SEEN = 'none';
/**
 * Held in memory when `account:pinHashSeen` could not be read: it matches no fingerprint, so
 * `reconcilePinEpoch` treats the stored PIN as a changed one (fail closed). Never stored.
 */
export const PIN_HASH_UNREAD = 'unread';

interface ProfileLike {
  /** Absent on a profile saved before roles existed: read as `learner`, like `ProfileRoleSchema`'s default. */
  role?: ProfileRole;
  learnerType?: LearnerType;
}

const NON_LEARNER_ROLES: ReadonlySet<unknown> = new Set<ProfileRole>(['parent', 'teacher', 'admin']);

/**
 * Whether a profile entry is a learner: anything but a grown-up role is one. An entry without a
 * role is one (the schema default), and so is an entry that is not an object at all, so an
 * unreadable entry can only make the marker stricter, never `none`.
 */
export function isLearnerEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return true;
  return !NON_LEARNER_ROLES.has((entry as { role?: unknown }).role);
}

/**
 * The profiles a stored list (`hr:profiles`, read raw) stands for, reduced to what the marker
 * reads, the strict way: a learner unless the role is a grown-up one, and a self learner only
 * when it says so (absent reads as a child, F-LEARN-001). Anything but a list is no profile.
 */
export function storedMarkerProfiles(raw: unknown): ProfileLike[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): ProfileLike => {
    if (!isLearnerEntry(entry)) return { role: (entry as { role: ProfileRole }).role };
    const self = typeof entry === 'object' && entry !== null && (entry as { learnerType?: unknown }).learnerType === 'self';
    return self ? { role: 'learner', learnerType: 'self' } : { role: 'learner' };
  });
}

/**
 * Whether a stored `hr:profiles` value (read exactly, `null` when absent) can confirm a `none`
 * marker: only a missing key or a list can; anything else is damaged data that may hide a learner
 * (A-6 review), so it never confirms `none`.
 */
export function storedProfilesReadable(raw: unknown): boolean {
  return raw === null || Array.isArray(raw);
}

const FINGERPRINT = /^[0-9a-f]{16}$/;

/**
 * A stored `account:pinHashSeen` (read exactly, `null` when absent): absent is "nothing seen yet",
 * a fingerprint or `NO_PIN_SEEN` is kept, and anything else is damaged and reads as
 * `PIN_HASH_UNREAD`, so it moves the epoch like a failed read (A-6 review: fail closed).
 */
export function pinHashSeenOf(raw: unknown): string | null {
  if (raw === null) return null;
  if (raw === NO_PIN_SEEN || (typeof raw === 'string' && FINGERPRINT.test(raw))) return raw;
  return PIN_HASH_UNREAD;
}

/** `account:pinSetAt` as stored: a finite, non-negative time, else none. */
export function pinSetAtOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function pinEpochOf(pinSetAt: unknown): number {
  return pinSetAtOf(pinSetAt) ?? 0;
}

export function deviceGateMarker(input: {
  profiles: readonly ProfileLike[];
  parentPinHash: string | null;
  pinSetAt: number | null;
}): DeviceGateMarker {
  const { parentPinHash } = input;
  const profiles = input.profiles.map((p) => ({ ...p, role: isLearnerEntry(p) ? ('learner' as const) : (p.role as ProfileRole) }));
  if (!profiles.some((p) => p.role === 'learner') || !gateRequired({ profiles, parentPinHash })) return { v: 1, gate: 'none' };
  if (parentPinHash === null) return { v: 1, gate: 'nopin' };
  return { v: 1, gate: 'pin', pinEpoch: pinEpochOf(input.pinSetAt) };
}

function markerKey(marker: DeviceGateMarker): string {
  return marker.gate === 'pin' ? `pin:${marker.pinEpoch}` : marker.gate;
}

/** Whether `b` says what `a` (the marker written last, `null` when none) already said. */
export function sameMarker(a: DeviceGateMarker | null, b: DeviceGateMarker): boolean {
  return a !== null && markerKey(a) === markerKey(b);
}

/** One FNV-1a 32-bit lane over the UTF-16 code units of `text`, as 8 hex digits. */
function fnv1a(text: string, basis: number): string {
  let hash = basis >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * A short digest of the stored PIN hash (16 hex digits from two FNV-1a lanes), so a boot can
 * tell that the hash changed without keeping a second copy of it. Not a security primitive:
 * every new PIN has a new random salt, so its stored hash, and with it this value, changes.
 */
export function pinHashFingerprint(hash: string | null): string {
  if (hash === null) return NO_PIN_SEEN;
  return fnv1a(hash, 0x811c9dc5) + fnv1a(hash, 0x050c5d1f);
}

export interface PinEpochState {
  parentPinHash: string | null;
  pinSetAt: number | null;
  pinHashSeen: string | null;
}

/**
 * Any PIN change moves the epoch, whichever bundle made it (section 3.9, A-4a review): a tab
 * still running a learner bundle older than A-6 can reset the PIN without writing
 * `account:pinSetAt`. On boot the stored hash is compared with the fingerprint seen last:
 * - the same: nothing to write (`null`);
 * - nothing seen yet (the first boot of A-6): record the fingerprint, keep the epoch, so a PIN
 *   set before A-6 stays epoch `0` until it is set again;
 * - a different PIN: the epoch becomes `now`, so a grown-up must sign in once before the PIN
 *   opens the grown-up area again;
 * - a fingerprint that could not be read (`PIN_HASH_UNREAD`): the same, since the PIN may have
 *   changed;
 * - the PIN removed: record that, keep the epoch (no `pin` marker carries it).
 */
export function reconcilePinEpoch(state: PinEpochState, now: number): Pick<PinEpochState, 'pinSetAt' | 'pinHashSeen'> | null {
  const seen = pinHashFingerprint(state.parentPinHash);
  if (state.pinHashSeen === seen) return null;
  const moved = state.pinHashSeen !== null && state.parentPinHash !== null;
  return { pinSetAt: moved ? now : state.pinSetAt, pinHashSeen: seen };
}
