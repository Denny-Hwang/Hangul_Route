'use client';

import { ClerkProvider, useAuth, useClerk, useReverification, useUser } from '@clerk/clerk-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { signInMerge, withAccountLocale, type UnsafeMetadata } from '@/lib/console/account-locale';
import { sessionFromClerkUser } from '@/lib/console/clerk';
import { clerkLocalization } from '@/lib/console/clerk-localization';
import { clerkPublishableKey } from '@/lib/console/config';
import { ROUTES } from '@/lib/console/routing';
import { readSession, writeSession, type ConsoleSession } from '@/lib/console/session';
import { browserOnline, clerkUiOpen, guardReverify, settleReverify, type ReverifyOutcome } from '@/lib/console/step-up';
import { clearSignInTab } from '@/lib/console/signin-record';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

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
  /**
   * F-BILL-002 B-8b: after the page's "Confirm it's you", runs `fetcher` through Clerk's `useReverification`
   * (Clerk's own verification, then one retry). `first` is the hint answer the page already has: Clerk's handler is
   * given it instead of sending the refused request a second time. Offline, or when Clerk's UI never opens, the
   * outcome is `unavailable` (section 4.12). Dev mode has no token to step up (the Worker skips step-up there,
   * section 4.4), so it simply runs `fetcher` once more.
   */
  reverify: <T>(fetcher: () => Promise<T>, first: T) => Promise<ReverifyOutcome<T>>;
}

const SIGNED_OUT: ConsoleAuth = {
  mode: 'dev',
  ready: false,
  session: null,
  sessionId: null,
  getToken: async () => null,
  signOut: async () => undefined,
  devSignIn: () => undefined,
  reverify: async () => ({ kind: 'unavailable' }),
};

const ConsoleAuthContext = createContext<ConsoleAuth>(SIGNED_OUT);

export function useConsoleAuth(): ConsoleAuth {
  return useContext(ConsoleAuthContext);
}

/** The Clerk user methods the language sync uses (`user.update` replaces `unsafeMetadata` whole). */
interface LocaleUser {
  id: string;
  unsafeMetadata?: UnsafeMetadata;
  update: (params: { unsafeMetadata: Record<string, unknown> }) => Promise<unknown>;
}

/**
 * One UI language per account (owner items 6 and 7), Clerk builds only (a dev-auth build keeps the
 * device record alone). Right after a sign-in, once the device record is read: the newer-wins merge
 * of the record and the account (`signInMerge`; a missing timestamp means the device wins). An
 * account that wins is written into the device record, which tells every open tab; a device that
 * wins is copied to the account. Then every language chosen in this tab while signed in goes to
 * the account. Every write merges into the existing `unsafeMetadata` (the adult step's
 * `adultAffirmedAt`). A failed write only loses the account copy; the device keeps the choice.
 */
export function AccountLocaleSync({ user, now = () => new Date().toISOString() }: { user: LocaleUser | null; now?: () => string }): null {
  const { ready, record, lastChoice, applyRecord } = useConsoleLocale();
  const merged = useRef<string | null>(null);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !ready || merged.current === user.id) return;
    merged.current = user.id;
    const result = signInMerge(record, user.unsafeMetadata, now());
    if (result.device) applyRecord(result.device);
    if (result.account) void user.update({ unsafeMetadata: withAccountLocale(user.unsafeMetadata, result.account) }).catch(() => undefined);
  }, [user, ready, record, applyRecord, now]);
  useEffect(() => {
    if (!user || !lastChoice || merged.current !== user.id) return;
    const key = `${lastChoice.uiLocale}|${lastChoice.uiLocaleAt}`;
    if (sent.current === key) return;
    sent.current = key;
    void user.update({ unsafeMetadata: withAccountLocale(user.unsafeMetadata, lastChoice) }).catch(() => undefined);
  }, [user, lastChoice]);
  return null;
}

function ClerkBridge({ children }: { children: ReactNode }): JSX.Element {
  const { isLoaded, user } = useUser();
  const { getToken, sessionId } = useAuth();
  const clerk = useClerk();
  // One enhanced fetcher for the whole tab; each step-up passes it the call to make (Clerk hands its arguments to
  // both the first call and the retry), so an attempt that never settled cannot retry a later request.
  const enhanced = useReverification((call: () => Promise<unknown>) => call());
  const reverify = useCallback(<T,>(fetcher: () => Promise<T>, first: T): Promise<ReverifyOutcome<T>> => {
    // Clerk's first call answers with the hint already in hand; only the retry reaches the Worker.
    let replay = true;
    const call = (): Promise<T> => {
      if (!replay) return fetcher();
      replay = false;
      return Promise.resolve(first);
    };
    return guardReverify(() => settleReverify(() => enhanced(call) as Promise<T>), { online: browserOnline, uiOpen: clerkUiOpen });
  }, [enhanced]);
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
      reverify,
    }),
    [isLoaded, user, sessionId, getToken, clerk, reverify],
  );
  return (
    <ConsoleAuthContext.Provider value={value}>
      <AccountLocaleSync user={isLoaded && user ? (user as unknown as LocaleUser) : null} />
      {children}
    </ConsoleAuthContext.Provider>
  );
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
      reverify: (fetcher) => settleReverify(fetcher),
    }),
    [ready, session, devSignIn],
  );
  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
}

/** Any sign-up link Clerk draws goes through the adult step (F-APP-001 section 3.7, OD-13). */
const CREATE_ACCOUNT_URL = `${ROUTES.signIn}?mode=create`;

export function ConsoleAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const publishableKey = clerkPublishableKey();
  // The Clerk widget speaks the console's language (owner items 6 and 7); a change re-localizes it in place.
  const { locale } = useConsoleLocale();
  const localization = useMemo(() => clerkLocalization(locale), [locale]);
  if (publishableKey) {
    return (
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl={ROUTES.signIn}
        signInUrl={ROUTES.signIn}
        signUpUrl={CREATE_ACCOUNT_URL}
        localization={localization}
      >
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <DevBridge>{children}</DevBridge>;
}
