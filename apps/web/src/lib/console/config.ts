/** Build-time switches for the console — F-CONSOLE-001 §3.2. */
export interface ConsoleEnv {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_CONSOLE_DEV_AUTH?: string;
  NEXT_PUBLIC_SCHOOL_CONSENT_MODE?: string;
  NODE_ENV?: string;
}

const PLACEHOLDER = 'https://api.hangulroute.example';

export function apiBaseUrl(env: ConsoleEnv = process.env as ConsoleEnv): string | null {
  const raw = env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');
  return raw && raw !== PLACEHOLDER ? raw : null;
}

/** The dev sign-in form (bearer = account id, F-AUTH-001 fallback) — never on by default in production. */
export function devAuthEnabled(env: ConsoleEnv = process.env as ConsoleEnv): boolean {
  if (env.NEXT_PUBLIC_CONSOLE_DEV_AUTH === 'true') return true;
  if (env.NEXT_PUBLIC_CONSOLE_DEV_AUTH === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** School consent mode (F-TCH-001 §10.3) stays locked until the owner's legal review — mirrors the Worker's SCHOOL_CONSENT_MODE. */
export function schoolConsentModeEnabled(env: ConsoleEnv = process.env as ConsoleEnv): boolean {
  return env.NEXT_PUBLIC_SCHOOL_CONSENT_MODE === 'enabled';
}
