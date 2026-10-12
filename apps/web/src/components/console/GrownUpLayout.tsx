'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';
import { CLERK_LOAD_TIMEOUT_MS, signedOutTarget } from '@/lib/console/signin-flow';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { ConsoleAuthProvider, useConsoleAuth } from './auth-context';
import { GrownUpLock } from './GrownUpLock';

/**
 * The one layout of every grown-up page (F-APP-001 A-4b, section 3.7): `LocaleProvider`,
 * `ConsoleAuthProvider` and `GrownUpLock`. Order of checks on load (section 3.11): signed in?
 * (else `/signin?next=<path and query>`) → the lock decision → the page. `/signin` itself is
 * exempt from both. Until a decision exists the page renders nothing (no frame, no API call):
 * every page that calls the API sits inside the lock, as `GrownUpLock` requires. When the session
 * stays unknown for `CLERK_LOAD_TIMEOUT_MS` (Clerk cannot load), the page goes to `/signin` the
 * same way, where the unreachable line and Try again live (section 3.19): never a blank page.
 */
const SIGN_IN_PAGE = /^\/signin(?:\/|\.html)?$/;

export function isSignInPage(pathname: string): boolean {
  return SIGN_IN_PAGE.test(pathname);
}

/** An empty canvas while the session or the lock is undecided (as A-4a built it; design pass D12). */
function Pending(): JSX.Element {
  return <div aria-busy="true" data-testid="grown-up-lock-pending" />;
}

export function GrownUpGate({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname() ?? '';
  const search = useSearchParams()?.toString() ?? '';
  const router = useRouter();
  const auth = useConsoleAuth();
  const exempt = isSignInPage(pathname);
  const signedOut = !exempt && auth.ready && !auth.session;

  useEffect(() => {
    if (signedOut) router.replace(signedOutTarget(pathname, search));
  }, [signedOut, router, pathname, search]);

  const waiting = !exempt && !auth.ready;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => router.replace(signedOutTarget(pathname, search)), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting, router, pathname, search]);

  if (exempt) return <>{children}</>;
  if (!auth.ready || !auth.session) return <Pending />;
  return (
    <GrownUpLock pathname={pathname} search={search} onSignInAgain={(url) => void auth.signOut(url)}>
      {children}
    </GrownUpLock>
  );
}

export function GrownUpLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <LocaleProvider>
      <ConsoleAuthProvider>
        {/* useSearchParams in a static export needs a Suspense boundary; its fallback is the same empty canvas. */}
        <Suspense fallback={<Pending />}>
          <GrownUpGate>{children}</GrownUpGate>
        </Suspense>
      </ConsoleAuthProvider>
    </LocaleProvider>
  );
}
