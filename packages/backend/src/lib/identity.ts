import { createClerkClient } from '@clerk/backend';
import type { Context } from 'hono';
import { dbFor } from '../db';
import type { RuntimeEnv } from './runtime';

/**
 * [SA] Who an account is, as Clerk knows it (AMENDMENTS-SEATS-ADMINS section 6.3). An administrator invite is a bearer
 * link, so accepting one needs a verified sign-in email, and the school's owner sees that email next to each admin.
 * The email is read at request time and never stored by these routes, never sent to an admin caller, never in a
 * preview and never in telemetry. `accounts.email` is not used: it is client-supplied at space creation.
 */
export interface PrimaryEmail {
  email: string;
  verified: boolean;
}

export interface IdentityPort {
  /** The account's primary email and whether Clerk verified it; null when the account has none (or Clerk has no such user). */
  primaryEmail(accountId: string): Promise<PrimaryEmail | null>;
}

/** The slice of a Clerk `User` this module reads. */
export interface ClerkUserLike {
  primaryEmailAddress: { emailAddress: string; verification: { status: string } | null } | null;
}

/** A Clerk user's primary email and whether its verification status is `verified`. */
export function primaryEmailOf(user: ClerkUserLike): PrimaryEmail | null {
  const primary = user.primaryEmailAddress;
  if (!primary || !primary.emailAddress) return null;
  return { email: primary.emailAddress, verified: primary.verification?.status === 'verified' };
}

/** Clerk's 404 for an unknown user id, as `@clerk/backend` throws it. */
function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404;
}

/** The port over Clerk's Backend API with the bound `CLERK_SECRET_KEY` (`users.getUser`). */
export function clerkIdentityPort(secretKey: string): IdentityPort {
  const clerk = createClerkClient({ secretKey });
  return {
    async primaryEmail(accountId) {
      try {
        return primaryEmailOf(await clerk.users.getUser(accountId));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };
}

let override: IdentityPort | null = null;

/** Tests only: answer every request with this port (null restores the real choice). */
export function setIdentityPortForTests(port: IdentityPort | null): void {
  override = port;
}

/**
 * The port for this request, or null when the deployment cannot verify identities: with only `CLERK_JWT_KEY` bound
 * (tokens verify offline, but the Backend API needs the secret key) it fails closed. With no Clerk key at all the
 * request only got this far on the dev fallback (never production, SEC-2), where the stored account email counts as
 * verified so local runs work.
 */
export function identityPortFor(c: Context): IdentityPort | null {
  if (override) return override;
  const env = (c.env ?? {}) as RuntimeEnv;
  if (env.CLERK_SECRET_KEY) return clerkIdentityPort(env.CLERK_SECRET_KEY);
  if (env.CLERK_JWT_KEY) return null;
  const db = dbFor(c);
  return {
    async primaryEmail(accountId) {
      const email = (await db.getAccount(accountId))?.email ?? null;
      return email ? { email, verified: true } : null;
    },
  };
}
