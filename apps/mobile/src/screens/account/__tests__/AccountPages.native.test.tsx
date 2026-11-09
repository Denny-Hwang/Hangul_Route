import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { AccountLoadError, codeGroups } from '../../../logic/account/homes';
import { DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY } from '../../../logic/account/sign-in-records';
import { useAccountVisit } from '../../../store/account-visit';
import { useLocaleStore } from '../../../store/locale-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountClassReportScreen } from '../AccountClassReportScreen.native';
import { AccountHostContext, ClerkMountContext, type AccountHost } from '../account-host';
import { AccountSchoolScreen } from '../AccountSchoolScreen.native';
import { AccountSpaceScreen } from '../AccountSpaceScreen.native';

/**
 * F-AUTH-004 sections 8.1, 8.3 to 8.5, 8.7 and 8.8 (row NS-6; design `homes.md` boards 12 to 14, `account-reports.md`
 * boards 2 and 3, D13, D14; CS-N2, CS-N5, CS-N8; anti-shame), in the `native` project: the class page, the school page
 * and the class report, each inside `AccountGate` and over the real account client (the Worker answered by a stand-in
 * fetch): the class page's Class report at the top, its roster in join order, the class code only when the roster
 * carries one, the plan block; the school page with and without `usage`, its teacher count, a refused class's row; the
 * class report's blocks, its periods and its stepper (each window read anew); every state of 8.8; and the deny list of
 * section 9.2 over every state in en, es and ko on iOS and Android.
 */

const env = vi.hoisted(() => ({
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  tracked: [] as { name: string; payload: unknown }[],
  removed: [] as string[],
  fetches: [] as string[],
  answer: (() => ({ status: 500, body: {} })) as (path: string, query: string) => { status: number; body: unknown } | 'offline',
}));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'token-1' }) }));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => ({ state: 'pin', epoch: 7 }) }));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => ({ kind: 'trust', trust: { v: 1, epoch: 7 } }),
  readUsesRecord: async () => ['teacher'],
  readRetrustNotice: async () => false,
  removeRecord: async (key: string) => void env.removed.push(key),
  writeDeviceUses: async () => undefined,
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
vi.mock('../../../platform/pwa', () => ({ copyText: async () => true }));
vi.mock('../../../platform/screen-reader', () => ({ focusForScreenReader: () => undefined }));
vi.mock('../../../store/profile-store', () => ({ useProfileStore: { getState: () => ({ profiles: [] }) } }));
vi.mock('../../../store/who-chooser', () => ({ deviceShared: () => false, holdJoin: () => undefined }));
vi.mock('../AccountCover', async () => {
  const { createElement: h } = await import('react');
  return { AccountCover: () => h('account-cover') };
});

const en = getMessages('en');
const m = en.caregiver.account;
const NOW = '2026-11-08T12:00:00.000Z';

// ---- The Worker (design README "Fixture") ----

