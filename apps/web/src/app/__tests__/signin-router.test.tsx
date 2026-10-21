import type { UiLocale } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';

/**
 * F-APP-001 A-4b, section 5 row `signin-router.test.tsx`: `/signin` (persona intro by `persona`
 * and `as`, no sign-up link, the adult step before `<SignUp>`, email first when installed), the
 * recorder of what a sign-in proved, the router (`next`, then `homeFor`; the unlock and trusted
 * epoch after a secret-proving sign-in; reverification first after OAuth on a locked device),
 * the `/teach` router's hint and the `/teach/start` redirect. Rendered with react-test-renderer
 * over a stand-in window (the web tests have no DOM); Clerk, the API and the stores are mocked.
 */

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), pathname: '/signin', replaced: [] as string[] }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: (url: string) => nav.replaced.push(url), push: (url: string) => nav.replaced.push(url) }),
}));

type AuthView = { mode: 'clerk' | 'dev'; ready: boolean; session: { accountId: string; displayName: string } | null; sessionId: string | null };
const auth = vi.hoisted(() => ({ value: { mode: 'clerk', ready: true, session: null, sessionId: null } as AuthView, devSignIns: [] as unknown[], signOuts: [] as Array<string | undefined> }));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    ...auth.value,
    getToken: async () => 'token',
    signOut: async (url?: string) => {
      auth.signOuts.push(url);
    },
    devSignIn: (session: unknown) => auth.devSignIns.push(session),
  }),
}));

type Listener = (resources: unknown) => void;
const clerk = vi.hoisted(() => ({
  loaded: true,
  status: 'ready' as string,
  listeners: [] as Listener[],
  signIn: [] as Array<Record<string, unknown>>,
  signUp: [] as Array<Record<string, unknown>>,
  reverify: 'verify' as 'verify' | 'cancel',
  reverifyAsked: 0,
}));
vi.mock('@clerk/clerk-react', () => ({
  SignIn: (props: Record<string, unknown>) => {
    clerk.signIn.push(props);
    return null;
  },
  SignUp: (props: Record<string, unknown>) => {
    clerk.signUp.push(props);
    return null;
  },
  useClerk: () => ({
    loaded: clerk.loaded,
    status: clerk.status,
    addListener: (listener: Listener) => {
      clerk.listeners.push(listener);
      return () => {
        clerk.listeners = clerk.listeners.filter((l) => l !== listener);
      };
    },
  }),
  // Clerk's handler: a reverification hint opens the dialog; success retries the fetcher, a cancel rejects.
  useReverification: (fetcher: () => Promise<unknown>) => async () => {
    const first = (await fetcher()) as { clerk_error?: unknown };
    if (!first || !('clerk_error' in first)) return first;
    clerk.reverifyAsked += 1;
    if (clerk.reverify === 'cancel') throw new Error('reverification_cancelled');
    return fetcher();
  },
}));

const api = vi.hoisted(() => ({ spaces: { ok: true, data: [] } as { ok: boolean; data?: unknown[]; error?: string }, calls: 0 }));
vi.mock('@/lib/console/api', () => ({
  createConsoleApi: () => ({
    listSpaces: async () => {
      api.calls += 1;
      return api.spaces;
    },
  }),
}));

const stores = vi.hoisted(() => ({ device: { readable: true, marker: null, hasProfiles: false } as DeviceGateRead, deviceReads: 0, last: null as 'parent' | 'teacher' | null, epochs: [] as Array<number | null> }));
vi.mock('@/lib/console/device-marker', () => ({
  readDeviceGate: async () => {
    stores.deviceReads += 1;
    return stores.device;
  },
}));
vi.mock('@/lib/console/shell-store', () => ({
  readLastPersona: async () => stores.last,
  readTrustedEpoch: async () => null,
  writeTrustedEpoch: async (epoch: number | null) => {
    stores.epochs.push(epoch);
    return true;
  },
}));

