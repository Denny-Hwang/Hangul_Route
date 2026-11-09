import { ConfirmSheet, ScreenHeaderSlotContext, type ConfirmSheetProps, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { codeGroups } from '../../../logic/account/homes';
import { DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY, TRUST_RECORD_KEY } from '../../../logic/account/sign-in-records';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountHostContext, type AccountHost } from '../account-host';
import { FamilyHome } from '../FamilyHome.native';
import { COPIED_MS } from '../home-parts.native';

/**
 * F-AUTH-004 sections 6.6, 8.1, 8.2, 8.5, 8.6, 8.8 and 15 (row NS-5; design `homes.md` boards 1 to 7 and 15 to 19,
 * `plan-block.html`, D9 to D11, D18; CS-N5, CS-N8; anti-shame), in the `native` project: the Family home over the real
 * account client (the Worker answered by a stand-in fetch): families and learners in their fixed order whatever the
 * server sent, the code panel's role rules, Copy, Make a code, Join on this device (the code held, the chooser with
 * `join`), the plan block for every coverage row of 8.5, the re-trust notice once, every state of 8.8 (loading,
 * offline and its reload, an error, `401`, `native_off`, one family refused), Sign out and where it lands,
 * `auth.native.home` once; and the deny list of section 9.2 over every state in en, es and ko on iOS and Android.
 */

const env = vi.hoisted(() => ({
  gate: { state: 'pin', epoch: 7 } as { state: string; epoch?: number },
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  tracked: [] as { name: string; payload: unknown }[],
  notice: false,
  removed: [] as string[],
  uses: [] as unknown[],
  copyOk: true,
  closed: [] as string[],
  held: [] as (string | null)[],
  shared: false,
  profiles: [{ id: 'p1' }] as { id: string }[],
  fetches: [] as { method: string; path: string }[],
  answer: (() => ({ status: 500, body: {} })) as (method: string, path: string) => { status: number; body: unknown } | 'offline',
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'token-1' }) }));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => env.gate }));
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
vi.mock('../../../platform/pwa', () => ({ copyText: async () => env.copyOk }));
vi.mock('../../../store/grown-up-session', () => ({ closeGrownUpSession: (reason: string) => void env.closed.push(reason) }));
vi.mock('../../../store/profile-store', () => ({ useProfileStore: { getState: () => ({ profiles: env.profiles }) } }));
vi.mock('../../../store/who-chooser', () => ({ deviceShared: () => env.shared, holdJoin: (code: string | null) => void env.held.push(code) }));

const en = getMessages('en');
const m = en.caregiver.account;

// ---- The Worker, as the fixture's account sees it (Nov 8, 2026) ----

const NOW = '2026-11-08T12:00:00.000Z';
const family = (id: string, name: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  space: { id, kind: 'family', name, createdAt: '2026-01-01T00:00:00.000Z', archivedAt: null, settings: {}, parentSpaceId: null, ...((over.space as object) ?? {}) },
  role: over.role ?? 'owner',
  counts: { learners: 2, accounts: 1, classes: 0 },
  joinCode: 'joinCode' in over ? over.joinCode : null,
  joinCodeExpiresAt: null,
});
const learner = (id: string, name: string, joinedAt: string, minutes: number, lastActiveAt = '2026-11-08T10:00:00.000Z'): Record<string, unknown> => ({
  id,
  displayName: name,
  ageGroup: 'child',
  avatar: 'tiger',
  joinedAt,
  lastActiveAt,
  summary: { lastActiveAt, minutesLast7d: minutes, cardsUnlocked: 1 },
});

