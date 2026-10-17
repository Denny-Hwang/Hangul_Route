import {
  APP_ROUTES,
  GROWN_UP_FRESH_PIN_MS,
  type DeviceGateMarker,
  type GrownUpUnlock,
} from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { GROWN_UP_AREA } from '../profiles/pin-flow';

/**
 * The learner app's hand-off into the grown-up area (F-APP-001 section 3.9, `openGrownUpArea`,
 * OD-3). Pure: `platform/grown-up-handoff.web.ts` reads the device state, writes the unlock and
 * navigates.
 *
 * 1. marker `none` (a self-only device without a PIN, or no learner profile): no unlock is
 *    needed; go.
 * 2. marker `nopin`: write nothing; go (the console's lock asks for a sign-in).
 * 3. marker `pin`: a PIN entered on the PIN screen in the last 2 minutes is needed. A gate the
 *    15-minute session opens directly does not count, so a tablet handed to a child after a PIN
 *    entry a while ago asks again; otherwise the PIN screen opens first (destination
 *    `GrownUpArea`, verify only).
 * 4. then the PIN unlock carries the marker epoch, which the console checks against the epoch a
 *    grown-up confirmed by signing in.
 */
export type GrownUpVia = 'profile' | 'dashboard' | 'plan' | 'lock';
export type HandoffTargetCode = 'router' | 'billing' | 'next';

export interface GrownUpHandoffRequest {
  via: GrownUpVia;
  /** The grown-up page to open; none opens the sign-in router (`/signin`), which routes a signed-in grown-up home. */
  target?: string;
}

export type HandoffDecision = { step: 'pin' } | { step: 'go'; unlock: GrownUpUnlock | null };

/** A PIN verified in `[0, GROWN_UP_FRESH_PIN_MS)` ago; a clock that ran backwards does not count. */
export function isFreshPin(lastPinVerifiedAt: number | null, now: number): boolean {
  if (lastPinVerifiedAt === null) return false;
  const age = now - lastPinVerifiedAt;
  return age >= 0 && age < GROWN_UP_FRESH_PIN_MS;
}

export function decideHandoff(input: {
  /** `null` while the stores have not loaded: no unlock is written, and the console decides. */
  marker: DeviceGateMarker | null;
  lastPinVerifiedAt: number | null;
  now: number;
}): HandoffDecision {
  const { marker, now } = input;
  if (marker === null || marker.gate !== 'pin') return { step: 'go', unlock: null };
  if (!isFreshPin(input.lastPinVerifiedAt, now)) return { step: 'pin' };
  return { step: 'go', unlock: { v: 1, at: now, seen: now, src: 'pin', pinEpoch: marker.pinEpoch } };
}

/** `shell.grown_up_handoff` `target`: the router without a page, billing for the Plan screen, else the lock's own page. */
export function handoffTargetCode(via: GrownUpVia, target: string | null | undefined): HandoffTargetCode {
  if (!target) return 'router';
  if (via !== 'lock' && target === APP_ROUTES.billing) return 'billing';
  return 'next';
}

const LANG = 'lang';

/**
 * The address to open: the target (already a safe grown-up path) or the sign-in router, always
 * with `?lang=<locale>` (F-I18N-001 hand-off), English included: without it the console fell back
 * to its own stored choice or the browser languages, so a learner app in English could open a
 * grown-up page in another language. A `lang` the target already carries is replaced, so the
 * hand-off always speaks for the learner app's language as it is now. Other query pairs keep the
 * exact text they were written with.
 */
export function handoffUrl(target: string | null | undefined, locale: UiLocale): string {
  const base = target || APP_ROUTES.signIn;
  const q = base.indexOf('?');
  const path = q === -1 ? base : base.slice(0, q);
  const pairs = q === -1 ? [] : base.slice(q + 1).split('&').filter((pair) => pair !== '' && pair.split('=')[0] !== LANG);
  pairs.push(`${LANG}=${locale}`);
  return `${path}?${pairs.join('&')}`;
}

/** Route params of the PIN screen the hand-off opens when a fresh PIN is needed. */
export function grownUpPinParams(request: GrownUpHandoffRequest): { next: typeof GROWN_UP_AREA; url?: string; grownUpVia: GrownUpVia } {
  return { next: GROWN_UP_AREA, ...(request.target === undefined ? {} : { url: request.target }), grownUpVia: request.via };
}