import SignInPage from '@/app/(console)/signin/page';
import TeachStartRedirect from '@/app/(console)/teach/start/page';
import TeachBillingRedirect from '@/app/(console)/teach/billing/page';
import TeachRouterPage from '@/app/(console)/teach/page';
import { GrownUpRouter, type RouterEnvironment } from '@/components/console/GrownUpRouter';
import { ClerkReverify } from '@/components/console/ClerkSignIn';
import { AFFIRMATION_KEY, SIGNIN_RECORD_KEY, readSignInRecord } from '@/lib/console/signin-record';

const ORIGIN = 'https://app.hangulroute.com';
const NOW = 1_800_000_000_000;
const PIN_DEVICE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 1_790_000_000_000 }, hasProfiles: true };
const NONE_DEVICE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: false };
const CLASS = { space: { kind: 'class' }, role: 'owner' };
const FAMILY = { space: { kind: 'family' }, role: 'owner' };

/** A stand-in window: session storage, the location calls, matchMedia; and a document for visibilitychange. */
class Store {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}
const browser = { session: new Store(), local: new Store(), replaced: [] as string[], assigned: [] as string[], search: '', standalone: false };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.test');
  vi.stubGlobal('window', {
    get sessionStorage() {
      return browser.session;
    },
    get localStorage() {
      return browser.local;
    },
    location: {
      origin: ORIGIN,
      get search() {
        return browser.search;
      },
      replace: (url: string) => browser.replaced.push(url),
      assign: (url: string) => browser.assigned.push(url),
      reload: () => undefined,
    },
    matchMedia: (query: string) => ({ matches: browser.standalone && query === '(display-mode: standalone)' }),
    navigator: {},
  });
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined });
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.pathname = '/signin';
  nav.replaced = [];
  auth.value = { mode: 'clerk', ready: true, session: null, sessionId: null };
  auth.devSignIns = [];
  clerk.loaded = true;
  clerk.status = 'ready';
  clerk.listeners = [];
  clerk.signIn = [];
  clerk.signUp = [];
  clerk.reverify = 'verify';
  clerk.reverifyAsked = 0;
  api.spaces = { ok: true, data: [] };
  api.calls = 0;
  stores.device = NONE_DEVICE;
  stores.deviceReads = 0;
  stores.last = null;
  stores.epochs = [];
  browser.session = new Store();
  browser.local = new Store();
  browser.replaced = [];
  browser.assigned = [];
  browser.search = '';
  browser.standalone = false;
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await act(async () => Promise.resolve());
}

async function render(element: ReactElement): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(element);
  });
  await settle();
  return mounted as unknown as ReactTestRenderer;
}

const text = (root: ReactTestInstance): string =>
  root
    .findAll((node) => typeof node.type === 'string' && node.type !== 'style')
    .flatMap((node) => node.children.filter((child): child is string => typeof child === 'string'))
    .join(' | ');
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => node.props['data-testid'] === id && typeof node.type === 'string');
const lastSignIn = (): Record<string, unknown> => clerk.signIn[clerk.signIn.length - 1] ?? {};

