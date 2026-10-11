/** Build-time switches for the console — F-CONSOLE-001 §3.2. */
export interface ConsoleEnv {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_CONSOLE_DEV_AUTH?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SCHOOL_CONSENT_MODE?: string;
  /** The learner web app (the lecture presenter lives at `${APP_URL}/present`, F-TCH-004 §3.2). */
  NEXT_PUBLIC_APP_URL?: string;
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
