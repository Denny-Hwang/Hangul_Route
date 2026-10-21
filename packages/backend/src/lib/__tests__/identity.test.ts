import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from 'hono';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.3: the identity port reads an account's primary email and its verification
 * from Clerk's Backend API with the bound secret key; with only a JWT key it fails closed (null); on the dev fallback
 * the stored account email counts as verified. Clerk itself is faked here.
 */
const getUser = vi.fn();
vi.mock('@clerk/backend', async (importOriginal) => ({ ...(await importOriginal<object>()), createClerkClient: vi.fn(() => ({ users: { getUser } })) }));

const { clerkIdentityPort, identityPortFor, primaryEmailOf, setIdentityPortForTests } = await import('../identity');
const { createClerkClient } = await import('@clerk/backend');
const { testDb: db } = await import('../../__tests__/helpers/db');

const ctx = (env: Record<string, string>) => ({ env }) as unknown as Context;
const user = (emailAddress: string | null, status: string | null) => ({ primaryEmailAddress: emailAddress === null ? null : { emailAddress, verification: status === null ? null : { status } } });

beforeEach(async () => {
  getUser.mockReset();
  await db.reset();
});
afterEach(() => setIdentityPortForTests(null));

describe('primaryEmailOf', () => {
  it('reads the primary email and whether Clerk verified it', () => {
    expect(primaryEmailOf(user('dean@example.org', 'verified'))).toEqual({ email: 'dean@example.org', verified: true });
    for (const status of ['unverified', 'expired', 'failed', null]) expect(primaryEmailOf(user('dean@example.org', status))).toEqual({ email: 'dean@example.org', verified: false });
    expect(primaryEmailOf(user(null, null))).toBeNull();
    expect(primaryEmailOf(user('', 'verified'))).toBeNull();
  });
});

describe('clerkIdentityPort', () => {
  it("calls users.getUser with the account id under the bound secret key; Clerk's 404 is no email, other errors throw", async () => {
    const port = clerkIdentityPort('sk_test_x');
    expect(createClerkClient).toHaveBeenCalledWith({ secretKey: 'sk_test_x' });
    getUser.mockResolvedValueOnce(user('dean@example.org', 'verified'));
    expect(await port.primaryEmail('user_dean')).toEqual({ email: 'dean@example.org', verified: true });
    expect(getUser).toHaveBeenCalledWith('user_dean');
    getUser.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    expect(await port.primaryEmail('user_gone')).toBeNull();
    getUser.mockRejectedValueOnce(Object.assign(new Error('Bad Gateway'), { status: 502 }));
    await expect(port.primaryEmail('user_dean')).rejects.toThrow('Bad Gateway');
  });
});

describe('identityPortFor', () => {
  it('the secret key gives the Clerk port; a JWT key alone gives none (fail closed)', async () => {
    getUser.mockResolvedValueOnce(user('dean@example.org', 'unverified'));
    expect(await identityPortFor(ctx({ CLERK_SECRET_KEY: 'sk_test_y', CLERK_JWT_KEY: 'pem' }))?.primaryEmail('user_dean')).toEqual({ email: 'dean@example.org', verified: false });
    expect(identityPortFor(ctx({ CLERK_JWT_KEY: 'pem' }))).toBeNull();
  });

  it('the dev fallback (no Clerk key) takes the stored account email as verified', async () => {
    await db.putAccount({ id: 'dean', email: 'dean@example.org', displayName: null, consent: null, createdAt: '2026-10-20T00:00:00.000Z' });
    const port = identityPortFor(ctx({ ENVIRONMENT: 'test' }));
    expect(await port?.primaryEmail('dean')).toEqual({ email: 'dean@example.org', verified: true });
    expect(await port?.primaryEmail('nobody')).toBeNull();
  });

  it('a test port wins over every binding', async () => {
    const port = { primaryEmail: async () => null };
    setIdentityPortForTests(port);
    expect(identityPortFor(ctx({ CLERK_SECRET_KEY: 'sk_test_z' }))).toBe(port);
  });
});
