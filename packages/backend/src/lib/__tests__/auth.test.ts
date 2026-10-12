import { signJwt } from '@clerk/backend/jwt';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../index';
import { getAuthClaims, getAuthUserId } from '../auth';
import { clerkTestKeys, type ClerkTestKeys } from '../../__tests__/helpers/clerk-token';
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

/**
 * F-APP-001 A-9: a Clerk session token names the site that minted it in its
 * `azp` claim. The API accepts it only when that site is on the CORS
 * allow-list (`ALLOWED_ORIGINS` when set, else the defaults), so a token
 * minted on another subdomain of the same Clerk instance is refused. The
 * local dev server and workers.dev leniency of the defaults applies to tokens
 * only on a named non-production deployment. Real RS256 tokens, verified
 * offline against CLERK_JWT_KEY.
 */
describe('getAuthUserId accepts a Clerk token only from an allowed site (F-APP-001 A-9)', () => {
  const KID = 'ins_a9_test_key';
  let jwtKey = '';
  let privateJwk: JsonWebKey = { kty: 'RSA' };
  /** A second, unrelated key pair: its tokens are well formed but not signed by CLERK_JWT_KEY. */
  let otherPrivateJwk: JsonWebKey = { kty: 'RSA' };

  async function rsaPair(): Promise<CryptoKeyPair> {
    return (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
  }

  beforeAll(async () => {
    const pair = await rsaPair();
    const spki = Buffer.from((await crypto.subtle.exportKey('spki', pair.publicKey)) as ArrayBuffer).toString('base64');
    jwtKey = `-----BEGIN PUBLIC KEY-----\n${(spki.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PUBLIC KEY-----`;
    privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
    otherPrivateJwk = (await crypto.subtle.exportKey('jwk', (await rsaPair()).privateKey)) as JsonWebKey;
  });

  /** A session token for user_a9, valid for ten minutes; `azp` only when given. */
  async function sessionToken(azp?: string, claims: Record<string, unknown> = {}, key: JsonWebKey = privateJwk): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = { sub: 'user_a9', sid: 'sess_a9', nbf: now - 5, exp: now + 600, ...claims };
    if (azp !== undefined) payload.azp = azp;
    return signJwt(payload, key, { algorithm: 'RS256', header: { typ: 'JWT', kid: KID } });
  }

  /** The Worker's env: ALLOWED_ORIGINS and ENVIRONMENT only when given (unset ENVIRONMENT = production). */
  async function userFor(azp: string | undefined, vars: { ALLOWED_ORIGINS?: string; ENVIRONMENT?: string } = {}): Promise<string | null> {
    return getAuthUserId(ctx(`Bearer ${await sessionToken(azp)}`, { CLERK_JWT_KEY: jwtKey, ...vars }));
  }

  const PREVIEWS = ['http://localhost:3000', 'http://127.0.0.1:4173', 'https://pr-12.hangul-route-web.denny.workers.dev'];

  describe('ALLOWED_ORIGINS unset, production (ENVIRONMENT unset or "production"): exactly the CORS defaults', () => {
    it.each(['https://app.hangulroute.com', 'https://hangulroute.com', 'https://www.hangulroute.com'])('accepts a token minted on %s', async (azp) => {
      expect(await userFor(azp)).toBe('user_a9');
      expect(await userFor(azp, { ENVIRONMENT: 'production' })).toBe('user_a9');
    });

    it.each(PREVIEWS)('refuses a local dev server or workers.dev preview, which a Clerk Production instance never serves: %s', async (azp) => {
      expect(await userFor(azp)).toBeNull();
      expect(await userFor(azp, { ENVIRONMENT: 'production' })).toBeNull();
    });

    it.each(['https://staging.hangulroute.com', 'https://evil.example', 'https://app.hangulroute.com.evil.example', 'http://app.hangulroute.com'])(
      'refuses a token minted on an unlisted site: %s',
      async (azp) => {
        expect(await userFor(azp)).toBeNull();
      },
    );
  });

  describe('ALLOWED_ORIGINS unset, a named non-production deployment: the defaults plus the previews CORS lets in', () => {
    it.each(['development', 'test', 'staging'])('keeps previews working where CORS lets them call (ENVIRONMENT=%s)', async (environment) => {
      for (const azp of PREVIEWS) expect(await userFor(azp, { ENVIRONMENT: environment })).toBe('user_a9');
      expect(await userFor('https://app.hangulroute.com', { ENVIRONMENT: environment })).toBe('user_a9');
    });

    it.each(['https://staging.hangulroute.com', 'https://evil.example', 'http://app.hangulroute.com'])(
      'still refuses a site CORS refuses: %s',
      async (azp) => {
        expect(await userFor(azp, { ENVIRONMENT: 'development' })).toBeNull();
      },
    );
  });

  describe('ALLOWED_ORIGINS set: exactly that list', () => {
    const list = 'https://hangulroute.com, https://app.hangulroute.com/';

    it.each(['https://hangulroute.com', 'https://app.hangulroute.com'])('accepts a token minted on %s', async (azp) => {
      expect(await userFor(azp, { ALLOWED_ORIGINS: list })).toBe('user_a9');
    });

    it.each(['https://www.hangulroute.com', 'http://localhost:3000', 'https://x.workers.dev', 'https://evil.example'])(
      'refuses a token minted on a site the list leaves out: %s',
      async (azp) => {
        expect(await userFor(azp, { ALLOWED_ORIGINS: list })).toBeNull();
        expect(await userFor(azp, { ALLOWED_ORIGINS: list, ENVIRONMENT: 'development' })).toBeNull();
      },
    );
  });

  it('accepts a token that names no site, as Clerk does (a token from no browser has no azp)', async () => {
    expect(await userFor(undefined)).toBe('user_a9');
    expect(await userFor(undefined, { ALLOWED_ORIGINS: 'https://app.hangulroute.com' })).toBe('user_a9');
  });

  it('refuses a token whose azp is not a string, even when it wraps an allowed site', async () => {
    for (const azp of [['https://hangulroute.com'], 42, { origin: 'https://app.hangulroute.com' }]) {
      const token = await sessionToken(undefined, { azp });
      expect(await getAuthUserId(ctx(`Bearer ${token}`, { CLERK_JWT_KEY: jwtKey }))).toBeNull();
      expect(await getAuthUserId(ctx(`Bearer ${token}`, { CLERK_JWT_KEY: jwtKey, ENVIRONMENT: 'development' }))).toBeNull();
    }
  });

  it('an allowed site does not excuse a bad token: expired, or signed with another key', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await sessionToken('https://app.hangulroute.com', { nbf: now - 3600, exp: now - 600 });
    expect(await getAuthUserId(ctx(`Bearer ${expired}`, { CLERK_JWT_KEY: jwtKey }))).toBeNull();

    const otherKey = await sessionToken('https://app.hangulroute.com', {}, otherPrivateJwk);
    expect(await getAuthUserId(ctx(`Bearer ${otherKey}`, { CLERK_JWT_KEY: jwtKey }))).toBeNull();
  });

  it('an allowed site does not excuse a tampered signature', async () => {
    const good = await sessionToken('https://app.hangulroute.com');
    const [head, body] = good.split('.');
    const tampered = `${head}.${body}.${Buffer.from('not-the-signature').toString('base64url')}`;
    expect(await getAuthUserId(ctx(`Bearer ${tampered}`, { CLERK_JWT_KEY: jwtKey }))).toBeNull();
  });

  it('a bearer that is not a JWT is refused, not thrown', async () => {
    expect(await getAuthUserId(ctx('Bearer not.a-jwt', { CLERK_JWT_KEY: jwtKey }))).toBeNull();
    expect(await getAuthUserId(ctx('Bearer plain', { CLERK_JWT_KEY: jwtKey }))).toBeNull();
  });

  it('end to end: the Worker reads ALLOWED_ORIGINS from its env and answers 401 for an unlisted site', async () => {
    const env = { CLERK_JWT_KEY: jwtKey, ALLOWED_ORIGINS: 'https://app.hangulroute.com' };
    const call = async (azp: string) =>
      app.request('/api/entitlements', { headers: { authorization: `Bearer ${await sessionToken(azp)}`, origin: 'https://app.hangulroute.com' } }, env);

    const listed = await call('https://app.hangulroute.com');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ ok: true, data: { entitlements: [] } });

    const unlisted = await call('https://hangulroute.com');
    expect(unlisted.status).toBe(401);
    expect(unlisted.headers.get('access-control-allow-origin')).toBe('https://app.hangulroute.com');
  });
});

