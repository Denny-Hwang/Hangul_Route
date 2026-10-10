import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAuthUserId } from '../auth';
import { setDevFallbacksDefaultForTests } from '../runtime';

function ctx(authHeader?: string, env: Record<string, unknown> = {}): Context {
  return {
    req: { header: (k: string) => (k.toLowerCase() === 'authorization' ? authHeader : undefined) },
    env,
  } as unknown as Context;
}

describe('getAuthUserId (dev fallback, opted in, no Clerk keys bound)', () => {
  it('returns the bearer token as the user id', async () => {
    expect(await getAuthUserId(ctx('Bearer user_abc', { ENVIRONMENT: 'development' }))).toBe('user_abc');
    expect(await getAuthUserId(ctx('Bearer user_abc', { ALLOW_DEV_AUTH: 'true' }))).toBe('user_abc');
  });

  it('returns null without a valid bearer', async () => {
    const env = { ENVIRONMENT: 'test' };
    expect(await getAuthUserId(ctx(undefined, env))).toBeNull();
    expect(await getAuthUserId(ctx('Basic xyz', env))).toBeNull();
    expect(await getAuthUserId(ctx('Bearer ', env))).toBeNull();
  });
});

describe('getAuthUserId fails closed (SEC-2)', () => {
  beforeEach(() => setDevFallbacksDefaultForTests(false));
  afterEach(() => setDevFallbacksDefaultForTests(true));

  async function rejection(c: Context): Promise<HTTPException> {
    const err = await getAuthUserId(c).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(HTTPException);
    return err as HTTPException;
  }

  it('throws 503 auth_not_configured when no Clerk key is bound and nothing opted in', async () => {
    const err = await rejection(ctx('Bearer user_abc'));
    expect(err.status).toBe(503);
    const body = (await err.getResponse().json()) as { error: { code: string } };
    expect(body.error.code).toBe('auth_not_configured');
  });

  it('throws even without a bearer, so a misconfigured deploy never reads as "signed out"', async () => {
    expect((await rejection(ctx(undefined))).status).toBe(503);
  });

  it('refuses the bearer-as-user-id fallback in production even with ALLOW_DEV_AUTH', async () => {
    expect((await rejection(ctx('Bearer user_abc', { ENVIRONMENT: 'production', ALLOW_DEV_AUTH: 'true' }))).status).toBe(503);
  });

  it('never trusts the raw bearer once a Clerk key is bound', async () => {
    expect(await getAuthUserId(ctx('Bearer user_abc', { CLERK_JWT_KEY: 'not-a-pem', ENVIRONMENT: 'development' }))).toBeNull();
  });
});