/** The server's order: newest space first; a roster by last activity (Jun first). */
const SPACES = {
  spaces: [
    family('space:spring', 'Spring family', { space: { createdAt: '2025-03-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z' } }),
    { ...family('space:class', 'Saturday class 3B'), space: { id: 'space:class', kind: 'class', name: 'Saturday class 3B', createdAt: '2026-04-01T00:00:00.000Z', archivedAt: null } },
    family('space:park', 'Grandma Park family', { role: 'caregiver', space: { createdAt: '2026-03-01T00:00:00.000Z' } }),
    family('space:kim', 'Kim family', { joinCode: 'K7MPQ4' }),
  ],
};
const ROSTERS: Record<string, unknown> = {
  'space:kim': { space: {}, learners: [learner('profile:jun', 'Jun', '2026-03-01T00:00:00.000Z', 90), learner('profile:mina', 'Mina', '2026-02-01T00:00:00.000Z', 34)], joinCode: 'K7MPQ4', seats: {} },
  'space:park': { space: {}, learners: [{ ...learner('profile:sora', 'Sora', '2026-03-02T00:00:00.000Z', 0), summary: null }], joinCode: null },
  'space:spring': { space: {}, learners: [], joinCode: null },
};
const card = (spaceId: string, kind: string, coverage: unknown, usage: unknown = null): Record<string, unknown> => ({
  spaceId,
  kind,
  name: 'x',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage,
  usage,
  actions: { buy: 'family_lifetime', manage: true, contact: true },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
});
const OWN = (status: string, planKey = 'family_lifetime'): unknown => ({ state: 'own', planKey, status, expiresAt: null, statusSince: '2026-01-01T00:00:00.000Z', endsAtPeriodEnd: false });
let planCards: unknown[] = [card('space:kim', 'family', OWN('active'), { learners: 2, learnerCap: 6, teachers: null, teacherCap: null }), card('space:park', 'family', { state: 'free' })];

function standardAnswer(method: string, path: string): { status: number; body: unknown } | 'offline' {
  if (method === 'GET' && path === '/api/spaces') return { status: 200, body: { data: SPACES } };
  const roster = /^\/api\/spaces\/([^/]+)\/roster$/.exec(path);
  if (method === 'GET' && roster) return { status: 200, body: { data: ROSTERS[decodeURIComponent(roster[1] as string)] } };
  if (method === 'GET' && path === '/api/billing/summary') return { status: 200, body: { data: { mode: 'none', purchasesOpen: false, cards: planCards, account: [] } } };
  return { status: 404, body: { error: { code: 'not_found' } } };
}

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
let client: QueryClient;
let rebuild: () => ReactElement;

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

async function mountHome(o: { use?: 'family' | 'account'; routes?: string[]; seed?: unknown } = {}): Promise<ReactTestRenderer> {
  nav = makeNav(o.routes ?? ['ParentDashboard', 'AccountHome']);
  host = { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (o.seed !== undefined) client.setQueryData(['account', 'spaces'], o.seed);
  const use = o.use ?? 'family';
  rebuild = () =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(ScreenHeaderSlotContext.Provider, { value: HeaderTitle }, createElement(AccountHostContext.Provider, { value: host }, createElement(FamilyHome, { use, navigation: nav as never, routeKey: `r${(o.routes ?? ['ParentDashboard', 'AccountHome']).length - 1}` }))),
    );
  const r = await render(rebuild());
  await settle();
  return r;
}

const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
/** The words a node shows or reads, each once (a button's name is on its composite and its host both). */
const textsOf = (root: ReactTestInstance, id: string): string[] => [...new Set(screenTexts(byTestId(root, id)[0]!))];
/** The React Native props of the component that carries `testID` (what VoiceOver and TalkBack read). */
const nativeProps = (root: ReactTestInstance, id: string): Record<string, unknown> => root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id).at(-1)!.props as Record<string, unknown>;
const homes = (): unknown[] => env.tracked.filter((e) => e.name === 'auth.native.home').map((e) => e.payload);
/** The stack a 401 leaves: what `navigation.dispatch` builds from the current one. */
const stackAfter = (): { name: string; params?: unknown }[] => {
  const builder = nav.dispatch.mock.calls[0]![0] as (state: unknown) => { payload: { routes: { name: string; params?: unknown }[] } };
  return builder({ key: 'stack', index: 1, routes: nav.getState().routes, routeNames: [], type: 'stack', stale: false }).payload.routes.map(({ name, params }) => ({ name, params }));
};
const sheetOf = (root: ReactTestInstance): ConfirmSheetProps => root.findByType(ConfirmSheet).props as ConfirmSheetProps;

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  Object.assign(env, { gate: { state: 'pin', epoch: 7 }, online: true, onlineListener: null, tracked: [], notice: false, removed: [], uses: [], copyOk: true, closed: [], held: [], shared: false, profiles: [{ id: 'p1' }], fetches: [], answer: standardAnswer });
  planCards = [card('space:kim', 'family', OWN('active'), { learners: 2, learnerCap: 6, teachers: null, teacherCap: null }), card('space:park', 'family', { state: 'free' })];
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

