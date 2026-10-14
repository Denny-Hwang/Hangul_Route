import type { UiLocale } from '@hangul-route/i18n';

/** Build-time switches for the console — F-CONSOLE-001 §3.2. */
export interface ConsoleEnv {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_CONSOLE_DEV_AUTH?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SCHOOL_CONSENT_MODE?: string;
  /** The learner web app (the lecture presenter lives at `${APP_URL}/present`, F-TCH-004 §3.2). */
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_LECTURE_MODE?: string;
  /** The free-plan switch (F-ENT-003 section 3.4), the console twin of the learner app's `EXPO_PUBLIC_CONTENT_GATING_ENABLED`. */
  NEXT_PUBLIC_CONTENT_GATING_ENABLED?: string;
  /** Notes from grown-ups (F-FEEDBACK-001), the console twin of the learner app's `EXPO_PUBLIC_NOTES_ENABLED`. */
  NEXT_PUBLIC_NOTES_ENABLED?: string;
  /** The grown-up Learning Route page (Learning Route amendment section 6.1, F-APP-001's reader), default off. */
  NEXT_PUBLIC_LEARNING_ROUTE_ENABLED?: string;
  /** Progress reports (F-REPORT-001), the console twin of the learner app's `EXPO_PUBLIC_REPORTS_ENABLED`; on unless `'false'` or `'0'`. */
  NEXT_PUBLIC_REPORTS_ENABLED?: string;
  /** All lessons, the grown-up Lessons entry (F-BROWSE-001 section 5.4; F-APP-001 section 3.8); on unless `'false'`, `'0'` or `'disabled'`, case and spaces ignored (BR-14). */
  NEXT_PUBLIC_BROWSE?: string;
  /** Class moves (F-SPACE-002 section 4.8), `enabled` to show the entry points; default off, flipped by the owner after the Worker's `CLASS_TRANSFER`. */
  NEXT_PUBLIC_CLASS_TRANSFER?: string;
  NODE_ENV?: string;
}

const PLACEHOLDER = 'https://api.hangulroute.example';

/**
 * The build's own values. Next.js inlines only literal `process.env.NEXT_PUBLIC_*` reads into the
 * browser bundle; handing the whole env object around reaches the browser as `{}`, so every
 * key is spelled out here.
 */
export function buildEnv(): ConsoleEnv {
  return {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_CONSOLE_DEV_AUTH: process.env.NEXT_PUBLIC_CONSOLE_DEV_AUTH,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SCHOOL_CONSENT_MODE: process.env.NEXT_PUBLIC_SCHOOL_CONSENT_MODE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_LECTURE_MODE: process.env.NEXT_PUBLIC_LECTURE_MODE,
    NEXT_PUBLIC_CONTENT_GATING_ENABLED: process.env.NEXT_PUBLIC_CONTENT_GATING_ENABLED,
    NEXT_PUBLIC_NOTES_ENABLED: process.env.NEXT_PUBLIC_NOTES_ENABLED,
    NEXT_PUBLIC_LEARNING_ROUTE_ENABLED: process.env.NEXT_PUBLIC_LEARNING_ROUTE_ENABLED,
    NEXT_PUBLIC_REPORTS_ENABLED: process.env.NEXT_PUBLIC_REPORTS_ENABLED,
    NEXT_PUBLIC_BROWSE: process.env.NEXT_PUBLIC_BROWSE,
    NEXT_PUBLIC_CLASS_TRANSFER: process.env.NEXT_PUBLIC_CLASS_TRANSFER,
    NODE_ENV: process.env.NODE_ENV,
  };
}

export function apiBaseUrl(env: ConsoleEnv = buildEnv()): string | null {
  const raw = env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');
  return raw && raw !== PLACEHOLDER ? raw : null;
}

