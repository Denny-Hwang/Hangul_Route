import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ActivitySummary } from '@hangul-route/content-schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY } from '../../../logic/account/sign-in-records';
import { useAccountVisit } from '../../../store/account-visit';
import { useLocaleStore } from '../../../store/locale-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountHostContext, ClerkMountContext, type AccountHost } from '../account-host';
import { AccountLearnerReportScreen } from '../AccountLearnerReportScreen.native';

/**
 * F-AUTH-004 sections 8.1, 8.7 and 8.8 (row NS-5; design `account-reports.md` boards 1 and 3, D14; CS-N2, CS-N5), in
 * the `native` project: the account learner report inside `AccountGate`, over the real account client: the server's
 * projection drawn through the in-app report's blocks (title, Last practice, the period switch and the stepper, the
 * sections, This period with "All devices", More detail), without "Now on", Open Learning Route, Preview lessons,
 * the skills rows or the free-end line; a period change reads again; every state of 8.8; and the deny list of section
 * 9.2 over every state in en, es and ko on iOS and Android.
 */

const env = vi.hoisted(() => ({
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  tracked: [] as { name: string; payload: unknown }[],
  removed: [] as string[],
  trust: { kind: 'trust', trust: { v: 1, epoch: 7 } } as { kind: string; trust?: unknown },
  fetches: [] as string[],
  answer: (() => ({ status: 500, body: {} })) as (path: string, query: string) => { status: number; body: unknown } | 'offline',
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'token-1' }) }));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => ({ state: 'pin', epoch: 7 }) }));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => env.trust,
  readUsesRecord: async () => ['family'],
  removeRecord: async (key: string) => void env.removed.push(key),
}));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('../../../platform/account-capture', () => ({ holdAccountCapture: () => () => undefined }));
vi.mock('../../../platform/telemetry', () => ({ track: async (event: { name: string; payload: unknown }) => void env.tracked.push(event) }));
vi.mock('../AccountCover', async () => {
  const { createElement: h } = await import('react');
  return { AccountCover: () => h('account-cover') };
});

const en = getMessages('en');
const NOW = '2026-10-12T15:00:00.000Z';

const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  v: 1,
  tz: 0,
  asOf: '2026-10-12',
  days: [
    { d: '2026-10-01', min: 6, q: 1, c: 1, w: 0, j: ['ㄱ'] },
    { d: '2026-10-07', min: 10, q: 1, c: 1, w: 0, j: ['ㅏ'] },
    { d: '2026-10-08', min: 12, q: 1, c: 0, w: 0, j: ['ㅓ'] },
    { d: '2026-10-12', min: 14, q: 0, c: 0, w: 0, j: [] },
  ],
  months: [
    { m: '2026-09', min: 20, q: 2, c: 2, w: 0, days: 4 },
    { m: '2026-10', min: 42, q: 3, c: 2, w: 0, days: 4 },
  ],
  total: { since: '2026-09-14', min: 62, q: 6, c: 5, w: 0, days: 8 },
  milestones: [],
  // The free lessons are done: the free-end line's trigger (D14 keeps it off native).
  next: { end: true },
  ...over,
});

const report = (summary: unknown = { lastActiveAt: '2026-10-12T14:00:00.000Z', stage1: { questsDone: 6, questsTotal: 20, anchorAccuracy: null }, cardsUnlocked: 5, minutesLast7d: 36, jamoRecognized: ['ㄱ', 'ㅏ', 'ㅓ'], needsPractice: ['ㅂ'], planProgress: { 'plan:a': { done: 3, total: 5, notReady: 0 } }, journey: { v: 1, here: 'stage1', stages: [] }, activity: activity() }): unknown => ({
  data: {
    space: { id: 'space:kim', kind: 'family', name: 'Kim family', archivedAt: null, parentSpaceId: null, settings: {}, createdAt: '2026-01-01T00:00:00.000Z' },
    learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', joinedAt: '2026-02-01T00:00:00.000Z', lastActiveAt: '2026-10-12T14:00:00.000Z' },
    summary,
    lastSyncedAt: '2026-10-12T14:30:00.000Z',
    serverTime: NOW,
    scope: 'full',
  },
});

/** A report body with some envelope fields replaced. */
const withEnvelope = (body: unknown, over: Record<string, unknown>): unknown => ({ data: { ...(body as { data: object }).data, ...over } });