describe('ready (boards 1 to 5): families, learners, the code panel, the plan block, the end', () => {
  it('titled Family; families live then archived, each oldest first; no class', async () => {
    const r = await mountHome();
    expect(screenTexts(r.root)).toContain(en.learner.who.use.family);
    const sections = hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string' && /^account-family-space:[a-z]+$/.test(n.props['data-testid'] as string)).map((n) => n.props['data-testid']);
    expect(sections).toEqual(['account-family-space:kim', 'account-family-space:park', 'account-family-space:spring']);
    expect(has(r.root, 'account-family-space:class')).toBe(false);
    expect(textsOf(r.root, 'account-family-space:spring')).toContain(en.console.home.archived);
  });

  it('learners in join order (Mina before Jun), never by activity; the console words (D10)', async () => {
    const r = await mountHome();
    const cards = hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string' && /^account-learner-profile:[a-z]+$/.test(n.props['data-testid'] as string)).map((n) => n.props['data-testid']);
    expect(cards).toEqual(['account-learner-profile:mina', 'account-learner-profile:jun', 'account-learner-profile:sora']);
    expect(textsOf(r.root, 'account-learner-profile:mina')).toEqual(expect.arrayContaining(['Mina', en.console.space.learner.lastActive(en.common.time.today), en.console.parentHome.minutes7d(34), en.console.parentHome.child.seeReport]));
    // A learner with no summary on the server: not started, no minutes.
    const sora = textsOf(r.root, 'account-learner-profile:sora');
    expect(sora).toContain(en.console.parentHome.lastActive.notStarted);
    expect(sora.some((t) => t.startsWith('Minutes'))).toBe(false);
  });

  it('See report opens the learner report on the week (ids in memory only)', async () => {
    const r = await mountHome();
    await tap(r.root, 'account-learner-profile:mina-report');
    expect(nav.navigate).toHaveBeenCalledWith('AccountLearnerReport', { spaceId: 'space:kim', learnerId: 'profile:mina', period: 'week', use: 'family' });
  });

  it('the owner sees the code in two groups, read spelled out (D11); a caregiver reads askOwner; an archived family no panel', async () => {
    const r = await mountHome();
    const code = byTestId(r.root, 'account-family-space:kim-code-code')[0]!;
    expect(screenTexts(code)).toEqual(expect.arrayContaining(codeGroups('K7MPQ4')));
    expect(code.props['aria-label']).toBe(en.a11y.account.joinCode('K 7 M P Q 4'));
    expect(textsOf(r.root, 'account-family-space:kim-code')).toContain(m.home.codeLabel.family);
    expect(has(r.root, 'account-family-space:park-ask-owner')).toBe(true);
    expect(textsOf(r.root, 'account-family-space:park')).toContain(en.console.parentHome.askOwner);
    expect(has(r.root, 'account-family-space:park-code')).toBe(false);
    expect(textsOf(r.root, 'account-family-space:spring').some((t) => t.includes('K7M') || t === en.console.parentHome.askOwner)).toBe(false);
    expect(has(r.root, 'account-family-space:spring-make')).toBe(false);
    // A family with no learner: the empty line (and an archived one, no code).
    expect(textsOf(r.root, 'account-family-space:spring')).toContain(en.console.parentHome.empty.title);
  });

  it('the plan block: a name and usage, plain text; no block without a status card', async () => {
    const r = await mountHome();
    const block = byTestId(r.root, 'account-family-space:kim-plan')[0]!;
    expect(screenTexts(block)).toEqual(expect.arrayContaining([en.console.billing.coverage.family, en.console.billing.usage.learners(2, 6)]));
    expect(textsOf(r.root, 'account-family-space:park-plan')).toContain(en.console.billing.coverage.free);
    expect(has(r.root, 'account-family-space:spring-plan')).toBe(false);
    expect(hostNodes(block, (n) => n.props.role === 'button' || typeof n.props.onClick === 'function')).toEqual([]);
  });

  it('the end of the home: the quiet line, then Sign out; nothing links out', async () => {
    const openURL = vi.spyOn(Linking, 'openURL').mockImplementation((async () => undefined) as never);
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-end')).toEqual(expect.arrayContaining([m.home.moreTools, en.console.shell.signOut.cta]));
    expect(hostNodes(r.root, (n) => n.props.href !== undefined)).toEqual([]);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('reads through the account client: the three routes, with the token and the native header', async () => {
    await mountHome();
    expect(env.fetches).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/api/spaces' },
        { method: 'GET', path: '/api/spaces/space%3Akim/roster' },
        { method: 'GET', path: '/api/spaces/space%3Apark/roster' },
        { method: 'GET', path: '/api/spaces/space%3Aspring/roster' },
        { method: 'GET', path: '/api/billing/summary' },
      ]),
    );
    expect(env.fetches.some((f) => f.path.includes('/api/sync') || f.path.includes('/api/recovery') || f.path.includes('/stripe'))).toBe(false);
  });

  it('auth.native.home once per mount, after the first successful load, with the bucket of the families listed', async () => {
    const r = await mountHome();
    expect(homes()).toEqual([{ os: 'ios', use: 'family', spaces: '2-4' }]);
    await act(async () => void client.refetchQueries());
    await settle();
    expect(homes()).toHaveLength(1);
    r.unmount();
  });

  it('section 8.1: a successful spaces read rewrites the uses record on a PIN device (no names, no ids); not elsewhere', async () => {
    await mountHome();
    expect(env.uses).toEqual([{ v: 1, uses: ['family', 'teacher'], at: Date.parse(NOW) }]);
    env.gate = { state: 'open' };
    env.uses = [];
    await mountHome();
    expect(env.uses).toEqual([]);
  });
});

