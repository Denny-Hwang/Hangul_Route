'use client';

import { ClerkProvider, useAuth, useClerk, useReverification, useUser } from '@clerk/clerk-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountLocaleOf, signInMerge, withAccountLocale, type UnsafeMetadata } from '@/lib/console/account-locale';
import { sessionFromClerkUser } from '@/lib/console/clerk';
import { clerkLocalization } from '@/lib/console/clerk-localization';
import { clerkPublishableKey } from '@/lib/console/config';
import { signInHome } from '@/lib/console/grown-up-lock';
import { passkeySnapshot, passkeyUsedDuring, secretReverifyAllowed, type PasskeyLike } from '@/lib/console/one-account';
import { deleteDeviceUses } from '@/lib/console/shell-store';
import { reverifyOnce, withTimeout } from '@/lib/console/signin-flow';
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
   * (F-APP-001 section 3.9), then goes to `redirectUrl` (under Clerk `/signin?lang=<the console's language>` by
   * default, AMENDMENTS-DISPLAY-NAV section 6; the lock's Sign in again passes `/signin?next=…&lang=…`). [SA] A waiting
   * administrator invite goes too, except with `keepInvite` (the invite page's Use another account and the lock's Sign in
   * again, AMENDMENTS-SEATS-ADMINS section 6.6 step 1).
   */
  signOut: (redirectUrl?: string, options?: { keepInvite?: boolean }) => Promise<void>;
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
  /**
   * The signed-in Clerk user whose account carries the UI language (owner items 6 and 7); null
   * signed out and in a dev-auth build (the device record alone). `AccountLocaleSlot` reads it
   * inside the grown-up lock.
   */
  localeUser: LocaleUser | null;
  /**
   * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.4: the lock's Use a passkey, Clerk's session verification with
   * the passkey first factor (the platform prompt, nothing else). True when it completed; false on a refusal, a
   * cancel, no session, or outside Clerk.
   */
  verifyPasskey: () => Promise<boolean>;
  /**
   * [OA] Section 7.2 moment 3: Clerk reverification that must be a password, an email code or a phone code. Clerk does
   * not name the factor its dialog used, so the dialog opens only for an account that holds no passkey
   * (`secretReverifyAllowed`): an account with a passkey, or one not loaded, is `refused` before any dialog. A passkey
   * that shows up during the dialog (its `lastUsedAt` moved, or a new one; server stamps only) refuses it too. Dev mode
   * (no Clerk, never on a production build with Clerk) counts the dev bearer as a password, as the dev sign-in does.
   */
  reverifySecret: () => Promise<SecretReverify>;
  /** [OA] Whether `reverifySecret` can complete for this account (no passkey on it); the PIN-owner card shows only then. */
  secretReverifyReady: boolean;
}

/** [OA] How a moment-3 reverification ended. */
export type SecretReverify = 'done' | 'cancelled' | 'unavailable' | 'refused';

/** [OA] How long Sign out waits for the `deviceUses` delete before it leaves anyway (WebKit can hang an IndexedDB open). */
export const SIGN_OUT_DELETE_MS = 1_000;

/** [OA] Section 7.1: Sign out deletes the account's grown-up uses from this browser. Never throws, never blocks long. */
export function forgetDeviceUses(): Promise<boolean> {
  return withTimeout(() => deleteDeviceUses(), false, SIGN_OUT_DELETE_MS);
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
  localeUser: null,
  verifyPasskey: async () => false,
  reverifySecret: async () => 'unavailable',
  secretReverifyReady: false,
};

const ConsoleAuthContext = createContext<ConsoleAuth>(SIGNED_OUT);

export function useConsoleAuth(): ConsoleAuth {
  return useContext(ConsoleAuthContext);
}

/** The Clerk user methods the language sync uses (`user.update` replaces `unsafeMetadata` whole). */
export interface LocaleUser {
  id: string;
  /** [OA] The account's passkeys (`id` and `lastUsedAt` only are read), for the moment-3 passkey check. */
  passkeys?: readonly PasskeyLike[];
  /** [OA] Reads the account again (Clerk's `user.reload`). */
  reload?: () => Promise<{ passkeys?: readonly PasskeyLike[] }>;
  unsafeMetadata?: UnsafeMetadata;
  update: (params: { unsafeMetadata: Record<string, unknown> }) => Promise<unknown>;
}

/**
 * One UI language per account (owner items 6 and 7; AMENDMENTS-DISPLAY-NAV section 5), Clerk
 * builds only (a dev-auth build keeps the device record alone). Mounted inside the grown-up lock
 * (`AccountLocaleSlot`), so nothing reaches the account until a grown-up has opened the page: a
 * language changed at the lock screen or in the learner app is copied to the account only once
 * the lock is passed. Once the device record read has settled (never on the paint timeout, which
 * would merge against a record still being read): the newer-wins merge of the record and the
 * account (`signInMerge`; a missing time counts as 1970, so a migrated or seeded language never
 * beats an account choice). An account that wins is written into the device record, merged again
 * against the record as stored when the write runs, which tells every open tab; a device that
 * wins is copied to the account with its own time. Then every language chosen in this tab goes to
 * the account. Every write merges into the existing `unsafeMetadata` (the adult step's
 * `adultAffirmedAt`). A failed write only loses the account copy; the device keeps the choice.
 */
