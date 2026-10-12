import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { liveRefusal } from '../live-guard';

function ctx(): Context {
  return {
    json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  } as unknown as Context;
}

describe('liveRefusal (F-BILL-002 B-5, section 4.9, OD-12)', () => {
  it('lets test mode and an unbound key through', () => {
    expect(liveRefusal(ctx(), { STRIPE_SECRET_KEY: 'sk_test_x' })).toBeNull();
    expect(liveRefusal(ctx(), { STRIPE_SECRET_KEY: 'rk_test_x' })).toBeNull();
    expect(liveRefusal(ctx(), {})).toBeNull();
  });

  it('answers 503 live_not_enabled for a live or unknown key unless BILLING_LIVE_ALLOWED is exactly "true"', async () => {
    for (const env of [{ STRIPE_SECRET_KEY: 'sk_live_x' }, { STRIPE_SECRET_KEY: 'rk_live_x' }, { STRIPE_SECRET_KEY: 'sk_test' }, { STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'TRUE' }]) {
      const res = liveRefusal(ctx(), env);
      expect(res?.status).toBe(503);
      expect(await res?.json()).toMatchObject({ ok: false, error: { code: 'live_not_enabled' }, meta: { version: expect.any(String) } });
    }
    expect(liveRefusal(ctx(), { STRIPE_SECRET_KEY: 'sk_live_x', BILLING_LIVE_ALLOWED: 'true' })).toBeNull();
  });
});
