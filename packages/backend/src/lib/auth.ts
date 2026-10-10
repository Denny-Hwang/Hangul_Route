import { verifyToken } from '@clerk/backend';
import type { Context } from 'hono';
import { devFallbacksAllowed, notConfigured, type RuntimeEnv } from './runtime';

/**
 * Resolve the authenticated adult (Clerk user id) from the request bearer.
 *
 * Production: verifies a Clerk session JWT with CLERK_SECRET_KEY / CLERK_JWT_KEY
 * (bound via `wrangler secret`). Without either key the request fails closed
 * with 503 `auth_not_configured` (audit SEC-2), unless the deployment opted in
 * to the dev fallback (ENVIRONMENT=development|test or ALLOW_DEV_AUTH=true,
 * see ./runtime) — then the bearer string is trusted as the user id so routes
 * stay testable locally.
 */
export async function getAuthUserId(c: Context): Promise<string | null> {
  const env = (c.env ?? {}) as RuntimeEnv;
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
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
