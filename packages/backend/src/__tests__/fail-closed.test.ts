import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1Db } from '../db';
import app from '../index';
import { setDevFallbacksDefaultForTests } from '../lib/runtime';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/**
 * Audit SEC-2 — production (ENVIRONMENT unset) must fail closed: without a
 * Clerk key or a D1 binding the API answers 503 instead of trusting the
 * bearer string or answering from an isolate's memory.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const LEARNER_ID = 'profile:failclosed-1';
const registerBody = JSON.stringify({ deviceId: 'device-failclosed', learner: { id: LEARNER_ID, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } });

async function call(path: string, init: RequestInit, env: Record<string, unknown>) {
  const res = await app.request(path, init, env);
  return { status: res.status, headers: res.headers, body: (await res.json()) as Envelope };
}

beforeEach(async () => {
  await db.reset();
  setDevFallbacksDefaultForTests(false); // the Worker's default: nothing opted in
});
afterEach(() => setDevFallbacksDefaultForTests(true));

describe('fail closed when nothing opted in (SEC-2)', () => {
  it('answers 503 auth_not_configured instead of trusting the bearer as an account id', async () => {
    const r = await call('/api/entitlements', { headers: bearer('mom') }, {});
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, error: { code: 'auth_not_configured' } });
  });

  it('answers 503 db_not_configured for learner traffic when D1 is not bound', async () => {
    const r = await call('/api/sync/learners', { method: 'POST', headers: json, body: registerBody }, { CLERK_SECRET_KEY: 'sk_test_x' });
    expect(r.status).toBe(503);
    expect(r.body.error?.code).toBe('db_not_configured');
    expect(await db.getLearner(LEARNER_ID)).toBeNull(); // nothing landed in the in-memory fallback
  });

  it('keeps the CORS headers on the 503 so the browser can read the error', async () => {
    const r = await call('/api/entitlements', { headers: { ...bearer('mom'), origin: 'https://hangulroute.com' } }, {});
    expect(r.status).toBe(503);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');
  });

  it('refuses ENVIRONMENT=production even with ALLOW_DEV_AUTH=true', async () => {
    const r = await call('/api/entitlements', { headers: bearer('mom') }, { ENVIRONMENT: 'production', ALLOW_DEV_AUTH: 'true' });
    expect(r.status).toBe(503);
  });

  it('does not block routes that need neither binding', async () => {
    const r = await call('/api/telemetry', { method: 'POST', headers: json, body: JSON.stringify({ name: 'session.start' }) }, {});
    expect(r.status).toBe(201);
  });
});

describe('the production config (ENVIRONMENT unset, Clerk key + D1 bound) still serves', () => {
  it('lands learner traffic in D1, rejects a forged bearer with 401 (not 503, not 200), and reports healthy', async () => {
    const d1 = openSqliteD1();
    const env = { DB: d1, CLERK_SECRET_KEY: 'sk_test_x' };
    try {
      const reg = await call('/api/sync/learners', { method: 'POST', headers: json, body: registerBody }, env);
      expect(reg.status).toBe(201);
      expect(await new D1Db(d1).getLearner(LEARNER_ID)).not.toBeNull(); // the binding, not the fallback
      expect(await db.getLearner(LEARNER_ID)).toBeNull();

      const forged = await call('/api/entitlements', { headers: { ...bearer('user_abc'), origin: 'https://hangulroute.com' } }, env);
      expect(forged.status).toBe(401);
      expect(forged.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');

      const health = await app.request('/health', {}, env);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ status: 'ok', environment: 'production', devFallbacks: false });
    } finally {
      d1.close();
    }
  });
});

describe('dev fallbacks run only when a deployment opts in', () => {
  it.each([[{ ENVIRONMENT: 'development' }], [{ ENVIRONMENT: 'test' }], [{ ALLOW_DEV_AUTH: 'true' }]])('opted in with %o', async (env) => {
    const list = await call('/api/entitlements', { headers: bearer('mom') }, env);
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual({ entitlements: [] });
    const reg = await call('/api/sync/learners', { method: 'POST', headers: json, body: registerBody }, env);
    expect(reg.status).toBe(201);
  });

  it('a named non-dev deployment (staging) stays closed', async () => {
    expect((await call('/api/entitlements', { headers: bearer('mom') }, { ENVIRONMENT: 'staging' })).status).toBe(503);
  });
});

describe('GET /health reports bindings as booleans', () => {
  it('is 503 misconfigured in production without Clerk and D1', async () => {
    const res = await app.request('/health', {}, {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: 'misconfigured',
      environment: 'production',
      devFallbacks: false,
      bindings: { db: false, clerk: false, stripe: false, stripeWebhook: false, rescuePepper: false },
    });
  });

  it('is 200 ok with both bound and never leaks a secret value', async () => {
    const res = await app.request('/health', {}, { DB: {}, CLERK_SECRET_KEY: 'sk_live_do_not_echo', STRIPE_SECRET_KEY: 'sk_stripe_do_not_echo', RESCUE_PEPPER: 'pepper_do_not_echo' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('do_not_echo');
    expect(JSON.parse(text)).toEqual({
      status: 'ok',
      environment: 'production',
      devFallbacks: false,
      bindings: { db: true, clerk: true, stripe: true, stripeWebhook: false, rescuePepper: true },
    });
  });
});
