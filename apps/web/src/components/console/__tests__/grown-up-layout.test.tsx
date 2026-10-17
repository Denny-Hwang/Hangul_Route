import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-APP-001 A-4b, section 3.7: one layout for every grown-up page. Order of checks on load
 * (section 3.11): signed in? (else `/signin?next=<path and query>`) → the lock → the page.
 * `/signin` is exempt from both. The lock itself has its own tests (A-4a); here it is a stand-in
 * that records what the layout hands it.
 */
const nav = vi.hoisted(() => ({ pathname: '/teach/space', search: 'id=sp_1', replaced: [] as string[] }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: (url: string) => nav.replaced.push(url), push: () => undefined }),
}));

const auth = vi.hoisted(() => ({ ready: true, session: null as { accountId: string } | null, signOuts: [] as Array<string | undefined> }));
vi.mock('../auth-context', () => ({
  ConsoleAuthProvider: ({ children }: { children: ReactNode }) => children,
  useConsoleAuth: () => ({
    ready: auth.ready,
    session: auth.session,
    signOut: async (url?: string) => {
      auth.signOuts.push(url);
    },
  }),
}));
const locale = vi.hoisted(() => ({ ready: true, locale: 'en' as 'en' | 'ko' }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const { getMessages } = await import('@hangul-route/i18n');
  return {
    LocaleProvider: ({ children }: { children: ReactNode }) => children,
    useConsoleLocale: () => ({ ready: locale.ready, messages: getMessages(locale.locale) }),
  };
});

const lock = vi.hoisted(() => ({ props: [] as Array<{ pathname: string; search: string; onSignInAgain: (url: string) => void }> }));
vi.mock('../GrownUpLock', () => ({
  GrownUpLock: (props: { pathname: string; search: string; onSignInAgain: (url: string) => void; children: ReactNode }) => {
    lock.props.push(props);
    return <section data-testid="lock">{props.children}</section>;
  },
}));

import { GrownUpLayout, isSignInPage } from '../GrownUpLayout';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  nav.pathname = '/teach/space';
  nav.search = 'id=sp_1';
  nav.replaced = [];
  auth.ready = true;
  auth.session = null;
  auth.signOuts = [];
  lock.props = [];
  locale.ready = true;
  locale.locale = 'en';
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

function render(title?: 'console' | 'signIn'): ReactTestRenderer {
  act(() => {
    mounted = create(
      <GrownUpLayout title={title}>
        <p>page</p>
      </GrownUpLayout>,
    );
  });
  return mounted as unknown as ReactTestRenderer;
}

const pageShown = (r: ReactTestRenderer): boolean => r.root.findAll((n) => n.type === 'p').length > 0;

describe('the shared grown-up layout (F-APP-001 A-4b)', () => {
  it('sends a signed-out visitor to /signin with the page and its query as next, before any lock', () => {
    const r = render();
    expect(nav.replaced).toEqual([`/signin?next=${encodeURIComponent('/teach/space?id=sp_1')}`]);
    expect(pageShown(r)).toBe(false);
    expect(lock.props).toHaveLength(0);
  });

  it('the /teach router carries only its hint (next only with a query)', () => {
    nav.pathname = '/teach';
    nav.search = '';
    render();
    expect(nav.replaced).toEqual(['/signin']);
  });

  it('renders the empty canvas while the session is unknown', () => {
    auth.ready = false;
    const r = render();
    expect(nav.replaced).toEqual([]);
    expect(pageShown(r)).toBe(false);
    expect(r.root.findAll((n) => n.props['data-testid'] === 'grown-up-lock-pending' && n.type === 'div')).toHaveLength(1);
  });

  it('a session still unknown after the Clerk wait goes to /signin (the unreachable line lives there), never a blank page', () => {
    vi.useFakeTimers();
    try {
      auth.ready = false;
      render();
      act(() => {
        vi.advanceTimersByTime(14_999);
      });
      expect(nav.replaced).toEqual([]);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(nav.replaced).toEqual([`/signin?next=${encodeURIComponent('/teach/space?id=sp_1')}`]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('/signin itself never forwards while Clerk loads (it shows its own unreachable line)', () => {
    vi.useFakeTimers();
    try {
      auth.ready = false;
      nav.pathname = '/signin';
      render();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(nav.replaced).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('wraps a signed-in page in the lock, keyed on the pathname, with the query for its return targets', () => {
    auth.session = { accountId: 'user_1' };
    const r = render();
    expect(nav.replaced).toEqual([]);
    expect(pageShown(r)).toBe(true);
    expect(lock.props[lock.props.length - 1]).toMatchObject({ pathname: '/teach/space', search: 'id=sp_1' });
  });

  it("the lock's Sign in again signs out to /signin?next=…", () => {
    auth.session = { accountId: 'user_1' };
    render();
    lock.props[lock.props.length - 1]?.onSignInAgain('/signin?next=%2Fteach%2Fhome');
    expect(auth.signOuts).toEqual(['/signin?next=%2Fteach%2Fhome']);
  });

  it('/signin is exempt from the sign-in check and the lock', () => {
    nav.pathname = '/signin';
    const r = render();
    expect(nav.replaced).toEqual([]);
    expect(pageShown(r)).toBe(true);
    expect(lock.props).toHaveLength(0);
  });

  it('holds the empty canvas on every page, /signin too, until the device record is read (owner items 6 and 7)', () => {
    locale.ready = false;
    auth.session = { accountId: 'user_1' };
    for (const path of ['/teach/space', '/signin']) {
      nav.pathname = path;
      const r = render();
      expect(pageShown(r), path).toBe(false);
      expect(r.root.findAll((n) => n.props['data-testid'] === 'grown-up-lock-pending' && n.type === 'div'), path).toHaveLength(1);
      expect(lock.props, path).toHaveLength(0);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });

  it('titles the tab from the dictionary in the console language, once the record is read', () => {
    const doc = { title: 'Console — Hangul Route' };
    vi.stubGlobal('document', doc);
    try {
      auth.session = { accountId: 'user_1' };
      locale.locale = 'ko';
      render();
      expect(doc.title).toBe('콘솔 — Hangul Route');
      act(() => mounted?.unmount());
      mounted = null;
      nav.pathname = '/signin';
      render('signIn');
      expect(doc.title).toBe('어른 로그인 — Hangul Route');
      act(() => mounted?.unmount());
      mounted = null;
      locale.ready = false;
      doc.title = 'static';
      render('signIn');
      expect(doc.title).toBe('static');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('knows the sign-in page by path', () => {
    for (const path of ['/signin', '/signin/', '/signin.html']) expect(isSignInPage(path)).toBe(true);
    for (const path of ['/signinx', '/teach', '/signin/other', '']) expect(isSignInPage(path)).toBe(false);
  });
});