describe('/signin signed out: Panel A (section 3.7)', () => {
  it.each([
    ['persona=parent', "Sign in to see your family's learning."],
    ['as=parent', "Sign in to see your family's learning."],
    ['persona=teacher', 'Sign in to see your classes.'],
    ['as=teacher', 'Sign in to see your classes.'],
    ['persona=admin', 'Sign in to your grown-up account.'],
    ['', 'Sign in to your grown-up account.'],
  ])('?%s shows its intro', async (query, intro) => {
    nav.params = new URLSearchParams(query);
    const page = (await render(<SignInPage />)).root;
    const words = text(page);
    expect(words).toContain('Grown-ups sign in');
    expect(words).toContain(intro);
    expect(page.findAllByType('h1')).toHaveLength(1);
  });

  it('draws the learners line, I am here to learn and the create link, never the old copy', async () => {
    nav.params = new URLSearchParams('persona=parent&next=%2Fteach%2Fhome');
    const page = (await render(<SignInPage />)).root;
    const words = text(page);
    expect(words).toContain("Learners don't need an account. They start learning right away, or join a class with a code.");
    expect(words).not.toMatch(/Kids|Keep progress safe|Sign in with your email or Google/);
    expect(byTestId(page, 'signin-create')[0]?.props.href).toBe(`/signin?mode=create&persona=parent&next=${encodeURIComponent('/teach/home')}`);
    expect(byTestId(page, 'signin-learn')[0]?.props.href).toBe('/?lang=en');
    expect(byTestId(page, 'signin-back')[0]?.props.children).toContain('Back to learning');
  });

  it("renders Clerk's sign-in with no way to sign up: footer action hidden, not transferable, hash routing", async () => {
    nav.params = new URLSearchParams('persona=teacher&next=%2Fteach%2Fspace%3Fid%3Dsp_1&mode=other');
    await render(<SignInPage />);
    const props = lastSignIn();
    expect(props.routing).toBe('hash');
    expect(props.transferable).toBe(false);
    expect((props.appearance as { elements: { footerAction: unknown } }).elements.footerAction).toEqual({ display: 'none' });
    expect(props.fallbackRedirectUrl).toBe(`/signin?persona=teacher&next=${encodeURIComponent('/teach/space?id=sp_1')}`);
    expect(props.signUpFallbackRedirectUrl).toBe('/start?persona=teacher');
    expect(clerk.signUp).toHaveLength(0);
  });

  it('lists the email method first in an installed PWA (OD-15), Google first in a browser tab', async () => {
    await render(<SignInPage />);
    expect((lastSignIn().appearance as { layout: { socialButtonsPlacement: string } }).layout.socialButtonsPlacement).toBe('top');
    act(() => mounted?.unmount());
    browser.standalone = true;
    await render(<SignInPage />);
    expect((lastSignIn().appearance as { layout: { socialButtonsPlacement: string } }).layout.socialButtonsPlacement).toBe('bottom');
  });

  it('says "Finish signing in here with an email code" in an installed PWA after Google left the window', async () => {
    browser.standalone = true;
    browser.session.setItem(SIGNIN_RECORD_KEY, JSON.stringify({ v: 1, kind: 'oauth', at: Date.now() - 1_000 }));
    const page = (await render(<SignInPage />)).root;
    expect(byTestId(page, 'signin-standalone-finish')[0]?.children).toEqual(['Finish signing in here with an email code']);
  });

  it('shows one line and Try again in the widget place when Clerk cannot load, keeping the ways back', async () => {
    clerk.loaded = false;
    clerk.status = 'error';
    const page = (await render(<SignInPage />)).root;
    expect(text(page)).toContain("Sign-in can't load right now.");
    expect(byTestId(page, 'signin-unreachable-retry')).toHaveLength(1);
    expect(byTestId(page, 'signin-learn')).toHaveLength(1);
    expect(clerk.signIn).toHaveLength(0);
  });

  it('keeps the dev form on a build without Clerk; its sign-in counts as secret-proving in this tab', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONSOLE_DEV_AUTH', 'true');
    auth.value = { mode: 'dev', ready: true, session: null, sessionId: null };
    const page = (await render(<SignInPage />)).root;
    const inputs = page.findAll((node) => node.type === 'input');
    await act(async () => {
      inputs.find((i) => i.props.name === 'accountId')?.props.onChange({ target: { value: 'teacher-kim' } });
      inputs.find((i) => i.props.name === 'displayName')?.props.onChange({ target: { value: 'Ms Kim' } });
    });
    await act(async () => {
      page.findByType('form').props.onSubmit({ preventDefault: () => undefined });
    });
    await settle();
    expect(auth.devSignIns).toEqual([{ token: 'teacher-kim', accountId: 'teacher-kim', displayName: 'Ms Kim', email: undefined }]);
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'teacher-kim', secret: true });
    vi.stubEnv('NEXT_PUBLIC_CONSOLE_DEV_AUTH', '');
  });
});

