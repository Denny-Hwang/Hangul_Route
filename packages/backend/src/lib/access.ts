import type { Space } from '@hangul-route/content-schema';
import type { Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail } from '../envelope';
import type { Account } from '../store';
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
  const db = dbFor(c);
  const existing = await db.getAccount(userId);
  if (existing) {
    let changed = false;
    if (seed.email && !existing.email) {
      existing.email = seed.email;
      changed = true;
    }
    if (seed.displayName && !existing.displayName) {
      existing.displayName = seed.displayName;
      changed = true;
    }
    if (changed) await saveAccount(db, existing);
    return existing;
  }
  const account: Account = {
    id: userId,
    email: seed.email ?? null,
    displayName: seed.displayName ?? null,
    consent: null,
    createdAt: new Date().toISOString(),
  };
  await saveAccount(db, account);
  return account;
}

/**
 * Upsert an account, giving up the email when another account already holds it
 * (`accounts.email` is UNIQUE). Happens when one person gets a new Clerk user id
 * for the same address — a re-created Clerk account, or the dev → production
 * instance switch. Signing in must not fail over a contact field.
 */
export async function saveAccount(db: Db, account: Account): Promise<void> {
  try {
    await db.putAccount(account);
  } catch (err) {
    if (!account.email) throw err;
    account.email = null;
    await db.putAccount(account);
  }
}

export async function accountActor(db: Db, account: Account): Promise<Actor> {
  return { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
}

export async function spaceContext(db: Db, space: Space): Promise<SpaceContext> {
  return { space, parent: space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null };
}

/** Every space a learner belongs to, with parents, for `can()` on learner targets. */
export async function learnerContexts(db: Db, learnerId: string): Promise<SpaceContext[]> {
  const contexts: SpaceContext[] = [];
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (space) contexts.push(await spaceContext(db, space));
  }
  return contexts;
}