const standard = (path: string): { status: number; body: unknown } => (path === '/api/spaces/space%3Akim/learners/profile%3Amina/report' ? { status: 200, body: report() } : { status: 404, body: { error: { code: 'not_found' } } });

interface Nav {
  dispatch: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  getState: () => { routes: { key: string; name: string }[] };
  getParent: () => { replace: ReturnType<typeof vi.fn> };
  isFocused: () => boolean;
  addListener: (event: string, listener: () => void) => () => void;
}
let nav: Nav;
let host: AccountHost & { endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn> };

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

const ROUTES = [{ key: 'd', name: 'ParentDashboard' }, { key: 'h', name: 'AccountHome', params: { use: 'family' } }, { key: 'me', name: 'AccountLearnerReport' }];

async function mountReport(use: 'family' | 'account' | undefined = 'family'): Promise<ReactTestRenderer> {
  nav = {
    dispatch: vi.fn(),
    navigate: vi.fn(),
    replace: vi.fn(),
    goBack: vi.fn(),
    getState: () => ({ routes: ROUTES }),
    getParent: () => ({ replace: vi.fn() }),
    isFocused: () => true,
    addListener: () => () => undefined,
  };
  host = { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const screen = createElement(AccountLearnerReportScreen, { navigation: nav, route: { key: 'me', name: 'AccountLearnerReport', params: { spaceId: 'space:kim', learnerId: 'profile:mina', period: 'week', ...(use === undefined ? {} : { use }) } } } as never);
  const r = await render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(ScreenHeaderSlotContext.Provider, { value: HeaderTitle }, createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: 'ready' }, screen))),
    ),
  );
  await settle();
  return r;
}

const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const uniq = (texts: string[]): string[] => [...new Set(texts)];

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useUiStore.setState({ parentGateOpenedAt: Date.parse(NOW), lastPinTypedAt: null });
  useAccountVisit.setState({ retrustPending: false, signedOutThisRun: false, signedInThisVisit: false, lastAccountSignInAt: null });
  Object.assign(env, { online: true, onlineListener: null, tracked: [], removed: [], trust: { kind: 'trust', trust: { v: 1, epoch: 7 } }, fetches: [], answer: standard });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    env.fetches.push(`${String(init.method)} ${parsed.pathname}${parsed.search}`);
    const answer = env.answer(parsed.pathname, parsed.search);
    if (answer === 'offline') throw new TypeError('Network request failed');
    return { status: answer.status, url, type: 'basic', json: async () => answer.body };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetPlatform();
});

