'use client';

import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sessionFromClerkUser } from '@/lib/console/clerk';
import { clerkPublishableKey } from '@/lib/console/config';
import { ROUTES } from '@/lib/console/routing';
import { clearSession, readSession, writeSession, type ConsoleSession } from '@/lib/console/session';

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
  /** Bearer for the next API call; null when signed out. */
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Dev mode only: store a dev session. No-op under Clerk. */
  devSignIn: (session: ConsoleSession) => void;
}

const SIGNED_OUT: ConsoleAuth = {
  mode: 'dev',
  ready: false,
  session: null,
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
  const { getToken } = useAuth();
  const clerk = useClerk();
  const value = useMemo<ConsoleAuth>(
    () => ({
      mode: 'clerk',
      ready: isLoaded,
      session: sessionFromClerkUser(user),
      getToken: () => getToken().catch(() => null),
      signOut: () => clerk.signOut({ redirectUrl: ROUTES.signIn }),
      devSignIn: () => undefined,
    }),
    [isLoaded, user, getToken, clerk],
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
      getToken: async () => session?.token ?? null,
      signOut: async () => {
        clearSession();
        setSession(null);
      },
      devSignIn,
    }),
    [ready, session, devSignIn],
  );
  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
}

export function ConsoleAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const publishableKey = clerkPublishableKey();
  if (publishableKey) {
    return (
      <ClerkProvider publishableKey={publishableKey} afterSignOutUrl={ROUTES.signIn}>
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <DevBridge>{children}</DevBridge>;
}
