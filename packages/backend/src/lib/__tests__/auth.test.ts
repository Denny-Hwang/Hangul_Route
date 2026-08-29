import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { getAuthUserId } from '../auth';

function ctx(authHeader?: string): Context {
  return {
    req: { header: (k: string) => (k.toLowerCase() === 'authorization' ? authHeader : undefined) },
    env: {},
  } as unknown as Context;
}

describe('getAuthUserId (dev fallback, no Clerk keys bound)', () => {
  it('returns the bearer token as the user id', async () => {
    expect(await getAuthUserId(ctx('Bearer user_abc'))).toBe('user_abc');
  });

  it('returns null without a valid bearer', async () => {
    expect(await getAuthUserId(ctx(undefined))).toBeNull();
    expect(await getAuthUserId(ctx('Basic xyz'))).toBeNull();
    expect(await getAuthUserId(ctx('Bearer '))).toBeNull();
  });
});