const pub = (id: string, kind: string, name: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({ id, kind, name, parentSpaceId: null, settings: {}, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z', ...over });
const learner = (id: string, name: string, joinedAt: string, lastActiveAt: string): Record<string, unknown> => ({ id, displayName: name, ageGroup: 'child', avatar: 'tiger', joinedAt, lastActiveAt, summary: null, lastSyncedAt: null, scope: 'base' });

/** A roster as the Worker sends it: by last activity (Ben first), the code under `space.manage` only. */
const ROSTERS: Record<string, unknown> = {
  'space:saturday': {
    space: pub('space:saturday', 'class', 'Saturday class 3B'),
    learners: [learner('profile:ben', 'Ben', '2026-03-01T00:00:00.000Z', '2026-11-08T10:00:00.000Z'), learner('profile:ana', 'Ana', '2026-02-01T00:00:00.000Z', '2026-10-01T10:00:00.000Z')],
    joinCode: 'H3TRW9',
    joinCodeExpiresAt: '2026-12-01T00:00:00.000Z',
    seats: { used: 2, limit: 30 },
    canRename: true,
  },
  'space:sunflower': { space: pub('space:sunflower', 'class', 'Sunflower class'), learners: [learner('profile:chloe', 'Chloe', '2026-02-01T00:00:00.000Z', '2026-11-08T10:00:00.000Z')], joinCode: null, joinCodeExpiresAt: null },
  'space:empty': { space: pub('space:empty', 'class', 'New class'), learners: [], joinCode: null },
};

const schoolClass = (id: string, name: string, createdAt: string, students: number): Record<string, unknown> => ({
  space: pub(id, 'class', name, { parentSpaceId: 'space:maple', createdAt }),
  teacher: { accountId: 'acct:lee', name: 'Ms Lee' },
  students,
  practiced: 3,
  lastActiveAt: null,
  hasPublishedPlan: false,
  canRename: true,
  openMoves: false,
});
const SCHOOL = {
  school: pub('space:maple', 'school', 'Maple Heritage School'),
  invite: { joinCode: 'K7MPQ4', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' },
  license: { planKey: 'school_seat', status: 'active', seats: 20, expiresAt: '2027-01-31T00:00:00.000Z', updatedAt: 'x', active: true, subjectName: 'Maple Heritage School' },
  limits: { licensed: true, students: 500, teachers: 20 },
  canRename: true,
  usage: { students: 34, teachers: 6 },
  thisWeek: { students: 34, practiced: 20, classes: 2, classesWithPlan: 0 },
  // The Worker's order: newest first.
  classes: [schoolClass('space:room12', 'Room 12', '2026-06-01T00:00:00.000Z', 10), schoolClass('space:saturday', 'Saturday class 3B', '2026-04-01T00:00:00.000Z', 24)],
};

const card = (spaceId: string, kind: string, coverage: unknown, usage: unknown = null): Record<string, unknown> => ({ spaceId, kind, name: 'x', role: 'owner', archived: false, payer: false, readOnlyReason: null, coverage, usage, actions: { buy: null, manage: false, contact: false }, receipts: [], hasReceipts: false, legacyNoHistory: false });
const OWN = (planKey: string): unknown => ({ state: 'own', planKey, status: 'active', expiresAt: null, statusSince: '2026-01-01T00:00:00.000Z', endsAtPeriodEnd: false });
const USAGE = { learners: 24, learnerCap: 40, teachers: 6, teacherCap: 20 };
let planCards: unknown[] = [];

const CLASS_REPORT = {
  v: 1,
  period: 'week',
  headline: { code: 'class_practiced', practiced: 18, learners: 24, up: true },
  class: { learners: 24, withActivity: 24, olderApp: 0, notSaved7d: 0 },
  wentWell: { lettersNew: [{ letter: 'ㅂ', learners: 5 }], questsNew: { count: 14 }, cardsNew: 9, milestones: [] },
  revisit: [{ letter: 'ㄹ', learners: 4 }],
  practice: { dayBands: [{ band: '0', learners: 6 }, { band: '1-2', learners: 6 }, { band: '3-4', learners: 6 }, { band: '5-7', learners: 6 }], notSaved: 0 },
  time: { minutesTotal: { count: 212 }, minutesMedian: 24 },
  levelCheck: [{ strand: 'hangul-recognition', secure: 4, gettingThere: 3, notYet: 1, notTested: 16 }],
  plans: [{ planId: 'plan:week-1', title: 'Week 1 letters', assigned: 12, started: 9, finished: 6, itemsDone: 30 }],
};
const classReportBody = (query: string, over: Record<string, unknown> = {}): unknown => {
  const params = new URLSearchParams(query);
  const period = params.get('period') ?? 'week';
  const bands = period === 'week' ? CLASS_REPORT.practice : period === 'month' ? { dayBands: [{ band: '0', learners: 24 }], notSaved: 0 } : period === 'day' ? { dayBands: [{ band: 'practiced', learners: 1 }, { band: 'not_yet', learners: 23 }], notSaved: 0 } : {};
  return { data: { space: pub('space:saturday', 'class', 'Saturday class 3B'), period, at: params.get('at'), serverTime: NOW, report: { ...CLASS_REPORT, period, practice: bands }, ...over } };
};

function standard(path: string, query: string): { status: number; body: unknown } | 'offline' {
  const roster = /^\/api\/spaces\/([^/]+)\/roster$/.exec(path);
  if (roster) {
    const data = ROSTERS[decodeURIComponent(roster[1]!)];
    return data === undefined ? { status: 404, body: { error: { code: 'not_found' } } } : { status: 200, body: { data } };
  }
  if (path === '/api/spaces/space%3Amaple/school') return { status: 200, body: { data: SCHOOL } };
  if (path === '/api/spaces/space%3Asaturday/class-report') return { status: 200, body: classReportBody(query) };
  if (path === '/api/billing/summary') return { status: 200, body: { data: { mode: 'none', purchasesOpen: false, cards: planCards, account: [] } } };
  return { status: 404, body: { error: { code: 'not_found' } } };
}
const failing =
  (prefix: string, status: number, code: string): typeof env.answer =>
  (path, query) =>
    path.startsWith(prefix) ? { status, body: { error: { code } } } : standard(path, query);

// ---- The harness ----

interface Nav {
  dispatch: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  root: { navigate: ReturnType<typeof vi.fn> };
  getState: () => { routes: { key: string; name: string }[] };
  getParent: () => Nav['root'] & { replace: ReturnType<typeof vi.fn> };
  isFocused: () => boolean;
  addListener: (event: string, listener: () => void) => () => void;
}
let nav: Nav;
let host: AccountHost & { endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn> };
let client: QueryClient;

function HeaderTitle({ options }: ScreenHeaderSlotProps): ReactElement {
  return createElement('header-title', { 'data-testid': 'header-title' }, options?.title ?? null);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

type Page = 'AccountSpace' | 'AccountSchool' | 'AccountClassReport';
const SCREENS = { AccountSpace: AccountSpaceScreen, AccountSchool: AccountSchoolScreen, AccountClassReport: AccountClassReportScreen } as const;

async function mountPage(page: Page, params: Record<string, unknown>, o: { seed?: (c: QueryClient) => Promise<void> | void } = {}): Promise<ReactTestRenderer> {
  // Opened from a home (an account route under it): no typed PIN asked again (ND-5, OA-D5b).
  const routes = [
    { key: 'd', name: 'ParentDashboard' },
    { key: 'h', name: 'AccountHome' },
    { key: 'me', name: page },
  ];
  const root = { navigate: vi.fn(), replace: vi.fn() };
  nav = { dispatch: vi.fn(), navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn(), root, getState: () => ({ routes }), getParent: () => root, isFocused: () => true, addListener: () => () => undefined };
  host = { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (o.seed) await o.seed(client);
  const screen = createElement(SCREENS[page] as never, { navigation: nav, route: { key: 'me', name: page, params } } as never);
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
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
const textsOf = (root: ReactTestInstance, id: string): string[] => [...new Set(screenTexts(byTestId(root, id)[0]!))];
const title = (root: ReactTestInstance): string[] => textsOf(root, 'header-title');
const rowIds = (root: ReactTestInstance, re: RegExp): string[] => hostNodes(root, (n) => typeof n.props['data-testid'] === 'string' && re.test(n.props['data-testid'] as string)).map((n) => n.props['data-testid'] as string);

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useUiStore.setState({ parentGateOpenedAt: Date.parse(NOW), lastPinTypedAt: null });
  useAccountVisit.setState({ retrustPending: false, signedOutThisRun: false, signedInThisVisit: false, lastAccountSignInAt: null });
  planCards = [card('space:saturday', 'class', { state: 'school', schoolName: 'Maple Heritage School', planKey: 'school_seat', expiresAt: '2027-01-31T00:00:00.000Z' }), card('space:sunflower', 'class', OWN('group_license'), USAGE), card('space:maple', 'school', OWN('school_seat'), USAGE)];
  Object.assign(env, { online: true, onlineListener: null, tracked: [], removed: [], fetches: [], answer: standard });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    env.fetches.push(`${String(init.method)} ${parsed.pathname}${parsed.search.replace(/[?&]_=\d+/, '')}`);
    const answer = env.answer(parsed.pathname, parsed.search);
    if (answer === 'offline') throw new TypeError('Network request failed');
    return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetPlatform();
});

describe('the class page (section 8.3, boards 12 and 13)', () => {
  it('inside the gate; titled with the class name; reads its roster and the plan status', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    expect(title(r.root)).toEqual(['Saturday class 3B']);
    expect(env.fetches).toEqual(expect.arrayContaining(['GET /api/spaces/space%3Asaturday/roster', 'GET /api/billing/summary?view=status']));
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('Class report at the top (D13), then the roster in join order with See report each (never by activity)', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    const order = rowIds(r.root, /^account-space-class-report$|^account-space-learner-profile:[a-z]+$/);
    expect(order).toEqual(['account-space-class-report', 'account-space-learner-profile:ana', 'account-space-learner-profile:ben']);
    await tap(r.root, 'account-space-class-report');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    await tap(r.root, 'account-space-learner-profile:ana-report');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountLearnerReport', { spaceId: 'space:saturday', learnerId: 'profile:ana', period: 'week', use: 'teacher' });
  });

  it('the class code when the roster carries one: the label, two groups read spelled out, Copy and Join on this device', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    expect(textsOf(r.root, 'account-space-code')).toEqual(expect.arrayContaining([m.home.codeLabel.class, ...codeGroups('H3TRW9'), en.console.joinCode.copy.cta, m.home.joinHere.cta]));
    expect(byTestId(r.root, 'account-space-code-code')[0]!.props['aria-label']).toBe(en.a11y.account.joinCode('H 3 T R W 9'));
    await tap(r.root, 'account-space-code-join-here');
    // No learner on this device: the first run keeps the code for Join (section 8.2, OA-D20); nothing joins by itself.
    expect(nav.root.navigate).toHaveBeenCalledWith('Onboarding', expect.objectContaining({ params: expect.objectContaining({ then: 'join', code: 'H3TRW9' }) }));
  });

  it('a school class: the school coverage line, never its end date; no home end', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    expect(textsOf(r.root, 'account-space-plan')).toEqual([en.a11y.account.planBlock, en.console.billing.coverage.school('Maple Heritage School')]);
    expect(screenTexts(r.root).some((t) => /2027|Jan/.test(t))).toBe(false);
    expect(has(r.root, 'account-home-end')).toBe(false);
  });

  it('no code on the roster (board 13): no panel and no line; a teacher-bought licence with usage', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:sunflower', use: 'teacher' });
    expect(has(r.root, 'account-space-code')).toBe(false);
    expect(screenTexts(r.root)).not.toContain(en.console.parentHome.askOwner);
    expect(screenTexts(r.root)).not.toContain(en.console.confirm.issueCode);
    expect(textsOf(r.root, 'account-space-plan')).toEqual([en.a11y.account.planBlock, en.console.billing.coverage.license, en.console.billing.usage.students(24, 40)]);
  });

  it('no learner yet: the empty line; no status card: no block', async () => {
    const r = await mountPage('AccountSpace', { spaceId: 'space:empty', use: 'teacher' });
    expect(textsOf(r.root, 'account-space-empty')).toEqual([en.console.parentHome.empty.title]);
    expect(has(r.root, 'account-space-plan')).toBe(false);
  });

  it('before the roster answers: the name the spaces list already read (D13), and the skeleton', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' }, { seed: (c) => void c.setQueryData(['account', 'spaces'], { spaces: [{ space: pub('space:saturday', 'class', 'Saturday class 3B'), role: 'owner', counts: { learners: 2 }, joinCode: null }] }) });
    expect(title(r.root)).toEqual(['Saturday class 3B']);
    expect(has(r.root, 'account-home-loading')).toBe(true);
  });

  it('before the roster answers, opened from a school page: the school list names it', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const r = await mountPage('AccountSpace', { spaceId: 'space:room12', use: 'teacher' }, { seed: (c) => void c.setQueryData(['account', 'school', 'space:maple'], { school: { id: 'space:maple', kind: 'school', name: 'Maple', archivedAt: null }, classes: [{ space: { id: 'space:room12', name: 'Room 12', createdAt: 'x', archivedAt: null }, students: 1 }], teachers: 1 }) });
    expect(title(r.root)).toEqual(['Room 12']);
  });
});

