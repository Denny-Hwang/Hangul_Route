import { APP_ORIGIN, APP_ROUTES, SITE_ORIGIN, safeNextPath, unlockActive, type DeviceGateMarker, type GrownUpUnlock, type UiLocale } from '@hangul-route/content-schema';

/**
 * The grown-up lock decision (F-APP-001 section 3.9, OD-3; wireframe shell/grown-up-lock.md).
 * A parent stays signed in on the family tablet for days, so a grown-up page on a device with
 * learner profiles also needs, in this tab within 15 idle minutes, either a fresh PIN whose
 * epoch a grown-up confirmed by signing in, or a secret-proving sign-in. Pure: the component
 * (`components/console/GrownUpLock.tsx`) reads the stored records and asks this module.
 */

/**
 * What the console could read of the learner app's device state (IndexedDB, `lib/console/device-marker.ts`).
 * `unavailable`: the browser has no IndexedDB API, so it cannot keep learner profiles either.
 * `failed`: the API exists but the read failed or timed out; this browser may hold profiles.
 */
export type DeviceGateRead =
  | { readable: false; reason: 'unavailable' | 'failed' }
  | {
      readable: true;
      /** `hr:device:gate`; null when absent or invalid. */
      marker: DeviceGateMarker | null;
      /** Whether `hr:profiles` holds a non-empty list (the fallback for learner apps older than A-6). */
      hasProfiles: boolean;
    };

/**
 * `default` goes with the PIN button; the others are the sign-in-only cases, each chosen by its
 * cause so it promises only what a sign-in can do: `firstSignIn` (no grown-up signed in here yet;
 * a sign-in turns the PIN path on), `pinChanged` (the epoch moved since), `pinRenew` (a PIN set
 * before A-6, epoch 0, which a sign-in never trusts), `signInOnly` (no PIN path at all: a learner
 * app older than A-6, or a failed read) and `noPin` (a family device without a PIN).
 */
export type LockLine = 'default' | 'pinChanged' | 'firstSignIn' | 'pinRenew' | 'signInOnly' | 'noPin';

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

/** Why the PIN cannot open a `pin` device whose epoch is not the trusted one. */
function untrustedLine(markerEpoch: number, trusted: number | null): LockLine {
  if (!isRealEpoch(markerEpoch)) return 'pinRenew';
  return trusted === null ? 'firstSignIn' : 'pinChanged';
}

/** The decision table of section 3.9, row by row (lines by cause, A-4a review 2026-10-12). */
export function decideGrownUpLock(input: LockInput): LockDecision {
  const { device, unlock, now } = input;
  if (input.exempt) return OPEN;
  if (!device.readable && device.reason === 'unavailable') return OPEN;
  // A failed read counts as an absent marker on a device with profiles: it may hold them.
  const marker = device.readable ? device.marker : null;
  if (device.readable && marker === null && !device.hasProfiles) return OPEN;
  if (marker?.gate === 'none') return OPEN;

  const active = unlockActive(unlock, now) ? unlock : null;
  // A sign-in unlock opens every locked row.
  if (active?.src === 'signin') return OPEN;

  if (marker === null) return signInOnly('signInOnly');
  if (marker.gate === 'nopin') return signInOnly('noPin');

  const trusted = isRealEpoch(input.trustedEpoch) ? input.trustedEpoch : null;
  if (trusted === null || marker.pinEpoch !== trusted) return signInOnly(untrustedLine(marker.pinEpoch, trusted));
  if (active === null) return { state: 'locked', pinPath: true, line: 'default' };
  // A PIN unlock made with another epoch: the PIN changed since it was entered.
  return active.src === 'pin' && active.pinEpoch === marker.pinEpoch ? OPEN : signInOnly('pinChanged');
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

/** The site origins that still serve the console until F-SITE-002 S-10 (hangulroute.com and www). */
const SITE_ORIGINS: ReadonlySet<string> = new Set([SITE_ORIGIN, SITE_ORIGIN.replace('://', '://www.')]);

/**
 * The learner app: the app host itself while the console is still served on the site, `/`
 * everywhere else (the app host, a merged-build preview, a local build), so a preview or a test
 * never leaves for production (A-4a review 2026-10-12, refines section 3.8). It always carries
 * `?lang=<the console's language>`, English included (AMENDMENTS-DISPLAY-NAV section 6): the
 * learner app uses it only to seed a device that never chose.
 */
export function learnerHome(origin: string, locale: UiLocale): string {
  const home = isSiteOrigin(origin) ? `${APP_ORIGIN}${APP_ROUTES.learn}` : APP_ROUTES.learn;
  return `${home}?lang=${locale}`;
}

/** Whether this page runs on a site origin (the console there until F-SITE-002 S-10), not on the learner app's origin. */
export function isSiteOrigin(origin: string): boolean {
  return SITE_ORIGINS.has(origin);
}