/** Clerk publishable key (pk_…), set as a build variable — F-AUTH-002. Null = Clerk not configured on this build. */
export function clerkPublishableKey(env: ConsoleEnv = buildEnv()): string | null {
  const raw = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  return raw && /^pk_(test|live)_/.test(raw) ? raw : null;
}

/**
 * The dev sign-in form (bearer = account id, F-AUTH-001 fallback) — never on by default in
 * production, and never when Clerk is configured (a real sign-in always wins).
 */
export function devAuthEnabled(env: ConsoleEnv = buildEnv()): boolean {
  if (clerkPublishableKey(env)) return false;
  if (env.NEXT_PUBLIC_CONSOLE_DEV_AUTH === 'true') return true;
  if (env.NEXT_PUBLIC_CONSOLE_DEV_AUTH === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** School consent mode (F-TCH-001 §10.3) stays locked until the owner's legal review — mirrors the Worker's SCHOOL_CONSENT_MODE. */
export function schoolConsentModeEnabled(env: ConsoleEnv = buildEnv()): boolean {
  return env.NEXT_PUBLIC_SCHOOL_CONSENT_MODE === 'enabled';
}

/**
 * Lecture mode (F-TCH-004): the console setup page and its entry points stay hidden until the
 * presenter (PR 6) is deployed in the learner app, so no teacher opens a link the app cannot
 * play yet. Switched on with `NEXT_PUBLIC_LECTURE_MODE=enabled` at build time.
 */
export function lectureModeEnabled(env: ConsoleEnv = buildEnv()): boolean {
  return env.NEXT_PUBLIC_LECTURE_MODE === 'enabled';
}

/**
 * The free-plan switch (F-ENT-003 section 3.4, OD-2): `NEXT_PUBLIC_CONTENT_GATING_ENABLED`, parsed
 * like the learner app's flag (`'true'` or `'1'` is on; anything else, or unset, is the launch
 * default, off). Off in production until the owner turns on Stripe Live. On the console it only
 * changes words: the curriculum wizard's left-out warning and short-plan line (section 3.9.3)
 * and the grown-up free-lessons line (section 3.9.2). The device stays the authority on what
 * opens; the generator's input never depends on it.
 */
export function contentGatingEnabled(env: ConsoleEnv = buildEnv()): boolean {
  const raw = env.NEXT_PUBLIC_CONTENT_GATING_ENABLED;
  return raw === 'true' || raw === '1';
}

/**
 * Notes from grown-ups (F-FEEDBACK-001 section 6.13): the notes pages, the composer and every entry
 * (adult nav, roster card, parent home, report slot) render only with `NEXT_PUBLIC_NOTES_ENABLED`
 * set to `'true'` or `'1'`, parsed like the learner app's flag. Off by default; FB-14 turns it on.
 * Sending also needs the Worker switch `NOTES_SEND` (section 7.8), which this flag never changes.
 */
export function notesEnabled(env: ConsoleEnv = buildEnv()): boolean {
  const raw = env.NEXT_PUBLIC_NOTES_ENABLED;
  return raw === 'true' || raw === '1';
}

/**
 * The grown-up Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1; F-APP-001 section 3.8
 * names the reader): the stage list page `/teach/space/route` and every entry to it render only with
 * `NEXT_PUBLIC_LEARNING_ROUTE_ENABLED` set to `'true'` or `'1'`. Off by default.
 */
export function learningRouteEnabled(env: ConsoleEnv = buildEnv()): boolean {
  const raw = env.NEXT_PUBLIC_LEARNING_ROUTE_ENABLED;
  return raw === 'true' || raw === '1';
}

/**
 * Console locales whose `report.*` words have passed native review (F-REPORT-001 section 3.1). Korean and Spanish
 * join when their review lands (F-I18N-001 PR 16); until then a ko or es console shows no report entry.
 */
export const REPORT_REVIEWED_LOCALES: readonly UiLocale[] = ['en'];

/** The reports switch when the build sets no value (F-REPORT-001 RP-11 turned it on, with the learner app's). */
const REPORTS_LAUNCH_DEFAULT = true;

/**
 * Progress reports (F-REPORT-001 section 3.1): the report pages, their entries and navigation items render with a
 * console locale in `REPORT_REVIEWED_LOCALES` unless `NEXT_PUBLIC_REPORTS_ENABLED` switches them off. The value is
 * parsed like the learner app's flag: `'false'` or `'0'` is off, `'true'` or `'1'` is on, anything else (or unset) is
 * the launch default, on since RP-11. Switched off, the entries are not drawn and the pages show the "not available
 * yet" state with the back link. The Worker routes are always on; this flag never changes what they serve.
 */
export function reportsEnabled(locale: UiLocale, env: ConsoleEnv = buildEnv()): boolean {
  const raw = env.NEXT_PUBLIC_REPORTS_ENABLED;
  const on = raw === 'false' || raw === '0' ? false : REPORTS_LAUNCH_DEFAULT;
  return on && REPORT_REVIEWED_LOCALES.includes(locale);
}

/** The All lessons switch when the build sets no value (F-BROWSE-001 BR-14 turned it on, owner decision 2026-10-13). */
const BROWSE_LAUNCH_DEFAULT = true;

/** The values that switch All lessons off: the `reportsEnabled()` pair plus `disabled`, the word the flag first used `enabled` for. */
const BROWSE_OFF_VALUES: readonly string[] = ['false', '0', 'disabled'];

/**
 * All lessons (F-BROWSE-001 section 5.4; the one predicate of F-APP-001 section 3.8, amended by F-BROWSE-001 BR-0b):
 * on by default since BR-14. `NEXT_PUBLIC_BROWSE` set to `false`, `0` or `disabled` (case and surrounding spaces ignored,
 * so a pasted `FALSE ` still works as the rollback) switches every Lessons entry and Preview link off (not drawn); any
 * other value, `enabled` included, or none is the launch default, on.
 * The entries still render only on the app origin (`browseEntryShown`, `browseLinksShown`), never on the site.
 */
export function browseEnabled(env: ConsoleEnv = buildEnv()): boolean {
  const raw = env.NEXT_PUBLIC_BROWSE?.trim().toLowerCase();
  return raw !== undefined && BROWSE_OFF_VALUES.includes(raw) ? false : BROWSE_LAUNCH_DEFAULT;
}

/**
 * Whether a Lessons entry shows on this page (F-APP-001 section 3.8, F-BROWSE-001 section 4.3): `browseEnabled()`
 * and the console runs on the app origin (`/browse` is a learner root of that origin only, never of the site).
 */
export function browseEntryShown(origin: string, env: ConsoleEnv = buildEnv()): boolean {
  return browseEnabled(env) && origin === appUrl(env);
}

/**
 * Class moves (F-SPACE-002 section 4.8, flag handling): the Move action, the start sheet, the requests and family
 * pages and every count render only with `NEXT_PUBLIC_CLASS_TRANSFER=enabled` (the `lectureModeEnabled()` pattern).
 * Off by default; the owner sets it after the Worker's `CLASS_TRANSFER` and every flip gate of section 7, never a PR.
 * The first `422 transfers_locked` hides them for the session too (`transfer-lock.ts`).
 */
export function classTransferEnabled(env: ConsoleEnv = buildEnv()): boolean {
  return env.NEXT_PUBLIC_CLASS_TRANSFER === 'enabled';
}

export const DEFAULT_APP_URL = 'https://app.hangulroute.com';

/**
 * The learner web app's origin (no path, no trailing slash): the presenter URL is
 * `${appUrl()}/present#d=…` and the roster hand-off only answers this origin (F-TCH-004 §3.2).
 * Anything that is not an http(s) URL falls back to production.
 */
export function appUrl(env: ConsoleEnv = buildEnv()): string {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_APP_URL;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : DEFAULT_APP_URL;
  } catch {
    return DEFAULT_APP_URL;
  }
}