describe('the spaces cache is shared with the sign-in, the account card and the gate (NS-5 review)', () => {
  it('a home opened right after a sign-in (the raw answer cached) draws, and the cache keeps the raw answer', async () => {
    const r = await mountHome({ seed: SPACES });
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
    // What the card and the gate read with `usesOfSpaces`.
    expect(client.getQueryData(['account', 'spaces'])).toEqual(SPACES);
  });

  it('a seeded answer of another shape draws no family, never a crash', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal('fetch', async () => {
      await gate;
      return { status: 500, url: 'https://api.example.test/api/spaces', type: 'basic', json: async () => ({}) };
    });
    const r = await mountHome({ seed: { odd: true } });
    expect(has(r.root, 'account-home-no-family')).toBe(true);
    release();
    await settle();
  });

  it('a spaces answer that arrives after Sign out never writes the uses record back', async () => {
    let release!: () => void;
    const late = new Promise<void>((resolve) => {
      release = resolve;
    });
    const r = await mountHome();
    env.uses = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      if (path === '/api/spaces') await late;
      const answer = standardAnswer(String(init.method), path) as { status: number; body: unknown };
      return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
    });
    await act(async () => void client.refetchQueries({ queryKey: ['account', 'spaces'] }));
    await tap(r.root, 'account-home-sign-out');
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    release();
    await settle();
    expect(env.uses).toEqual([]);
  });
});

describe('the uses record and another sign-in', () => {
  it('a spaces answer that arrives after another account signed in never writes over its record', async () => {
    let release!: () => void;
    const late = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { useAccountVisit } = await import('../../../store/account-visit');
    await mountHome();
    env.uses = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      if (path === '/api/spaces') await late;
      const answer = standardAnswer(String(init.method), path) as { status: number; body: unknown };
      return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
    });
    await act(async () => void client.refetchQueries({ queryKey: ['account', 'spaces'] }));
    act(() => useAccountVisit.getState().markSignedIn(Date.parse(NOW) + 1000, false));
    release();
    await settle();
    expect(env.uses).toEqual([]);
  });
});