describe('the school page (section 8.4, board 14)', () => {
  it('titled with the school; its classes oldest first with counts and Class report; Teachers; the plan block with usage', async () => {
    const r = await mountPage('AccountSchool', { spaceId: 'space:maple', use: 'teacher' });
    expect(title(r.root)).toEqual(['Maple Heritage School']);
    expect(rowIds(r.root, /^account-school-class-space:[a-z0-9]+$/)).toEqual(['account-school-class-space:saturday', 'account-school-class-space:room12']);
    expect(textsOf(r.root, 'account-school-class-space:saturday')).toEqual(expect.arrayContaining(['Saturday class 3B', en.console.spaceCounts.students(24), en.console.home.classReport]));
    expect(textsOf(r.root, 'account-school-teachers')).toEqual([m.home.teachers(6)]);
    expect(textsOf(r.root, 'account-school-plan')).toEqual([en.a11y.account.planBlock, en.console.billing.coverage.contract, `${en.console.billing.usage.students(24, 40)} · ${en.console.billing.usage.teachers(6, 20)}`]);
    // Only what the page draws: never a teacher's name, the licence's seats or dates, the school's invite code.
    expect(screenTexts(r.root).join(' ')).not.toMatch(/Ms Lee|K7M|2027|20 seats/);
    expect(has(r.root, 'account-home-end')).toBe(false);
  });

  it('without usage on the status card: the plan name only', async () => {
    planCards = [card('space:maple', 'school', OWN('school_seat'), null)];
    const r = await mountPage('AccountSchool', { spaceId: 'space:maple', use: 'school' });
    expect(textsOf(r.root, 'account-school-plan')).toEqual([en.a11y.account.planBlock, en.console.billing.coverage.contract]);
  });

  it('no status card: no block; a teacher count the Worker did not send: no line', async () => {
    planCards = [];
    env.answer = (path, query) => (path === '/api/spaces/space%3Amaple/school' ? { status: 200, body: { data: { ...SCHOOL, usage: null } } } : standard(path, query));
    const r = await mountPage('AccountSchool', { spaceId: 'space:maple', use: 'teacher' });
    expect(has(r.root, 'account-school-plan')).toBe(false);
    expect(has(r.root, 'account-school-teachers')).toBe(false);
  });

  it('a class row opens the class page; Class report the class report', async () => {
    const r = await mountPage('AccountSchool', { spaceId: 'space:maple', use: 'school' });
    await tap(r.root, 'account-school-class-space:room12-open');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountSpace', { spaceId: 'space:room12', use: 'school' });
    await tap(r.root, 'account-school-class-space:room12-report');
    expect(nav.navigate).toHaveBeenLastCalledWith('AccountClassReport', { spaceId: 'space:room12', period: 'week', use: 'school' });
  });

  it('a class whose page was refused this session reads cantLoad, plain, no button; it updates when the refusal lands', async () => {
    const refuse = (c: QueryClient, key: unknown[], error: 'forbidden' | 'not_found' | 'error'): Promise<void> =>
      c.prefetchQuery({
        queryKey: key,
        queryFn: () => {
          throw new AccountLoadError(error);
        },
      });
    const r = await mountPage('AccountSchool', { spaceId: 'space:maple', use: 'teacher' }, { seed: (c) => refuse(c, ['account', 'roster', 'space:room12'], 'forbidden') });
    expect(textsOf(r.root, 'account-school-class-space:room12')).toEqual(expect.arrayContaining(['Room 12', m.home.cantLoad]));
    expect(has(r.root, 'account-school-class-space:room12-open')).toBe(false);
    expect(has(r.root, 'account-school-class-space:room12-report')).toBe(false);
    expect(has(r.root, 'account-school-class-space:saturday-open')).toBe(true);
    // A class report refused (404) while the page is open: its row changes too; any other failure does not.
    await act(async () => refuse(client, ['account', 'class-report', 'space:saturday', 'week', 'current'], 'error'));
    await settle();
    expect(has(r.root, 'account-school-class-space:saturday-open')).toBe(true);
    await act(async () => refuse(client, ['account', 'class-report', 'space:saturday', 'month', 'current'], 'not_found'));
    await settle();
    expect(has(r.root, 'account-school-class-space:saturday-plain')).toBe(true);
  });
});

