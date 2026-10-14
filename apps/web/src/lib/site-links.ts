import { APP_ORIGIN, APP_ROUTES, type AdultPersona } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { appUrl } from './console/config';
import { appEntryUrl } from './site-path';

/**
 * Every link from hangulroute.com to the app (F-SITE-002 §3.8). The only place the site builds an app URL,
 * and it spells no path: paths come from F-APP-001's `APP_ROUTES`, the grown-up origin from the site build
 * variable `CONSOLE_ORIGIN` that F-SITE-002 §3.8 defines (inlined by `next.config.js`).
 *
 * - Since S-10 (F-SITE-002 §3.10, with F-APP-001 A-10) a build without `CONSOLE_ORIGIN` sends grown-up links to
 *   the app host (`SITE_DEFAULT_CONSOLE_ORIGIN`), the place production moved them at M3. `CONSOLE_ORIGIN` still
 *   overrides it, and the kill switch `CONSOLE_ORIGIN=false` (or `0`) keeps them on the site's own origin
 *   (`/signin?persona=parent`), where F-APP-001's `/signin` is part of the same export.
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

/** `APP_ORIGIN` since S-10 (was `''`, same origin, until then). A build with `CONSOLE_ORIGIN` set ignores it. */
export const SITE_DEFAULT_CONSOLE_ORIGIN: typeof APP_ORIGIN = APP_ORIGIN;

/**
 * Values of `CONSOLE_ORIGIN` that switch the move off (compared trimmed, in lower case): grown-up links stay on
 * the site's own origin and `site-redirects.mjs` writes no `_redirects`. `next.config.js` and
 * `scripts/site-redirects.mjs` repeat this list; their tests check that all three agree.
 */
export const CONSOLE_ORIGIN_OFF: readonly string[] = ['false', '0'];

/** Hosts where a plain-http origin is allowed: this machine only (local builds and tests). */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The only domain an https `CONSOLE_ORIGIN` may name (itself or a subdomain): a mistyped host is ignored. */
const SITE_DOMAIN = 'hangulroute.com';

/**
 * What a `CONSOLE_ORIGIN` value says: `''` (the site's own origin) for a `CONSOLE_ORIGIN_OFF` value, the origin
 * without a trailing slash for an https URL on hangulroute.com or a subdomain (plain http only on
 * `LOCAL_HOSTS`), and `undefined` for anything else (unset, blank or invalid: the caller uses the default).
 */
export function parseConsoleOrigin(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (CONSOLE_ORIGIN_OFF.includes(value.toLowerCase())) return '';
  try {
    const url = new URL(value);
    const ownHost = url.hostname === SITE_DOMAIN || url.hostname.endsWith(`.${SITE_DOMAIN}`);
    const allowed = (url.protocol === 'https:' && ownHost) || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    return allowed ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The origin of the grown-up pages (`''` means the site's own origin): `parseConsoleOrigin(CONSOLE_ORIGIN)`,
 * otherwise `SITE_DEFAULT_CONSOLE_ORIGIN`. An invalid value falls back to the default, so it never breaks
 * Sign in; `next.config.js` repeats the rule and fails the build on such a value, so a typo is seen, not shipped.
 */
export function grownUpOrigin(env: { CONSOLE_ORIGIN?: string } = { CONSOLE_ORIGIN: process.env.CONSOLE_ORIGIN }): string {
  return parseConsoleOrigin(env.CONSOLE_ORIGIN) ?? SITE_DEFAULT_CONSOLE_ORIGIN;
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
