import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/console/api';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 "Accept page", steps 1 to 8 (row SA-4; wireframe console/admin-invite-accept,
 * mock admin-invite-accept.html): `GrownUpGate` stashes the token from `/account/invite#t=…` before its sign-in
 * redirect, the lock's Sign in again keeps the stash, `/start` forwards to the invite while it lives, and the page
 * shows the preview, the accept and one calm line per refusal. The token is in no rendered link, title or address.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined, ready: true });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined, LocaleProvider: ({ children }: { children: ReactNode }) => children };
});

const nav = vi.hoisted(() => ({ pathname: '/account/invite', replaced: [] as string[] }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: (url: string) => {
      nav.replaced.push(url);
      order.push(url);
    },
    push: (url: string) => nav.replaced.push(url),
  }),
}));
const order: string[] = [];

const auth = vi.hoisted(() => ({
  ready: true,
  session: null as null | { accountId: string; displayName: string; email?: string },
  signOuts: [] as Array<{ url?: string; options?: { keepInvite?: boolean } }>,
}));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    mode: 'dev',
    ready: auth.ready,
    session: auth.session,
    sessionId: auth.session?.accountId ?? null,
    getToken: async () => 'token',
    signOut: async (url?: string, options?: { keepInvite?: boolean }) => {
      auth.signOuts.push({ url, options });
    },
  }),
  AccountLocaleSlot: () => null,
  ConsoleAuthProvider: ({ children }: { children: ReactNode }) => children,
}));

// The lock has its own tests: here it records the Sign in again the gate hands it and draws the page.
const lock = vi.hoisted(() => ({ onSignInAgain: null as null | ((url: string) => void) }));
vi.mock('@/components/console/GrownUpLock', () => ({
  GrownUpLock: ({ children, onSignInAgain }: { children: ReactNode; onSignInAgain: (url: string) => void }) => {
    lock.onSignInAgain = onSignInAgain;
    return <>{children}</>;
  },
}));

vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const calls = vi.hoisted(() => ({ preview: [] as string[], accept: [] as string[] }));
const answers = vi.hoisted(() => ({ preview: [] as Array<ApiResult<unknown>>, accept: [] as Array<ApiResult<unknown>> }));
const api = {
  previewAdminInvite: async (token: string) => {
    calls.preview.push(token);
    return answers.preview.shift() ?? { ok: false, error: 'network', status: -1 };
  },
  acceptAdminInvite: async (token: string) => {
    calls.accept.push(token);
    return answers.accept.shift() ?? { ok: false, error: 'network', status: -1 };
  },
};
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: auth.ready, session: auth.session, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }) };
});

import { GrownUpGate } from '@/components/console/GrownUpLayout';
import AdminInvitePage from '@/app/(console)/account/invite/page';
import StartPage from '@/app/(console)/start/page';
import { clearGrownUpTab } from '@/lib/console/unlock';

const m = getMessages('en');
const t = m.console.adminInvite;
const TOKEN = 'A'.repeat(20) + 'b_-9' + 'z'.repeat(19);
const OPEN = { ok: true as const, data: { state: 'open', school: { name: 'Maple School' }, invitedBy: 'Ms Park', expiresAt: '2026-10-27T15:00:00.000Z' } };
const fail = (status: number, code?: string): ApiResult<never> => ({ ok: false, error: 'unknown', status, ...(code ? { code } : {}) });

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
const browser = { session: new Store(), local: new Store(), location: { pathname: '/account/invite', search: '', hash: '' }, replaced: [] as Array<{ state: unknown; url: string }>, timers: [] as Array<() => void> };
const doc = { title: '' };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  browser.session = new Store();
  browser.local = new Store();
  browser.location = { pathname: '/account/invite', search: '', hash: '' };
  browser.replaced = [];
  browser.timers = [];
  doc.title = '';
  vi.stubGlobal('window', {
    get sessionStorage() {
      return browser.session;
    },
    get localStorage() {
      return browser.local;
    },
    get location() {
      return browser.location;
    },
    history: {
      state: null,
      replaceState: (state: unknown, _t: string, url: string) => {
        browser.replaced.push({ state, url });
        order.push('strip');
        browser.location = { ...browser.location, hash: '' };
      },
    },
    setTimeout: (run: () => void) => {
      browser.timers.push(run);
      return browser.timers.length;
    },
    clearTimeout: () => undefined,
  });
  vi.stubGlobal('document', doc);
  nav.pathname = '/account/invite';
  nav.replaced = [];
  order.length = 0;
  auth.ready = true;
  auth.session = null;
  auth.signOuts = [];
  lock.onSignInAgain = null;
  calls.preview = [];
  calls.accept = [];
  answers.preview = [];
  answers.accept = [];
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

