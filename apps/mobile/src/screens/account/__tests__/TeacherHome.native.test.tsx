import { ConfirmSheet, ScreenHeaderSlotContext, type ConfirmSheetProps, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY, TRUST_RECORD_KEY } from '../../../logic/account/sign-in-records';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountHostContext, type AccountHost } from '../account-host';
import { TeacherHome } from '../TeacherHome.native';

/**
 * F-AUTH-004 sections 6.6, 8.1, 8.3, 8.4, 8.6, 8.8 and 15 (row NS-6; design `homes.md` boards 8 to 11 and 15 to 18, D13,
 * D18; anti-shame), in the `native` project: the Teacher home and its School use over the real account client (the
 * Worker answered by a stand-in fetch): classes grouped and in their fixed order whatever the server sent, the attention
 * line as plain text, the school row's link by role (a teacher member's row is plain text), the School focus, the stale
 * record's `noSchool`, `noClass`, the re-trust notice once, every state of 8.8, Sign out, `auth.native.home` once; and
 * the deny list of section 9.2 over every state in en, es and ko on iOS and Android.
 */

const env = vi.hoisted(() => ({
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  tracked: [] as { name: string; payload: unknown }[],
  notice: false,
  removed: [] as string[],
  uses: [] as unknown[],
  focused: [] as unknown[],
  fetches: [] as { method: string; path: string }[],
  answer: (() => ({ status: 500, body: {} })) as (method: string, path: string) => { status: number; body: unknown } | 'offline',
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'token-1' }) }));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => ({ state: 'pin', epoch: 7 }) }));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => ({ kind: 'trust', trust: { v: 1, epoch: 7 } }),
  readRetrustNotice: async () => env.notice,
  removeRecord: async (key: string) => void env.removed.push(key),
  writeDeviceUses: async (record: unknown) => void env.uses.push(record),
}));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('../../../platform/telemetry', () => ({ track: async (event: { name: string; payload: unknown }) => void env.tracked.push(event) }));
vi.mock('../../../platform/pwa', () => ({ copyText: async () => true }));
vi.mock('../../../store/grown-up-session', () => ({ closeGrownUpSession: () => undefined }));
vi.mock('../../../store/profile-store', () => ({ useProfileStore: { getState: () => ({ profiles: [{ id: 'p1' }] }) } }));
vi.mock('../../../store/who-chooser', () => ({ deviceShared: () => false, holdJoin: () => undefined }));
vi.mock('../../../platform/screen-reader', () => ({ focusForScreenReader: (node: { testID?: unknown } | null) => void env.focused.push(node === null ? null : { testID: node.testID }) }));

const en = getMessages('en');
const m = en.caregiver.account;
const NOW = '2026-11-08T12:00:00.000Z';

// ---- The Worker, as the fixture's account sees it (design README "Fixture") ----