describe('/signin?mode=create: the adult step (OD-13, behaviour 27)', () => {
  it('renders no sign-up form until the affirmation is ticked, then <SignUp> with adultAffirmedAt', async () => {
    nav.params = new URLSearchParams('mode=create&persona=teacher');
    const page = (await render(<SignInPage />)).root;
    expect(text(page)).toContain('Grown-up accounts are for parents, guardians and teachers.');
    expect(text(page)).toContain('I am a parent, guardian or teacher');
    const button = byTestId(page, 'signin-affirm-continue')[0];
    expect(button?.props.disabled).toBe(true);
    expect(clerk.signUp).toHaveLength(0);
    expect(clerk.signIn).toHaveLength(0);

    // Submitting while unticked does nothing.
    await act(async () => page.findByType('form').props.onSubmit({ preventDefault: () => undefined }));
    expect(clerk.signUp).toHaveLength(0);

    await act(async () => byTestId(page, 'signin-affirm')[0]?.props.onChange({ target: { checked: true } }));
    expect(byTestId(page, 'signin-affirm-continue')[0]?.props.disabled).toBe(false);
    expect(byTestId(page, 'signin-affirm')[0]?.props['aria-describedby']).toBeTruthy();
    await act(async () => page.findByType('form').props.onSubmit({ preventDefault: () => undefined }));
    await settle();
    const signUp = clerk.signUp[clerk.signUp.length - 1] ?? {};
    expect((signUp.unsafeMetadata as { adultAffirmedAt: string }).adultAffirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(signUp.fallbackRedirectUrl).toBe('/signin?persona=teacher');
    expect((signUp.appearance as { elements: { footerAction: unknown } }).elements.footerAction).toEqual({ display: 'none' });
  });

  it('keeps the tick for this tab: a Google sign-up back at #/sso-callback (or a reload) renders <SignUp>, not the checkbox', async () => {
    nav.params = new URLSearchParams('mode=create&persona=parent');
    const first = (await render(<SignInPage />)).root;
    await act(async () => byTestId(first, 'signin-affirm')[0]?.props.onChange({ target: { checked: true } }));
    await act(async () => first.findByType('form').props.onSubmit({ preventDefault: () => undefined }));
    await settle();
    const stored = JSON.parse(browser.session.getItem(AFFIRMATION_KEY) ?? 'null') as { v: number; at: string };
    expect(stored.v).toBe(1);
    expect(Object.keys(stored).sort()).toEqual(['at', 'v']);
    act(() => mounted?.unmount());
    clerk.signUp = [];

    // The new page load after Clerk's redirect: the stored tick mounts <SignUp> at once with the same time.
    const again = (await render(<SignInPage />)).root;
    expect(byTestId(again, 'signin-affirm')).toHaveLength(0);
    const signUp = clerk.signUp[clerk.signUp.length - 1] ?? {};
    expect((signUp.unsafeMetadata as { adultAffirmedAt: string }).adultAffirmedAt).toBe(stored.at);
  });

  it('with no stored tick (or a stale one) the checkbox still comes first', async () => {
    nav.params = new URLSearchParams('mode=create');
    browser.session.setItem(AFFIRMATION_KEY, JSON.stringify({ v: 1, at: new Date(Date.now() - 31 * 60_000).toISOString() }));
    const page = (await render(<SignInPage />)).root;
    expect(byTestId(page, 'signin-affirm')).toHaveLength(1);
    expect(clerk.signUp).toHaveLength(0);
  });

  it('Back to sign in leaves mode=create with the hint kept', async () => {
    nav.params = new URLSearchParams('mode=create&as=parent');
    const page = (await render(<SignInPage />)).root;
    await act(async () => byTestId(page, 'signin-create-back')[0]?.props.onClick());
    expect(nav.replaced).toEqual(['/signin?as=parent']);
  });
});

describe('the recorder: what a sign-in completed in this tab proved (section 3.9)', () => {
  const emit = (resources: unknown): void => {
    act(() => {
      for (const listener of [...clerk.listeners]) listener(resources);
    });
  };

  it('a password sign-in seen completing here is a secret proof for its session', async () => {
    await render(<SignInPage />);
    expect(clerk.listeners).toHaveLength(1);
    emit({ session: null, client: { signIn: { status: 'needs_first_factor' } } });
    expect(readSignInRecord()).toBeNull();
    emit({ session: { id: 'sess_1' }, client: { signIn: { status: 'complete', createdSessionId: 'sess_1', firstFactorVerification: { strategy: 'password' } } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_1', secret: true });
  });

  it('a secret factor verified before the session appears proves a secret even when Clerk no longer names the sign-in', async () => {
    await render(<SignInPage />);
    emit({ session: null, client: { signIn: { status: 'needs_first_factor', firstFactorVerification: { strategy: 'email_code', status: 'unverified' } } } });
    expect(readSignInRecord()).toBeNull();
    emit({ session: null, client: { signIn: { status: 'complete', firstFactorVerification: { strategy: 'email_code', status: 'verified' } } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'secret' });
    emit({ session: { id: 'sess_3' }, client: { signIn: { status: null } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_3', secret: true });
  });

  it('a session that appears with no evidence (no hand-off record, no named sign-in) is not secret-proving', async () => {
    await render(<SignInPage />);
    emit({ session: null, client: { signIn: { status: null } } });
    emit({ session: { id: 'sess_4' }, client: { signIn: { status: null } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_4', secret: false });
  });

  it('an email-link sign-in is not secret-proving', async () => {
    await render(<SignInPage />);
    emit({ session: null, client: { signIn: { status: 'needs_first_factor', firstFactorVerification: { strategy: 'email_link', status: 'unverified' } } } });
    emit({ session: { id: 'sess_5' }, client: { signIn: { status: 'complete', createdSessionId: 'sess_5', firstFactorVerification: { strategy: 'email_link', status: 'verified' } } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_5', secret: false });
  });

  it('the adult-step tick is spent once the sign-up signs in', async () => {
    browser.session.setItem(AFFIRMATION_KEY, JSON.stringify({ v: 1, at: new Date().toISOString() }));
    nav.params = new URLSearchParams('mode=create');
    await render(<SignInPage />);
    emit({ session: null, client: { signUp: { status: 'missing_requirements' } } });
    emit({ session: { id: 'sess_6' }, client: { signUp: { status: 'complete', createdSessionId: 'sess_6', verifications: { emailAddress: { strategy: 'email_code', status: 'verified' } } } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_6', secret: true });
    expect(browser.session.getItem(AFFIRMATION_KEY)).toBeNull();
  });

  it('a Google hand-off is noted, and the sign-in it completes is OAuth even when Clerk no longer names it', async () => {
    await render(<SignInPage />);
    emit({ session: null, client: { signIn: { status: 'needs_first_factor', firstFactorVerification: { strategy: 'oauth_google', status: 'unverified', externalVerificationRedirectURL: 'https://accounts.example' } } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'oauth' });
    emit({ session: { id: 'sess_2' }, client: { signIn: { status: null } } });
    expect(readSignInRecord()).toMatchObject({ kind: 'proof', sessionId: 'sess_2', secret: false });
  });

  it('does not listen before the page knows the tab is signed out', async () => {
    auth.value = { mode: 'clerk', ready: false, session: null, sessionId: null };
    await render(<SignInPage />);
    expect(clerk.listeners).toHaveLength(0);
  });
});

/** The router with an injected browser side. */
function routerEnv(over: Partial<RouterEnvironment> = {}): RouterEnvironment & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    now: () => NOW,
    readRecord: () => readSignInRecord(),
    clearRecord: () => {
      log.push('clearRecord');
      browser.session.removeItem(SIGNIN_RECORD_KEY);
    },
    readDevice: async () => {
      log.push('readDevice');
      return stores.device;
    },
    grant: async (device, now) => {
      log.push(`grant:${now}:${device.readable ? (device.marker?.gate ?? 'absent') : 'unreadable'}`);
    },
    readLastPersona: async () => stores.last,
    replace: (url) => log.push(`replace:${url}`),
    assign: (url) => log.push(`assign:${url}`),
    origin: () => ORIGIN,
    clearGrownUpTab: () => log.push('clearGrownUpTab'),
    ...over,
  };
}

const proof = (secret: boolean, sessionId = 'sess_1') => JSON.stringify({ v: 1, kind: 'proof', sessionId, secret, at: NOW - 1_000 });
/** The same record for the pages, whose clock is the real one. */
const proofNow = (secret: boolean) => JSON.stringify({ v: 1, kind: 'proof', sessionId: 'sess_1', secret, at: Date.now() - 1_000 });

describe('the router after sign-in (sections 3.5, 3.7, 3.9)', () => {
  beforeEach(() => {
    auth.value = { mode: 'clerk', ready: true, session: { accountId: 'user_1', displayName: 'Kim' }, sessionId: 'sess_1' };
  });

  it('a signed-in visitor on /signin gets the router: one polite line, then one location.replace (behaviour 3)', async () => {
    api.spaces = { ok: true, data: [CLASS] };
    const page = (await render(<SignInPage />)).root;
    expect(text(page)).toContain('Taking you to your home…');
    expect(page.findAll((n) => n.props.role === 'status' && n.props['aria-live'] === 'polite')).toHaveLength(1);
    expect(browser.replaced).toEqual(['/teach/home']);
    expect(byTestId(page, 'signin-go-now')[0]?.props.href).toBe('/teach/home');
    expect(clerk.signIn).toHaveLength(0);
  });

  it('follows an accepted next, ignores a refused one (behaviour 14)', async () => {
    api.spaces = { ok: true, data: [CLASS] };
    const env = routerEnv();
    await render(<GrownUpRouter next="/teach/space?id=sp_1" hint={null} environment={env} />);
    expect(env.log).toContain('replace:/teach/space?id=sp_1');
    for (const next of ['https://evil.example', '//evil.example', '/']) {
      act(() => mounted?.unmount());
      const other = routerEnv();
      await render(<GrownUpRouter next={next} hint={null} environment={other} />);
      expect(other.log.filter((l) => l.startsWith('replace:'))).toEqual(['replace:/teach/home']);
    }
  });

  it('an account with no space goes to /start with the hint (behaviour 5)', async () => {
    const env = routerEnv();
    await render(<GrownUpRouter next={null} hint="parent" environment={env} />);
    expect(env.log).toContain('replace:/start?persona=parent');
  });

  it('a visitor already signed in (no record) reads no device and writes no unlock', async () => {
    api.spaces = { ok: true, data: [FAMILY, CLASS] };
    stores.last = 'teacher';
    const env = routerEnv();
    await render(<GrownUpRouter next={null} hint={null} environment={env} />);
    expect(env.log).toEqual(['replace:/teach/home']);
  });

  it('a secret-proving sign-in writes the unlock and the trusted epoch before leaving', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proof(true));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    const env = routerEnv();
    await render(<GrownUpRouter next={null} hint={null} environment={env} />);
    expect(env.log).toEqual(['readDevice', `grant:${NOW}:pin`, 'clearRecord', 'replace:/teach/home']);
  });

  it('the real grant writes the signin unlock of this tab and the marker epoch as trusted', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proofNow(true));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    await render(<SignInPage />);
    expect(JSON.parse(browser.session.getItem('hr:grownup:unlock') ?? 'null')).toMatchObject({ v: 1, src: 'signin' });
    expect(stores.epochs).toEqual([1_790_000_000_000]);
    expect(readSignInRecord()).toBeNull();
    expect(browser.replaced).toEqual(['/teach/home']);
  });

  it('OAuth on a locked device: reverification first, the unlock only after it (behaviour 21)', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proof(false));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    let finish: (verified: boolean) => void = () => undefined;
    const env = routerEnv();
    const page = (
      await render(
        <GrownUpRouter
          next={null}
          hint={null}
          environment={env}
          reverify={({ onDone }) => {
            finish = onDone;
            return null;
          }}
        />,
      )
    ).root;
    expect(text(page)).toContain("Confirm it's you");
    expect(text(page)).toContain("This device has learner profiles. Confirm it's you to open grown-up pages.");
    expect(env.log).toEqual(['readDevice']);
    await act(async () => finish(true));
    await settle();
    expect(env.log).toEqual(['readDevice', `grant:${NOW}:pin`, 'clearRecord', 'replace:/teach/home']);
  });

  it('a cancelled reverification leaves the device locked: no unlock, the lock decides at the home', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proofNow(false));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    clerk.reverify = 'cancel';
    await render(<SignInPage />);
    expect(clerk.reverifyAsked).toBe(1);
    expect(browser.session.getItem('hr:grownup:unlock')).toBeNull();
    expect(stores.epochs).toEqual([]);
    expect(browser.replaced).toEqual(['/teach/home']);
  });

  it("Clerk's reverification succeeds: the unlock is written, then the home", async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proofNow(false));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    await render(<SignInPage />);
    expect(clerk.reverifyAsked).toBe(1);
    expect(JSON.parse(browser.session.getItem('hr:grownup:unlock') ?? 'null')).toMatchObject({ src: 'signin' });
    expect(browser.replaced).toEqual(['/teach/home']);
  });

  it('OAuth on a device without a lock asks nothing more', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proof(false));
    stores.device = NONE_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    const env = routerEnv();
    await render(<GrownUpRouter next={null} hint={null} environment={env} />);
    expect(env.log).toEqual(['readDevice', 'clearRecord', 'replace:/teach/home']);
  });

  it('Back to learning on the reverification panel clears the tab and opens the learner app', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proof(false));
    stores.device = PIN_DEVICE;
    const env = routerEnv();
    const page = (await render(<GrownUpRouter next={null} hint={null} environment={env} reverify={() => null} />)).root;
    await act(async () => byTestId(page, 'signin-reverify-back')[0]?.props.onClick());
    expect(env.log.slice(-2)).toEqual(['clearGrownUpTab', 'assign:/?lang=en']);
  });

  it('without a reverification slot (no Clerk) the reverification counts as cancelled', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proof(false));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    const env = routerEnv();
    await render(<GrownUpRouter next={null} hint={null} environment={env} />);
    expect(env.log).toEqual(['readDevice', 'clearRecord', 'replace:/teach/home']);
  });

  it('a failed spaces fetch shows one line and Try again, never a wrong home', async () => {
    api.spaces = { ok: false, error: 'network' };
    const env = routerEnv();
    const page = (await render(<GrownUpRouter next={null} hint={null} environment={env} />)).root;
    expect(text(page)).toContain("Can't reach the console right now.");
    expect(env.log.filter((l) => l.startsWith('replace:'))).toEqual([]);
    api.spaces = { ok: true, data: [CLASS] };
    await act(async () => byTestId(page, 'signin-router-error-retry')[0]?.props.onClick());
    await settle();
    expect(env.log.filter((l) => l.startsWith('replace:'))).toEqual(['replace:/teach/home']);
  });

  it('ClerkReverify opens the dialog once and reports the outcome', async () => {
    const outcomes: boolean[] = [];
    await render(<ClerkReverify onDone={(ok) => outcomes.push(ok)} />);
    expect(clerk.reverifyAsked).toBe(1);
    expect(outcomes).toEqual([true]);
  });
});

