import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it } from 'vitest';
import { devFallbacksAllowed, environmentName, healthReport, notConfigured, setDevFallbacksDefaultForTests } from '../runtime';

describe('devFallbacksAllowed (SEC-2: fail closed unless a deployment opts in)', () => {
  afterEach(() => setDevFallbacksDefaultForTests(true));

  it('is off when the env says nothing — ENVIRONMENT unset is production', () => {
    setDevFallbacksDefaultForTests(false);
    expect(devFallbacksAllowed(undefined)).toBe(false);
    expect(devFallbacksAllowed({})).toBe(false);
    expect(devFallbacksAllowed({ ENVIRONMENT: '' })).toBe(false);
    expect(devFallbacksAllowed({ ENVIRONMENT: 'staging' })).toBe(false);
    expect(devFallbacksAllowed({ ALLOW_DEV_AUTH: '1' })).toBe(false);
    expect(devFallbacksAllowed({ ALLOW_DEV_AUTH: 'TRUE ' })).toBe(false);
  });

  it('turns on for ENVIRONMENT=development|test or ALLOW_DEV_AUTH=true', () => {
    setDevFallbacksDefaultForTests(false);
    expect(devFallbacksAllowed({ ENVIRONMENT: 'development' })).toBe(true);
    expect(devFallbacksAllowed({ ENVIRONMENT: 'test' })).toBe(true);
    expect(devFallbacksAllowed({ ENVIRONMENT: ' Development ' })).toBe(true);
    expect(devFallbacksAllowed({ ALLOW_DEV_AUTH: 'true' })).toBe(true);
  });

  it('never turns on for ENVIRONMENT=production, whatever else is set', () => {
    setDevFallbacksDefaultForTests(true);
    expect(devFallbacksAllowed({ ENVIRONMENT: 'production' })).toBe(false);
    expect(devFallbacksAllowed({ ENVIRONMENT: 'production', ALLOW_DEV_AUTH: 'true' })).toBe(false);
  });

  it('falls back to the test default only when the env does not decide', () => {
    setDevFallbacksDefaultForTests(true);
    expect(devFallbacksAllowed(undefined)).toBe(true);
    expect(devFallbacksAllowed({ STRIPE_SECRET_KEY: 'sk_test' })).toBe(true);
  });
});

describe('environmentName', () => {
  it('names an unset environment production', () => {
    expect(environmentName(undefined)).toBe('production');
    expect(environmentName({ ENVIRONMENT: '  ' })).toBe('production');
    expect(environmentName({ ENVIRONMENT: 'Development' })).toBe('development');
  });
});

describe('notConfigured', () => {
  it('is a 503 HTTPException carrying the JSON error envelope', async () => {
    const err = notConfigured('db_not_configured', 'Storage is not configured on this deployment');
    expect(err).toBeInstanceOf(HTTPException);
    const res = err.getResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string }; meta: { serverTime: string } };
    expect(body.ok).toBe(false);
    expect(body.error).toEqual({ code: 'db_not_configured', message: 'Storage is not configured on this deployment' });
    expect(typeof body.meta.serverTime).toBe('string');
  });
});

describe('healthReport (booleans only)', () => {
  afterEach(() => setDevFallbacksDefaultForTests(true));

  it('is unhealthy in production when Clerk or D1 is missing', () => {
    setDevFallbacksDefaultForTests(false);
    expect(healthReport({})).toEqual({
      status: 'misconfigured',
      environment: 'production',
      devFallbacks: false,
      bindings: { db: false, clerk: false, stripe: false, stripeWebhook: false },
    });
    expect(healthReport({ DB: {} }).status).toBe('misconfigured');
    expect(healthReport({ CLERK_SECRET_KEY: 'sk_live_secret' }).status).toBe('misconfigured');
  });

  it('is ok once both required bindings are present, and never echoes a secret', () => {
    setDevFallbacksDefaultForTests(false);
    const report = healthReport({ DB: {}, CLERK_SECRET_KEY: 'sk_live_secret', STRIPE_SECRET_KEY: 'sk_stripe', STRIPE_WEBHOOK_SECRET: 'whsec_x' });
    expect(report).toEqual({
      status: 'ok',
      environment: 'production',
      devFallbacks: false,
      bindings: { db: true, clerk: true, stripe: true, stripeWebhook: true },
    });
    expect(JSON.stringify(report)).not.toMatch(/sk_live_secret|sk_stripe|whsec_x/);
    expect(healthReport({ DB: {}, CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----' }).bindings.clerk).toBe(true);
  });

  it('is ok without bindings when the deployment runs the dev fallbacks', () => {
    setDevFallbacksDefaultForTests(false);
    expect(healthReport({ ENVIRONMENT: 'development' })).toMatchObject({ status: 'ok', environment: 'development', devFallbacks: true });
  });

  it('ignores a DB binding that is not an object', () => {
    setDevFallbacksDefaultForTests(false);
    expect(healthReport({ DB: 'nope', CLERK_SECRET_KEY: 'sk' }).bindings.db).toBe(false);
  });
});
