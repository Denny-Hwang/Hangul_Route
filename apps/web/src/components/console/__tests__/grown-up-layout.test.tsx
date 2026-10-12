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
vi.mock('@/lib/i18n/locale-context', () => ({ LocaleProvider: ({ children }: { children: ReactNode }) => children }));

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
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

function render(): ReactTestRenderer {
  act(() => {
    mounted = create(
      <GrownUpLayout>
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

  it('knows the sign-in page by path', () => {
    for (const path of ['/signin', '/signin/', '/signin.html']) expect(isSignInPage(path)).toBe(true);
    for (const path of ['/signinx', '/teach', '/signin/other', '']) expect(isSignInPage(path)).toBe(false);
  });
});