describe('/teach: a router page with the hint of persona or as, none otherwise (section 3.7)', () => {
  beforeEach(() => {
    nav.pathname = '/teach';
    auth.value = { mode: 'clerk', ready: true, session: { accountId: 'user_1', displayName: 'Kim' }, sessionId: 'sess_1' };
  });

  it.each([
    ['persona=teacher', '/start?persona=teacher'],
    ['as=parent', '/start?persona=parent'],
    ['persona=nobody', '/start'],
    ['', '/start'],
  ])('?%s goes to %s for an account with no space', async (query, target) => {
    nav.params = new URLSearchParams(query);
    await render(<TeachRouterPage />);
    expect(browser.replaced).toEqual([target]);
  });

  it('a teacher with a hint for Family lands on the Family home, which shows its no-family state (behaviour 24)', async () => {
    nav.params = new URLSearchParams('persona=parent');
    api.spaces = { ok: true, data: [CLASS] };
    await render(<TeachRouterPage />);
    expect(browser.replaced).toEqual(['/parent']);
  });

  it('an OAuth sign-in record that reaches /teach on a locked device runs the same reverification (behaviour 21)', async () => {
    browser.session.setItem(SIGNIN_RECORD_KEY, proofNow(false));
    stores.device = PIN_DEVICE;
    api.spaces = { ok: true, data: [CLASS] };
    await render(<TeachRouterPage />);
    expect(clerk.reverifyAsked).toBe(1);
    expect(JSON.parse(browser.session.getItem('hr:grownup:unlock') ?? 'null')).toMatchObject({ src: 'signin' });
    expect(browser.replaced).toEqual(['/teach/home']);
  });

  it('renders nothing while signed out (the layout sends the visitor to /signin)', async () => {
    auth.value = { mode: 'clerk', ready: true, session: null, sessionId: null };
    const page = (await render(<TeachRouterPage />)).root;
    expect(text(page)).toBe('');
    expect(api.calls).toBe(0);
  });
});