describe('the code panel: Copy, Make a code, Join on this device', () => {
  it('Copy: Copied for about 2 seconds; a refused copy keeps the code and says so', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date(NOW), shouldAdvanceTime: true });
    const r = await mountHome();
    await tap(r.root, 'account-family-space:kim-code-copy');
    expect(textsOf(r.root, 'account-family-space:kim-code-copy')).toContain(en.console.joinCode.copied.cta);
    // The polite status holds Copied only while it shows (Android reads it; iOS announces).
    expect(textsOf(r.root, 'account-family-space:kim-code-status')).toEqual([en.console.joinCode.copied.cta]);
    await act(async () => {
      vi.advanceTimersByTime(COPIED_MS + 10);
    });
    expect(textsOf(r.root, 'account-family-space:kim-code-copy')).toContain(en.console.joinCode.copy.cta);
    env.copyOk = false;
    await tap(r.root, 'account-family-space:kim-code-copy');
    expect(textsOf(r.root, 'account-family-space:kim-code-copy-failed')).toContain(en.console.parentHome.copyFailed);
    expect(has(r.root, 'account-family-space:kim-code-code')).toBe(true);
  });

  it('the owner with no live code: Make a code, then the code', async () => {
    const before = SPACES.spaces[3] as { joinCode: unknown };
    const kim = ROSTERS['space:kim'] as { joinCode: unknown };
    before.joinCode = null;
    kim.joinCode = null;
    try {
      const r = await mountHome();
      expect(textsOf(r.root, 'account-family-space:kim-make')).toEqual(expect.arrayContaining([m.home.codeLabel.family, en.console.confirm.issueCode]));
      env.answer = (method, path) => {
        if (method === 'POST' && path === '/api/spaces/space%3Akim/code') {
          before.joinCode = 'H3TRW9';
          return { status: 200, body: { data: { joinCode: 'H3TRW9', expiresAt: null } } };
        }
        return standardAnswer(method, path);
      };
      await tap(r.root, 'account-family-space:kim-make-code');
      expect(env.fetches).toContainEqual({ method: 'POST', path: '/api/spaces/space%3Akim/code' });
      expect(byTestId(r.root, 'account-family-space:kim-code-code')[0]!.props['aria-label']).toBe(en.a11y.account.joinCode('H 3 T R W 9'));
    } finally {
      before.joinCode = 'K7MPQ4';
      kim.joinCode = 'K7MPQ4';
    }
  });

  it('Make a code refused: the line, and the button stays', async () => {
    const before = SPACES.spaces[3] as { joinCode: unknown };
    const kim = ROSTERS['space:kim'] as { joinCode: unknown };
    before.joinCode = null;
    kim.joinCode = null;
    try {
      const r = await mountHome();
      env.answer = (method, path) => (method === 'POST' ? { status: 500, body: { error: { code: 'x' } } } : standardAnswer(method, path));
      await tap(r.root, 'account-family-space:kim-make-code');
      expect(textsOf(r.root, 'account-family-space:kim-make')).toContain(m.home.cantLoad);
      expect(has(r.root, 'account-family-space:kim-make-code')).toBe(true);
    } finally {
      before.joinCode = 'K7MPQ4';
      kim.joinCode = 'K7MPQ4';
    }
  });

  it('Join on this device, shared device: the code held in memory, the chooser with join, then the session closes', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date(NOW), shouldAdvanceTime: true });
    env.shared = true;
    const r = await mountHome();
    await press(byTestId(r.root, 'account-family-space:kim-code-join-here')[0]!);
    expect(env.held).toEqual(['K7MPQ4']);
    expect(nav.root.navigate).toHaveBeenCalledWith('WhoIsUsing', { trigger: 'join' });
    expect(env.closed).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(env.closed).toEqual(['exit']);
    // Nothing joined: no join or lookup request left with the account token (CS-N8).
    expect(env.fetches.some((f) => f.method === 'POST')).toBe(false);
  });

  it('Join on this device, a learner and no sharing: Join prefilled; no learner: the first run keeps the code', async () => {
    const r = await mountHome();
    await tap(r.root, 'account-family-space:kim-code-join-here');
    expect(nav.root.navigate).toHaveBeenCalledWith('JoinSpace', { code: 'K7MPQ4' });
    expect(env.held).toEqual([]);
    env.profiles = [];
    const r2 = await mountHome();
    await tap(r2.root, 'account-family-space:kim-code-join-here');
    expect(nav.root.navigate).toHaveBeenCalledWith('Onboarding', { screen: 'CreateProfile', params: { firstRun: true, then: 'join', code: 'K7MPQ4' }, initial: false });
    await unmount(r);
  });
});

