'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { typography } from '@hangul-route/design-system/tokens';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { rem } from '@/lib/console/rem';
import { CLERK_LOAD_TIMEOUT_MS, signedOutTarget } from '@/lib/console/signin-flow';
import { LocaleProvider, useConsoleLocale } from '@/lib/i18n/locale-context';
import { AccountLocaleSlot, ConsoleAuthProvider, useConsoleAuth } from './auth-context';
import { GrownUpLocationContext } from './grown-up-location';
import { GrownUpLock } from './GrownUpLock';

/**
 * The one layout of every grown-up page (F-APP-001 A-4b, section 3.7): `LocaleProvider`,
 * `ConsoleAuthProvider` and `GrownUpLock`. Order of checks on load (section 3.11): signed in?
 * (else `/signin?next=<path and query>`) → the lock decision → the page. `/signin` itself is
 * exempt from both. Until a decision exists the page renders nothing (no frame, no API call):
 * every page that calls the API sits inside the lock, as `GrownUpLock` requires. When the session
 * stays unknown for `CLERK_LOAD_TIMEOUT_MS` (Clerk cannot load), the page goes to `/signin` the
 * same way, where the unreachable line and Try again live (section 3.19): never a blank page.
 * Before any of that, every grown-up page (`/signin` too) waits on the same empty canvas until the
 * device's display record is read (owner items 6 and 7), so no frame paints in English or at the
 * standard size first; `document.title` comes from the dictionary in that language.
 */
const SIGN_IN_PAGE = /^\/signin(?:\/|\.html)?$/;

export function isSignInPage(pathname: string): boolean {
  return SIGN_IN_PAGE.test(pathname);
}

/** An empty canvas while the session or the lock is undecided (as A-4a built it; design pass D12). */
function Pending(): JSX.Element {
  return <div aria-busy="true" data-testid="grown-up-lock-pending" />;
}

/** Which grown-up title the tab shows (`console.docTitle`); a page may set a more specific one over it. */
export type GrownUpTitle = 'console' | 'signIn';

/**
 * `document.title` in the console's language. Drawn before the page, so a page that sets its own
 * title (a report) sets it after this one and wins; the static English `metadata` title is only the
 * HTML's.
 */
function DocumentTitle({ kind }: { kind: GrownUpTitle }): null {
  const { messages, ready } = useConsoleLocale();
  const title = messages.console.docTitle[kind];
  useEffect(() => {
    if (ready && typeof document !== 'undefined') document.title = title;
  }, [ready, title]);
  return null;
}

export function GrownUpGate({ children, title = 'console' }: { children: ReactNode; title?: GrownUpTitle }): JSX.Element {
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

  const location = useMemo(() => ({ pathname, search }), [pathname, search]);
  // The device's language and text size resolve during this wait (owner items 6 and 7).
  const localeReady = useConsoleLocale().ready;

  if (!localeReady) return <Pending />;
  if (exempt) {
    return (
      <>
        <DocumentTitle kind={title} />
        {children}
      </>
    );
  }
  if (!auth.ready || !auth.session) return <Pending />;
  return (
    <GrownUpLocationContext.Provider value={location}>
      <DocumentTitle kind={title} />
      <GrownUpLock pathname={pathname} search={search} onSignInAgain={(url) => void auth.signOut(url)}>
        {/* The account's language is read and written only once a grown-up has opened the page. */}
        <AccountLocaleSlot />
        {children}
      </GrownUpLock>
    </GrownUpLocationContext.Provider>
  );
}

/**
 * A form control the browser draws at its own fixed font size (13.33 px) whatever the root says,
 * so a button, field or select without a size of its own would ignore the chosen text size. This
 * puts every such control in rem at the caption token (the closest token to that default, so
 * nothing moves at Standard). `:where` keeps it at zero specificity: any size a component sets
 * still wins.
 */
export const CONTROL_FONT_CSS = `:where(button,input,select,textarea){font-size:${rem(typography.size.caption)}}`;

export function GrownUpLayout({ children, title }: { children: ReactNode; title?: GrownUpTitle }): JSX.Element {
  return (
    <LocaleProvider>
      <style>{CONTROL_FONT_CSS}</style>
      <ConsoleAuthProvider>
        {/* useSearchParams in a static export needs a Suspense boundary; its fallback is the same empty canvas. */}
        <Suspense fallback={<Pending />}>
          <GrownUpGate title={title}>{children}</GrownUpGate>
        </Suspense>
      </ConsoleAuthProvider>
    </LocaleProvider>
  );
}