const item = (id: string, kind: string, name: string, role: string, over: { createdAt?: string; archivedAt?: string | null; learners?: number; attention?: unknown } = {}): Record<string, unknown> => ({
  space: { id, kind, name, createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z', archivedAt: over.archivedAt ?? null, settings: {}, parentSpaceId: null },
  role,
  counts: { learners: over.learners ?? 0, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
  ...(over.attention === undefined ? {} : { attention: over.attention }),
});

/** The server's order: newest first. */
const SPACES = {
  spaces: [
    item('space:lakeside', 'school', 'Lakeside Korean School', 'teacher', { createdAt: '2026-07-01T00:00:00.000Z', attention: { relinks: 0, moves: 0, relinkExpiresAt: null } }),
    item('space:sunflower', 'class', 'Sunflower class', 'teacher', { createdAt: '2026-05-01T00:00:00.000Z', learners: 18, attention: { relinks: 0, moves: 0, relinkExpiresAt: null } }),
    item('space:saturday', 'class', 'Saturday class 3B', 'owner', { createdAt: '2026-04-01T00:00:00.000Z', learners: 24, attention: { relinks: 1, moves: 1, relinkExpiresAt: '2026-11-09T00:00:00.000Z' } }),
    item('space:maple', 'school', 'Maple Heritage School', 'admin', { createdAt: '2026-02-01T00:00:00.000Z' }),
    item('space:kim', 'family', 'Kim family', 'owner'),
    item('space:spring', 'class', 'Spring 2026 class', 'owner', { createdAt: '2025-03-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z', learners: 14, attention: { relinks: 3, moves: 0, relinkExpiresAt: null } }),
  ],
};

function standardAnswer(method: string, path: string): { status: number; body: unknown } | 'offline' {
  if (method === 'GET' && path === '/api/spaces') return { status: 200, body: { data: SPACES } };
  return { status: 404, body: { error: { code: 'not_found' } } };
}
const spacesAnswer =
  (spaces: unknown[]): typeof env.answer =>
  (method, path) =>
    path === '/api/spaces' ? { status: 200, body: { data: { spaces } } } : standardAnswer(method, path);

// ---- The harness ----

interface Nav {
  dispatch: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  root: { navigate: ReturnType<typeof vi.fn>; goBack: ReturnType<typeof vi.fn> };
  getState: () => { routes: { key: string; name: string }[] };
  getParent: () => Nav['root'];
}
let nav: Nav;
let host: AccountHost & { endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn> };

function makeNav(routes: string[]): Nav {
  const root = { navigate: vi.fn(), goBack: vi.fn() };
  return { dispatch: vi.fn(), navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn(), root, getState: () => ({ routes: routes.map((name, k) => ({ key: `r${k}`, name })) }), getParent: () => root };
}

function HeaderTitle({ options }: ScreenHeaderSlotProps): ReactElement {
  return createElement('header-title', null, options?.title ?? null);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

async function mountHome(o: { use?: 'teacher' | 'school'; routes?: string[] } = {}): Promise<ReactTestRenderer> {
  const routes = o.routes ?? ['ParentDashboard', 'AccountHome'];
  nav = makeNav(routes);
  host = { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = await render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        ScreenHeaderSlotContext.Provider,
        { value: HeaderTitle },
        createElement(AccountHostContext.Provider, { value: host }, createElement(TeacherHome, { use: o.use ?? 'teacher', navigation: nav as never, routeKey: `r${routes.length - 1}` })),
      ),
    ),
    // A host node's ref names it, so the School focus can be told apart.
    {
      createNodeMock: (element) => ({
        testID: (element.props as Record<string, unknown>)['data-testid'] ?? (element.props as Record<string, unknown>).testID,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    },
  );
  await settle();
  return r;
}

const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
const textsOf = (root: ReactTestInstance, id: string): string[] => [...new Set(screenTexts(byTestId(root, id)[0]!))];
const rowIds = (root: ReactTestInstance, re: RegExp): string[] => hostNodes(root, (n) => typeof n.props['data-testid'] === 'string' && re.test(n.props['data-testid'] as string)).map((n) => n.props['data-testid'] as string);
const homes = (): unknown[] => env.tracked.filter((e) => e.name === 'auth.native.home').map((e) => e.payload);

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  Object.assign(env, { online: true, onlineListener: null, tracked: [], notice: false, removed: [], uses: [], focused: [], fetches: [], answer: standardAnswer });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    env.fetches.push({ method: String(init.method), path: parsed.pathname });
    const answer = env.answer(String(init.method), parsed.pathname);
    if (answer === 'offline') throw new TypeError('Network request failed');
    return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetPlatform();
});

describe('the Teacher home (section 8.3, board 8)', () => {
  it('titled Teacher; reads the spaces list only (no roster or plan read)', async () => {
    const r = await mountHome();
    expect(screenTexts(r.root)).toContain(en.learner.who.use.teacher);
    expect(env.fetches).toEqual([{ method: 'GET', path: '/api/spaces' }]);
  });

  it('class grouping: Classes, live first then archived, each oldest first; never a family', async () => {
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-classes')).toContain(en.console.kind.group.class);
    expect(rowIds(r.root, /^account-class-space:[a-z]+$/)).toEqual(['account-class-space:saturday', 'account-class-space:sunflower', 'account-class-space:spring']);
    expect(has(r.root, 'account-class-space:kim')).toBe(false);
    expect(textsOf(r.root, 'account-class-space:spring')).toEqual(expect.arrayContaining(['Spring 2026 class', en.console.spaceCounts.students(14)]));
    expect(screenTexts(byTestId(r.root, 'account-class-space:spring')[0]!).join(' ')).toContain(en.console.home.archived);
  });

  it('a class row: the name, the count from the list, the attention line as plain text; Class report its own button', async () => {
    const r = await mountHome();
    const saturday = textsOf(r.root, 'account-class-space:saturday');
    expect(saturday).toEqual(expect.arrayContaining(['Saturday class 3B', en.console.spaceCounts.students(24), en.console.home.attention(2), en.console.home.classReport]));
    // The attention line is part of the row's name, never a control of its own.
    expect(byTestId(r.root, 'account-class-space:saturday-open')[0]!.props['aria-label']).toBe(`Saturday class 3B, ${en.console.spaceCounts.students(24)}, ${en.console.home.attention(2)}`);
    // No count waits: no line; an archived class never shows one.
    expect(textsOf(r.root, 'account-class-space:sunflower').some((t) => t.includes('OK'))).toBe(false);
    expect(textsOf(r.root, 'account-class-space:spring').some((t) => t.includes('OK'))).toBe(false);
    expect(hostNodes(r.root, (n) => n.props.href !== undefined)).toEqual([]);
  });

  it('the row opens the class page, Class report the class report on the week (ids in memory only)', async () => {
    const r = await mountHome();
    await tap(r.root, 'account-class-space:saturday-open');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    await tap(r.root, 'account-class-space:saturday-report');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
  });

  it('school row link by role: an admin opens the school page; a teacher member has plain text, no link', async () => {
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-schools')).toContain(en.console.kind.group.school);
    expect(rowIds(r.root, /^account-school-space:[a-z]+$/)).toEqual(['account-school-space:maple', 'account-school-space:lakeside']);
    await tap(r.root, 'account-school-space:maple-open');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountSchool', { spaceId: 'space:maple', use: 'teacher' });
    expect(has(r.root, 'account-school-space:lakeside-open')).toBe(false);
    expect(has(r.root, 'account-school-space:lakeside-plain')).toBe(true);
    expect(hostNodes(byTestId(r.root, 'account-school-space:lakeside')[0]!, (n) => n.props.role === 'button' || n.props.accessibilityRole === 'button')).toEqual([]);
  });

  it('the end: the quiet line, then Sign out; no focus moved on the Teacher use', async () => {
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-end')).toEqual(expect.arrayContaining([m.home.moreTools, en.console.shell.signOut.cta]));
    expect(env.focused).toEqual([]);
  });

  it('auth.native.home once, with the bucket of the classes and schools listed', async () => {
    await mountHome();
    expect(homes()).toEqual([{ os: 'ios', use: 'teacher', spaces: '5+' }]);
  });

  it('section 8.1: a successful spaces read rewrites the uses record (no names, no ids)', async () => {
    await mountHome();
    expect(env.uses).toHaveLength(1);
    expect(JSON.stringify(env.uses[0])).not.toMatch(/space:|Maple|Saturday/);
  });
});

describe('the School use (section 8.4, boards 9 and 10)', () => {
  it('the Teacher home titled School, with the screen reader focus on the first school row, once', async () => {
    const r = await mountHome({ use: 'school' });
    expect(screenTexts(r.root)).toContain(en.learner.who.use.school);
    expect(rowIds(r.root, /^account-class-space:[a-z]+$/)).toHaveLength(3);
    expect(env.focused).toEqual([{ testID: 'account-school-space:maple-open' }]);
    expect(homes()).toEqual([{ os: 'ios', use: 'school', spaces: '5+' }]);
  });

  it('a teacher member only (the School use came from an admin role it no longer holds): noSchool, its row plain, no focus', async () => {
    env.answer = spacesAnswer([item('space:lakeside', 'school', 'Lakeside Korean School', 'teacher')]);
    const r = await mountHome({ use: 'school' });
    expect(textsOf(r.root, 'account-home-no-school')).toEqual([m.home.noSchool]);
    expect(has(r.root, 'account-school-space:lakeside-plain')).toBe(true);
    expect(env.focused).toEqual([]);
  });

  it('a stale record (no school any more): noSchool above the Teacher home, no focus', async () => {
    env.answer = spacesAnswer(SPACES.spaces.filter((s) => (s.space as { kind: string }).kind !== 'school'));
    const r = await mountHome({ use: 'school' });
    expect(textsOf(r.root, 'account-home-no-school')).toEqual([m.home.noSchool]);
    expect(rowIds(r.root, /^account-class-space:[a-z]+$/)).toHaveLength(3);
    expect(env.focused).toEqual([]);
  });

  it('noSchool is the School use only', async () => {
    env.answer = spacesAnswer(SPACES.spaces.filter((s) => (s.space as { kind: string }).kind !== 'school'));
    const r = await mountHome();
    expect(has(r.root, 'account-home-no-school')).toBe(false);
  });
});

describe('no class and no school (board 11)', () => {
  it('noClass, then the end; no set-up button', async () => {
    env.answer = spacesAnswer([item('space:kim', 'family', 'Kim family', 'owner')]);
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-no-class')).toEqual([m.home.noClass]);
    expect(has(r.root, 'account-home-classes')).toBe(false);
    expect(has(r.root, 'account-home-schools')).toBe(false);
    expect(has(r.root, 'account-home-end')).toBe(true);
    expect(homes()).toEqual([{ os: 'ios', use: 'teacher', spaces: '0' }]);
  });
});

describe('the re-trust notice (section 8.2): once, at the top, no button', () => {
  it('shown, then deleted', async () => {
    env.notice = true;
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-retrust')).toEqual([m.home.retrustNotice]);
    expect(env.removed).toContain(RETRUST_NOTICE_KEY);
  });
});

describe('section 8.8: states', () => {
  it('loading: the skeleton, the header title real', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const r = await mountHome();
    expect(has(r.root, 'account-home-loading')).toBe(true);
    expect(screenTexts(r.root)).toEqual([en.learner.who.use.teacher]);
  });

  it('offline: the offline line with Try again; reloads by itself when the network returns', async () => {
    env.online = false;
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-offline')).toEqual(expect.arrayContaining([m.home.offline, en.common.buttons.tryAgain]));
    env.online = true;
    await act(async () => env.onlineListener?.(true));
    await settle();
    expect(has(r.root, 'account-home-classes')).toBe(true);
  });

  it('an error while online: cantLoad with Try again, which reads again', async () => {
    env.answer = (method, path) => (path === '/api/spaces' ? { status: 500, body: { error: { code: 'x' } } } : standardAnswer(method, path));
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-cant_load')).toEqual(expect.arrayContaining([m.home.cantLoad]));
    env.answer = standardAnswer;
    await tap(r.root, 'account-home-state-try-again');
    expect(has(r.root, 'account-home-classes')).toBe(true);
  });

  it('401: the records go, Clerk signs out, the sign-in opens for the use; no sign-out event', async () => {
    env.answer = () => ({ status: 401, body: { error: { code: 'unauthorized' } } });
    await mountHome({ use: 'school' });
    expect(env.removed).toEqual(expect.arrayContaining([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY]));
    expect(host.endSession).toHaveBeenCalled();
    const builder = nav.dispatch.mock.calls[0]![0] as (state: unknown) => { payload: { routes: { name: string; params?: unknown }[] } };
    const routes = builder({ key: 'stack', index: 1, routes: nav.getState().routes, routeNames: [], type: 'stack', stale: false }).payload.routes.map(({ name, params }) => ({ name, params }));
    expect(routes).toEqual([{ name: 'ParentDashboard', params: undefined }, { name: 'SignIn', params: { use: 'school' } }]);
    expect(env.tracked.filter((e) => e.name === 'auth.native.signout')).toEqual([]);
  });

  it('403 native_off: unavailable with Back only (no quiet line, no Sign out)', async () => {
    env.answer = () => ({ status: 403, body: { error: { code: 'native_off' } } });
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-unavailable')).toEqual(expect.arrayContaining([m.home.unavailable, en.common.buttons.back]));
    expect(has(r.root, 'account-home-end')).toBe(false);
    await tap(r.root, 'account-home-state-back');
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe('Sign out (section 6.6)', () => {
  it('the sheet, then back to the Grown-up area under the home', async () => {
    const r = await mountHome();
    await tap(r.root, 'account-home-sign-out');
    const sheet = r.root.findByType(ConfirmSheet).props as ConfirmSheetProps;
    expect(sheet.visible).toBe(true);
    await act(async () => sheet.onConfirm());
    await settle();
    expect(host.endSession).toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('ParentDashboard');
    expect(env.tracked.filter((e) => e.name === 'auth.native.signout').map((e) => e.payload)).toEqual([{ os: 'ios', via: 'user' }]);
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  type Setup = { answer?: typeof env.answer; online?: boolean; notice?: boolean; use?: 'teacher' | 'school'; act?: (root: ReactTestInstance) => Promise<void>; pending?: boolean };
  const STATES: Record<string, Setup> = {
    ready: { notice: true },
    school: { use: 'school' },
    noSchool: { use: 'school', answer: spacesAnswer(SPACES.spaces.filter((s) => (s.space as { kind: string }).kind !== 'school')) },
    noClass: { answer: spacesAnswer([]) },
    signOutSheet: { act: async (root) => tap(root, 'account-home-sign-out') },
    loading: { pending: true },
    offline: { online: false },
    cantLoad: { answer: () => ({ status: 500, body: { error: { code: 'x' } } }) },
    unavailable: { answer: () => ({ status: 403, body: { error: { code: 'native_off' } } }) },
  };

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every state, every language`, async () => {
      const realFetch = globalThis.fetch;
      const openURL = vi.spyOn(Linking, 'openURL').mockImplementation((async () => undefined) as never);
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, s] of Object.entries(STATES)) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          Object.assign(env, { online: s.online ?? true, notice: s.notice ?? false, answer: s.answer ?? standardAnswer });
          if (s.pending === true) vi.stubGlobal('fetch', () => new Promise(() => undefined));
          const r = await mountHome({ use: s.use });
          if (s.act) await s.act(r.root);
          const sheet = r.root.findAllByType(ConfirmSheet).map((n) => n.props as ConfirmSheetProps).filter((p) => p.visible);
          const labels = hostNodes(r.root, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
          const texts = [...screenTexts(r.root), ...labels, ...sheet.flatMap((p) => [p.title, p.cancelLabel, p.confirmLabel])];
          // The fixture's names are typed by grown-ups (section 9.2: not checked); the app's words around them are.
          const own = texts.map((t) => t.replace(/Lakeside Korean School|Maple Heritage School|Saturday class 3B|Sunflower class|Spring 2026 class|Kim family/g, 'NAME'));
          const hits = own.flatMap((t) => accountDenyHits(t, locale).map((h) => `${platform} ${locale} ${name}: "${t}" has ${h}`));
          expect(hits).toEqual([]);
          expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
          await unmount(r);
          if (s.pending === true) vi.stubGlobal('fetch', realFetch);
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