describe('the plan block for every coverage row of section 8.5 (no date, no free cap, no status)', () => {
  const USAGE = { learners: 3, learnerCap: 6, teachers: null, teacherCap: null };
  const ROWS: [string, unknown, string[]][] = [
    ['free', { state: 'free' }, [en.console.billing.coverage.free]],
    ...(['active', 'trial', 'past_due', 'cancelled'] as const).map((status): [string, unknown, string[]] => [`own ${status}`, OWN(status), [en.console.billing.coverage.family, en.console.billing.usage.learners(3, 6)]]),
    ['own expired', OWN('expired'), [en.console.billing.coverage.free]],
    ['school with a date', { state: 'school', schoolName: 'Maple Heritage School', planKey: 'group_license', expiresAt: '2027-06-30T00:00:00.000Z' }, [en.console.billing.coverage.school('Maple Heritage School')]],
    ['school without', { state: 'school', schoolName: 'Maple Heritage School', planKey: 'group_license', expiresAt: null }, [en.console.billing.coverage.school('Maple Heritage School')]],
  ];
  it.each(ROWS)('%s', async (_name, coverage, lines) => {
    planCards = [card('space:kim', 'family', coverage, USAGE)];
    const r = await mountHome();
    const shown = textsOf(r.root, 'account-family-space:kim-plan');
    expect(shown).toEqual([en.a11y.account.planBlock, ...lines]);
    // iOS: one element named "Plan for this space", its value the visible lines in order (D9).
    const props = nativeProps(r.root, 'account-family-space:kim-plan');
    expect(props).toMatchObject({ accessible: true, accessibilityLabel: en.a11y.account.planBlock, accessibilityValue: { text: lines.join(', ') } });
    expect([...shown, lines.join(', ')].join(' ')).not.toMatch(/2027|Jun|\b30\b/);
  });

  it('Android: ungrouped (D9 fallback), its lines read in order', async () => {
    setPlatform('android');
    const r = await mountHome();
    expect(textsOf(r.root, 'account-family-space:kim-plan')).toEqual([en.console.billing.coverage.family, en.console.billing.usage.learners(2, 6)]);
    expect(nativeProps(r.root, 'account-family-space:kim-plan')).toMatchObject({ accessible: false, accessibilityLabel: undefined, accessibilityValue: undefined });
  });

  it('a status read that fails shows no block and fails nothing else', async () => {
    env.answer = (method, path) => (path === '/api/billing/summary' ? { status: 500, body: {} } : standardAnswer(method, path));
    const r = await mountHome();
    expect(has(r.root, 'account-family-space:kim-plan')).toBe(false);
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
  });
});

describe('the re-trust notice (section 8.2): once, at the top, no button', () => {
  it('shown, then deleted; not again', async () => {
    env.notice = true;
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-retrust')).toEqual([m.home.retrustNotice]);
    expect(hostNodes(byTestId(r.root, 'account-home-retrust')[0]!, (n) => n.props.role === 'button')).toEqual([]);
    expect(env.removed).toEqual([RETRUST_NOTICE_KEY]);
    env.notice = false;
    const again = await mountHome();
    expect(has(again.root, 'account-home-retrust')).toBe(false);
  });

  it('not deleted while the home could not draw it (offline)', async () => {
    env.notice = true;
    env.online = false;
    await mountHome();
    expect(env.removed).toEqual([]);
  });
});

