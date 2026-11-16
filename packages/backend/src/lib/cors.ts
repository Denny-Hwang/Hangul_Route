/**
 * Browser origins allowed to call /api/* — F-CONSOLE-001 §3.1. The PWA
 * (app.hangulroute.com) and the console (hangulroute.com) are separate
 * origins from the Worker, so every browser call needs this.
 */
export const DEFAULT_ORIGINS = ['https://hangulroute.com', 'https://www.hangulroute.com', 'https://app.hangulroute.com'] as const;

export function parseAllowedOrigins(raw: string | undefined): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : [...DEFAULT_ORIGINS];
}

/**
 * The origin to echo back, or null. An explicit list is final. With no
 * explicit list, production (`environment` = "production", which is also what
 * an unset ENVIRONMENT means: `environmentName`, lib/runtime) accepts
 * `DEFAULT_ORIGINS` only; any other deployment also accepts local dev servers
 * and workers.dev previews. [AU] AMENDMENTS-AUDIT-2026-11 AU-4 (audit SEC-2):
 * anyone can publish a workers.dev site, so production never trusts one unless
 * the owner lists it in ALLOWED_ORIGINS.
 */
export function allowedOrigin(origin: string | undefined, raw: string | undefined, environment: string): string | null {
  if (!origin) return null;
  const explicit = parseAllowedOrigins(raw);
  if (explicit.includes(origin)) return origin;
  if (raw && raw.trim()) return null;
  if (environment === 'production') return null;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev$/.test(origin)) return origin;
  return null;
}

/**
 * Clerk `authorizedParties` for a session token whose `azp` claim names
 * `azp` (F-APP-001 A-9): the same allow-list, so the API accepts a token only
 * from a site the browser may call it from. With an explicit list that list
 * is final; without one, a local dev server or workers.dev preview that
 * `allowedOrigin` lets in for this `environment` is added, so previews keep
 * working exactly where CORS already lets them call. In production that is
 * never ([AU] AU-4), whatever `azp` is passed. Always a fresh array.
 */
export function authorizedPartiesFor(raw: string | undefined, azp: string | undefined, environment: string): string[] {
  const parties = parseAllowedOrigins(raw);
  const preview = allowedOrigin(azp, raw, environment);
  return preview && !parties.includes(preview) ? [...parties, preview] : parties;
}
