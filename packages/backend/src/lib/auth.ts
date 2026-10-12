import { verifyToken } from '@clerk/backend';
import { decodeJwt } from '@clerk/backend/jwt';
import type { Context } from 'hono';
import { authorizedPartiesFor } from './cors';
import { devFallbacksAllowed, notConfigured, type RuntimeEnv } from './runtime';

type AuthEnv = RuntimeEnv & { ALLOWED_ORIGINS?: string };

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
 */
export async function getAuthUserId(c: Context): Promise<string | null> {
  const env = (c.env ?? {}) as AuthEnv;
  const keyBound = Boolean(env.CLERK_SECRET_KEY || env.CLERK_JWT_KEY);
  if (!keyBound && !devFallbacksAllowed(env)) {
    throw notConfigured('auth_not_configured', 'Sign-in is not configured on this deployment');
  }

  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) return null;

  if (!keyBound) return token; // DEV FALLBACK — opted in explicitly, never in production.

  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: authorizedPartiesFor(env.ALLOWED_ORIGINS, claimedParty(token)),
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
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
