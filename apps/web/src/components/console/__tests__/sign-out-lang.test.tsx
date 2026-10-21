import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-DISPLAY-NAV section 6 (DN-5, DN-6): every link from the grown-up pages to `/signin` carries
 * `?lang=<the console's language>`, English included. Sign out (useConsole) lands on `/signin?lang=…`; under
 * Clerk the default sign-out redirect does too; the lock's Sign in again and the transfers page's (their own
 * wiring tests) pass `/signin?next=…&lang=…`.
 */
const nav = vi.hoisted(() => ({ replaced: [] as string[] }));
const clerk = vi.hoisted(() => ({ redirects: [] as Array<string | undefined>, afterSignOutUrl: [] as string[] }));
const view = vi.hoisted(() => ({ locale: 'en' as 'en' | 'es' | 'ko' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (url: string) => nav.replaced.push(url), push: () => undefined }),
}));
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children, afterSignOutUrl }: { children: ReactNode; afterSignOutUrl: string }) => {
    clerk.afterSignOutUrl.push(afterSignOutUrl);
    return <>{children}</>;
  },
  useUser: () => ({ isLoaded: true, user: { id: 'user_1', firstName: 'Kim', primaryEmailAddress: null } }),
  useAuth: () => ({ getToken: async () => 'token', sessionId: 'sess_1' }),
  useClerk: () => ({
    signOut: async (options?: { redirectUrl?: string }) => {
      clerk.redirects.push(options?.redirectUrl);
    },
  }),
  useReverification: (fetcher: (...args: unknown[]) => Promise<unknown>) => fetcher,
}));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const current = () => ({
    locale: view.locale,
    messages: i18n.getMessages(view.locale),
    available: ['en', 'es', 'ko'],
    setLocale: () => undefined,
    recordSettled: false,
    record: null,
    lastChoice: null,
    applyAccount: () => undefined,
  });
  return { useConsoleLocale: current, useMessages: () => current().messages, useLocale: () => view.locale };
});

import { ConsoleAuthProvider, useConsoleAuth, type ConsoleAuth } from '../auth-context';
import { lockActions } from '../GrownUpLock';
import { useConsole, type ConsoleView } from '../use-console';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  nav.replaced = [];
  clerk.redirects = [];
  clerk.afterSignOutUrl = [];
  view.locale = 'en';
  vi.unstubAllEnvs();
});

async function mountUnderClerk(): Promise<{ auth: ConsoleAuth; console: ConsoleView }> {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
  const seen: { auth: ConsoleAuth | null; console: ConsoleView | null } = { auth: null, console: null };
  function Probe(): null {
    seen.auth = useConsoleAuth();
    seen.console = useConsole();
    return null;
  }
  await act(async () => {
    mounted = create(
      <ConsoleAuthProvider>
        <Probe />
      </ConsoleAuthProvider>,
    );
  });
  return { auth: seen.auth as unknown as ConsoleAuth, console: seen.console as unknown as ConsoleView };
}

describe.each(['en', 'es', 'ko'] as const)('lang=%s on the way to /signin', (locale) => {
  it('Sign out signs out of Clerk to /signin?lang=… and lands there', async () => {
    view.locale = locale;
    const { console: page } = await mountUnderClerk();
    await act(async () => {
      page.signOut();
      await Promise.resolve();
    });
    expect(clerk.redirects).toEqual([`/signin?lang=${locale}`]);
    expect(nav.replaced).toEqual([`/signin?lang=${locale}`]);
  });

  it("Clerk's default sign-out redirect carries the language; an explicit target is kept", async () => {
    view.locale = locale;
    const { auth } = await mountUnderClerk();
    await act(async () => {
      await auth.signOut();
      await auth.signOut('/signin?next=%2Fparent&lang=ko');
    });
    expect(clerk.redirects).toEqual([`/signin?lang=${locale}`, '/signin?next=%2Fparent&lang=ko']);
  });

  it("a sign-out Clerk starts by itself (afterSignOutUrl) lands on /signin?lang=…", async () => {
    view.locale = locale;
    await mountUnderClerk();
    expect(clerk.afterSignOutUrl.length).toBeGreaterThan(0);
    expect(new Set(clerk.afterSignOutUrl)).toEqual(new Set([`/signin?lang=${locale}`]));
  });

  it("the lock's Sign in again hands /signin with next and lang to the sign-out", () => {
    const urls: string[] = [];
    const env = { assign: () => undefined, clearGrownUpTab: () => undefined, origin: () => 'https://app.hangulroute.com' };
    lockActions(env as unknown as Parameters<typeof lockActions>[0], '/teach/space?id=sp_1', (url) => urls.push(url), locale).onSignInAgain();
    expect(urls).toEqual([`/signin?next=${encodeURIComponent('/teach/space?id=sp_1')}&lang=${locale}`]);
  });
});
