'use client';

import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sessionFromClerkUser } from '@/lib/console/clerk';
import { clerkPublishableKey } from '@/lib/console/config';
import { ROUTES } from '@/lib/console/routing';
import { readSession, writeSession, type ConsoleSession } from '@/lib/console/session';
import { clearSignInTab } from '@/lib/console/signin-record';
import { clearGrownUpTab } from '@/lib/console/unlock';

/**
 * One sign-in surface for the console — F-AUTH-002 §3.1. With a publishable key
 * on the build, Clerk owns the session and hands out short-lived tokens per
 * request; without one, the F-AUTH-001 dev session (bearer = account id) stays.
 * Pages only ever see `useConsoleAuth()`.
 */
export type AuthMode = 'clerk' | 'dev';

export interface ConsoleAuth {
  mode: AuthMode;
  /** false until the provider knows whether someone is signed in. */
  ready: boolean;
  session: Omit<ConsoleSession, 'token'> | null;
  /**
   * The signed-in session's id (Clerk's session id; the account id in dev mode): the router
   * matches a sign-in completed in this tab to it (F-APP-001 section 3.9). Null when signed out.
   */
  sessionId: string | null;
  /** Bearer for the next API call; null when signed out. */
  getToken: () => Promise<string | null>;
  /**
   * Signs out, removing the grown-up unlock, the console session, the sign-in record and the
   * adult-step tick from this tab first
   * (F-APP-001 section 3.9), then goes to `redirectUrl` (`/signin` by default; the lock's Sign in
   * again passes `/signin?next=…`).
   */
  signOut: (redirectUrl?: string) => Promise<void>;
  /** Dev mode only: store a dev session. No-op under Clerk. */
  devSignIn: (session: ConsoleSession) => void;
}

const SIGNED_OUT: ConsoleAuth = {
  mode: 'dev',
  ready: false,
  session: null,
  sessionId: null,
  getToken: async () => null,
  signOut: async () => undefined,
  devSignIn: () => undefined,
};

const ConsoleAuthContext = createContext<ConsoleAuth>(SIGNED_OUT);

export function useConsoleAuth(): ConsoleAuth {
  return useContext(ConsoleAuthContext);
}

function ClerkBridge({ children }: { children: ReactNode }): JSX.Element {
  const { isLoaded, user } = useUser();
  const { getToken, sessionId } = useAuth();
  const clerk = useClerk();
  const value = useMemo<ConsoleAuth>(
    () => ({
      mode: 'clerk',
      ready: isLoaded,
      session: sessionFromClerkUser(user),
      sessionId: user ? (sessionId ?? null) : null,
      getToken: () => getToken().catch(() => null),
      signOut: (redirectUrl = ROUTES.signIn) => {
        clearGrownUpTab();
        clearSignInTab();
        return clerk.signOut({ redirectUrl });
      },
      devSignIn: () => undefined,
    }),
    [isLoaded, user, sessionId, getToken, clerk],
  );
  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
}

function DevBridge({ children }: { children: ReactNode }): JSX.Element {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ConsoleSession | null>(null);
  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);
  const devSignIn = useCallback((next: ConsoleSession) => {
    writeSession(next);
    setSession(next);
  }, []);
  const value = useMemo<ConsoleAuth>(
    () => ({
      mode: 'dev',
      ready,
      session: session ? { accountId: session.accountId, displayName: session.displayName, ...(session.email ? { email: session.email } : {}) } : null,
      sessionId: session?.accountId ?? null,
      getToken: async () => session?.token ?? null,
      signOut: async (redirectUrl?: string) => {
        clearGrownUpTab();
        clearSignInTab();
        setSession(null);
        if (redirectUrl) window.location.assign(redirectUrl);
      },
      devSignIn,
    }),
    [ready, session, devSignIn],
  );
  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
}

/** Any sign-up link Clerk draws goes through the adult step (F-APP-001 section 3.7, OD-13). */
const CREATE_ACCOUNT_URL = `${ROUTES.signIn}?mode=create`;

export function ConsoleAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const publishableKey = clerkPublishableKey();
  if (publishableKey) {
    return (
      <ClerkProvider publishableKey={publishableKey} afterSignOutUrl={ROUTES.signIn} signInUrl={ROUTES.signIn} signUpUrl={CREATE_ACCOUNT_URL}>
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <DevBridge>{children}</DevBridge>;
}
