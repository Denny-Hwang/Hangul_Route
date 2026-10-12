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

interface ProfileLike {
  /** Absent on a profile saved before roles existed: read as `learner`, like `ProfileRoleSchema`'s default. */
  role?: ProfileRole;
  learnerType?: LearnerType;
}

/**
 * Whether a profile entry is a learner. An entry without a role is one (the schema default); an
 * entry that is not an object at all counts as one too, so an unreadable entry can only make the
 * marker stricter, never `none`.
 */
export function isLearnerEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return true;
  const role = (entry as { role?: unknown }).role;
  return role === undefined || role === 'learner';
}

/** Whether a stored profile list (`hr:profiles`, read raw) holds a learner; anything but a list holds none. */
export function storedListHasLearner(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some(isLearnerEntry);
}

export function pinEpochOf(pinSetAt: unknown): number {
  return typeof pinSetAt === 'number' && Number.isFinite(pinSetAt) && pinSetAt >= 0 ? pinSetAt : 0;
}

export function deviceGateMarker(input: {
  profiles: readonly ProfileLike[];
  parentPinHash: string | null;
  pinSetAt: number | null;
}): DeviceGateMarker {
  const { parentPinHash } = input;
  const profiles = input.profiles.map((p) => ({ ...p, role: p.role ?? 'learner' }));
  if (!profiles.some(isLearnerEntry) || !gateRequired({ profiles, parentPinHash })) return { v: 1, gate: 'none' };
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
 * - the PIN removed: record that, keep the epoch (no `pin` marker carries it).
 */
export function reconcilePinEpoch(state: PinEpochState, now: number): Pick<PinEpochState, 'pinSetAt' | 'pinHashSeen'> | null {
  const seen = pinHashFingerprint(state.parentPinHash);
  if (state.pinHashSeen === seen) return null;
  const moved = state.pinHashSeen !== null && state.parentPinHash !== null;
  return { pinSetAt: moved ? now : state.pinSetAt, pinHashSeen: seen };
}
