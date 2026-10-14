import { APP_ORIGIN, APP_ROUTES, type AdultPersona } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { appUrl } from './console/config';
import { appEntryUrl } from './site-path';

/**
 * Every link from hangulroute.com to the app (F-SITE-002 §3.8). The only place the site builds an app URL,
 * and it spells no path: paths come from F-APP-001's `APP_ROUTES`, the grown-up origin from the site build
 * variable `CONSOLE_ORIGIN` that F-SITE-002 §3.8 defines (inlined by `next.config.js`).
 *
 * - While `CONSOLE_ORIGIN` is unset, grown-up links stay on the site's own origin (`/signin?persona=parent`),
 *   where F-APP-001's `/signin` is part of the same export. Once the owner sets
 *   `CONSOLE_ORIGIN=https://app.hangulroute.com` on the site build at M3 (F-SITE-002 §3.8, §3.10), the same
 *   build sends them to the app host.
 * - Never `/teach`, `/parent`, `/account` or billing: a parent never passes through the teacher router, and
 *   the site has no billing link (F-BILL-002 §4.1). `site-links.test.ts` pins this for both origins.
 * - Learners never sign in with an email or password (F-APP-001 OD-2): their action is always `learnerStart`.
 *
 * Server components only. `APP_ROUTES` comes from the content-schema barrel, which a client bundle would ship
 * whole (zod included). Call these functions in a server component and pass the href strings to a client
 * component as props, the way `WaitlistForm` gets its words; `landing-client-bundle.test.ts` fails otherwise.
 *
 * Use plain `<a>` for these links, never `next/link` (they leave the site route groups).
 */

/** The grown-up personas the `/signin` page reads from `?persona=` (F-APP-001 §3.7). */
export type GrownUpPersona = AdultPersona;

/** `''` (same origin) until S-10, then `APP_ORIGIN`. A build with `CONSOLE_ORIGIN` set ignores it. */
export const SITE_DEFAULT_CONSOLE_ORIGIN: '' | typeof APP_ORIGIN = '';

/** Hosts where a plain-http origin is allowed: this machine only (local builds and tests). */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The only domain an https `CONSOLE_ORIGIN` may name (itself or a subdomain): a mistyped host is ignored. */
const SITE_DOMAIN = 'hangulroute.com';

/**
 * The origin of the grown-up pages: `CONSOLE_ORIGIN` trimmed, as an origin without a trailing slash;
 * otherwise `SITE_DEFAULT_CONSOLE_ORIGIN`. `''` means the site's own origin. Only an https URL on
 * hangulroute.com or a subdomain counts (plain http only on `LOCAL_HOSTS`); any other value falls back to the default, so it never breaks Sign in.
 * `next.config.js` repeats this rule and fails the build on such a value, so a typo is seen, not shipped.
 */
export function grownUpOrigin(env: { CONSOLE_ORIGIN?: string } = { CONSOLE_ORIGIN: process.env.CONSOLE_ORIGIN }): string {
  const raw = env.CONSOLE_ORIGIN?.trim();
  if (!raw) return SITE_DEFAULT_CONSOLE_ORIGIN;
  try {
    const url = new URL(raw);
    const ownHost = url.hostname === SITE_DOMAIN || url.hostname.endsWith(`.${SITE_DOMAIN}`);
    const allowed = (url.protocol === 'https:' && ownHost) || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    return allowed ? url.origin : SITE_DEFAULT_CONSOLE_ORIGIN;
  } catch {
    return SITE_DEFAULT_CONSOLE_ORIGIN;
  }
}

/** The learner app from a site page in `locale`, with `?lang=` from `/es` or `/ko` (F-I18N-001 §3.3). */
export function learnerStart(locale: UiLocale): string {
  return appEntryUrl(appUrl(), locale);
}

/** Grown-up sign-in; with a persona, the `/signin` intro for it. The header and footer pass none (neutral intro). */
export function signIn(persona?: GrownUpPersona): string {
  const href = `${grownUpOrigin()}${APP_ROUTES.signIn}`;
  return persona ? `${href}?persona=${persona}` : href;
}