describe('section 8.8: states', () => {
  it('loading: the skeleton, no data, the header title real', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    env.answer = standardAnswer;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      await gate;
      const answer = standardAnswer(String(init.method), new URL(url).pathname) as { status: number; body: unknown };
      return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
    });
    const r = await mountHome();
    expect(has(r.root, 'account-home-loading')).toBe(true);
    expect(screenTexts(r.root)).toContain(en.learner.who.use.family);
    expect(screenTexts(r.root).some((t) => t.includes('Kim'))).toBe(false);
    release();
    await settle();
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
  });

  it('offline: the offline line with Try again; reloads by itself when the network returns', async () => {
    env.online = false;
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-offline')).toEqual([m.home.offline, en.common.buttons.tryAgain]);
    expect(has(r.root, 'account-home-end')).toBe(false);
    env.online = true;
    await act(async () => env.onlineListener?.(true));
    await settle();
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
  });

  it('offline, Try again reads the network again (the subscription said nothing yet)', async () => {
    env.online = false;
    const r = await mountHome();
    env.online = true;
    await tap(r.root, 'account-home-state-try-again');
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
  });

  it('the network drops while open: the offline line', async () => {
    const r = await mountHome();
    await act(async () => env.onlineListener?.(false));
    await settle();
    expect(has(r.root, 'account-home-state-offline')).toBe(true);
  });

  it('the network drops during a roster read: the whole home reads offline, not one family refused', async () => {
    env.answer = (method, path) => (path === '/api/spaces/space%3Apark/roster' ? 'offline' : standardAnswer(method, path));
    const r = await mountHome();
    expect(has(r.root, 'account-home-state-offline')).toBe(true);
    expect(has(r.root, 'account-family-space:park-refused')).toBe(false);
  });

  it('a request that fails for the network reads offline', async () => {
    env.answer = () => 'offline';
    const r = await mountHome();
    expect(has(r.root, 'account-home-state-offline')).toBe(true);
  });

  it('an error while online: cantLoad with Try again, which reads again', async () => {
    env.answer = (method, path) => (path === '/api/spaces' ? { status: 500, body: {} } : standardAnswer(method, path));
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-cant_load')).toEqual([m.home.cantLoad, en.common.buttons.tryAgain]);
    env.answer = standardAnswer;
    await tap(r.root, 'account-home-state-try-again');
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
  });

  it('an answer that does not parse: cantLoad', async () => {
    env.answer = (method, path) => (path === '/api/spaces' ? { status: 200, body: { data: { spaces: 'x' } } } : standardAnswer(method, path));
    const r = await mountHome();
    expect(has(r.root, 'account-home-state-cant_load')).toBe(true);
  });

  it('401: the records go (uses, trust, notice), Clerk signs out, the sign-in opens; no sign-out event', async () => {
    env.answer = (method, path) => (path === '/api/spaces' ? { status: 401, body: { error: { code: 'unauthorized' } } } : standardAnswer(method, path));
    await mountHome();
    expect(host.endSession).toHaveBeenCalled();
    expect(host.wipeTokens).toHaveBeenCalled();
    expect(env.removed).toEqual(expect.arrayContaining([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY]));
    expect(stackAfter()).toEqual([{ name: 'ParentDashboard', params: undefined }, { name: 'SignIn', params: { use: 'family' } }]);
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(env.tracked.filter((e) => e.name === 'auth.native.signout')).toEqual([]);
    expect(homes()).toEqual([]);
  });

  it('401 on a roster counts the same', async () => {
    env.answer = (method, path) => (path.endsWith('/roster') ? { status: 401, body: { error: { code: 'unauthorized' } } } : standardAnswer(method, path));
    await mountHome({ use: 'account' });
    expect(stackAfter().at(-1)).toEqual({ name: 'SignIn', params: { use: 'account' } });
  });

  it('403 native_off: unavailable with Back only (no quiet line, no Sign out)', async () => {
    env.answer = () => ({ status: 403, body: { error: { code: 'native_off' } } });
    const r = await mountHome();
    expect(textsOf(r.root, 'account-home-state-unavailable')).toEqual([m.home.unavailable, en.common.buttons.back]);
    expect(has(r.root, 'account-home-end')).toBe(false);
    expect(has(r.root, 'account-home-state-try-again')).toBe(false);
    await tap(r.root, 'account-home-state-back');
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('native_off on a roster turns the whole home unavailable', async () => {
    env.answer = (method, path) => (path.endsWith('/roster') ? { status: 403, body: { error: { code: 'native_off' } } } : standardAnswer(method, path));
    const r = await mountHome();
    expect(has(r.root, 'account-home-state-unavailable')).toBe(true);
  });

  it('one family refused (403 or 404): its section says so with Try again; the others stay', async () => {
    env.answer = (method, path) => (path === '/api/spaces/space%3Apark/roster' ? { status: 403, body: { error: { code: 'forbidden' } } } : standardAnswer(method, path));
    const r = await mountHome();
    expect(textsOf(r.root, 'account-family-space:park-refused')).toEqual([m.home.cantLoad, en.common.buttons.tryAgain]);
    expect(has(r.root, 'account-learner-profile:mina')).toBe(true);
    env.answer = standardAnswer;
    await tap(r.root, 'account-family-space:park-try-again');
    expect(has(r.root, 'account-learner-profile:sora')).toBe(true);
  });

  it('no family (and the Grown-up account row): titled Grown-up account, noFamily and the end; no set-up button', async () => {
    env.answer = (method, path) => (path === '/api/spaces' ? { status: 200, body: { data: { spaces: [] } } } : standardAnswer(method, path));
    const r = await mountHome({ use: 'account' });
    expect(screenTexts(r.root)).toContain(m.card.title);
    expect(textsOf(r.root, 'account-home-no-family')).toEqual([m.home.noFamily]);
    expect(has(r.root, 'account-home-end')).toBe(true);
    expect(homes()).toEqual([{ os: 'ios', use: 'account', spaces: '0' }]);
  });
});

