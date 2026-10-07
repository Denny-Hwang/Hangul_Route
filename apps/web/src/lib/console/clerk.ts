import type { ConsoleSession } from './session';

/**
 * Clerk → console session mapping — F-AUTH-002 §3.2. Pure, so the shape the
 * pages rely on (accountId · displayName · email) is tested without the SDK.
 */
export interface ClerkUserLike {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
}

export type ClerkSession = Omit<ConsoleSession, 'token'>;

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** A name to greet the adult with: full name, then first + last, username, the email's local part, else "Grown-up". */
export function displayNameFrom(user: ClerkUserLike): string {
  const full = clean(user.fullName) || [clean(user.firstName), clean(user.lastName)].filter(Boolean).join(' ');
  if (full) return full;
  const username = clean(user.username);
  if (username) return username;
  const email = clean(user.primaryEmailAddress?.emailAddress);
  const local = email.split('@')[0] ?? '';
  return local || 'Grown-up';
}

export function sessionFromClerkUser(user: ClerkUserLike | null | undefined): ClerkSession | null {
  if (!user || !user.id) return null;
  const email = clean(user.primaryEmailAddress?.emailAddress);
  return { accountId: user.id, displayName: displayNameFrom(user), ...(email ? { email } : {}) };
}