describe('the account learner report (section 8.7, board 1)', () => {
  it('opens inside the gate (from a home: no PIN asked again) and reads the server projection with its period', async () => {
    const r = await mountReport();
    expect(env.fetches).toEqual(['GET /api/spaces/space%3Akim/learners/profile%3Amina/report?period=week']);
    expect(uniq(screenTexts(byTestId(r.root, 'learner-report-title')[0]!))).toEqual([en.report.title.learner('Mina')]);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('drawn as in-app: Last practice, the periods, the stepper, the sections, This period on All devices, More detail', async () => {
    const r = await mountReport();
    const texts = screenTexts(r.root);
    expect(texts.some((t) => t.startsWith('Last practice'))).toBe(true);
    for (const period of ['day', 'week', 'month', 'all'] as const) expect(texts).toContain(en.report.period[period]);
    expect(has(r.root, 'learner-report-range')).toBe(true);
    expect(has(r.root, 'learner-report-went-well')).toBe(true);
    expect(texts).toContain(en.report.scope.allDevices);
    expect(has(r.root, 'learner-report-more-detail')).toBe(true);
  });

  it('left out on native (D14): Now on, Open Learning Route, Preview lessons, the skills rows, the free-end line', async () => {
    const r = await mountReport();
    const texts = screenTexts(r.root);
    expect(texts.some((t) => t.startsWith('Now on'))).toBe(false);
    expect(has(r.root, 'learner-report-open-route')).toBe(false);
    expect(has(r.root, 'learner-report-preview-lessons')).toBe(false);
    await press(byTestId(r.root, 'learner-report-more-detail-toggle')[0]!);
    await settle();
    expect(has(r.root, 'learner-report-skills')).toBe(false);
    expect(texts).not.toContain(en.report.insight.free_days_done('Mina'));
    expect(screenTexts(r.root).join(' ')).not.toContain('free lessons');
  });

  it('a period change reads again with the new period; a step reads nothing', async () => {
    const r = await mountReport();
    const month = hostNodes(r.root, (n) => n.props.role === 'tab' && screenTexts(n).includes(en.report.period.month))[0]!;
    await press(month);
    await settle();
    expect(env.fetches).toContain('GET /api/spaces/space%3Akim/learners/profile%3Amina/report?period=month');
    const count = env.fetches.length;
    await press(byTestId(r.root, 'learner-report-step-prev')[0]!);
    await settle();
    expect(env.fetches).toHaveLength(count);
    expect(has(r.root, 'learner-report-step-next')).toBe(true);
  });

  it('no summary on the server: the console no-data lines', async () => {
    env.answer = () => ({ status: 200, body: report(null) });
    const r = await mountReport();
    expect(screenTexts(byTestId(r.root, 'learner-report-notices')[0]!)).toEqual([en.report.state.noData('Mina'), en.report.state.noDataAction]);
  });

  it('a lock (the PIN changed): no report, nothing read; the lock titled with the home it came from', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    const r = await mountReport();
    expect(has(r.root, 'account-learner-report')).toBe(false);
    expect(screenTexts(r.root)).toContain(en.learner.who.use.family);
    expect(has(r.root, 'account-lock-pin_changed')).toBe(true);
    expect(env.fetches).toEqual([]);
  });
});

describe('section 8.8: states (board 3)', () => {
  it('loading: the report skeleton', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const r = await mountReport();
    expect(has(r.root, 'learner-report-loading')).toBe(true);
  });

  it('offline: the homes offline line with Try again; it reloads when the network returns', async () => {
    env.online = false;
    const r = await mountReport();
    expect(uniq(screenTexts(byTestId(r.root, 'account-report-state-offline')[0]!))).toEqual([en.caregiver.account.home.offline, en.common.buttons.tryAgain]);
    env.online = true;
    await act(async () => env.onlineListener?.(true));
    await settle();
    expect(has(r.root, 'learner-report-title')).toBe(true);
  });

  it('offline, Try again reads the network again', async () => {
    env.online = false;
    const r = await mountReport();
    env.online = true;
    await press(byTestId(r.root, 'account-report-state-try-again')[0]!);
    await settle();
    expect(has(r.root, 'learner-report-title')).toBe(true);
  });

  it('an error while online: report.state.error with Try again, which reads again', async () => {
    env.answer = () => ({ status: 500, body: {} });
    const r = await mountReport();
    expect(uniq(screenTexts(byTestId(r.root, 'learner-report-error')[0]!))).toEqual([en.report.state.error]);
    env.answer = standard;
    await press(byTestId(r.root, 'learner-report-retry')[0]!);
    await settle();
    expect(has(r.root, 'learner-report-title')).toBe(true);
  });

  it('a body it cannot read, and a refused learner (404): the error state', async () => {
    env.answer = () => ({ status: 200, body: { data: { space: null } } });
    const r = await mountReport();
    expect(has(r.root, 'learner-report-error')).toBe(true);
    env.answer = () => ({ status: 404, body: { error: { code: 'not_found' } } });
    const r2 = await mountReport();
    expect(has(r2.root, 'learner-report-error')).toBe(true);
    await unmount(r);
  });

  /** The stack the 401 leaves: what `navigation.dispatch` builds from the current one. */
  const stackAfter = (): { name: string; params?: unknown }[] => {
    const builder = nav.dispatch.mock.calls[0]![0] as (state: unknown) => { payload: { routes: { name: string; params?: unknown }[]; index: number } };
    const action = builder({ key: 'stack', index: 2, routes: ROUTES, routeNames: [], type: 'stack', stale: false });
    expect(action.payload.index).toBe(action.payload.routes.length - 1);
    return action.payload.routes.map(({ name, params }) => ({ name, params }));
  };

  it('401: the records go; the home and the report give way to one sign-in for the use (Back never reaches them)', async () => {
    env.answer = () => ({ status: 401, body: { error: { code: 'unauthorized' } } });
    await mountReport();
    expect(env.removed).toEqual(expect.arrayContaining([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY]));
    expect(host.endSession).toHaveBeenCalled();
    expect(stackAfter()).toEqual([{ name: 'ParentDashboard', params: undefined }, { name: 'SignIn', params: { use: 'family' } }]);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(env.tracked.filter((e) => e.name === 'auth.native.signout')).toEqual([]);
  });

  it('401 on a refetch after a report was shown: the report goes at once', async () => {
    const r = await mountReport();
    expect(has(r.root, 'learner-report-title')).toBe(true);
    env.answer = () => ({ status: 401, body: { error: { code: 'unauthorized' } } });
    await press(hostNodes(r.root, (n) => n.props.role === 'tab' && screenTexts(n).includes(en.report.period.week))[0]!);
    await act(async () => {
      env.online = true;
      env.onlineListener?.(false);
    });
    await act(async () => env.onlineListener?.(true));
    await settle();
    expect(has(r.root, 'learner-report-title')).toBe(false);
    expect(nav.dispatch).toHaveBeenCalled();
  });

  it('opened from the Grown-up account home: the gate is titled with it, and the sign-in after a 401 keeps it', async () => {
    env.answer = () => ({ status: 401, body: { error: { code: 'unauthorized' } } });
    await mountReport('account');
    expect(stackAfter().at(-1)).toEqual({ name: 'SignIn', params: { use: 'account' } });
  });

  it('403 native_off: unavailable with Back only', async () => {
    env.answer = () => ({ status: 403, body: { error: { code: 'native_off' } } });
    const r = await mountReport();
    expect(uniq(screenTexts(byTestId(r.root, 'account-report-state-unavailable')[0]!))).toEqual([en.caregiver.account.home.unavailable, en.common.buttons.back]);
    await press(byTestId(r.root, 'account-report-state-back')[0]!);
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('no telemetry of its own (no id, name or period leaves in an event)', async () => {
    await mountReport();
    expect(env.tracked.filter((e) => !e.name.startsWith('auth.native.lock'))).toEqual([]);
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  const STATES: Record<string, { answer?: typeof env.answer; online?: boolean; open?: boolean }> = {
    ready: { open: true },
    noData: { answer: () => ({ status: 200, body: report(null) }) },
    empty: { answer: () => ({ status: 200, body: report({ lastActiveAt: '', activity: activity({ days: [], months: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 }, next: undefined }) }) }) },
    legacyStale: { answer: () => ({ status: 200, body: withEnvelope(report({ lastActiveAt: '2026-08-01T00:00:00.000Z', cardsUnlocked: 2, minutesLast7d: 0 }), { lastSyncedAt: '2026-08-01T00:00:00.000Z' }) }) },
    archived: { answer: () => ({ status: 200, body: withEnvelope(report(), { space: { id: 'space:kim', kind: 'family', name: 'Kim family', archivedAt: '2026-10-01T00:00:00.000Z' } }) }) },
    classViewer: { open: true, answer: () => ({ status: 200, body: withEnvelope(report(), { space: { id: 'space:kim', kind: 'class', name: 'Saturday class 3B', archivedAt: null } }) }) },
    offline: { online: false },
    error: { answer: () => ({ status: 500, body: {} }) },
    unavailable: { answer: () => ({ status: 403, body: { error: { code: 'native_off' } } }) },
  };
  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every state, every period, every language`, async () => {
      const openURL = vi.spyOn(Linking, 'openURL').mockImplementation((async () => undefined) as never);
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, s] of Object.entries(STATES)) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          Object.assign(env, { online: s.online ?? true, answer: s.answer ?? standard });
          const r = await mountReport();
          const scan = (): string[] => screenTexts(r.root).map((t) => t.replace(/Mina|Kim family|Saturday class 3B/g, 'NAME')).flatMap((t) => accountDenyHits(t, locale).map((h) => `${platform} ${locale} ${name}: "${t}" has ${h}`));
          if (s.open === true) {
            // Every period, with More detail open.
            await press(byTestId(r.root, 'learner-report-more-detail-toggle')[0]!);
            await settle();
            expect(scan()).toEqual([]);
            for (const tab of hostNodes(r.root, (n) => n.props.role === 'tab')) {
              await press(tab);
              await settle();
              expect(scan()).toEqual([]);
            }
          }
          expect(scan()).toEqual([]);
          expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
          await unmount(r);
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
