import { verifyToken } from '@clerk/backend';
import { decodeJwt } from '@clerk/backend/jwt';
import type { Context } from 'hono';
import { authorizedPartiesFor } from './cors';
import { devFallbacksAllowed, environmentName, notConfigured, type RuntimeEnv } from './runtime';

/**
 * Resolve the authenticated adult (Clerk user id) from the request bearer.
 *
 * Production: verifies a Clerk session JWT with CLERK_SECRET_KEY / CLERK_JWT_KEY
 * (bound via `wrangler secret`). Without either key the request fails closed
 * with 503 `auth_not_configured` (audit SEC-2), unless the deployment opted in
 * to the dev fallback (ENVIRONMENT=development|test or ALLOW_DEV_AUTH=true,
 * see ./runtime) — then the bearer string is trusted as the user id so routes
 * stay testable locally.
 *
 * The token must also come from an allowed site (F-APP-001 A-9): its `azp`
 * claim is checked against the CORS allow-list (`authorizedPartiesFor`), so a
 * token minted on another subdomain of the same Clerk instance is refused.
 * Production (ENVIRONMENT unset or "production") uses the list alone: the
 * local dev server and workers.dev leniency that CORS keeps without an
 * explicit list never applies to tokens there, since a Clerk Production
 * instance serves only its own domain. A token with no `azp` (not minted by a
 * browser) follows Clerk's default and is checked for signature and expiry only; F-AUTH-004 (row NS-1) lets it read
 * the account routes (the native app's token) but never a money route (`lib/native-client`).
 */
export async function getAuthUserId(c: Context): Promise<string | null> {
  return (await getAuthClaims(c))?.sub ?? null;
}

/** Factor verification age in minutes, `[firstFactor, secondFactor]` (Clerk session token v2; -1 = never). */
export type FactorVerificationAge = readonly [number, number];

/**
 * The verified claims of the request's bearer (F-BILL-002 B-5): `sub` as
 * `getAuthUserId` returns it, and `fva` for step-up on money routes
 * (`lib/step-up`); `fva` is null when the token carries none or a malformed
 * one. `verified` is false on the dev fallback, where the bearer string is the
 * user id and there is no token to read. Null when no bearer verifies. The
 * same request is verified once, however many times this is called.
 */
export interface AuthClaims {
  sub: string;
  fva: FactorVerificationAge | null;
  verified: boolean;
  /**
   * F-AUTH-004 section 9.4 (row NS-1): the site that minted the verified token (`azp`), or null when it names none
   * (a missing, empty or non-string claim): only a non-browser client, such as the native app's Clerk SDK, mints one
   * without it, so the money routes refuse it (`lib/native-client`). Null on the dev fallback, which has no token.
   */
  azp: string | null;
}

const claimsByRequest = new WeakMap<object, Promise<AuthClaims | null>>();

export function getAuthClaims(c: Context): Promise<AuthClaims | null> {
  const key: object = c.req;
  const known = claimsByRequest.get(key);
  if (known) return known;
  const pending = readAuthClaims(c);
  claimsByRequest.set(key, pending);
  return pending;
}

async function readAuthClaims(c: Context): Promise<AuthClaims | null> {
  const env = (c.env ?? {}) as RuntimeEnv;
  const keyBound = Boolean(env.CLERK_SECRET_KEY || env.CLERK_JWT_KEY);
  if (!keyBound && !devFallbacksAllowed(env)) {
    throw notConfigured('auth_not_configured', 'Sign-in is not configured on this deployment');
  }

  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) return null;

  if (!keyBound) return { sub: token, fva: null, verified: false, azp: null }; // DEV FALLBACK — opted in explicitly, never in production.

  // Production: the allow-list alone, never widened by what the token claims.
  const previewParty = environmentName(env) === 'production' ? undefined : claimedParty(token);
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: authorizedPartiesFor(env.ALLOWED_ORIGINS, previewParty),
    });
    if (typeof payload.sub !== 'string') return null;
    const azp = (payload as { azp?: unknown }).azp;
    return { sub: payload.sub, fva: factorAges((payload as { fva?: unknown }).fva), verified: true, azp: typeof azp === 'string' && azp.length > 0 ? azp : null };
  } catch {
    return null;
  }
}

/** `fva` as two finite numbers, or null for anything else. */
function factorAges(value: unknown): FactorVerificationAge | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [first, second] = value as unknown[];
  return typeof first === 'number' && Number.isFinite(first) && typeof second === 'number' && Number.isFinite(second) ? [first, second] : null;
}

/**
 * The site a token says minted it (`azp`), read before verification only to
 * build the allow-list; `verifyToken` still checks the signature and the claim.
 */
function claimedParty(token: string): string | undefined {
  try {
    const { azp } = decodeJwt(token).payload;
    return typeof azp === 'string' ? azp : undefined;
  } catch {
    return undefined;
  }
}
