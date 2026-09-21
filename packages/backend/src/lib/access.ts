import type { Space } from '@hangul-route/content-schema';
import type { Context } from 'hono';
import { fail } from '../envelope';
import { store, type Account } from '../store';
import { getAuthUserId } from './auth';
import type { Actor, SpaceContext } from './can';

/**
 * Account principal for console traffic (F-SPACE-001 §3.1). The bearer is a
 * Clerk session (dev fallback: the bearer string is the user id, F-AUTH-001);
 * the `accounts` row is upserted on first use. Children are never accounts.
 */
export async function requireAccount(c: Context, seed: { email?: string; displayName?: string } = {}): Promise<Response | Account> {
  const userId = await getAuthUserId(c);
  if (!userId) return fail(c, 'unauthorized', 'Sign in required', 401);
  const existing = store.accounts.get(userId);
  if (existing) {
    if (seed.email && !existing.email) existing.email = seed.email;
    if (seed.displayName && !existing.displayName) existing.displayName = seed.displayName;
    return existing;
  }
  const account: Account = {
    id: userId,
    email: seed.email ?? null,
    displayName: seed.displayName ?? null,
    consent: null,
    createdAt: new Date().toISOString(),
  };
  store.accounts.set(userId, account);
  return account;
}

export function accountActor(account: Account): Actor {
  return { kind: 'account', accountId: account.id, memberships: store.membershipsOf('account', account.id) };
}

export function spaceContext(space: Space): SpaceContext {
  return { space, parent: space.parentSpaceId ? (store.spaces.get(space.parentSpaceId) ?? null) : null };
}
