import { STEP_UP_MAX_AGE_MIN } from '@hangul-route/content-schema';
import type { Context } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { clerkTestKeys, type ClerkTestKeys } from '../../__tests__/helpers/clerk-token';
import { requireStepUp, reverifyRequiredBody, stepUpVerdict } from '../step-up';

/**
 * The predicate `useReverification` in @clerk/clerk-react 5.x runs on a fetcher's
 * parsed result (`isReverificationHint` in @clerk/shared/authorization-errors),
 * written out so the test pins the shape the page's hook reacts to.
 */
function isReverificationHint(result: unknown): boolean {
  if (!result || typeof result !== 'object' || !('clerk_error' in result)) return false;
  const err = (result as { clerk_error?: { type?: unknown; reason?: unknown } }).clerk_error;
  return err?.type === 'forbidden' && err.reason === 'reverification-error';
}

function ctx(authHeader: string | undefined, env: Record<string, unknown>): Context {
  return {
    req: { header: (k: string) => (k.toLowerCase() === 'authorization' ? authHeader : undefined) },
    env,
    json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  } as unknown as Context;
}

describe('step-up before money moves (F-BILL-002 B-5, section 4.4, OD-7)', () => {
  it('allows a first factor verified at most STEP_UP_MAX_AGE_MIN minutes ago', () => {
    expect(STEP_UP_MAX_AGE_MIN).toBe(10);
    for (const age of [0, 1, 9, 10]) expect(stepUpVerdict({ sub: 'u', fva: [age, -1], verified: true })).toBe('ok');
  });

  it('asks again when the first factor is older, whatever the second factor says', () => {
    for (const fva of [[11, -1], [11, 0], [600, 2]] as const) expect(stepUpVerdict({ sub: 'u', fva, verified: true })).toBe('reverify');
  });

  it('fails closed: no fva, or a negative or non-finite first-factor age, asks again', () => {
    expect(stepUpVerdict({ sub: 'u', fva: null, verified: true })).toBe('reverify');
    expect(stepUpVerdict({ sub: 'u', fva: [-1, -1], verified: true })).toBe('reverify');
    expect(stepUpVerdict({ sub: 'u', fva: [Number.POSITIVE_INFINITY, 0], verified: true })).toBe('reverify');
  });

  it('skips step-up on the dev fallback, where no token exists to read (never in production)', () => {
    expect(stepUpVerdict({ sub: 'u', fva: null, verified: false })).toBe('ok');
  });

  it('answers with the Clerk reverification hint the hook recognises, plus our own code', async () => {
    const { reverificationError } = await import('@clerk/backend/internal');
    const body = reverifyRequiredBody();
    expect(isReverificationHint(body)).toBe(true);
    expect(body).toEqual({
      ...reverificationError({ level: 'first_factor', afterMinutes: STEP_UP_MAX_AGE_MIN }),
      ok: false,
      error: { code: 'reverify_required', message: 'Confirm it is you to continue' },
      meta: { serverTime: expect.any(String), version: expect.any(String) },
    });
    expect(body.clerk_error).toEqual({ type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } });
  });

  describe('requireStepUp on a request', () => {
    let keys: ClerkTestKeys;
    beforeAll(async () => {
      keys = await clerkTestKeys();
    });
    const withToken = async (claims: Record<string, unknown>) => ctx(`Bearer ${await keys.token('user_s', claims)}`, { CLERK_JWT_KEY: keys.jwtKey });

    it('lets a fresh sign-in through', async () => {
      expect(await requireStepUp(await withToken({ fva: [2, -1] }))).toBeNull();
      expect(await requireStepUp(await withToken({ fva: [10, -1] }))).toBeNull();
    });

    it('answers 403 with the hint for an old or missing fva', async () => {
      for (const claims of [{ fva: [11, -1] }, {}]) {
        const res = await requireStepUp(await withToken(claims));
        expect(res?.status).toBe(403);
        const body: unknown = await res?.json();
        expect(isReverificationHint(body)).toBe(true);
        expect(body).toMatchObject({ ok: false, error: { code: 'reverify_required' } });
      }
    });

    it('lets the dev fallback through; an unverifiable bearer gets the 403 hint here (requireAccount has already answered 401 in the real routes)', async () => {
      expect(await requireStepUp(ctx('Bearer user_dev', { ENVIRONMENT: 'test' }))).toBeNull();
      const res = await requireStepUp(ctx('Bearer not-a-token', { CLERK_JWT_KEY: keys.jwtKey }));
      expect(res?.status).toBe(403);
    });
  });
});
