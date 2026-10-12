import { APP_ORIGIN, APP_ROUTES, safeNextPath, unlockActive, type DeviceGateMarker, type GrownUpUnlock } from '@hangul-route/content-schema';

/**
 * The grown-up lock decision (F-APP-001 section 3.9, OD-3; wireframe shell/grown-up-lock.md).
 * A parent stays signed in on the family tablet for days, so a grown-up page on a device with
 * learner profiles also needs, in this tab within 15 idle minutes, either a fresh PIN whose
 * epoch a grown-up confirmed by signing in, or a secret-proving sign-in. Pure: the component
 * (`components/console/GrownUpLock.tsx`) reads the stored records and asks this module.
 */

/** What the console could read of the learner app's device state (IndexedDB, `lib/console/device-marker.ts`). */
export type DeviceGateRead =
  | { readable: false }
  | {
      readable: true;
      /** `hr:device:gate`; null when absent or invalid. */
      marker: DeviceGateMarker | null;
      /** Whether `hr:profiles` holds a non-empty list (the fallback for learner apps older than A-6). */
      hasProfiles: boolean;
    };

/** `default` goes with the PIN button; the other three are the sign-in-only cases. */
export type LockLine = 'default' | 'pinChanged' | 'firstSignIn' | 'noPin';

export type LockDecision = { state: 'open' } | { state: 'locked'; pinPath: boolean; line: LockLine };

export interface LockInput {
  /** `/signin` is exempt from the lock (section 3.7). */
  exempt?: boolean;
  device: DeviceGateRead;
  /** `sessionStorage` `hr:grownup:unlock` of this tab, already read leniently. */
  unlock: GrownUpUnlock | null;
  /** Shell store `pinEpoch`: the marker epoch seen at the last secret-proving sign-in in this browser. */
  trustedEpoch: number | null;
  now: number;
}

const OPEN: LockDecision = { state: 'open' };
const signInOnly = (line: LockLine): LockDecision => ({ state: 'locked', pinPath: false, line });

/** Epoch `0` is the shared value of every PIN set before A-6, so it is never trusted. */
function isRealEpoch(epoch: number | null | undefined): epoch is number {
  return typeof epoch === 'number' && Number.isFinite(epoch) && epoch > 0;
}

/**
 * What a secret-proving sign-in stores as the trusted epoch: the epoch of a `pin` marker, never
 * `0`; `null` (store nothing, forget any earlier one) for every other device state.
 */
export function trustableEpoch(marker: DeviceGateMarker | null): number | null {
  return marker?.gate === 'pin' && isRealEpoch(marker.pinEpoch) ? marker.pinEpoch : null;
}

/** The decision table of section 3.9, row by row. */
export function decideGrownUpLock(input: LockInput): LockDecision {
  const { device, unlock, now } = input;
  if (input.exempt) return OPEN;
  if (!device.readable) return OPEN;
  const { marker } = device;
  if (marker === null && !device.hasProfiles) return OPEN;
  if (marker?.gate === 'none') return OPEN;

  const active = unlockActive(unlock, now) ? unlock : null;
  // A sign-in unlock opens every locked row.
  if (active?.src === 'signin') return OPEN;

  if (marker === null) return signInOnly('firstSignIn');
  if (marker.gate === 'nopin') return signInOnly('noPin');

  const trusted = isRealEpoch(input.trustedEpoch) ? input.trustedEpoch : null;
  const markerTrusted = trusted !== null && marker.pinEpoch === trusted;
  if (active?.src === 'pin') {
    return markerTrusted && active.pinEpoch === marker.pinEpoch ? OPEN : signInOnly('pinChanged');
  }
  if (markerTrusted) return { state: 'locked', pinPath: true, line: 'default' };
  return signInOnly(trusted === null ? 'firstSignIn' : 'pinChanged');
}

/**
 * Use the grown-up PIN: the learner app's gate (A-6 parses `gate=grown-up` once, opens the PIN
 * screen in verify mode, writes the PIN unlock and comes back to `next`). `path` is this page's
 * path and query; one that `safeNextPath` refuses comes back through the router instead.
 */
export function pinPathUrl(path: string): string {
  return `/?gate=grown-up&next=${encodeURIComponent(safeNextPath(path) ?? APP_ROUTES.signIn)}`;
}

/** Sign in again: after the sign-out, `/signin` with this page as `next`. */
export function signInAgainUrl(path: string): string {
  const next = safeNextPath(path);
  return next ? `${APP_ROUTES.signIn}?next=${encodeURIComponent(next)}` : APP_ROUTES.signIn;
}

/** The learner app: `/` on the app host, the app host itself while the console is still served on hangulroute.com. */
export function learnerHome(origin: string): string {
  return origin === APP_ORIGIN ? APP_ROUTES.learn : `${APP_ORIGIN}${APP_ROUTES.learn}`;
}
