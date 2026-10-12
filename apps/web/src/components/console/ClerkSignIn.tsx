'use client';

import { SignIn, SignUp, useClerk, useReverification } from '@clerk/clerk-react';
import { colors, radii } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState } from 'react';
import {
  CLERK_LOAD_TIMEOUT_MS,
  clerkUnreachable,
  oauthRedirectStarted,
  oauthSignUpStarted,
  proofAtSignIn,
  reverifyOnce,
  signedInHere,
  type ClerkSignInLike,
  type ClerkSignUpLike,
} from '@/lib/console/signin-flow';
import { readSignInRecord, writeOAuthStarted, writeSignInProof } from '@/lib/console/signin-record';
import { useMessages } from '@/lib/i18n/locale-context';
import { RetryPanel, WidgetBox } from './SignInParts';

/**
 * The Clerk side of `/signin` (F-APP-001 A-4b, sections 3.7 and 3.9; mock
 * design/screens/app-shell/signin.md, decision D13). Only rendered under `ClerkProvider` (a build
 * with a publishable key); the dev build never imports a Clerk hook through here.
 *
 * - `<SignIn routing="hash">` with the sign-up link hidden (`footerAction`) and `transferable`
 *   off, so an unknown Google account is never signed up past the adult step; in an installed PWA
 *   the email method is listed above Google (OD-15).
 * - `<SignUp>` only after the adult step, with `unsafeMetadata.adultAffirmedAt`.
 * - The recorder keeps what the sign-in completed in this tab proved, for the router.
 * - The widget's place shows one line and Try again when Clerk cannot load.
 */

/** Clerk appearance from tokens (D13): the brand colours, the token radius, the page's own font. */
export function clerkAppearance(standalone: boolean) {
  return {
    layout: { socialButtonsPlacement: standalone ? ('bottom' as const) : ('top' as const) },
    variables: {
      colorPrimary: colors.brand.primary,
      colorText: colors.text.primary,
      colorBackground: colors.surface.paper,
      borderRadius: `${radii.md}px`,
      fontFamily: 'inherit',
    },
    elements: {
      // Sign-up is reachable only through the adult step (OD-13).
      footerAction: { display: 'none' },
      rootBox: { width: '100%' },
      cardBox: { width: '100%', maxWidth: '100%', boxShadow: 'none', border: 'none' },
    },
  };
}

interface ClerkResources {
  client?: { signIn?: ClerkSignInLike | null; signUp?: ClerkSignUpLike | null } | null;
  session?: { id: string } | null;
}

/**
 * Keeps, for the router, what a sign-in completed in this tab proved (section 3.9). Enabled only
 * while the page knows the tab is signed out, so the first session it sees is one that signed in
 * here; an OAuth hand-off that leaves the window is noted too (the installed PWA line, and the
 * proof when Clerk finishes the redirect before this page watches).
 */
function useSignInRecorder(enabled: boolean): void {
  const clerk = useClerk();
  useEffect(() => {
    if (!enabled) return undefined;
    let previous: string | null = null;
    return clerk.addListener((resources: ClerkResources) => {
      const now = Date.now();
      const current = resources.session?.id ?? null;
      if (signedInHere(previous, current)) {
        writeSignInProof(proofAtSignIn({ sessionId: current, signIn: resources.client?.signIn, signUp: resources.client?.signUp, record: readSignInRecord(), now }), now);
      } else if (!current && (oauthRedirectStarted(resources.client?.signIn) || oauthSignUpStarted(resources.client?.signUp))) {
        writeOAuthStarted(now);
      }
      previous = current;
    });
  }, [clerk, enabled]);
}

/** True once Clerk failed to load or is still loading after `CLERK_LOAD_TIMEOUT_MS` (section 3.19). */
function useClerkUnreachable(): boolean {
  const clerk = useClerk();
  const [waitedMs, setWaitedMs] = useState(0);
  useEffect(() => {
    if (clerk.loaded) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setWaitedMs(Date.now() - started), 1_000);
    return () => clearInterval(timer);
  }, [clerk.loaded]);
  return clerkUnreachable({ status: clerk.status, loaded: clerk.loaded, waitedMs: clerk.loaded ? 0 : Math.min(waitedMs, CLERK_LOAD_TIMEOUT_MS) });
}

export interface ClerkWidgetProps {
  kind: 'signIn' | 'signUp';
  /** True once the page knows this tab is signed out: from then on a session that appears signed in here. */
  record: boolean;
  /** Where Clerk returns after a sign-in or a sign-up: the router (`signInReturnUrl`). */
  returnUrl: string;
  /** Where Clerk would send a sign-up started from the sign-in widget: `/start` with the hint (never reached with `transferable` off). */
  startUrl: string;
  standalone: boolean;
  /** `adultAffirmedAt` for `<SignUp>` (ISO time of the tick). */
  affirmedAt?: string;
}

export function ClerkWidget({ kind, record, returnUrl, startUrl, standalone, affirmedAt }: ClerkWidgetProps): JSX.Element {
  const m = useMessages();
  useSignInRecorder(record);
  const unreachable = useClerkUnreachable();
  if (unreachable) return <RetryPanel line={m.console.signIn.unreachable} retryLabel={m.console.tryAgain} onRetry={() => window.location.reload()} testId="signin-unreachable" />;
  const appearance = clerkAppearance(standalone);
  return (
    <WidgetBox testId={kind === 'signIn' ? 'signin-widget' : 'signup-widget'}>
      {kind === 'signIn' ? (
        <SignIn routing="hash" transferable={false} appearance={appearance} fallbackRedirectUrl={returnUrl} signUpFallbackRedirectUrl={startUrl} />
      ) : (
        <SignUp routing="hash" appearance={appearance} unsafeMetadata={{ adultAffirmedAt: affirmedAt }} fallbackRedirectUrl={returnUrl} />
      )}
    </WidgetBox>
  );
}

/**
 * Clerk reverification (Panel D, section 3.9): opens Clerk's first-factor dialog at once (an
 * email code to the account's address, the password or a passkey) and reports the outcome.
 * Closing the dialog is a cancel: the visitor stays signed in and the lock decides.
 */
export function ClerkReverify({ onDone }: { onDone: (verified: boolean) => void }): null {
  const fetcher = useRef(reverifyOnce());
  const confirm = useReverification(() => fetcher.current());
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    confirm().then(
      (result) => onDone('verified' in result && result.verified === true),
      () => onDone(false),
    );
  }, [confirm, onDone]);
  return null;
}
