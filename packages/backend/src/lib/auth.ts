import { verifyToken } from '@clerk/backend';
import type { Context } from 'hono';
import { fail } from '../envelope';
import { store } from '../store';

interface ClerkEnv {
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
}

/**
 * Resolve the authenticated parent (Clerk user id) from the request bearer.
 *
 * Production: verifies a Clerk session JWT with CLERK_SECRET_KEY / CLERK_JWT_KEY
 * (bound via `wrangler secret`). Dev/test (no keys bound): trusts the bearer
 * string as the user id so routes are testable — NEVER acceptable in prod.
 */
export async function getAuthUserId(c: Context): Promise<string | null> {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) return null;

  const env = (c.env ?? {}) as ClerkEnv;
  if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) {
    return token; // DEV FALLBACK — bind CLERK_SECRET_KEY in production.
  }

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

/**
 * Authorize the caller as the owner of `familyId`.
 * Returns the user id on success, or a ready-to-return error Response.
 */
export async function authorizeFamily(c: Context, familyId: string): Promise<Response | string> {
  const userId = await getAuthUserId(c);
  if (!userId) return fail(c, 'unauthorized', 'Authentication required', 401);
  const family = store.families.get(familyId);
  if (!family) return fail(c, 'not_found', 'Family not found', 404);
  if (family.ownerId !== userId) return fail(c, 'forbidden', 'Not your family', 403);
  return userId;
}

/**
 * Authorize the caller as the owner of the family that owns `profileId`.
 * Returns the user id on success, or a ready-to-return error Response.
 */
export async function authorizeProfile(c: Context, profileId: string): Promise<Response | string> {
  const profile = store.profiles.get(profileId);
  if (!profile) return fail(c, 'not_found', 'Profile not found', 404);
  return authorizeFamily(c, profile.familyId);
}
