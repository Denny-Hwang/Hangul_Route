// `@clerk/backend/internal` is a non-public subpath; the import is deliberate (the pinned
// version's re-export of @clerk/shared's helper, F-BILL-002 section 4.4). If it moves in a
// minor release, typecheck fails, and step-up.test.ts pins the exact body the hook parses.
import { reverificationError } from '@clerk/backend/internal';
import { STEP_UP_MAX_AGE_MIN } from '@hangul-route/content-schema';
import type { Context } from 'hono';
import { meta } from '../envelope';
import { getAuthClaims, type AuthClaims } from './auth';

/**
 * Step-up before money moves (F-BILL-002 section 4.4, OD-7). The billing page
 * shares an origin with the learner app on a family device, and a signed-in
 * grown-up session can outlive the grown-up at the keyboard, so checkout,
 * portal (and, from B-4, receipt links) need a first factor verified at most
 * `STEP_UP_MAX_AGE_MIN` minutes ago (the token's `fva[0]`).
 *
 * Fails closed: a token without `fva` (or with a negative or non-finite age)
 * asks again. If production tokens ever lack `fva`, money actions stay refused
 * until the owner switches the Clerk session token version (runbook Step 8);
 * no code change. The dev fallback (no Clerk key bound) has no token to read
 * and skips step-up; it never runs in production (SEC-2).
 */
export function stepUpVerdict(claims: AuthClaims): 'ok' | 'reverify' {
  if (!claims.verified) return 'ok';
  const firstFactor = claims.fva?.[0];
  if (typeof firstFactor !== 'number' || !Number.isFinite(firstFactor) || firstFactor < 0) return 'reverify';
  return firstFactor <= STEP_UP_MAX_AGE_MIN ? 'ok' : 'reverify';
}

/**
 * The 403 body: Clerk's reverification hint, so `useReverification` in
 * @clerk/clerk-react recognises it and runs the reverification flow, plus our
 * own envelope code `reverify_required` and `meta` (as every `fail` carries) for
 * every other reader.
 */
export function reverifyRequiredBody() {
  return {
    ...reverificationError({ level: 'first_factor', afterMinutes: STEP_UP_MAX_AGE_MIN }),
    ok: false as const,
    error: { code: 'reverify_required' as const, message: 'Confirm it is you to continue' },
    meta: meta(),
  };
}

/** Null when the request may go on, else the 403 hint response. Call after `requireAccount`. */
export async function requireStepUp(c: Context): Promise<Response | null> {
  const claims = await getAuthClaims(c);
  if (claims && stepUpVerdict(claims) === 'ok') return null;
  return c.json(reverifyRequiredBody(), 403);
}