async function render(node: JSX.Element): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(node, { createNodeMock: () => ({ focus: () => undefined }) });
  });
  for (let i = 0; i < 4; i += 1) await act(async () => Promise.resolve());
  return (mounted as unknown as ReactTestRenderer).root;
}
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.type === 'style' ? '' : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const press = async (root: ReactTestInstance, id: string): Promise<void> => {
  const [button] = byTestId(root, id);
  expect(button, id).toBeTruthy();
  await act(async () => (button as ReactTestInstance).props.onClick());
  for (let i = 0; i < 4; i += 1) await act(async () => Promise.resolve());
};
const stashed = (): string | null => browser.session.getItem('hr:admin-invite');
const stash = (): void => browser.session.setItem('hr:admin-invite', JSON.stringify({ token: TOKEN, savedAt: Date.now() }));
const signIn = (): void => {
  auth.session = { accountId: 'jin', displayName: 'Jin Cho', email: 'jin.cho@example.org' };
};
/** Everything a person or a log could read: the rendered text, every link and label, the tab title and every address. */
const everywhere = (root: ReactTestInstance): string =>
  [textOf(root), ...root.findAll((n) => typeof n.type === 'string').flatMap((n) => [n.props.href, n.props['aria-label']].filter((v): v is string => typeof v === 'string')), doc.title, ...nav.replaced, ...browser.replaced.map((r) => r.url), ...auth.signOuts.map((s) => s.url ?? '')].join('\n');

describe('step 1: GrownUpGate captures the invite before anything else', () => {
  it('signed out: the token is stashed, the redirect is /signin?next=/account/invite with no token, then the fragment goes', async () => {
    browser.location = { pathname: '/account/invite', search: '', hash: `#t=${TOKEN}` };
    const root = await render(
      <GrownUpGate>
        <p data-testid="child">page</p>
      </GrownUpGate>,
    );
    expect(JSON.parse(stashed() ?? '{}').token).toBe(TOKEN);
    expect(nav.replaced).toEqual([`/signin?next=${encodeURIComponent('/account/invite')}`]);
    expect(byTestId(root, 'child')).toHaveLength(0);
    // The fragment left the address through the router's patch (state without __NA), before the redirect was sent.
    expect(browser.replaced).toEqual([{ state: null, url: '/account/invite' }]);
    expect(order).toEqual(['strip', `/signin?next=${encodeURIComponent('/account/invite')}`]);
    expect(everywhere(root)).not.toContain(TOKEN);
  });

  it('another page with a fragment is never touched', async () => {
    nav.pathname = '/join';
    browser.location = { pathname: '/join', search: '', hash: `#t=${TOKEN}` };
    await render(<GrownUpGate>{null}</GrownUpGate>);
    expect(stashed()).toBeNull();
    expect(browser.replaced).toEqual([]);
  });

  it("locked device: the lock's Sign in again signs out keeping the stash, back to /account/invite", async () => {
    signIn();
    browser.location = { pathname: '/account/invite', search: '', hash: `#t=${TOKEN}` };
    await render(<GrownUpGate>{null}</GrownUpGate>);
    expect(stashed()).not.toBeNull();
    act(() => lock.onSignInAgain?.(`/signin?next=${encodeURIComponent('/account/invite')}`));
    expect(auth.signOuts).toEqual([{ url: `/signin?next=${encodeURIComponent('/account/invite')}`, options: { keepInvite: true } }]);
  });
});