export function AccountLocaleSync({ user }: { user: LocaleUser | null }): null {
  const { recordSettled, record, lastChoice, applyAccount } = useConsoleLocale();
  const merged = useRef<string | null>(null);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !recordSettled || merged.current === user.id) return;
    merged.current = user.id;
    // A choice already in the record is the merge's to send, not the choice effect's.
    if (lastChoice) sent.current = `${lastChoice.uiLocale}|${lastChoice.uiLocaleAt}`;
    const result = signInMerge(record, user.unsafeMetadata);
    const account = accountLocaleOf(user.unsafeMetadata);
    if (result.device && account) applyAccount(account);
    if (result.account) void user.update({ unsafeMetadata: withAccountLocale(user.unsafeMetadata, result.account) }).catch(() => undefined);
  }, [user, recordSettled, record, lastChoice, applyAccount]);
  useEffect(() => {
    if (!user || !lastChoice || merged.current !== user.id) return;
    const key = `${lastChoice.uiLocale}|${lastChoice.uiLocaleAt}`;
    if (sent.current === key) return;
    sent.current = key;
    void user.update({ unsafeMetadata: withAccountLocale(user.unsafeMetadata, lastChoice) }).catch(() => undefined);
  }, [user, lastChoice]);
  return null;
}

/** The account language sync for the signed-in user, if any; rendered inside the grown-up lock's open page. */
export function AccountLocaleSlot(): JSX.Element | null {
  const { localeUser } = useConsoleAuth();
  return localeUser ? <AccountLocaleSync user={localeUser} /> : null;
}

function ClerkBridge({ children }: { children: ReactNode }): JSX.Element {
  const { isLoaded, user } = useUser();
  const { getToken, sessionId } = useAuth();
  const clerk = useClerk();
  // One enhanced fetcher for the whole tab; each step-up passes it the call to make (Clerk hands its arguments to
  // both the first call and the retry), so an attempt that never settled cannot retry a later request.
  const enhanced = useReverification((call: () => Promise<unknown>) => call());
  // Sign out lands on `/signin` in this page's language (AMENDMENTS-DISPLAY-NAV section 6).
  const { locale } = useConsoleLocale();
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
  const verifyPasskey = useCallback(async (): Promise<boolean> => {
    const session = clerk.session;
    if (!session) return false;
    try {
      await session.startVerification({ level: 'first_factor' });
      return (await session.verifyWithPasskey()).status === 'complete';
    } catch {
      return false;
    }
  }, [clerk]);
  const reverifySecret = useCallback(async (): Promise<SecretReverify> => {
    const account = user as unknown as LocaleUser | null | undefined;
    if (!account) return 'unavailable';
    // Fail closed: a dialog that could offer a passkey never opens (sections 7.2 and 7.4).
    if (!secretReverifyAllowed(account.passkeys)) return 'refused';
    const before = passkeySnapshot(account.passkeys);
    const hint = await reverifyOnce()();
    const outcome = await reverify(async () => ({ verified: true }), hint as unknown);
    if (outcome.kind !== 'result') return outcome.kind;
    let after: readonly PasskeyLike[] | null = null;
    try {
      after = account.reload ? ((await account.reload()).passkeys ?? null) : null;
    } catch {
      after = null;
    }
    // An account that could not be read again fails closed too.
    return after === null || passkeyUsedDuring(before, after) ? 'refused' : 'done';
  }, [user, reverify]);
  const value = useMemo<ConsoleAuth>(
    () => ({
      mode: 'clerk',
      ready: isLoaded,
      session: sessionFromClerkUser(user),
      sessionId: user ? (sessionId ?? null) : null,
      getToken: () => getToken().catch(() => null),
      signOut: async (redirectUrl = signInHome(locale), options = {}) => {
        clearGrownUpTab(undefined, options);
        clearSignInTab();
        await forgetDeviceUses();
        return clerk.signOut({ redirectUrl });
      },
      devSignIn: () => undefined,
      reverify,
      localeUser: isLoaded && user ? (user as unknown as LocaleUser) : null,
      verifyPasskey,
      reverifySecret,
      secretReverifyReady: isLoaded && !!user && secretReverifyAllowed((user as unknown as LocaleUser).passkeys),
    }),
    [isLoaded, user, sessionId, getToken, clerk, reverify, locale, verifyPasskey, reverifySecret],
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
      signOut: async (redirectUrl?: string, options: { keepInvite?: boolean } = {}) => {
        clearGrownUpTab(undefined, options);
        clearSignInTab();
        await forgetDeviceUses();
        setSession(null);
        if (redirectUrl) window.location.assign(redirectUrl);
      },
      devSignIn,
      reverify: (fetcher) => settleReverify(fetcher),
      localeUser: null,
      verifyPasskey: async () => false,
      reverifySecret: async () => 'done',
      secretReverifyReady: true,
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
  // A sign-out Clerk starts by itself (a session ended in another tab, its own widget) lands with lang too (DN-6 section 6).
  const afterSignOutUrl = signInHome(locale);
  if (publishableKey) {
    return (
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl={afterSignOutUrl}
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