describe('the class report (section 8.7, account-reports.md board 2)', () => {
  it('reads the week, draws the class blocks: no learner named, no Print, no Send a note, no Plan a lesson', async () => {
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    expect(env.fetches).toEqual(['GET /api/spaces/space%3Asaturday/class-report?period=week']);
    expect(textsOf(r.root, 'account-class-report-title')).toEqual([en.report.title.class('Saturday class 3B')]);
    const texts = screenTexts(r.root);
    expect(texts).toEqual(expect.arrayContaining([en.report.class.headline(18, 24, en.report.when.week), en.report.section.wentWell, en.report.class.section.practiceTogether, en.report.class.didntPractice(6), en.report.class.minutesTotal(212)]));
    for (const p of ['day', 'week', 'month', 'all'] as const) expect(texts).toContain(en.report.period[p]);
    expect(texts.join(' ')).not.toMatch(/Print|Send a note|Plan a lesson|Ana|Ben/);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('More detail: the level check counts and the homework counts as plain text (no plan link)', async () => {
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    await tap(r.root, 'account-class-report-more-detail-toggle');
    expect(textsOf(r.root, 'account-class-report-homework')).toEqual(expect.arrayContaining(['Week 1 letters', en.report.class.planRow(12, 9, 6)]));
    expect(has(r.root, 'account-class-report-level-check')).toBe(true);
    expect(hostNodes(r.root, (n) => n.props.href !== undefined)).toEqual([]);
  });

  it('a period reads that window anew; the stepper reads a past window with at', async () => {
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    await tap(r.root, 'account-class-report-step-prev');
    expect(env.fetches.at(-1)).toBe('GET /api/spaces/space%3Asaturday/class-report?period=week&at=2026-11-01');
    expect(screenTexts(r.root)).toContain(en.report.class.headline(18, 24, en.report.when.prevWeek));
    await tap(r.root, 'account-class-report-step-next');
    expect(screenTexts(r.root)).toContain(en.report.class.headline(18, 24, en.report.when.week));
    await press(byTestId(r.root, 'account-class-report-tabs-month')[0]!);
    await settle();
    expect(env.fetches.at(-1)).toBe('GET /api/spaces/space%3Asaturday/class-report?period=month');
    expect(screenTexts(r.root)).toContain(en.report.class.headline(18, 24, en.report.when.month));
  });

  it('while a new window loads, its tabs show and the panel is the skeleton (never the old figures)', async () => {
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    await press(byTestId(r.root, 'account-class-report-tabs-all')[0]!);
    await settle();
    expect(has(r.root, 'learner-report-loading')).toBe(true);
    expect(screenTexts(r.root)).not.toContain(en.report.class.headline(18, 24, en.report.when.week));
  });

  it('an empty class: the empty line, no tabs', async () => {
    env.answer = (path, query) => (path.endsWith('/class-report') ? { status: 200, body: classReportBody(query, { report: { ...CLASS_REPORT, class: { learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 }, headline: { code: 'class_practiced', practiced: 0, learners: 0 } } }) } : standard(path, query));
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    expect(textsOf(r.root, 'account-class-report-empty')).toEqual([en.report.class.empty]);
    expect(has(r.root, 'account-class-report-tabs')).toBe(false);
  });

  it('an archived class: the neutral line', async () => {
    env.answer = (path, query) => (path.endsWith('/class-report') ? { status: 200, body: classReportBody(query, { space: pub('space:saturday', 'class', 'Saturday class 3B', { archivedAt: '2026-06-01T00:00:00.000Z' }) }) } : standard(path, query));
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    expect(textsOf(r.root, 'account-class-report-archived')).toEqual([en.report.state.archived.class]);
  });

  it('an error while online: the report error with Try again, which reads again', async () => {
    env.answer = failing('/api/spaces/space%3Asaturday/class-report', 500, 'x');
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    expect(textsOf(r.root, 'account-class-report-error')).toEqual([en.report.state.error]);
    env.answer = standard;
    await tap(r.root, 'account-class-report-retry');
    expect(has(r.root, 'account-class-report-title')).toBe(true);
  });

  it('a space with no class report (the body names a family): not available', async () => {
    env.answer = (path, query) => (path.endsWith('/class-report') ? { status: 200, body: classReportBody(query, { space: pub('space:saturday', 'family', 'Kim family') }) } : standard(path, query));
    const r = await mountPage('AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' });
    expect(textsOf(r.root, 'account-class-report-unavailable')).toEqual([en.report.state.unavailable]);
  });
});

describe('section 8.8: the pages states', () => {
  const PAGES: [Page, Record<string, unknown>, string, string][] = [
    ['AccountSpace', { spaceId: 'space:saturday', use: 'teacher' }, '/api/spaces/space%3Asaturday/roster', 'account-space-state'],
    ['AccountSchool', { spaceId: 'space:maple', use: 'school' }, '/api/spaces/space%3Amaple/school', 'account-school-state'],
    ['AccountClassReport', { spaceId: 'space:saturday', period: 'week', use: 'teacher' }, '/api/spaces/space%3Asaturday/class-report', 'account-class-report-state'],
  ];

  it.each(PAGES)('%s offline: the offline line with Try again; reloads by itself on the network return', async (page, params, path, state) => {
    env.online = false;
    const r = await mountPage(page, params);
    expect(textsOf(r.root, `${state}-offline`)).toEqual(expect.arrayContaining([m.home.offline, en.common.buttons.tryAgain]));
    env.online = true;
    await act(async () => env.onlineListener?.(true));
    await settle();
    expect(has(r.root, `${state}-offline`)).toBe(false);
    expect(env.fetches.some((f) => f.includes(path))).toBe(true);
  });

  it.each(PAGES)('%s 403 native_off: unavailable with Back only', async (page, params, path, state) => {
    env.answer = failing(path, 403, 'native_off');
    const r = await mountPage(page, params);
    expect(textsOf(r.root, `${state}-unavailable`)).toEqual(expect.arrayContaining([m.home.unavailable, en.common.buttons.back]));
    await tap(r.root, `${state}-back`);
    expect(nav.goBack).toHaveBeenCalled();
  });

  it.each(PAGES)('%s 401: the records go, Clerk signs out, the run of account routes gives way to one sign-in', async (page, params, path) => {
    env.answer = failing(path, 401, 'unauthorized');
    await mountPage(page, params);
    expect(env.removed).toEqual(expect.arrayContaining([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY]));
    expect(host.endSession).toHaveBeenCalled();
    const builder = nav.dispatch.mock.calls[0]![0] as (state: unknown) => { payload: { routes: { name: string; params?: unknown }[] } };
    const routes = builder({ key: 'stack', index: 2, routes: nav.getState().routes, routeNames: [], type: 'stack', stale: false }).payload.routes.map(({ name, params: p }) => ({ name, params: p }));
    expect(routes).toEqual([{ name: 'ParentDashboard', params: undefined }, { name: 'SignIn', params: { use: (params as { use: string }).use } }]);
  });

  it.each([
    ['AccountSpace', { spaceId: 'space:saturday', use: 'teacher' }, '/api/spaces/space%3Asaturday/roster', 'account-space-state'],
    ['AccountSchool', { spaceId: 'space:maple', use: 'school' }, '/api/spaces/space%3Amaple/school', 'account-school-state'],
  ] as [Page, Record<string, unknown>, string, string][])('%s refused (403) or an error: cantLoad with Try again, which reads again', async (page, params, path, state) => {
    env.answer = failing(path, 403, 'forbidden');
    const r = await mountPage(page, params);
    expect(textsOf(r.root, `${state}-cant_load`)).toEqual(expect.arrayContaining([m.home.cantLoad, en.common.buttons.tryAgain]));
    env.answer = standard;
    await tap(r.root, `${state}-try-again`);
    expect(has(r.root, `${state}-cant_load`)).toBe(false);
  });

  it('a plan status read that fails shows no block and fails nothing else', async () => {
    env.answer = failing('/api/billing/summary', 500, 'x');
    const r = await mountPage('AccountSpace', { spaceId: 'space:saturday', use: 'teacher' });
    expect(has(r.root, 'account-space-plan')).toBe(false);
    expect(has(r.root, 'account-space-roster')).toBe(true);
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  type Setup = { page: Page; params: Record<string, unknown>; answer?: typeof env.answer; online?: boolean; plan?: unknown[]; act?: (root: ReactTestInstance) => Promise<void>; pending?: boolean };
  const space = { spaceId: 'space:saturday', use: 'teacher' };
  const school = { spaceId: 'space:maple', use: 'school' };
  const report = { spaceId: 'space:saturday', period: 'week', use: 'teacher' };
  const STATES: Record<string, Setup> = {
    classPage: { page: 'AccountSpace', params: space, act: async (root) => tap(root, 'account-space-code-copy') },
    classNoCode: { page: 'AccountSpace', params: { spaceId: 'space:sunflower', use: 'teacher' } },
    classEmpty: { page: 'AccountSpace', params: { spaceId: 'space:empty', use: 'teacher' } },
    classLoading: { page: 'AccountSpace', params: space, pending: true },
    classOffline: { page: 'AccountSpace', params: space, online: false },
    classRefused: { page: 'AccountSpace', params: space, answer: failing('/api/spaces/space%3Asaturday/roster', 404, 'not_found') },
    classUnavailable: { page: 'AccountSpace', params: space, answer: failing('/api/spaces', 403, 'native_off') },
    schoolPage: { page: 'AccountSchool', params: school },
    schoolNoUsage: { page: 'AccountSchool', params: school, plan: [card('space:maple', 'school', OWN('school_seat'), null)] },
    schoolExpired: { page: 'AccountSchool', params: school, plan: [card('space:maple', 'school', { state: 'own', planKey: 'school_seat', status: 'expired', expiresAt: null, statusSince: 'x', endsAtPeriodEnd: false }, USAGE)] },
    schoolCantLoad: { page: 'AccountSchool', params: school, answer: failing('/api/spaces/space%3Amaple/school', 500, 'x') },
    schoolOffline: { page: 'AccountSchool', params: school, online: false },
    reportWeek: { page: 'AccountClassReport', params: report, act: async (root) => tap(root, 'account-class-report-more-detail-toggle') },
    reportPast: { page: 'AccountClassReport', params: report, act: async (root) => tap(root, 'account-class-report-step-prev') },
    reportDay: { page: 'AccountClassReport', params: { ...report, period: 'day' } },
    reportMonth: { page: 'AccountClassReport', params: { ...report, period: 'month' } },
    reportAll: { page: 'AccountClassReport', params: { ...report, period: 'all' } },
    reportError: { page: 'AccountClassReport', params: report, answer: failing('/api/spaces/space%3Asaturday/class-report', 500, 'x') },
    reportUnavailable: { page: 'AccountClassReport', params: report, answer: failing('/api/spaces/space%3Asaturday/class-report', 403, 'native_off') },
    reportOffline: { page: 'AccountClassReport', params: report, online: false },
    reportLoading: { page: 'AccountClassReport', params: report, pending: true },
  };

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every state, every language`, async () => {
      const realFetch = globalThis.fetch;
      const openURL = vi.spyOn(Linking, 'openURL').mockImplementation((async () => undefined) as never);
      const plans = planCards;
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, s] of Object.entries(STATES)) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinTypedAt: null });
          Object.assign(env, { online: s.online ?? true, answer: s.answer ?? standard });
          planCards = s.plan ?? plans;
          if (s.pending === true) vi.stubGlobal('fetch', () => new Promise(() => undefined));
          const r = await mountPage(s.page, s.params);
          if (s.act) await s.act(r.root);
          const labels = hostNodes(r.root, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
          const texts = [...screenTexts(r.root), ...labels];
          // The fixture's names are typed by grown-ups (section 9.2: not checked); the app's words around them are.
          const own = texts.map((t) => t.replace(/Maple Heritage School|Saturday class 3B|Sunflower class|New class|Room 12|Week 1 letters|Kim family|Ana|Ben|Chloe/g, 'NAME'));
          const hits = own.flatMap((t) => accountDenyHits(t, locale).map((h) => `${platform} ${locale} ${name}: "${t}" has ${h}`));
          expect(hits).toEqual([]);
          expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
          await unmount(r);
          if (s.pending === true) vi.stubGlobal('fetch', realFetch);
        }
      }
      planCards = plans;
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