describe('Sign out (section 6.6): the sheet, then where it lands', () => {
  async function signOutFrom(routes: string[]): Promise<void> {
    const r = await mountHome({ routes });
    await tap(r.root, 'account-home-sign-out');
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: m.signOut.ask, confirmLabel: en.console.shell.signOut.cta });
    expect(sheetOf(r.root).confirmTone).toBeUndefined();
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(env.tracked.filter((e) => e.name === 'auth.native.signout').map((e) => e.payload)).toEqual([{ os: 'ios', via: 'user' }]);
    expect(host.endSession).toHaveBeenCalled();
  }

  it('the Grown-up area under the home: back to it', async () => {
    await signOutFrom(['ParentDashboard', 'AccountHome']);
    expect(nav.navigate).toHaveBeenCalledWith('ParentDashboard');
  });

  it('first in its stack (a chooser row): the Grown-up area in its place', async () => {
    await signOutFrom(['AccountHome']);
    expect(nav.replace).toHaveBeenCalledWith('ParentDashboard');
  });

  it('a device with no learner profile (from Welcome): Welcome, by leaving the area', async () => {
    env.profiles = [];
    await signOutFrom(['AccountHome']);
    expect(nav.root.goBack).toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('Cancel signs nothing out', async () => {
    const r = await mountHome();
    await tap(r.root, 'account-home-sign-out');
    await act(async () => sheetOf(r.root).onCancel());
    expect(sheetOf(r.root).visible).toBe(false);
    expect(host.endSession).not.toHaveBeenCalled();
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  type Setup = { answer?: typeof env.answer; online?: boolean; notice?: boolean; use?: 'family' | 'account'; act?: (root: ReactTestInstance) => Promise<void>; plan?: unknown[]; pending?: boolean };
  /** The owner's family with no live code (Make a code). */
  const noCode: typeof env.answer = (method, path) => {
    if (path === '/api/spaces') return { status: 200, body: { data: { spaces: SPACES.spaces.map((item) => ({ ...item, joinCode: null })) } } };
    if (path === '/api/spaces/space%3Akim/roster') return { status: 200, body: { data: { ...(ROSTERS['space:kim'] as object), joinCode: null } } };
    return standardAnswer(method, path);
  };
  const failing = (path: string, status: number, code: string): typeof env.answer => (method, p) => (p === path ? { status, body: { error: { code } } } : standardAnswer(method, p));
  const STATES: Record<string, Setup> = {
    ready: { notice: true },
    everyPlan: {
      plan: [
        card('space:kim', 'family', OWN('past_due'), { learners: 6, learnerCap: 6, teachers: null, teacherCap: null }),
        card('space:park', 'family', { state: 'school', schoolName: 'Maple', planKey: 'school_seat', expiresAt: '2027-01-31T00:00:00.000Z' }),
        card('space:spring', 'family', OWN('expired'), { learners: 3, learnerCap: 3, teachers: null, teacherCap: null }),
      ],
    },
    noFamily: { use: 'account', answer: (method, path) => (path === '/api/spaces' ? { status: 200, body: { data: { spaces: [] } } } : standardAnswer(method, path)) },
    copied: { act: async (root) => tap(root, 'account-family-space:kim-code-copy') },
    copyFailed: {
      act: async (root) => {
        env.copyOk = false;
        await tap(root, 'account-family-space:kim-code-copy');
      },
    },
    signOutSheet: { act: async (root) => tap(root, 'account-home-sign-out') },
    freePlan: { plan: [card('space:kim', 'family', { state: 'free' }, { learners: 3, learnerCap: 3, teachers: null, teacherCap: null })] },
    makeCode: { answer: noCode },
    makeFailed: {
      answer: (method, path) => (method === 'POST' ? { status: 500, body: { error: { code: 'x' } } } : noCode(method, path)),
      act: async (root) => tap(root, 'account-family-space:kim-make-code'),
    },
    loading: { answer: () => 'offline', online: true, act: async () => undefined, pending: true },
    offline: { online: false },
    cantLoad: { answer: failing('/api/spaces', 500, 'x') },
    unavailable: { answer: () => ({ status: 403, body: { error: { code: 'native_off' } } }) },
    familyRefused: { answer: failing('/api/spaces/space%3Apark/roster', 404, 'not_found') },
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
          Object.assign(env, { online: s.online ?? true, notice: s.notice ?? false, answer: s.answer ?? standardAnswer, copyOk: true });
          if (s.plan !== undefined) planCards = s.plan;
          if (s.pending === true) vi.stubGlobal('fetch', () => new Promise(() => undefined));
          const r = await mountHome({ use: s.use });
          if (s.pending === true) expect(has(r.root, 'account-home-loading')).toBe(true);
          if (s.act) await s.act(r.root);
          const sheet = r.root.findAllByType(ConfirmSheet).map((n) => n.props as ConfirmSheetProps).filter((p) => p.visible);
          const texts = [...screenTexts(r.root), ...sheet.flatMap((p) => [p.title, p.cancelLabel, p.confirmLabel])];
          // The fixture's names are typed by grown-ups (section 9.2: not checked); the app's words around them are.
          const own = texts.map((t) => t.replace(/Kim family|Grandma Park family|Spring family|Maple|Mina|Jun|Sora/g, 'NAME'));
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