describe('step 3: /start sends a signed-in grown-up with a live stash to the invite', () => {
  it('forwards while a stash lives, shows the role cards otherwise', async () => {
    signIn();
    nav.pathname = '/start';
    stash();
    await render(<StartPage />);
    expect(nav.replaced).toEqual(['/account/invite']);
    act(() => mounted?.unmount());
    mounted = null;
    nav.replaced = [];
    browser.session = new Store();
    const root = await render(<StartPage />);
    expect(nav.replaced).toEqual([]);
    expect(textOf(root)).toContain(m.console.start.roleTitle);
  });
});

describe('the invite page', () => {
  it('no stash (a new tab, after 30 minutes, another browser): reopen and Go to my home', async () => {
    signIn();
    const root = await render(<AdminInvitePage />);
    expect(textOf(byTestId(root, 'invite-reopen')[0] as ReactTestInstance)).toBe(t.reopen);
    expect(calls.preview).toEqual([]);
    expect(doc.title).toBe(t.pageTitle);
    await press(root, 'invite-home');
    expect(nav.replaced).toEqual(['/teach']);
  });

  it('after a sign-out from the frame, the next sign-in in this tab sees reopen, not the invite', async () => {
    stash();
    clearGrownUpTab();
    signIn();
    const root = await render(<AdminInvitePage />);
    expect(byTestId(root, 'invite-reopen')).toHaveLength(1);
    expect(calls.preview).toEqual([]);
  });

  it('preview: the school, who invited, whose account, what the role can and cannot do, Accept and Not now', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    const root = await render(<AdminInvitePage />);
    expect(calls.preview).toEqual([TOKEN]);
    expect(textOf(byTestId(root, 'invite-title')[0] as ReactTestInstance)).toBe('Join Maple School as an administrator?');
    expect(textOf(byTestId(root, 'invite-by')[0] as ReactTestInstance)).toBe('Invited by Ms Park');
    expect(textOf(byTestId(root, 'invite-signed-in')[0] as ReactTestInstance)).toContain('Signed in as jin.cho@example.org');
    const consent = textOf(byTestId(root, 'invite-consent')[0] as ReactTestInstance);
    expect(consent).toContain(t.can);
    expect(consent).toContain(t.cannot);
    expect(consent).toContain(t.leave);
    expect(byTestId(root, 'invite-accept')).toHaveLength(1);
    expect(byTestId(root, 'invite-not-now')).toHaveLength(1);
    // The tab title never holds the school's name.
    expect(doc.title).toBe(t.pageTitle);
    expect(everywhere(root)).not.toContain(TOKEN);
  });

  it("an owner without a display name reads as the school's owner; an account without an email shows its name", async () => {
    auth.session = { accountId: 'jin', displayName: 'Jin Cho' };
    stash();
    answers.preview.push({ ok: true, data: { ...OPEN.data, invitedBy: null } });
    const root = await render(<AdminInvitePage />);
    expect(textOf(byTestId(root, 'invite-by')[0] as ReactTestInstance)).toBe(t.invitedByOwner);
    expect(textOf(byTestId(root, 'invite-signed-in')[0] as ReactTestInstance)).toContain('Signed in as Jin Cho');
  });

  it('Accept: the school page, the done notice from the flash, the stash gone, no name in the address', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    answers.accept.push({ ok: true, data: { space: { id: 'space:maple', kind: 'school', name: 'Maple School' }, role: 'admin' } });
    const root = await render(<AdminInvitePage />);
    await press(root, 'invite-accept');
    expect(calls.accept).toEqual([TOKEN]);
    expect(nav.replaced).toEqual([`/teach/space?id=${encodeURIComponent('space:maple')}`]);
    expect(JSON.parse(browser.session.getItem('hr:console-flash') ?? '{}')).toEqual({ kind: 'adminJoined', school: 'Maple School' });
    expect(stashed()).toBeNull();
    expect(nav.replaced.join()).not.toContain('Maple');
  });

  it('Use another account signs out keeping the stash, back through /signin?next=/account/invite', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    const root = await render(<AdminInvitePage />);
    await press(root, 'invite-switch');
    expect(auth.signOuts).toEqual([{ url: `/signin?next=${encodeURIComponent('/account/invite')}`, options: { keepInvite: true } }]);
    expect(stashed()).not.toBeNull();
  });

  it('Not now: the stash goes, then the router home', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    const root = await render(<AdminInvitePage />);
    await press(root, 'invite-not-now');
    expect(stashed()).toBeNull();
    expect(nav.replaced).toEqual(['/teach']);
  });

  it.each([
    [fail(410, 'invite_used'), t.used],
    [fail(410, 'invite_expired'), t.expired],
    [fail(410, 'invite_revoked'), t.revoked],
    [fail(409, 'admins_full'), 'This school already has 2 administrators.'],
    [fail(409, 'already_owner'), t.owner],
    [fail(404, 'invite_not_found'), t.notFound],
    [{ ok: true, data: { state: 'already_admin', school: { name: 'Maple School' } } }, "You're already an administrator of Maple School."],
  ] as Array<[ApiResult<unknown>, string]>)('a refusal at preview is one calm line with Go to my home: %#', async (answer, line) => {
    signIn();
    stash();
    answers.preview.push(answer);
    const root = await render(<AdminInvitePage />);
    expect(textOf(byTestId(root, 'invite-refused')[0] as ReactTestInstance)).toBe(line);
    expect(textOf(byTestId(root, 'invite-title')[0] as ReactTestInstance)).toBe(t.pageTitle);
    expect(byTestId(root, 'invite-try-again')).toHaveLength(0);
    await press(root, 'invite-home');
    expect(stashed()).toBeNull();
  });

  it('a refusal at accept replaces the preview: email not verified', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    answers.accept.push(fail(403, 'email_unverified'));
    const root = await render(<AdminInvitePage />);
    await press(root, 'invite-accept');
    expect(textOf(byTestId(root, 'invite-refused')[0] as ReactTestInstance)).toBe(t.emailUnverified);
    expect(byTestId(root, 'invite-accept')).toHaveLength(0);
  });

  it('429: slow down with Try again (the stash kept); Go to my home still drops the stash', async () => {
    signIn();
    stash();
    answers.preview.push(fail(429, 'too_many_attempts'), OPEN);
    const root = await render(<AdminInvitePage />);
    expect(textOf(byTestId(root, 'invite-retry')[0] as ReactTestInstance)).toBe(m.caregiver.retry.tooManyAttempts);
    await press(root, 'invite-try-again');
    expect(calls.preview).toEqual([TOKEN, TOKEN]);
    expect(byTestId(root, 'invite-accept')).toHaveLength(1);
    act(() => mounted?.unmount());
    mounted = null;
    answers.preview.push(fail(429, 'too_many_attempts'));
    const again = await render(<AdminInvitePage />);
    await press(again, 'invite-home');
    expect(stashed()).toBeNull();
    expect(nav.replaced).toEqual(['/teach']);
  });

  it('a network failure or a 503 at accept: cantReach, Try again runs the accept again, Go to my home drops the stash', async () => {
    signIn();
    stash();
    answers.preview.push(OPEN);
    answers.accept.push(fail(503, 'identity_not_configured'), { ok: true, data: { space: { id: 'space:maple', kind: 'school', name: 'Maple School' }, role: 'admin' } });
    const root = await render(<AdminInvitePage />);
    await press(root, 'invite-accept');
    expect(textOf(byTestId(root, 'invite-retry')[0] as ReactTestInstance)).toBe(m.console.cantReach);
    await press(root, 'invite-try-again');
    expect(calls.accept).toEqual([TOKEN, TOKEN]);
    expect(nav.replaced).toEqual([`/teach/space?id=${encodeURIComponent('space:maple')}`]);
    act(() => mounted?.unmount());
    mounted = null;
    nav.replaced = [];
    stash();
    answers.preview.push(fail(-1));
    const again = await render(<AdminInvitePage />);
    expect(textOf(byTestId(again, 'invite-retry')[0] as ReactTestInstance)).toBe(m.console.cantReach);
    await press(again, 'invite-home');
    expect(stashed()).toBeNull();
  });
});