describe('/teach/start: a client redirect to /start with the query kept (sections 3.7, 3.13)', () => {
  it.each([
    ['', '/start'],
    ['?persona=parent&from=home', '/start?persona=parent&from=home'],
  ])('%s', async (search, target) => {
    browser.search = search;
    const page = (await render(<TeachStartRedirect />)).root;
    expect(browser.replaced).toEqual([target]);
    expect(byTestId(page, 'signin-go-now')[0]?.props.href).toBe(target);
  });
});

describe('/teach/billing: a client redirect to /account/billing with the query kept (F-APP-001 A-5c, sections 3.8, 3.13)', () => {
  it.each([
    ['', '/account/billing'],
    ['?checkout=success', '/account/billing?checkout=success'],
    ['?checkout=cancel&space=sp_1', '/account/billing?checkout=cancel&space=sp_1'],
  ])('%s', async (search, target) => {
    browser.search = search;
    const page = (await render(<TeachBillingRedirect />)).root;
    expect(browser.replaced).toEqual([target]);
    expect(byTestId(page, 'signin-go-now')[0]?.props.href).toBe(target);
  });
});

describe('[SA] an administrator invite waiting in this tab (AMENDMENTS-SEATS-ADMINS section 6.6 steps 2 and 3)', () => {
  const TOKEN = 'A'.repeat(20) + 'b_-9' + 'z'.repeat(19);
  const stash = (): void => browser.session.setItem('hr:admin-invite', JSON.stringify({ token: TOKEN, savedAt: Date.now() }));

  it('/signin?next=/account/invite says "Sign in to see this invite." and sends a sign-up to the invite, not /start', async () => {
    stash();
    nav.params = new URLSearchParams(`next=${encodeURIComponent('/account/invite')}`);
    const page = (await render(<SignInPage />)).root;
    expect(text(page)).toContain('Sign in to see this invite.');
    const props = lastSignIn();
    expect(props.signUpFallbackRedirectUrl).toBe('/account/invite');
    expect(props.fallbackRedirectUrl).toBe(`/signin?next=${encodeURIComponent('/account/invite')}`);
    // The token is in no address Clerk is handed.
    expect(JSON.stringify(props)).not.toContain(TOKEN);
  });

  it('a sign-up from the adult step returns through the router to the invite page', async () => {
    stash();
    browser.session.setItem(AFFIRMATION_KEY, JSON.stringify({ v: 1, at: new Date().toISOString() }));
    nav.params = new URLSearchParams(`mode=create&next=${encodeURIComponent('/account/invite')}`);
    await render(<SignInPage />);
    const signUp = clerk.signUp[clerk.signUp.length - 1] ?? {};
    expect(signUp.fallbackRedirectUrl).toBe(`/signin?next=${encodeURIComponent('/account/invite')}`);
    expect(JSON.stringify(signUp)).not.toContain(TOKEN);
  });

  it('without a stash (or an expired one) nothing changes', async () => {
    browser.session.setItem('hr:admin-invite', JSON.stringify({ token: TOKEN, savedAt: Date.now() - 31 * 60_000 }));
    const page = (await render(<SignInPage />)).root;
    expect(text(page)).not.toContain('Sign in to see this invite.');
    expect(lastSignIn().signUpFallbackRedirectUrl).toBe('/start');
  });

  it('Back to learning drops the stash with the rest of the grown-up tab', async () => {
    stash();
    const page = (await render(<SignInPage />)).root;
    await act(async () => byTestId(page, 'signin-back')[0]?.props.onClick());
    expect(browser.session.getItem('hr:admin-invite')).toBeNull();
  });
});