/**
 * F-BILL-002 B-5: the verified claims carry `fva` (factor verification age in
 * minutes, `[firstFactor, secondFactor]`) next to `sub`, so money routes can
 * ask for a fresh sign-in. `getAuthUserId` stays exactly as before.
 */
describe('getAuthClaims exposes fva next to sub (F-BILL-002 B-5)', () => {
  let keys: ClerkTestKeys;
  beforeAll(async () => {
    keys = await clerkTestKeys();
  });
  const claimsFor = async (claims: Record<string, unknown>) => getAuthClaims(ctx(`Bearer ${await keys.token('user_fva', claims)}`, { CLERK_JWT_KEY: keys.jwtKey }));

  it('returns the verified sub and fva', async () => {
    expect(await claimsFor({ fva: [3, -1] })).toEqual({ sub: 'user_fva', fva: [3, -1], verified: true });
    expect(await claimsFor({ fva: [0, 0] })).toEqual({ sub: 'user_fva', fva: [0, 0], verified: true });
  });

  it('reads fva as null when the token has none or it is malformed', async () => {
    expect(await claimsFor({})).toEqual({ sub: 'user_fva', fva: null, verified: true });
    for (const fva of ['3,-1', [3], [3, -1, 2], ['3', '-1'], [Number.NaN, 0], null, { 0: 3, 1: -1 }]) {
      expect((await claimsFor({ fva }))?.fva).toBeNull();
    }
  });

  it('keeps getAuthUserId unchanged for every existing caller', async () => {
    const token = await keys.token('user_fva', { fva: [1, -1] });
    expect(await getAuthUserId(ctx(`Bearer ${token}`, { CLERK_JWT_KEY: keys.jwtKey }))).toBe('user_fva');
    expect(await getAuthUserId(ctx('Bearer user_abc', { ENVIRONMENT: 'development' }))).toBe('user_abc');
  });

  it('marks the dev fallback as unverified, with no fva (no token to read)', async () => {
    expect(await getAuthClaims(ctx('Bearer user_abc', { ENVIRONMENT: 'development' }))).toEqual({ sub: 'user_abc', fva: null, verified: false });
  });

  it('returns null for no bearer or a token that does not verify', async () => {
    expect(await getAuthClaims(ctx(undefined, { CLERK_JWT_KEY: keys.jwtKey }))).toBeNull();
    expect(await getAuthClaims(ctx('Bearer plain', { CLERK_JWT_KEY: keys.jwtKey }))).toBeNull();
    const otherKeys = await clerkTestKeys();
    expect(await getAuthClaims(ctx(`Bearer ${await otherKeys.token('user_fva', { fva: [1, -1] })}`, { CLERK_JWT_KEY: keys.jwtKey }))).toBeNull();
  });

  it('verifies a request once, however many times its claims are read', async () => {
    const c = ctx(`Bearer ${await keys.token('user_fva', { fva: [2, -1] })}`, { CLERK_JWT_KEY: keys.jwtKey });
    const first = getAuthClaims(c);
    expect(getAuthClaims(c)).toBe(first);
    expect(await getAuthUserId(c)).toBe('user_fva');
  });
});
