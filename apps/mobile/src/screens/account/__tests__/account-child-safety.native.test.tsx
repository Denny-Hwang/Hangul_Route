import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '@hangul-route/content-schema';
import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement, type ReactElement } from 'react';
import { AppState, Keyboard, Linking, TextInput } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-AUTH-004 section 10, row NS-7 (section 20.1): the native child-safety suite in one file. Every invariant CS-N1 to
 * CS-N15 has its own `describe` below, and AMENDMENTS-ONE-ACCOUNT-MANY-USERS CS-1, CS-4 (as amended by ND-7), CS-7,
 * CS-14 and CS-15 are re-run with `Platform.OS` (and `EXPO_OS`) `ios` and `android`. Then the deny-list sweep of section
 * 9.2 over every state of every account screen, card and row, in en, es and ko on iOS and Android, in one place (the
 * per-screen sweeps of rows NS-3 to NS-6 stand beside it as a second layer).
 *
 * The suite drives the real code from the edges in: the real stores, the real storage wrapper over the test
 * AsyncStorage (so the gate state is `nativeGateState()` read exactly as on a device, the trust and uses records are the
 * stored ones, and a PIN change is `setParentPin(Hash)`'s own write), the real `AccountGate`, the real account screens
 * and the real account client, with only these stand-ins: Clerk's SDK at its hooks (a spy that counts every call), the
 * Worker (a stand-in `fetch` that records every request with its headers), the network state, `expo-screen-capture`,
 * `expo-secure-store`, telemetry (recorded), and the presentation-only cover image.
 *
 * Where an invariant's full table is a pure function with its own 100 % unit test (`account-lock`, `account-gate`,
 * `token-cache`, `install-sweep`, `sign-in-step`, `api`), the suite still asserts the invariant end to end through
 * that code, and names the deeper test.
 */

// ---- Stand-ins at the edges ----

type Answer = { status: number; body: unknown } | 'offline';

const env = vi.hoisted(() => ({
  online: true,
  onlineListeners: [] as ((online: boolean) => void)[],
  tracked: [] as { name: string; payload: Record<string, unknown> }[],
  fetches: [] as { method: string; path: string; headers: Record<string, string> }[],
  answer: null as null | ((method: string, path: string, query: string) => Answer | Promise<Answer>),
  capture: [] as string[],
  secure: new Map<string, string>(),
  secureOptions: [] as unknown[],
  secureFails: false,
  copied: [] as string[],
  externalLinks: [] as unknown[],
}));

const clerk = vi.hoisted(() => ({
  loaded: true,
  signedIn: true,
  email: 'dana.kim@example.com' as string | null,
  /** Every Clerk hook or component used, in order (CS-N1). */
  used: [] as string[],
  calls: [] as string[],
  answers: {} as Record<string, (params: unknown) => Promise<Record<string, unknown>>>,
  resource: null as unknown,
}));

vi.mock('@clerk/clerk-expo', () => {
  const resource = (view: Record<string, unknown>): Record<string, unknown> => {
    const call = (name: string) => async (params: unknown) => {
      clerk.calls.push(`${name}:${JSON.stringify(params)}`);
      const answer = clerk.answers[name];
      if (answer === undefined) throw new Error(`no answer for ${name}`);
      return resource(await answer(params));
    };
    return { ...view, create: call('create'), prepareFirstFactor: call('prepareFirstFactor'), attemptFirstFactor: call('attemptFirstFactor'), prepareSecondFactor: call('prepareSecondFactor'), attemptSecondFactor: call('attemptSecondFactor') };
  };
  const signIn = resource({ status: null, supportedFirstFactors: null, supportedSecondFactors: null, createdSessionId: null });
  const setActive = async (params: unknown): Promise<void> => {
    clerk.calls.push(`setActive:${JSON.stringify(params)}`);
    clerk.signedIn = true;
  };
  return {
    useAuth: () => {
      clerk.used.push('useAuth');
      return { isLoaded: clerk.loaded, isSignedIn: clerk.signedIn, getToken: async () => 'token-1', signOut: async () => undefined };
    },
    useUser: () => {
      clerk.used.push('useUser');
      return { user: clerk.email === null ? null : { primaryEmailAddress: { emailAddress: clerk.email } } };
    },
    useSignIn: () => {
      clerk.used.push('useSignIn');
      return { isLoaded: true, signIn, setActive };
    },
    ClerkProvider: ({ children }: { children?: unknown }) => {
      clerk.used.push('ClerkProvider');
      return children;
    },
  };
});
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListeners.push(listener);
    return () => {
      env.onlineListeners = env.onlineListeners.filter((l) => l !== listener);
    };
  },
}));
vi.mock('../../../platform/telemetry', () => ({
  track: async (event: { name: string; payload: Record<string, unknown> }) => {
    env.tracked.push(event);
    return true;
  },
}));
vi.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: async (key: string) => void env.capture.push(`prevent ${key}`),
  allowScreenCaptureAsync: async (key: string) => void env.capture.push(`allow ${key}`),
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: async (key: string, options: unknown) => {
    env.secureOptions.push(options);
    if (env.secureFails) throw new Error('locked');
    return env.secure.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string, options: unknown) => {
    env.secureOptions.push(options);
    if (env.secureFails) throw new Error('locked');
    env.secure.set(key, value);
  },
  deleteItemAsync: async (key: string, options: unknown) => {
    env.secureOptions.push(options);
    if (env.secureFails) throw new Error('locked');
    env.secure.delete(key);
  },
}));
vi.mock('../../../platform/pwa', () => ({ copyText: async (text: string) => {
    env.copied.push(text);
    return true;
  } }));
vi.mock('../../../platform/external-link', () => ({
  openExternalLink: async (...args: unknown[]) => void env.externalLinks.push(args),
  isOffline: async () => false,
}));
vi.mock('../../../platform/screen-reader', () => ({ focusForScreenReader: () => undefined }));
vi.mock('../../../platform/grown-up-tab', () => ({ endGrownUpTab: () => undefined }));
vi.mock('../../../platform/crypto', () => ({
  pinHasher: { hash: async (pin: string) => `h:${pin}`, verify: async (pin: string, stored: string) => stored === `h:${pin}` },
}));
const biometricPort = vi.hoisted(() => ({
  available: async () => true,
  write: async () => 'written' as const,
  read: async () => 'ok' as const,
  remove: async () => undefined,
}));
vi.mock('../../../platform/biometric', () => ({ biometric: biometricPort }));
// The navigation library's native build does not load in Node (Flow sources): what the screens here use of it, and the
// native stack as a stand-in (the nested stack is never rendered here; its routes are mounted one by one below).
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    useIsFocused: () => true,
    useNavigation: () => ({ navigate: () => undefined, goBack: () => undefined, addListener: () => () => undefined }),
    useRoute: () => ({ key: 'route', name: 'route', params: {} }),
    NavigationContext: createContext(undefined),
    NavigationRouteContext: createContext(undefined),
    NavigationContainerRefContext: createContext(undefined),
    Link: () => null,
    CommonActions: { reset: (payload: unknown) => ({ type: 'RESET', payload }), navigate: (...args: unknown[]) => ({ type: 'NAVIGATE', payload: args }), goBack: () => ({ type: 'GO_BACK' }) },
    StackActions: { replace: (name: string, params?: unknown) => ({ type: 'REPLACE', payload: { name, params } }), push: (name: string, params?: unknown) => ({ type: 'PUSH', payload: { name, params } }), pop: () => ({ type: 'POP' }), popToTop: () => ({ type: 'POP_TO_TOP' }) },
  };
});
vi.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
// react-native-web's Image needs a browser window: the covers stand in as host nodes that say what they draw.
vi.mock('../AccountCover', async () => {
  const { createElement: h } = await import('react');
  return { AccountCover: ({ image = true }: { image?: boolean }) => h('account-cover', { 'data-testid': 'account-cover', image }) };
});

import { ACCOUNT_CAPTURE_KEY, accountCaptureHolders } from '../../../platform/account-capture';
import { applyGateToTokens, clerkTokens, ensureInstallSweep } from '../../../platform/clerk-token-cache.native';
import { reportCrash } from '../../../platform/crash-report';
import { nativeSignInConfig } from '../../../config/native-signin';
import { classifySignInError, submitEmail, type SignInPort } from '../../../logic/account/sign-in-step';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { ACCOUNT_ROUTE_NAMES } from '../../../logic/account/account-gate';
import { accountUrl, createAccountApi } from '../../../logic/account/api';
import { INSTALLED_KEY, runInstallSweep } from '../../../logic/account/install-sweep';
import { nativeAccountEnabled } from '../../../logic/account/native-account';
import { DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, afterSignInPlan } from '../../../logic/account/sign-in-records';
import { CLERK_INDEX_KEY, CLERK_KEYCHAIN_SERVICE } from '../../../logic/account/token-cache';
import { grownUpRows } from '../../../logic/profiles/who';
import { GrownUpStack, bindAccountQueryClearing, endMemorySession, prepareClerkMount, type ClerkMountDeps } from '../../../navigation/grown-up-stack.native';
import { pinHashFingerprint } from '../../../logic/shell/device-gate';
import { useAccountStore, PIN_HASH_KEY } from '../../../store/account-store';
import { useAccountVisit } from '../../../store/account-visit';
import { closeGrownUpSession } from '../../../store/grown-up-session';
import { useGuestStore } from '../../../store/guest-store';
import { useLocaleStore } from '../../../store/locale-store';
import { nativeGateState } from '../../../store/native-gate-state';
import { PROFILES_KEY, useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { resetChooserState } from '../../../store/who-chooser';
import { bindGrownUpBackgroundRule } from '../../parent/use-gate-lapse';
import { PinEntryScreen } from '../../parent/PinEntryScreen';
import { WhoIsUsingScreen } from '../../who/WhoIsUsingScreen';
import { provideForRequire, srcPath } from '../../../test-support/native-require';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountCard } from '../AccountCard.native';
import { AccountClassReportScreen } from '../AccountClassReportScreen.native';
import { AccountHomeScreen } from '../AccountHomeScreen.native';
import { AccountHostContext, ClerkMountContext, type AccountHost, type ClerkMountState } from '../account-host';
import { AccountLearnerReportScreen } from '../AccountLearnerReportScreen.native';
import { AccountSchoolScreen } from '../AccountSchoolScreen.native';
import { AccountSpaceScreen } from '../AccountSpaceScreen.native';
import { SignInScreen } from '../SignInScreen.native';
import { WelcomeAccountRow } from '../WelcomeAccountRow.native';

const OSES = ['ios', 'android'] as const;
const LOCALES: UiLocale[] = ['en', 'es', 'ko'];
const en = getMessages('en');
const m = en.caregiver.account;
const NOW = '2026-11-08T12:00:00.000Z';
/** When the device's PIN was set (`account:pinSetAt`): the trust epoch. */
const EPOCH = Date.parse('2026-11-01T09:00:00.000Z');
const EMAIL = 'dana.kim@example.com';
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../../../..');
const SRC = join(APP, 'src');

// ---- The Worker (the design README's fixture account: a family owner who teaches, and a school admin) ----

const space = (id: string, kind: string, name: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({ id, kind, name, parentSpaceId: null, settings: {}, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z', ...over });
const item = (id: string, kind: string, name: string, role: string, over: { createdAt?: string; archivedAt?: string | null; learners?: number; attention?: unknown; joinCode?: string | null } = {}): Record<string, unknown> => ({
  space: space(id, kind, name, { createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z', archivedAt: over.archivedAt ?? null }),
  role,
  counts: { learners: over.learners ?? 2, accounts: 1, classes: 0 },
  joinCode: over.joinCode ?? null,
  joinCodeExpiresAt: null,
  ...(over.attention === undefined ? {} : { attention: over.attention }),
});
const ALL_SPACES = [
  item('space:kim', 'family', 'Kim family', 'owner', { joinCode: 'K7MPQ4' }),
  item('space:park', 'family', 'Grandma Park family', 'caregiver', { createdAt: '2026-03-01T00:00:00.000Z' }),
  item('space:spring', 'family', 'Spring family', 'owner', { createdAt: '2025-03-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z' }),
  item('space:saturday', 'class', 'Saturday class 3B', 'owner', { createdAt: '2026-04-01T00:00:00.000Z', learners: 24, attention: { relinks: 1, moves: 1, relinkExpiresAt: '2026-11-09T00:00:00.000Z' } }),
  item('space:sunflower', 'class', 'Sunflower class', 'teacher', { createdAt: '2026-05-01T00:00:00.000Z', learners: 18 }),
  item('space:old', 'class', 'Spring 2026 class', 'owner', { createdAt: '2025-03-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z', learners: 14 }),
  item('space:maple', 'school', 'Maple Heritage School', 'admin', { createdAt: '2026-02-01T00:00:00.000Z' }),
  item('space:lakeside', 'school', 'Lakeside Korean School', 'teacher', { createdAt: '2026-07-01T00:00:00.000Z' }),
];
let spaces: unknown[] = ALL_SPACES;

const rosterLearner = (id: string, name: string, joinedAt: string, minutes: number | null): Record<string, unknown> => ({
  id,
  displayName: name,
  ageGroup: 'child',
  avatar: 'tiger',
  joinedAt,
  lastActiveAt: '2026-11-08T10:00:00.000Z',
  summary: minutes === null ? null : { lastActiveAt: '2026-11-08T10:00:00.000Z', minutesLast7d: minutes, cardsUnlocked: 1 },
});
const ROSTERS: Record<string, unknown> = {
  'space:kim': { space: space('space:kim', 'family', 'Kim family'), learners: [rosterLearner('profile:jun', 'Jun', '2026-03-01T00:00:00.000Z', 90), rosterLearner('profile:mina', 'Mina', '2026-02-01T00:00:00.000Z', 34)], joinCode: 'K7MPQ4', seats: {} },
  'space:park': { space: space('space:park', 'family', 'Grandma Park family'), learners: [rosterLearner('profile:sora', 'Sora', '2026-03-02T00:00:00.000Z', null)], joinCode: null },
  'space:spring': { space: space('space:spring', 'family', 'Spring family', { archivedAt: '2026-01-01T00:00:00.000Z' }), learners: [], joinCode: null },
  'space:saturday': { space: space('space:saturday', 'class', 'Saturday class 3B'), learners: [rosterLearner('profile:ben', 'Ben', '2026-03-01T00:00:00.000Z', 20), rosterLearner('profile:ana', 'Ana', '2026-02-01T00:00:00.000Z', 0)], joinCode: 'H3TRW9', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z', seats: { used: 2, limit: 30 } },
  'space:sunflower': { space: space('space:sunflower', 'class', 'Sunflower class', { parentSpaceId: 'space:maple' }), learners: [rosterLearner('profile:chloe', 'Chloe', '2026-02-01T00:00:00.000Z', 12)], joinCode: null },
  'space:old': { space: space('space:old', 'class', 'Spring 2026 class', { archivedAt: '2026-01-01T00:00:00.000Z' }), learners: [rosterLearner('profile:chloe', 'Chloe', '2026-02-01T00:00:00.000Z', 3)], joinCode: null },
  'space:empty': { space: space('space:empty', 'class', 'New class'), learners: [], joinCode: null },
};
const schoolClass = (id: string, name: string, createdAt: string, students: number): Record<string, unknown> => ({
  space: space(id, 'class', name, { parentSpaceId: 'space:maple', createdAt }),
  teacher: { accountId: 'acct:lee', name: 'Ms Lee' },
  students,
  practiced: 3,
  lastActiveAt: null,
  hasPublishedPlan: false,
  canRename: true,
  openMoves: false,
});
let schoolUsage: unknown = { students: 34, teachers: 6 };
const school = (): unknown => ({
  school: space('space:maple', 'school', 'Maple Heritage School'),
  invite: { joinCode: 'K7MPQ4', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' },
  license: { planKey: 'school_seat', status: 'active', seats: 20, expiresAt: '2027-01-31T00:00:00.000Z', updatedAt: 'x', active: true, subjectName: 'Maple Heritage School' },
  limits: { licensed: true, students: 500, teachers: 20 },
  canRename: true,
  usage: schoolUsage,
  thisWeek: { students: 34, practiced: 20, classes: 2, classesWithPlan: 0 },
  classes: [schoolClass('space:room12', 'Room 12', '2026-06-01T00:00:00.000Z', 10), schoolClass('space:saturday', 'Saturday class 3B', '2026-04-01T00:00:00.000Z', 24), schoolClass('space:refused', 'Room 7', '2026-05-01T00:00:00.000Z', 4)],
});
const CLASS_REPORT = {
  v: 1,
  headline: { code: 'class_practiced', practiced: 18, learners: 24, up: true },
  class: { learners: 24, withActivity: 24, olderApp: 0, notSaved7d: 0 },
  wentWell: { lettersNew: [{ letter: 'ㅂ', learners: 5 }], questsNew: { count: 14 }, cardsNew: 9, milestones: [] },
  revisit: [{ letter: 'ㄹ', learners: 4 }],
  practice: { dayBands: [{ band: '0', learners: 6 }, { band: '1-2', learners: 6 }, { band: '3-4', learners: 6 }, { band: '5-7', learners: 6 }], notSaved: 0 },
  time: { minutesTotal: { count: 212 }, minutesMedian: 24 },
  levelCheck: [{ strand: 'hangul-recognition', secure: 4, gettingThere: 3, notYet: 1, notTested: 16 }],
  plans: [{ planId: 'plan:week-1', title: 'Week 1 letters', assigned: 12, started: 9, finished: 6, itemsDone: 30 }],
};
const classReport = (spaceId: string, query: string): unknown => {
  const params = new URLSearchParams(query);
  const period = params.get('period') ?? 'week';
  const archived = spaceId === 'space:old' ? { archivedAt: '2026-01-01T00:00:00.000Z' } : {};
  const kind = spaceId === 'space:kim' ? 'family' : 'class';
  const practice = period === 'week' ? CLASS_REPORT.practice : period === 'day' ? { dayBands: [{ band: 'practiced', learners: 1 }, { band: 'not_yet', learners: 23 }], notSaved: 0 } : period === 'month' ? { dayBands: [{ band: '0', learners: 24 }], notSaved: 0 } : {};
  return { data: { space: space(spaceId, kind, 'Saturday class 3B', archived), period, at: params.get('at'), serverTime: NOW, report: { ...CLASS_REPORT, period, practice } } };
};
const learnerReport = (spaceId: string): unknown => ({
  data: {
    space: space(spaceId, 'family', 'Kim family', spaceId === 'space:spring' ? { archivedAt: '2026-01-01T00:00:00.000Z' } : {}),
    learner: { id: 'profile:mina', displayName: 'Mina', avatar: 'tiger', joinedAt: '2026-02-01T00:00:00.000Z', lastActiveAt: '2026-11-08T10:00:00.000Z' },
    summary: {
      lastActiveAt: '2026-11-08T10:00:00.000Z',
      stage1: { questsDone: 6, questsTotal: 20, anchorAccuracy: null },
      cardsUnlocked: 5,
      minutesLast7d: 36,
      jamoRecognized: ['ㄱ', 'ㅏ'],
      needsPractice: ['ㅂ'],
      journey: { v: 1, here: 'stage1', stages: [] },
      activity: {
        v: 1,
        tz: 0,
        asOf: '2026-11-08',
        days: [{ d: '2026-11-07', min: 10, q: 1, c: 1, w: 0, j: ['ㅏ'] }],
        months: [{ m: '2026-11', min: 10, q: 1, c: 1, w: 0, days: 1 }],
        total: { since: '2026-10-01', min: 10, q: 1, c: 1, w: 0, days: 1 },
        milestones: [],
        // The free lessons are done: the free-end line's trigger, which never shows on native (D14).
        next: { end: true },
      },
    },
    lastSyncedAt: '2026-11-08T11:00:00.000Z',
    serverTime: NOW,
    scope: 'full',
  },
});
const planCard = (spaceId: string, kind: string, coverage: unknown, usage: unknown = null): Record<string, unknown> => ({
  spaceId,
  kind,
  name: 'x',
  role: 'owner',
  archived: false,
  // What a web summary would say: a payer, a buy and a manage action, receipts. The status view never sends these, and
  // the native plan block must not show them if one ever came (9.1, 9.4).
  payer: true,
  readOnlyReason: null,
  coverage,
  usage,
  actions: { buy: 'family_lifetime', manage: true, contact: true },
  receipts: [{ id: 'r1', amount: 4900, currency: 'usd' }],
  hasReceipts: true,
  legacyNoHistory: false,
});
const OWN = (planKey: string, status = 'active'): unknown => ({ state: 'own', planKey, status, expiresAt: '2027-01-31T00:00:00.000Z', statusSince: '2026-01-01T00:00:00.000Z', endsAtPeriodEnd: true });
const USAGE = { learners: 24, learnerCap: 40, teachers: 6, teacherCap: 20 };
let planCards: unknown[] = [];
const PLAN_VARIANTS: Record<string, unknown[]> = {
  own: [
    planCard('space:kim', 'family', OWN('family_lifetime'), { learners: 2, learnerCap: 6, teachers: null, teacherCap: null }),
    planCard('space:park', 'family', { state: 'free' }),
    planCard('space:saturday', 'class', { state: 'school', schoolName: 'Maple Heritage School', planKey: 'school_seat', expiresAt: '2027-01-31T00:00:00.000Z' }),
    planCard('space:sunflower', 'class', OWN('group_license'), USAGE),
    planCard('space:maple', 'school', OWN('school_seat'), USAGE),
  ],
  lapsed: [
    planCard('space:kim', 'family', OWN('family_lifetime', 'past_due'), { learners: 2, learnerCap: 6, teachers: null, teacherCap: null }),
    planCard('space:park', 'family', OWN('family_lifetime', 'expired')),
    planCard('space:saturday', 'class', OWN('group_license', 'cancelled'), USAGE),
    planCard('space:sunflower', 'class', { state: 'school', schoolName: 'Maple Heritage School', planKey: 'group_license', expiresAt: null }),
    planCard('space:maple', 'school', OWN('school_seat', 'trial'), USAGE),
  ],
  none: [],
};

function standardAnswer(method: string, path: string, query: string): { status: number; body: unknown } {
  if (method === 'GET' && path === '/api/spaces') return { status: 200, body: { data: { spaces } } };
  const roster = /^\/api\/spaces\/([^/]+)\/roster$/.exec(path);
  if (method === 'GET' && roster) {
    const data = ROSTERS[decodeURIComponent(roster[1]!)];
    return data === undefined ? { status: 404, body: { error: { code: 'not_found' } } } : { status: 200, body: { data } };
  }
  if (method === 'GET' && path === '/api/spaces/space%3Amaple/school') return { status: 200, body: { data: school() } };
  const report = /^\/api\/spaces\/([^/]+)\/class-report$/.exec(path);
  if (method === 'GET' && report) return decodeURIComponent(report[1]!) === 'space:refused' ? { status: 403, body: { error: { code: 'forbidden' } } } : { status: 200, body: classReport(decodeURIComponent(report[1]!), query) };
  const learner = /^\/api\/spaces\/([^/]+)\/learners\/profile%3Amina\/report$/.exec(path);
  if (method === 'GET' && learner) return { status: 200, body: learnerReport(decodeURIComponent(learner[1]!)) };
  if (method === 'GET' && path === '/api/billing/summary') return { status: 200, body: { data: { mode: 'none', purchasesOpen: false, cards: planCards, account: [] } } };
  if (method === 'POST' && /^\/api\/spaces\/[^/]+\/code$/.test(path)) return { status: 200, body: { data: { joinCode: 'N3WC0D' } } };
  return { status: 404, body: { error: { code: 'not_found' } } };
}
const failing =
  (status: number, code: string, only?: RegExp): NonNullable<typeof env.answer> =>
  (method, path, query) =>
    only === undefined || only.test(path) ? { status, body: { error: { code } } } : standardAnswer(method, path, query);
const offlineAnswer: NonNullable<typeof env.answer> = () => 'offline';

/** Whether any account request left the device (the gate must decide before one does). */
const accountRequests = (): string[] => env.fetches.map((f) => `${f.method} ${f.path}`);

// ---- The device ----

const learner = (id: string, displayName: string, learnerType: 'child' | 'self' = 'child'): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType,
});

type DeviceKind = 'pin' | 'nopin' | 'open' | 'empty';

/**
 * A device as storage and the stores hold it after launch (hydrated): `pin` two child learners and a PIN (epoch
 * `EPOCH`); `nopin` the same learners without a PIN; `open` one self-only learner and no PIN; `empty` no profile (Welcome).
 * `trust` is the stored trust record (`hr:grownup:trust`), `uses` the stored uses record.
 */
async function device(kind: DeviceKind, o: { trust?: unknown; uses?: unknown; epoch?: number } = {}): Promise<void> {
  await AsyncStorage.clear();
  const profiles = kind === 'empty' ? [] : kind === 'open' ? [learner('profile:ana', 'Ana', 'self')] : [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
  await AsyncStorage.setItem(`hr:${PROFILES_KEY}`, JSON.stringify(profiles));
  const hash = kind === 'pin' ? 'h:1234' : null;
  if (hash !== null) await AsyncStorage.setItem(`hr:${PIN_HASH_KEY}`, JSON.stringify(hash));
  if (o.trust !== undefined) await AsyncStorage.setItem(`hr:${TRUST_RECORD_KEY}`, JSON.stringify(o.trust));
  if (o.uses !== undefined) await AsyncStorage.setItem(`hr:${DEVICE_USES_RECORD_KEY}`, JSON.stringify(o.uses));
  useProfileStore.setState({ profiles, activeId: profiles[0]?.id ?? null, hydrated: true, activeSince: Date.parse(NOW) });
  useGuestStore.setState({ hydrated: true, record: null });
  useAccountStore.setState({ hydrated: true, pinHashReadFailed: false, parentPinHash: hash, pinSetAt: hash === null ? null : (o.epoch ?? EPOCH), pinHashSeen: pinHashFingerprint(hash), pinResetRequestedAt: null, pinResetByWait: null });
}
const TRUSTED = (): unknown => ({ v: 1, epoch: EPOCH });
const usesRecord = (uses: string[]): unknown => ({ v: 1, uses, at: Date.parse(NOW) - 60_000 });

/** A grown-up who typed the PIN just now and opened the 15-minute session (the chooser row's or the card's PIN). */
function typedPinNow(): void {
  useUiStore.setState({ lastPinTypedAt: Date.now(), lastPinVerifiedAt: Date.now(), parentGateOpenedAt: Date.now() });
}

// ---- The account screens, inside their stack ----

type AccountRoute = 'SignIn' | 'AccountHome' | 'AccountLearnerReport' | 'AccountSpace' | 'AccountSchool' | 'AccountClassReport';
const SCREENS: Record<AccountRoute, unknown> = {
  SignIn: SignInScreen,
  AccountHome: AccountHomeScreen,
  AccountLearnerReport: AccountLearnerReportScreen,
  AccountSpace: AccountSpaceScreen,
  AccountSchool: AccountSchoolScreen,
  AccountClassReport: AccountClassReportScreen,
};
/** Each route with the params a grown-up reaches it with, and the node its open content always draws. */
const ROUTES: Record<AccountRoute, { params: Record<string, unknown>; content: string }> = {
  SignIn: { params: { use: 'family' }, content: 'sign-in-step-email' },
  AccountHome: { params: { use: 'family' }, content: 'account-home-family' },
  AccountLearnerReport: { params: { spaceId: 'space:kim', learnerId: 'profile:mina', period: 'week', use: 'family' }, content: 'account-learner-report' },
  AccountSpace: { params: { spaceId: 'space:saturday', use: 'teacher' }, content: 'account-space' },
  AccountSchool: { params: { spaceId: 'space:maple', use: 'school' }, content: 'account-school' },
  AccountClassReport: { params: { spaceId: 'space:saturday', period: 'week', use: 'teacher' }, content: 'account-class-report' },
};

interface Nav {
  navigate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  parent: { navigate: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn>; goBack: ReturnType<typeof vi.fn> };
  getState: () => { index: number; routes: { key: string; name: string }[] };
  getParent: () => Nav['parent'];
  isFocused: () => boolean;
  addListener: (event: string, listener: () => void) => () => void;
  setOptions: ReturnType<typeof vi.fn>;
  emit: (event: 'focus' | 'blur') => Promise<void>;
}

function makeNav(names: string[]): Nav {
  const listeners: Record<string, (() => void)[]> = {};
  const parent = { navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn() };
  const routes = names.map((name, k) => ({ key: k === names.length - 1 ? 'me' : `r${k}`, name }));
  const nav: Nav = {
    navigate: vi.fn(),
    replace: vi.fn(),
    goBack: vi.fn(),
    dispatch: vi.fn(),
    reset: vi.fn(),
    parent,
    getState: () => ({ index: routes.length - 1, routes }),
    getParent: () => parent,
    isFocused: () => true,
    setOptions: vi.fn(),
    addListener: (event, listener) => {
      (listeners[event] ??= []).push(listener);
      return () => {
        listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
      };
    },
    emit: async (event) => {
      await act(async () => (listeners[event] ?? []).forEach((l) => l()));
      await settle();
    },
  };
  return nav;
}

function HeaderTitle({ options }: ScreenHeaderSlotProps): ReactElement {
  return createElement('header-title', { 'data-testid': 'header-title' }, options?.title ?? null);
}

/**
 * Waits (real time, at most `ms`) until `check` holds: a part loaded with `import()` and drawn through Suspense shows
 * only after React's fallback throttle the first time it loads.
 */
async function until(check: () => boolean, ms = 1500): Promise<void> {
  // `Date` is faked in this file; the wall clock is `performance`.
  const end = performance.now() + ms;
  while (!check() && performance.now() < end) await settle(5);
}

async function settle(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1));
    });
  }
}

let client: QueryClient;
let host: AccountHost & { endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> };

function providers(child: ReactElement, mount: ClerkMountState = 'ready'): ReactElement {
  host = { mount, endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  return createElement(
    QueryClientProvider,
    { client },
    createElement(ScreenHeaderSlotContext.Provider, { value: HeaderTitle }, createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: mount }, child))),
  );
}

/**
 * Mounts an account route as the nested stack would: `below` are the routes under it (`['ParentDashboard']`: entered
 * from outside the account routes, as the chooser row's and the card's entries are; `['ParentDashboard',
 * 'AccountHome']`: a page opened from a home).
 */
async function mountRoute(route: AccountRoute, o: { below?: string[]; params?: Record<string, unknown>; mount?: ClerkMountState } = {}): Promise<{ r: ReactTestRenderer; nav: Nav }> {
  const nav = makeNav([...(o.below ?? ['ParentDashboard']), route]);
  const params = o.params ?? ROUTES[route].params;
  const r = await render(providers(createElement(SCREENS[route] as never, { navigation: nav, route: { key: 'me', name: route, params } } as never), o.mount));
  await settle();
  return { r, nav };
}

/**
 * The Grown-up area itself (`GrownUpStack`, the root stack's `ParentDashboard` route on iOS and Android), mounted with
 * the same query client as the account screens: the module-level session listener clears that client's account
 * queries (CS-N4). Its nested navigator is a stand-in here; the account routes are mounted one by one.
 */
async function mountArea(): Promise<ReactTestRenderer> {
  const area = await render(providers(createElement(GrownUpStack, { navigation: makeNav(['Main', 'ParentDashboard']), route: { key: 'area', name: 'ParentDashboard', params: {} } } as never)));
  await settle();
  return area;
}
const accountQueries = (): unknown[] => client.getQueryCache().findAll({ queryKey: ['account'] });
const chooserRows = (root: ReactTestInstance): string[] => hostNodes(root, (n) => /^who-row-[a-z]+$/.test(String(n.props['data-testid'] ?? ''))).map((n) => String(n.props['data-testid']));

const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
const lockCause = (root: ReactTestInstance): string | null => {
  const node = hostNodes(root, (n) => /^account-lock-(unknown|epoch_zero|no_trust|pin_changed|retrust_password)$/.test(String(n.props['data-testid'] ?? '')))[0];
  return node === undefined ? null : String(node.props['data-testid']).replace('account-lock-', '');
};
const shows = (root: ReactTestInstance, text: string): boolean => screenTexts(root).some((t) => t.includes(text));

// ---- The app state (react-native-web has no app lifecycle) ----

let appListeners: ((state: string) => void)[] = [];
let appState = 'active';
const toApp = async (state: string): Promise<void> => {
  appState = state;
  await act(async () => [...appListeners].forEach((l) => l(state)));
  await settle();
};

beforeAll(async () => {
  // The chooser requires its native account entries on iOS and Android (folded away on the web): give Node's require them.
  provideForRequire(srcPath('screens/account/account-entries'), await import('../account-entries.native'));
  // The card's parts load with import() when first drawn: load them once here, so every state draws on its first pass.
  await Promise.all([import('../AccountCardBody.native'), import('../AccountCardClerk.native')]);
});

beforeEach(async () => {
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
  vi.stubEnv('EXPO_PUBLIC_NATIVE_SIGNIN', 'on');
  vi.stubEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20k');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, lastPinTypedAt: null, gateReturnPending: false });
  useAccountVisit.setState({ visit: 0, lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
  resetChooserState();
  Object.assign(env, { online: true, onlineListeners: [], tracked: [], fetches: [], answer: null, capture: [], secureOptions: [], secureFails: false, copied: [], externalLinks: [] });
  env.secure.clear();
  Object.assign(clerk, { loaded: true, signedIn: true, email: EMAIL, used: [], calls: [], answers: {} });
  spaces = ALL_SPACES;
  schoolUsage = { students: 34, teachers: 6 };
  planCards = PLAN_VARIANTS.own!;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    const headers = { ...(init.headers as Record<string, string>) };
    env.fetches.push({ method: String(init.method), path: parsed.pathname, headers });
    const query = parsed.search.replace(/[?&]_=\d+/, '').replace(/^&/, '?');
    const answer = await (env.answer ?? standardAnswer)(String(init.method), parsed.pathname, query);
    if (answer === 'offline') throw new TypeError('Network request failed');
    return { status: answer.status, url, type: 'basic', json: async () => structuredClone(answer.body) };
  });
  appListeners = [];
  appState = 'active';
  vi.spyOn(AppState, 'currentState', 'get').mockImplementation(() => appState as never);
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appListeners.push(listener as (state: string) => void);
    return { remove: () => void (appListeners = appListeners.filter((l) => l !== listener)) } as never;
  });
  vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  await device('pin', { trust: TRUSTED(), uses: usesRecord(['family', 'teacher', 'school']) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetPlatform();
});

// =====================================================================================================================

describe('the device the suite runs on', () => {
  it('reads as the device says, exactly: pin with its epoch, nopin, open, and Welcome’s empty device (open)', async () => {
    expect(await nativeGateState()).toEqual({ state: 'pin', epoch: EPOCH });
    await device('nopin');
    expect(await nativeGateState()).toEqual({ state: 'nopin' });
    await device('open');
    expect(await nativeGateState()).toEqual({ state: 'open' });
    await device('empty');
    expect(await nativeGateState()).toEqual({ state: 'open' });
  });
});

// =====================================================================================================================

describe('CS-N1: no learner screen renders the sign-in, an account name or email, or any Clerk element', () => {
  for (const os of OSES) {
    it(`${os}: the chooser and Welcome (the learner roots that carry account rows) call no Clerk hook and show no email or sign-in`, async () => {
      setPlatform(os);
      const chooserNav = makeNav(['WhoIsUsing']);
      const chooser = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: chooserNav, route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
      await settle();
      const welcome = await render(providers(createElement(WelcomeAccountRow, { navigation: makeNav(['Welcome']) as never })));
      await settle();
      for (const r of [chooser, welcome]) {
        const texts = screenTexts(r.root).join('\n');
        expect(texts).not.toContain(EMAIL);
        expect(texts).not.toContain(m.signIn.title);
        expect(r.root.findAll((n) => n.type === TextInput)).toEqual([]);
      }
      expect(clerk.used).toEqual([]);
    });
  }

  it('ClerkProvider’s module loads only for the Grown-up area, only after the install sweep, and only on pin or open', async () => {
    const run = async (over: Partial<ClerkMountDeps>): Promise<{ loads: number; state: string }> => {
      let loads = 0;
      const deps: ClerkMountDeps = {
        config: { flag: true, publishableKey: 'pk_live_x', enabled: true },
        sweep: async () => true,
        gate: async () => ({ state: 'pin', epoch: EPOCH }),
        applyGate: async () => true,
        load: async () => {
          loads += 1;
          return { clerkHost: { Provider: () => null, endSession: async () => true } as never };
        },
        ...over,
      };
      const state = (await prepareClerkMount(deps)).state;
      return { loads, state };
    };
    expect(await run({})).toEqual({ loads: 1, state: 'ready' });
    expect(await run({ gate: async () => ({ state: 'open' }) })).toMatchObject({ state: 'ready' });
    // No sweep, an unknown gate, the switch off or no key: nothing of Clerk's is even loaded.
    expect(await run({ sweep: async () => false })).toEqual({ loads: 0, state: 'off' });
    expect(await run({ gate: async () => ({ state: 'unknown' }) })).toEqual({ loads: 0, state: 'off' });
    expect(await run({ config: { flag: false, publishableKey: null, enabled: false } })).toEqual({ loads: 0, state: 'off' });
    // nopin: Clerk is loaded only to end an earlier visit's session, and the provider never mounts.
    expect((await run({ gate: async () => ({ state: 'nopin' }) })).state).toBe('off');
  });

  it('the root stack’s only way to Clerk is the Grown-up area route; no learner screen module imports Clerk or its host', () => {
    const root = readFileSync(join(SRC, 'navigation/root.tsx'), 'utf8');
    expect(root).toMatch(/require\('\.\/grown-up-stack'\)[^\n]*\.GrownUpArea/);
    const offenders = sourcesUnder(SRC)
      .filter((file) => !/\/screens\/account\/|\/platform\/clerk[^/]*\.native\.tsx?$|\/navigation\/grown-up-stack\.native\.tsx$|__tests__/.test(file))
      .filter((file) => /(from|import\()\s*'(@clerk\/clerk-expo|[^']*platform\/clerk(\.native)?|[^']*clerk-token-cache(\.native)?)'/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => relative(APP, f))).toEqual([]);
  });
});

// =====================================================================================================================

const ALL_ROUTES = Object.keys(ROUTES) as AccountRoute[];

describe('CS-N2: every account screen sits in AccountGate, which decides before any account call', () => {
  it('every account route is registered in the nested Grown-up area stack and renders AccountGate', () => {
    const stack = readFileSync(join(SRC, 'navigation/grown-up-stack.native.tsx'), 'utf8');
    for (const route of ACCOUNT_ROUTE_NAMES) {
      expect(stack, route).toMatch(new RegExp(`<Stack\\.Screen name="${route}" getComponent=`));
      const file = join(SRC, `screens/account/${route === 'SignIn' ? 'SignInScreen' : `${route}Screen`}.native.tsx`);
      expect(readFileSync(file, 'utf8'), route).toMatch(/<AccountGate\b/);
    }
    expect([...ACCOUNT_ROUTE_NAMES].sort()).toEqual([...ALL_ROUTES].sort());
  });

  for (const route of ALL_ROUTES) {
    describe(route, () => {
      it('unknown (a store not hydrated): the cantCheck lock, no account call, no content', async () => {
        useProfileStore.setState({ hydrated: false });
        typedPinNow();
        const { r } = await mountRoute(route);
        expect(lockCause(r.root)).toBe('unknown');
        expect(has(r.root, ROUTES[route].content)).toBe(false);
        expect(accountRequests()).toEqual([]);
      });

      it('nopin: the Grown-up area gives way to PIN setup, no account call (ND-7)', async () => {
        await device('nopin');
        typedPinNow();
        const { r, nav } = await mountRoute(route);
        expect(nav.parent.replace).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard' });
        expect(has(r.root, ROUTES[route].content)).toBe(false);
        expect(accountRequests()).toEqual([]);
      });

      it('pin, entered from outside with the 15-minute session open but no typed PIN (face or fingerprint): the typed PIN first', async () => {
        useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now(), lastPinTypedAt: null });
        const { r, nav } = await mountRoute(route);
        expect(nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin', typedOnly: true }));
        expect(has(r.root, ROUTES[route].content)).toBe(false);
        expect(accountRequests()).toEqual([]);
      });

      it('pin, a typed PIN older than 2 minutes: the typed PIN first', async () => {
        useUiStore.setState({ parentGateOpenedAt: Date.now() - 3 * 60_000, lastPinVerifiedAt: Date.now() - 3 * 60_000, lastPinTypedAt: Date.now() - 3 * 60_000 });
        const { r, nav } = await mountRoute(route);
        expect(nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin', typedOnly: true }));
        expect(has(r.root, ROUTES[route].content)).toBe(false);
        expect(accountRequests()).toEqual([]);
      });

      it('open, Clerk signed in from an earlier visit (not this one): the sign-in, no account call (ND-9)', async () => {
        await device('open');
        clerk.signedIn = true;
        const { r, nav } = await mountRoute(route);
        if (route === 'SignIn') {
          expect(has(r.root, 'sign-in-step-email')).toBe(true);
        } else {
          expect(nav.replace).toHaveBeenCalledWith('SignIn', expect.anything());
          expect(has(r.root, ROUTES[route].content)).toBe(false);
        }
        expect(accountRequests()).toEqual([]);
      });

      if (route !== 'SignIn') {
        it('pin, signed in, trusted, typed PIN just now: the content, and only then the account reads', async () => {
          typedPinNow();
          const { r } = await mountRoute(route);
          expect(has(r.root, ROUTES[route].content)).toBe(true);
          expect(accountRequests().length).toBeGreaterThan(0);
          expect(accountRequests().every((req) => /^(GET|POST) \/api\/(spaces|billing\/summary)/.test(req))).toBe(true);
        });

        it('pin, opened from another account page inside the 15-minute session: no PIN asked again (OA-D5b)', async () => {
          useUiStore.setState({ parentGateOpenedAt: Date.now() - 10 * 60_000, lastPinTypedAt: Date.now() - 10 * 60_000, lastPinVerifiedAt: Date.now() - 10 * 60_000 });
          const { r, nav } = await mountRoute(route, { below: ['ParentDashboard', 'AccountHome'] });
          expect(nav.navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
          expect(has(r.root, ROUTES[route].content)).toBe(true);
        });

        it('pin, opened from another account page after the 15-minute session ended: no content, no account call', async () => {
          useUiStore.setState({ parentGateOpenedAt: null, lastPinTypedAt: null, lastPinVerifiedAt: null });
          const { r } = await mountRoute(route, { below: ['ParentDashboard', 'AccountHome'] });
          expect(has(r.root, ROUTES[route].content)).toBe(false);
          expect(accountRequests()).toEqual([]);
        });
      }
    });
  }

  it('a decision on focus and on the return to active: a PIN changed meanwhile locks an open home at once', async () => {
    typedPinNow();
    const { r, nav } = await mountRoute('AccountHome');
    expect(has(r.root, 'account-home-family')).toBe(true);
    await act(async () => useAccountStore.getState().setParentPinHash('h:5678'));
    await settle();
    await nav.emit('focus');
    expect(lockCause(r.root)).toBe('pin_changed');
    expect(has(r.root, 'account-home-family')).toBe(false);
    // And on the return to `active` (a second screen mounted over a fresh device).
    await device('pin', { trust: TRUSTED() });
    typedPinNow();
    const second = await mountRoute('AccountHome');
    expect(has(second.r.root, 'account-home-family')).toBe(true);
    await act(async () => useAccountStore.getState().setParentPinHash('h:2468'));
    await toApp('background');
    await toApp('active');
    expect(lockCause(second.r.root)).toBe('pin_changed');
  });
});

// =====================================================================================================================

describe('CS-N3: a changed PIN, epoch 0 or an unreadable trust never opens; a re-trust needs the password', () => {
  it('a PIN changed since the sign-in (setParentPinHash: setup, change, Rescue Code and the 24-hour wait all write through it) locks', async () => {
    typedPinNow();
    await act(async () => useAccountStore.getState().setParentPinHash('h:9999'));
    await settle();
    expect((await nativeGateState()).state).toBe('pin');
    expect(await nativeGateState()).not.toEqual({ state: 'pin', epoch: EPOCH });
    typedPinNow();
    const { r } = await mountRoute('AccountHome');
    expect(lockCause(r.root)).toBe('pin_changed');
    expect(accountRequests()).toEqual([]);
    expect(screenTexts(r.root)).not.toContain(EMAIL);
  });

  it('a PIN whose epoch memory has not reconciled with storage reads unknown, never the old epoch', async () => {
    useAccountStore.setState({ pinHashSeen: pinHashFingerprint('h:0000') });
    expect(await nativeGateState()).toEqual({ state: 'unknown' });
  });

  it('epoch 0 (a PIN older than the epoch record) is never trusted, even with a trust record for 0', async () => {
    await device('pin', { epoch: 0, trust: { v: 1, epoch: 0 } });
    typedPinNow();
    const { r } = await mountRoute('AccountHome');
    expect(lockCause(r.root)).toBe('epoch_zero');
    expect(shows(r.root, en.console.lock.pinRenew)).toBe(true);
    expect(accountRequests()).toEqual([]);
  });

  it.each([
    ['absent', undefined, 'no_trust'],
    ['damaged', { v: 1, epoch: 'x' }, 'no_trust'],
    ['for another epoch', { v: 1, epoch: EPOCH - 1 }, 'pin_changed'],
  ] as const)('a trust record %s: locked (%s), Sign in again', async (_name, trust, cause) => {
    await device('pin', trust === undefined ? {} : { trust });
    typedPinNow();
    const { r } = await mountRoute('AccountHome');
    expect(lockCause(r.root)).toBe(cause);
    expect(has(r.root, 'account-lock-sign-in-again')).toBe(true);
    expect(accountRequests()).toEqual([]);
  });

  it('a trust read that fails is no trust (the lock), never an open home', async () => {
    typedPinNow();
    const getItem = AsyncStorage.getItem.bind(AsyncStorage);
    vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => {
      if (key === `hr:${TRUST_RECORD_KEY}`) throw new Error('disk');
      return getItem(key);
    });
    const { r } = await mountRoute('AccountHome');
    expect(lockCause(r.root)).toBe('no_trust');
    expect(accountRequests()).toEqual([]);
  });

  it('re-trust: after a change, an email code alone writes no trust; a password or a second step does (7.3, R-1)', () => {
    const gate = { state: 'pin' as const, epoch: EPOCH };
    const stale = { kind: 'trust' as const, trust: { v: 1 as const, epoch: EPOCH - 1 } };
    expect(afterSignInPlan(gate, stale, false, { method: 'email_code', second: null, hasPassword: true })).toMatchObject({ writeTrust: false, retrustPending: true });
    expect(afterSignInPlan(gate, { kind: 'none' }, true, { method: 'email_code', second: null, hasPassword: true })).toMatchObject({ writeTrust: false, retrustPending: true });
    // The device check and an emailed second step prove the same inbox: no re-trust.
    expect(afterSignInPlan(gate, stale, false, { method: 'email_code', second: 'email_code', hasPassword: true })).toMatchObject({ writeTrust: false });
    expect(afterSignInPlan(gate, stale, false, { method: 'password', second: null, hasPassword: true })).toMatchObject({ writeTrust: true, retrustPending: false });
    expect(afterSignInPlan(gate, stale, false, { method: 'email_code', second: 'totp', hasPassword: true })).toMatchObject({ writeTrust: true });
    // An account with no password re-trusts with its code (R-1 records it).
    expect(afterSignInPlan(gate, stale, false, { method: 'email_code', second: null, hasPassword: false })).toMatchObject({ writeTrust: true });
    // Epoch 0 is never written as a trust.
    expect(afterSignInPlan({ state: 'pin', epoch: 0 }, { kind: 'none' }, false, { method: 'password', second: null, hasPassword: true })).toMatchObject({ writeTrust: false });
  });

  it('D21: while a re-trust is pending, Continue goes to the password step and sends no code', async () => {
    const calls: string[] = [];
    const port: SignInPort = {
      create: async () => {
        calls.push('create');
        return { status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }, { strategy: 'password' }], supportedSecondFactors: null, clientTrustState: null, createdSessionId: null };
      },
      prepareFirstFactor: async () => {
        calls.push('prepare');
        return { status: 'needs_first_factor', supportedFirstFactors: null, supportedSecondFactors: null, clientTrustState: null, createdSessionId: null };
      },
    } as unknown as SignInPort;
    expect(await submitEmail(port, EMAIL, true)).toMatchObject({ type: 'to_password' });
    expect(calls).toEqual(['create']);
    // Without a pending re-trust the same account gets the code (the control).
    expect(await submitEmail(port, EMAIL, false)).toMatchObject({ type: 'to_code' });
    expect(calls).toEqual(['create', 'create', 'prepare']);
  });
});

// =====================================================================================================================

describe('CS-N4: closing the grown-up session clears the account and asks the gate again', () => {
  it('every close (chooser, learner change, leaving the area, 15 minutes, background) cancels and clears the account queries and ends the visit', async () => {
    const unbind = bindAccountQueryClearing();
    try {
      for (const reason of ['exit', 'switch', 'background'] as const) {
        const area = await mountArea();
        typedPinNow();
        useAccountVisit.getState().markSignedIn(Date.now(), false);
        const { r } = await mountRoute('AccountHome');
        expect(has(r.root, 'account-home-family')).toBe(true);
        expect(client.getQueryData(['account', 'spaces'])).toBeDefined();
        // A read still on its way when the session closes must not refill the cache.
        let answer: (a: Answer) => void = () => undefined;
        env.answer = (method, path, query) => (path === '/api/spaces' ? new Promise<Answer>((resolve) => (answer = resolve)) : standardAnswer(method, path, query));
        await act(async () => void client.refetchQueries({ queryKey: ['account', 'spaces'] }));
        await act(async () => closeGrownUpSession(reason));
        await act(async () => answer(standardAnswer('GET', '/api/spaces', '')));
        await settle();
        expect(accountQueries(), reason).toEqual([]);
        expect(useAccountVisit.getState()).toMatchObject({ signedInThisVisit: false, lastAccountSignInAt: null });
        expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinTypedAt: null, lastPinVerifiedAt: null });
        env.answer = null;
        await unmount(r);
        await unmount(area);
        // Reopening asks the gate again: the typed PIN first, before any account call.
        env.fetches = [];
        const again = await mountRoute('AccountHome');
        expect(again.nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin', typedOnly: true }));
        expect(accountRequests()).toEqual([]);
        await unmount(again.r);
      }
    } finally {
      unbind();
    }
  });

  it('a session whose 15 minutes end while a home is open closes, and the home does not stay', async () => {
    typedPinNow();
    const { r } = await mountRoute('AccountHome');
    expect(has(r.root, 'account-home-family')).toBe(true);
    vi.setSystemTime(Date.parse(NOW) + 15 * 60_000 + 1);
    await toApp('background');
    await toApp('active');
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(has(r.root, 'account-home-family')).toBe(false);
  });

  it('a device with no PIN: the close ends Clerk’s memory session and drops its items (ND-9)', async () => {
    const order: string[] = [];
    await endMemorySession({ storage: () => 'memory', endSession: async () => {
        order.push('clerk sign-out');
        return true;
      }, dropMemoryItems: () => void order.push('drop items') });
    expect(order).toEqual(['clerk sign-out', 'drop items']);
    order.length = 0;
    await endMemorySession({ storage: () => 'secure', endSession: async () => {
        order.push('clerk sign-out');
        return true;
      }, dropMemoryItems: () => void order.push('drop items') });
    expect(order).toEqual([]);
  });
});

// =====================================================================================================================

describe('CS-N5: no purchase, price, renewal, manage or billing word, and no way out of the app', () => {
  it('the account client reaches only the spaces routes and the plan status view; every money route is refused before a request', async () => {
    const api = createAccountApi({ baseUrl: 'https://api.example.test', dev: false, getToken: async () => 'token-1', fetch: globalThis.fetch as never });
    for (const path of [
      '/api/entitlements/stripe/checkout',
      '/api/entitlements/stripe/portal',
      '/api/entitlements/stripe/promo',
      '/api/entitlements',
      '/api/billing/receipts',
      '/api/billing/receipt-link',
      '/api/billing/receipt',
      '/api/billing/summary',
      '/api/billing/summary?view=full',
      '/api/spaces/..%2Fbilling%2Freceipts',
      '/api/spaces/%2e%2e/entitlements/stripe/checkout',
    ]) {
      expect(await api.request('POST', path), path).toEqual({ ok: false, error: 'refused', status: 0 });
      expect(await api.request('GET', path), path).toEqual({ ok: false, error: 'refused', status: 0 });
    }
    expect(env.fetches).toEqual([]);
    await api.planStatus();
    expect(accountRequests()).toEqual(['GET /api/billing/summary']);
  });

  it('a summary that came with a payer, actions, receipts, a renewal and an end date shows none of them', async () => {
    planCards = PLAN_VARIANTS.own!;
    typedPinNow();
    const { r } = await mountRoute('AccountHome');
    const text = screenTexts(r.root).join('\n');
    expect(accountDenyHits(text, 'en')).toEqual([]);
    expect(text).not.toMatch(/2027|Jan(uary)? 31|49\.00|\$/);
  });

  it('the import guard (9.3, `account-imports.test.ts`) and the Worker guard (9.4, `native-client.test.ts`) stand: every money route asks the guard first', () => {
    expect(existsSync(join(SRC, 'logic/account/__tests__/account-imports.test.ts'))).toBe(true);
    const backend = resolve(APP, '../../packages/backend/src');
    expect(existsSync(join(backend, '__tests__/native-client.test.ts'))).toBe(true);
    const entitlements = readFileSync(join(backend, 'routes/entitlements.ts'), 'utf8');
    const billing = readFileSync(join(backend, 'routes/billing.ts'), 'utf8');
    // Each money route's handler refuses a native request first, before any other step (NS-1's own tests cover the answers).
    const first = (method: string, route: string): RegExp =>
      new RegExp(`\\.${method}\\('${route.replace(/\//g, '\\/')}', async \\(c\\) => \\{\\s*(//[^\\n]*\\n\\s*)*const native = await nativeMoneyRefusal\\(c\\);\\s*if \\(native\\) return native;`);
    for (const route of ['/stripe/checkout', '/stripe/portal', '/stripe/promo']) expect(entitlements, route).toMatch(first('post', route));
    expect(entitlements, 'GET /api/entitlements').toMatch(first('get', '/'));
    expect(billing, '/receipts').toMatch(first('get', '/receipts'));
    expect(billing, '/receipt-link').toMatch(first('post', '/receipt-link'));
  });
});

// =====================================================================================================================

describe('CS-N6: no URL scheme, link, notification or boot intent opens an account screen', () => {
  it('app.json declares no scheme, associated domains or intent filters, and no notification module is installed', () => {
    const app = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: Record<string, Record<string, unknown> | unknown> };
    const expo = app.expo as { scheme?: unknown; ios?: { associatedDomains?: unknown }; android?: { intentFilters?: unknown }; plugins?: unknown[] };
    expect(expo.scheme).toBeUndefined();
    expect(expo.ios?.associatedDomains).toBeUndefined();
    expect(expo.android?.intentFilters).toBeUndefined();
    const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter((d) => /notification|branch|firebase|linking/.test(d) && d !== 'expo-linking')).toEqual([]);
  });

  it('the navigator takes no linking config; no app code reads an incoming URL; the native boot intent is always none', async () => {
    const app = readFileSync(join(APP, 'App.tsx'), 'utf8');
    expect(app).not.toMatch(/<NavigationContainer[^>]*\blinking=/);
    const readers = sourcesUnder(SRC)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /getInitialURL|addEventListener\(\s*['"]url['"]|useURL\b|expo-linking|expo-notifications/.test(readFileSync(f, 'utf8')));
    expect(readers.map((f) => relative(APP, f))).toEqual([]);
    const root = await import('../../../platform/app-root');
    expect(root.peekBootIntent()).toBeNull();
    expect(root.bootRoot()).toBe('app');
  });

  it('the only entries are the rows of 7.1: every account route a navigation names is opened by the rows, the gate or the account screens', () => {
    const openers = sourcesUnder(SRC)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /(navigate|replace|push)\([^)]*['"](SignIn|AccountHome|AccountLearnerReport|AccountSpace|AccountSchool|AccountClassReport)['"]|screen: ['"](SignIn|AccountHome)['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    for (const file of openers) expect(file, file).toMatch(/^(screens\/account\/|screens\/parent\/PinEntryScreen\.tsx$|logic\/account\/)/);
  });
});

// =====================================================================================================================

describe('CS-N7: Clerk’s items stay in SecureStore hr.clerk, on a PIN device only, and a fresh install deletes them first', () => {
  it('on pin the items go to SecureStore, service hr.clerk, WHEN_UNLOCKED_THIS_DEVICE_ONLY, no face asked, indexed first; nothing in AsyncStorage', async () => {
    await clerkTokens.wipe();
    expect(await applyGateToTokens({ state: 'pin', epoch: EPOCH }, 'mount')).toBe(true);
    await clerkTokens.cache.saveToken('__clerk_client_jwt', 'jwt-secret-value');
    expect(env.secure.get('__clerk_client_jwt')).toBe('jwt-secret-value');
    expect(JSON.parse(env.secure.get(CLERK_INDEX_KEY)!)).toContain('__clerk_client_jwt');
    expect(env.secureOptions.length).toBeGreaterThan(0);
    for (const options of env.secureOptions) expect(options).toEqual({ keychainService: CLERK_KEYCHAIN_SERVICE, keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
    const keys = await AsyncStorage.getAllKeys();
    const values = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
    expect(values.join('\n')).not.toContain('jwt-secret-value');
    expect(keys.filter((k) => /clerk/i.test(k))).toEqual([]);
    await clerkTokens.wipe();
  });

  it('on open and nopin nothing is kept: a gate that leaves pin deletes every kept item', async () => {
    await clerkTokens.wipe();
    await applyGateToTokens({ state: 'pin', epoch: EPOCH }, 'mount');
    await clerkTokens.cache.saveToken('__clerk_client_jwt', 'kept');
    expect(env.secure.size).toBeGreaterThan(0);
    await applyGateToTokens({ state: 'nopin' }, 'change');
    expect([...env.secure.keys()]).toEqual([]);
    for (const gate of [{ state: 'open' as const }, { state: 'nopin' as const }]) {
      await applyGateToTokens(gate, 'mount');
      await clerkTokens.cache.saveToken('__clerk_client_jwt', 'memory-only');
      expect([...env.secure.keys()], gate.state).toEqual([]);
      expect(clerkTokens.storage()).toBe('memory');
    }
    clerkTokens.endMemorySession();
    expect(await clerkTokens.cache.getToken('__clerk_client_jwt')).toBeFalsy();
  });

  it('a fresh install deletes every indexed and named item before anything reads them, and records itself only after', async () => {
    env.secure.set(CLERK_INDEX_KEY, JSON.stringify(['__clerk_client_jwt', 'clerk_other']));
    env.secure.set('__clerk_client_jwt', 'from-an-earlier-install');
    env.secure.set('clerk_other', 'x');
    const order: string[] = [];
    let written = false;
    // A delete that fails (the device not unlocked since a restart): no record, the sweep runs again.
    env.secureFails = true;
    expect(await runInstallSweep({ readRecord: async () => null, writeRecord: async () => void (written = true), wipe: () => clerkTokens.wipe(), now: () => Date.now() })).toBe('failed');
    expect(written).toBe(false);
    env.secureFails = false;
    const wipe = async (): Promise<boolean> => {
      order.push('wipe');
      return clerkTokens.wipe();
    };
    expect(await runInstallSweep({ readRecord: async () => null, writeRecord: async () => void order.push('record'), wipe, now: () => Date.now() })).toBe('swept');
    expect(order).toEqual(['wipe', 'record']);
    expect([...env.secure.keys()]).toEqual([]);
    // Through the platform module: the record in the storage wrapper holds no account data.
    expect(await ensureInstallSweep()).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(`hr:${INSTALLED_KEY}`))!)).toEqual({ v: 1, at: expect.any(Number) });
  });

  it('Android backups leave SecureStore out (configureAndroidBackup); an Android restore therefore reads as signed out', () => {
    const app = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: { plugins: unknown[] } };
    const secure = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-secure-store') as [string, Record<string, unknown>];
    expect(secure[1]).toMatchObject({ configureAndroidBackup: true });
  });

  it('nothing of Clerk’s reaches a log, telemetry or a crash report: the token modules log nothing, and the events carry no token or email', () => {
    for (const file of ['platform/clerk-token-cache.native.ts', 'logic/account/token-cache.ts', 'logic/account/install-sweep.ts', 'platform/clerk.native.tsx']) {
      expect(readFileSync(join(SRC, file), 'utf8'), file).not.toMatch(/console\.|track\(/);
    }
  });
});

// =====================================================================================================================

describe('CS-N8: a sign-in never touches a learner, and the account token never rides with learner data', () => {
  const signInWithCode = async (): Promise<{ r: ReactTestRenderer; nav: Nav }> => {
    clerk.signedIn = false;
    clerk.answers.create = async () => ({ status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }, { strategy: 'password' }], supportedSecondFactors: null, createdSessionId: null });
    clerk.answers.prepareFirstFactor = async () => ({ status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }], supportedSecondFactors: null, createdSessionId: null });
    clerk.answers.attemptFirstFactor = async () => ({ status: 'complete', createdSessionId: 'sess_1', supportedFirstFactors: null, supportedSecondFactors: null });
    typedPinNow();
    const mounted = await mountRoute('SignIn', { params: {} });
    const field = (kind: string): ReactTestInstance => mounted.r.root.findAll((n) => n.type === TextInput && n.props.testID === `sign-in-field-${kind}`)[0]!;
    await act(async () => field('email').props.onChangeText(EMAIL));
    await tap(mounted.r.root, 'sign-in-submit');
    await act(async () => field('code').props.onChangeText('123456'));
    await tap(mounted.r.root, 'sign-in-submit');
    await settle();
    return mounted;
  };

  it('a completed sign-in reads GET /api/spaces only, with the Clerk token and never a device secret; no learner changes', async () => {
    await device('pin');
    const profilesBefore = structuredClone(useProfileStore.getState().profiles);
    const keysBefore = (await AsyncStorage.getAllKeys()).filter((k) => !k.startsWith('hr:grownup:')).sort();
    const { nav } = await signInWithCode();
    expect(nav.replace).toHaveBeenCalledWith('AccountHome', expect.anything());
    expect(accountRequests()).toEqual(['GET /api/spaces']);
    for (const request of env.fetches) {
      expect(request.headers.Authorization).toBe('Bearer token-1');
      expect(JSON.stringify(request.headers)).not.toMatch(/Device /);
    }
    expect(useProfileStore.getState().profiles).toEqual(profilesBefore);
    // Only the grown-up records were written (the trust and the uses record): no learner key, no sync or membership.
    const keysAfter = (await AsyncStorage.getAllKeys()).filter((k) => !k.startsWith('hr:grownup:')).sort();
    expect(keysAfter).toEqual(keysBefore);
    expect(JSON.parse((await AsyncStorage.getItem(`hr:${TRUST_RECORD_KEY}`))!)).toEqual({ v: 1, epoch: EPOCH });
    // The flow's events carry no email, token, space or learner (section 15).
    expect(env.tracked.map((e) => e.name)).toContain('auth.native.signin');
    expect(JSON.stringify(env.tracked)).not.toMatch(/dana|example\.com|token-1|space:|profile:|sess_/);
    const uses = JSON.parse((await AsyncStorage.getItem(`hr:${DEVICE_USES_RECORD_KEY}`))!) as Record<string, unknown>;
    expect(JSON.stringify(uses)).not.toMatch(/space:|Kim|dana/);
  });

  it('the account client refuses /api/sync/* and /api/recovery/*, encoded or not', () => {
    for (const path of ['/api/sync/push', '/api/sync/pull', '/api/recovery/issue', '/api/recovery/redeem', '/api/spaces/x/../../sync/push', '/api/spaces/%2e%2e/%2e%2e/sync/push', '/api/spaces/..%2F..%2Frecovery%2Fissue', '/api/spaces/space%3Akim%2F..%2F..%2Fsync']) {
      expect(accountUrl('https://api.example.test', path), path).toBeNull();
    }
  });

  it('no account module reaches the learner sync client, device credentials or a join: the only write is Make a code', () => {
    const files = [...sourcesUnder(join(SRC, 'screens/account')), ...sourcesUnder(join(SRC, 'logic/account'))].filter((f) => !f.includes('__tests__'));
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/sync-api|membership-store|notes-store|DeviceCredentials|\/join['`/]|relink-requests|\/api\/(sync|recovery)/);
      if (!file.endsWith('logic/account/api.ts')) expect(text, file).not.toMatch(/\.request\(\s*'POST'/);
    }
  });
});

// =====================================================================================================================

describe('CS-N9 and CS-7: generic labels on the chooser and Welcome; the email only past the gate with a fresh proof', () => {
  const allowed = (locale: UiLocale): string[] => {
    const l = getMessages(locale);
    return [l.learner.who.use.family, l.learner.who.use.teacher, l.learner.who.use.school, l.learner.who.use.signIn, l.caregiver.account.card.title, l.caregiver.audience.family.zoneLabel, l.caregiver.audience.self.zoneLabel];
  };
  const captions = (locale: UiLocale): string[] => {
    const l = getMessages(locale);
    return [l.caregiver.pin.needsPinFirst, l.learner.welcome.grownUps.needsInternet, l.learner.who.nopinCaption];
  };

  for (const os of OSES) {
    for (const locale of LOCALES) {
      it(`${os} ${locale}: every chooser row and the Welcome row carry only the generic labels, never a name or an email (CS-7)`, async () => {
        setPlatform(os);
        vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
        useLocaleStore.setState({ device: locale, byProfile: {} });
        const l = getMessages(locale);
        const cases: [DeviceKind, unknown, boolean][] = [
          ['pin', usesRecord(['family', 'teacher', 'school']), true],
          ['pin', usesRecord([]), true],
          ['pin', undefined, true],
          ['nopin', undefined, true],
          ['open', undefined, true],
          ['pin', usesRecord(['family']), false],
        ];
        for (const [kind, uses, online] of cases) {
          await device(kind, uses === undefined ? {} : { uses });
          env.online = online;
          resetChooserState();
          const r = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: makeNav(['WhoIsUsing']), route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
          await settle();
          const rows = hostNodes(r.root, (n) => /^who-row-[a-z]+$/.test(String(n.props['data-testid'] ?? '')));
          expect(rows.length, `${kind}`).toBeGreaterThan(0);
          for (const row of rows) {
            for (const text of screenTexts(row)) {
              const known = [...allowed(locale), ...captions(locale), ...allowed(locale).map((label) => l.a11y.who.grownUpRow(label))];
              expect(known, `${kind} ${String(row.props['data-testid'])}: "${text}"`).toContain(text);
            }
          }
          expect(screenTexts(r.root).join('\n')).not.toContain(EMAIL);
          await unmount(r);
        }
        await device('empty');
        const welcome = await render(providers(createElement(WelcomeAccountRow, { navigation: makeNav(['Welcome']) as never })));
        await settle();
        const label = l.learner.who.use.signIn;
        expect(screenTexts(byTestId(welcome.root, 'welcome-account-sign-in')[0]!)).toContain(label);
        expect(screenTexts(welcome.root).join('\n')).not.toContain(EMAIL);
      });
    }
  }

  const mountCard = async (): Promise<ReactTestRenderer> => {
    const nav = makeNav(['ParentDashboard']);
    const r = await render(providers(createElement(AccountCard, { navigation: nav as never })));
    await settle(14);
    await until(() => has(r.root, 'account-card'));
    return r;
  };

  it('the card shows the email with a typed PIN within 2 minutes', async () => {
    typedPinNow();
    const r = await mountCard();
    expect(has(r.root, 'account-card-email')).toBe(true);
    expect(shows(r.root, EMAIL)).toBe(true);
  });

  it('the card shows the email after a native sign-in within 2 minutes', async () => {
    useUiStore.setState({ parentGateOpenedAt: Date.now() });
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const r = await mountCard();
    expect(shows(r.root, EMAIL)).toBe(true);
  });

  it.each([
    ['face or fingerprint alone', () => useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now(), lastPinTypedAt: null })],
    ['a typed PIN 3 minutes ago', () => useUiStore.setState({ parentGateOpenedAt: Date.now() - 180_000, lastPinVerifiedAt: Date.now() - 180_000, lastPinTypedAt: Date.now() - 180_000 })],
    ['a typed PIN in the future (the clock went back)', () => useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinTypedAt: Date.now() + 60_000 })],
  ])('the card never shows the email after %s', async (_name, arrange) => {
    arrange();
    const r = await mountCard();
    expect(has(r.root, 'account-card')).toBe(true);
    expect(shows(r.root, EMAIL)).toBe(false);
  });

  it.each([
    ['no trust', {}],
    ['a changed PIN', { trust: { v: 1, epoch: EPOCH - 5 } }],
  ])('the card never shows the email when locked (%s), even with a fresh typed PIN', async (_name, o) => {
    await device('pin', o);
    typedPinNow();
    const r = await mountCard();
    expect(has(r.root, 'account-card')).toBe(true);
    expect(shows(r.root, EMAIL)).toBe(false);
  });

  it('the card never shows the email while the gate state cannot be read', async () => {
    useAccountStore.setState({ hydrated: false });
    typedPinNow();
    const r = await mountCard();
    expect(shows(r.root, EMAIL)).toBe(false);
  });
});

// =====================================================================================================================

describe('CS-N10: no account can be made on native, and nothing says where one is made', () => {
  it('no sign-up resource, step or redirect in the account code', () => {
    const files = [...sourcesUnder(join(SRC, 'screens/account')), ...sourcesUnder(join(SRC, 'logic/account')), join(SRC, 'platform/clerk.native.tsx')].filter((f) => !f.includes('__tests__'));
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/useSignUp|signUp\.|SignUp\b|authenticateWithRedirect|oauth_|email_link/);
  });

  it('an email with no account reads the neutral cantSignIn line, never an offer to make one', () => {
    const error = Object.assign(new Error('Couldn’t find your account. Sign up?'), { clerkError: true, status: 422, errors: [{ code: 'form_identifier_not_found', message: 'Sign up' }] });
    expect(classifySignInError(error, 'identify')).toEqual({ line: 'cantSignIn', result: 'refused' });
    for (const locale of LOCALES) {
      const l = getMessages(locale).caregiver.account;
      for (const line of [l.errors.cantSignIn, l.signIn.noNewAccounts, l.signIn.learners, l.signIn.intro]) expect(accountDenyHits(line, locale), line).toEqual([]);
    }
  });

  it('a status the app does not have (a new password, a sign-up transfer) ends in unsupported, with Use another email only', async () => {
    clerk.signedIn = false;
    clerk.answers.create = async () => ({ status: 'needs_identifier', supportedFirstFactors: null, supportedSecondFactors: null, createdSessionId: null });
    typedPinNow();
    const { r } = await mountRoute('SignIn', { params: {} });
    const field = r.root.findAll((n) => n.type === TextInput && n.props.testID === 'sign-in-field-email')[0]!;
    await act(async () => field.props.onChangeText(EMAIL));
    await tap(r.root, 'sign-in-submit');
    expect(has(r.root, 'sign-in-unsupported')).toBe(true);
    expect(accountDenyHits(screenTexts(r.root).join('\n').replace(EMAIL, ''), 'en')).toEqual([]);
  });
});

// =====================================================================================================================

describe('CS-N11: face or fingerprint never opens an account screen, never signs in, never writes the trust', () => {
  const pinScreen = async (params: Record<string, unknown>): Promise<{ r: ReactTestRenderer; nav: Nav }> => {
    useAccountStore.setState({ biometricShortcut: { v: 1, enabledAt: EPOCH + 1, epoch: EPOCH } } as never);
    const nav = makeNav(['WhoIsUsing', 'PinEntry']);
    const r = await render(providers(createElement(PinEntryScreen, { navigation: nav, route: { key: 'me', name: 'PinEntry', params } } as never)));
    await settle();
    return { r, nav };
  };

  for (const os of OSES) {
    it(`${os}: an account row’s PIN screen offers no face or fingerprint, whatever the shortcut says`, async () => {
      setPlatform(os);
      // The control: the same device's Grown-up area PIN screen does offer it (the shortcut is on and available).
      const area = await pinScreen({ next: 'ParentDashboard' });
      await settle();
      expect(has(area.r.root, 'pin-biometric')).toBe(true);
      await unmount(area.r);
      for (const params of [{ next: 'GrownUpUse', use: 'family', typedOnly: true }, { next: 'GrownUpUse', use: 'signin' }, { next: 'FreshPin', typedOnly: true, use: 'teacher' }, { next: 'FreshPin', typedOnly: true }]) {
        const { r } = await pinScreen(params);
        expect(has(r.root, 'pin-biometric'), JSON.stringify(params)).toBe(false);
        expect(has(r.root, 'pin-biometric-pending'), JSON.stringify(params)).toBe(false);
        await unmount(r);
      }
    });
  }

  it('face or fingerprint never counts as a typed PIN, so the gate asks the typed PIN and a return without one leaves', async () => {
    useUiStore.getState().markPinVerified('biometric');
    useUiStore.getState().openParentGate();
    expect(useUiStore.getState().lastPinTypedAt).toBeNull();
    const { r, nav } = await mountRoute('AccountHome');
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ typedOnly: true }));
    // Back from the PIN screen with face or fingerprint only: the gate leaves the screen.
    useUiStore.getState().markPinVerified('biometric');
    await nav.emit('focus');
    expect(nav.goBack).toHaveBeenCalled();
    expect(has(r.root, 'account-home-family')).toBe(false);
    expect(accountRequests()).toEqual([]);
  });

  it('only a completed sign-in writes the trust record: the PIN screen, the gate and the card never import its writer', () => {
    const writers = sourcesUnder(SRC)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /\bwriteTrust\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(writers.sort()).toEqual(['platform/account-records.ts', 'screens/account/SignInScreen.native.tsx']);
  });
});

// =====================================================================================================================

describe('CS-N12: no account screen’s content reaches the app switcher, a screenshot or a recording', () => {
  for (const route of ALL_ROUTES) {
    it(`${route}: capture protection held while focused, whatever it shows; the cover while not active; released on blur`, async () => {
      typedPinNow();
      // A locked screen holds it too ("whatever it shows").
      const locked = await mountRoute(route, { mount: 'off' });
      expect(accountCaptureHolders()).toBe(1);
      expect(env.capture).toEqual([`prevent ${ACCOUNT_CAPTURE_KEY}`]);
      await unmount(locked.r);
      expect(accountCaptureHolders()).toBe(0);
      env.capture = [];
      const { r, nav } = await mountRoute(route);
      expect(accountCaptureHolders()).toBe(1);
      await toApp('inactive');
      expect(byTestId(r.root, 'account-cover').map((n) => n.props.image)).toEqual([true]);
      expect(Keyboard.dismiss).toHaveBeenCalled();
      await toApp('active');
      await nav.emit('blur');
      expect(accountCaptureHolders()).toBe(0);
      expect(env.capture).toEqual([`prevent ${ACCOUNT_CAPTURE_KEY}`, `allow ${ACCOUNT_CAPTURE_KEY}`]);
      await unmount(r);
    });
  }

  it('the iOS cover plugin is configured and reads the flag the screens set', () => {
    const app = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: { plugins: unknown[] } };
    expect(app.expo.plugins).toContain('./plugins/with-account-cover');
    expect(readFileSync(join(APP, 'plugins/with-account-cover.js'), 'utf8')).toContain('hr.accountCover');
  });
});

// =====================================================================================================================

describe('CS-N13: switch off or no valid key: exactly the basis, Grown-up area only, no Clerk', () => {
  it.each([
    ['the switch off', { EXPO_PUBLIC_NATIVE_SIGNIN: 'off' }],
    ['the switch unset', { EXPO_PUBLIC_NATIVE_SIGNIN: '' }],
    ['no key', { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: '' }],
    ['a secret key', { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_live_abc' }],
    ['a test key in a release build', { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k' }],
  ])('%s: the config is off, the chooser shows the Grown-up area only, Welcome and the card draw nothing, Clerk is never called', async (_name, values) => {
    for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
    vi.stubEnv('NODE_ENV', 'production');
    expect(nativeSignInConfig().enabled).toBe(false);
    for (const os of OSES) {
      setPlatform(os);
      for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.example.test');
      resetChooserState();
      const chooser = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: makeNav(['WhoIsUsing']), route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
      await settle();
      expect(hostNodes(chooser.root, (n) => /^who-row-[a-z]+$/.test(String(n.props['data-testid'] ?? ''))).map((n) => n.props['data-testid'])).toEqual(['who-row-area']);
      const welcome = await render(providers(createElement(WelcomeAccountRow, { navigation: makeNav(['Welcome']) as never })));
      const card = await render(providers(createElement(AccountCard, { navigation: makeNav(['ParentDashboard']) as never })));
      await settle();
      expect(welcome.toJSON()).toBeNull();
      expect(card.toJSON()).toBeNull();
      await unmount(chooser);
    }
    expect(clerk.used).toEqual([]);
    expect(env.onlineListeners).toEqual([]);
  });

  it('the rows: with nativeAccount false a native device gets the basis rows, whatever its record says', () => {
    const view = grownUpRows({ os: 'ios', uses: [], online: true, marker: 'pin', resetPending: false, native: { nativeAccount: false, record: ['family', 'teacher'] } } as never);
    expect(view.rows.map((r) => r.use)).toEqual(['area']);
  });

  it('the build: with the switch off the root route is the dashboard itself, and nothing binds the account', async () => {
    vi.stubEnv('EXPO_PUBLIC_NATIVE_SIGNIN', 'off');
    vi.resetModules();
    const stack = await import('../../../navigation/grown-up-stack.native');
    const dashboard = await import('../../parent/ParentDashboardScreen');
    expect(stack.GrownUpArea).toBe(dashboard.ParentDashboardScreen);
    expect(nativeAccountEnabled({ os: 'ios', flag: false, key: 'pk_live_x', release: true })).toBe(false);
    expect(nativeAccountEnabled({ os: 'web', flag: true, key: 'pk_live_x', release: true })).toBe(false);
  });
});

// =====================================================================================================================

describe('CS-N14: a device with no PIN keeps no session; a failed profile read opens nothing', () => {
  it('Welcome’s row leads to the sign-in every time (no PIN on an empty device), and nothing of a sign-in is kept on disk', async () => {
    await device('empty');
    for (let i = 0; i < 2; i += 1) {
      const nav = makeNav(['Welcome']);
      const r = await render(providers(createElement(WelcomeAccountRow, { navigation: nav as never })));
      await settle();
      await tap(r.root, 'welcome-account-sign-in');
      expect(nav.navigate.mock.calls).toEqual([['ParentDashboard', { screen: 'SignIn', params: {} }]]);
      await unmount(r);
    }
    await applyGateToTokens({ state: 'open' }, 'mount');
    await clerkTokens.cache.saveToken('__clerk_client_jwt', 'this-visit-only');
    expect([...env.secure.keys()]).toEqual([]);
    expect(await AsyncStorage.getItem(`hr:${TRUST_RECORD_KEY}`)).toBeNull();
    expect(await AsyncStorage.getItem(`hr:${DEVICE_USES_RECORD_KEY}`)).toBeNull();
    clerkTokens.endMemorySession();
  });

  it('on an open device the home opens only for this visit’s sign-in; the session close ends it and the next mount asks again', async () => {
    await device('open');
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const first = await mountRoute('AccountHome');
    expect(has(first.r.root, 'account-home-family')).toBe(true);
    // The gate opened a session for the visit, so the 15-minute and background rules end it.
    expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
    await unmount(first.r);
    const unbind = bindAccountQueryClearing();
    await act(async () => closeGrownUpSession('exit'));
    unbind();
    env.fetches = [];
    const second = await mountRoute('AccountHome');
    expect(second.nav.replace).toHaveBeenCalledWith('SignIn', expect.anything());
    expect(accountRequests()).toEqual([]);
  });

  it('a profile read that fails at boot (the app looks empty and shows Welcome) reads unknown and opens nothing', async () => {
    await device('empty');
    const getItem = AsyncStorage.getItem.bind(AsyncStorage);
    vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => {
      if (key === `hr:${PROFILES_KEY}`) throw new Error('disk');
      return getItem(key);
    });
    expect(await nativeGateState()).toEqual({ state: 'unknown' });
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const { r } = await mountRoute('AccountHome');
    expect(lockCause(r.root)).toBe('unknown');
    expect(accountRequests()).toEqual([]);
  });
});

// =====================================================================================================================

describe('CS-N15: a crash on an account route sends app.crash with an empty message', () => {
  it.each([...ACCOUNT_ROUTE_NAMES])('%s: only the route and the error class leave the device', (route) => {
    reportCrash(new TypeError('Cannot read Mina’s report in Saturday class 3B (code H3TRW9, dana.kim@example.com)'), 'learner', route);
    expect(env.tracked).toEqual([{ name: 'app.crash', payload: expect.objectContaining({ route, errorName: 'TypeError', message: '' }) }]);
  });

  it('a learner route keeps the scrubbed message (unchanged)', () => {
    reportCrash(new TypeError('x is undefined'), 'learner', 'Home');
    expect(env.tracked).toEqual([{ name: 'app.crash', payload: expect.objectContaining({ route: 'Home', message: 'x is undefined' }) }]);
  });

  it('the app’s root boundary reports the focused leaf route, and the Clerk boundary reports an empty message', () => {
    expect(readFileSync(join(APP, 'App.tsx'), 'utf8')).toMatch(/onError=\{\(error\) => reportCrash\(error, 'learner', navigation\.isReady\(\) \? navigation\.getCurrentRoute\(\)\?\.name : undefined\)\}/);
    expect(readFileSync(join(SRC, 'navigation/grown-up-stack.native.tsx'), 'utf8')).toMatch(/const scrubbed = new Error\(''\);/);
  });
});

// =====================================================================================================================
// AMENDMENTS-ONE-ACCOUNT-MANY-USERS, re-run on iOS and Android

describe('OA CS-1 (native): no path from a learner or the chooser reaches an account screen without the typed PIN or a sign-in', () => {
  for (const os of OSES) {
    it(`${os}: each chooser row on a pin device opens the typed PIN, never an account or Grown-up area route`, async () => {
      setPlatform(os);
      await device('pin', { trust: TRUSTED(), uses: usesRecord(['family', 'teacher', 'school']) });
      // A grown-up session left open from earlier never lets a row skip the PIN (arriving at the chooser closes it).
      typedPinNow();
      const nav = makeNav(['WhoIsUsing']);
      const r = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: nav, route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
      await settle();
      expect(chooserRows(r.root)).toEqual(['who-row-family', 'who-row-teacher', 'who-row-school', 'who-row-area']);
      for (const use of ['family', 'teacher', 'school', 'area']) {
        nav.navigate.mockClear();
        nav.replace.mockClear();
        nav.reset.mockClear();
        nav.dispatch.mockClear();
        await press(byTestId(r.root, `who-row-${use}`)[0]!);
        await settle();
        // What ran under the chooser is taken off the stack (the learner home under it), never an account route.
        for (const [state] of nav.reset.mock.calls as [{ routes: { name: string }[] }][]) expect(state.routes.map((x) => x.name), use).toEqual(['Main', 'WhoIsUsing']);
        expect(nav.dispatch, use).not.toHaveBeenCalled();
        const targets = [...nav.navigate.mock.calls, ...nav.replace.mock.calls].map((c) => c[0]);
        expect(targets, use).toEqual(['PinEntry']);
      }
      expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    });

    it(`${os}: the Grown-up area’s 15-minute session never opens an account screen from outside (the card or a row)`, async () => {
      setPlatform(os);
      useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: null, lastPinTypedAt: null });
      for (const route of ALL_ROUTES) {
        env.fetches = [];
        const { r, nav } = await mountRoute(route);
        expect(nav.navigate, route).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin', typedOnly: true }));
        expect(accountRequests(), route).toEqual([]);
        await unmount(r);
      }
    });
  }
});

describe('OA CS-4 as amended by ND-7 (native): the account’s PIN screens never make or reset a PIN; nopin sets a PIN first', () => {
  for (const os of OSES) {
    it(`${os}: a nopin device’s account rows carry Set a grown-up PIN first and open PIN setup, never an account screen`, async () => {
      setPlatform(os);
      await device('nopin');
      const nav = makeNav(['WhoIsUsing']);
      const r = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: nav, route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
      await settle();
      expect(chooserRows(r.root)).toEqual(['who-row-signin', 'who-row-area']);
      const rows = hostNodes(r.root, (n) => /^who-row-(family|teacher|school|signin|account)$/.test(String(n.props['data-testid'] ?? '')));
      for (const row of rows) {
        expect(screenTexts(row)).toContain(en.caregiver.pin.needsPinFirst);
        nav.navigate.mockClear();
        await press(row);
        await settle();
        expect(nav.navigate.mock.calls.map((c) => c.slice(0, 2))).toEqual([['PinEntry', { next: 'ParentDashboard' }]]);
      }
    });

    it(`${os}: GrownUpUse with no PIN stored goes back, writes no PIN and never shows the set-up pad`, async () => {
      setPlatform(os);
      await device('nopin');
      const nav = makeNav(['WhoIsUsing', 'PinEntry']);
      const r = await render(providers(createElement(PinEntryScreen, { navigation: nav, route: { key: 'me', name: 'PinEntry', params: { next: 'GrownUpUse', use: 'family', typedOnly: true } } } as never)));
      await settle();
      expect(nav.goBack).toHaveBeenCalledTimes(1);
      expect(nav.replace).not.toHaveBeenCalled();
      expect(screenTexts(r.root)).not.toContain(en.caregiver.audience.family.pinCreateTitle);
      expect(await AsyncStorage.getItem(`hr:${PIN_HASH_KEY}`)).toBeNull();
      expect(useAccountStore.getState().parentPinHash).toBeNull();
    });

    it(`${os}: the account’s typed PIN (GrownUpUse, FreshPin) verifies only: no Forgot PIN?, no new PIN`, async () => {
      setPlatform(os);
      for (const params of [{ next: 'GrownUpUse', use: 'teacher', typedOnly: true }, { next: 'FreshPin', typedOnly: true, use: 'family' }]) {
        const nav = makeNav(['WhoIsUsing', 'PinEntry']);
        const r = await render(providers(createElement(PinEntryScreen, { navigation: nav, route: { key: 'me', name: 'PinEntry', params } } as never)));
        await settle();
        expect(screenTexts(r.root), JSON.stringify(params)).not.toContain(en.caregiver.pin.entry.forgot.cta);
        expect(useAccountStore.getState().parentPinHash).toBe('h:1234');
        await unmount(r);
      }
    });
  }
});

describe('OA CS-14 (native): five minutes in the background close the session, and the account screen asks again', () => {
  for (const os of OSES) {
    it(`${os}: an open home, 5 minutes in the background: the session closes and the area’s account cannot be reopened without the PIN`, async () => {
      setPlatform(os);
      const unbind = bindGrownUpBackgroundRule();
      const unbindQueries = bindAccountQueryClearing();
      try {
        await mountArea();
        typedPinNow();
        const { r } = await mountRoute('AccountHome');
        expect(has(r.root, 'account-home-family')).toBe(true);
        await toApp('background');
        vi.setSystemTime(Date.parse(NOW) + 5 * 60_000);
        await toApp('active');
        expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinTypedAt: null });
        expect(accountQueries()).toEqual([]);
        expect(has(r.root, 'account-home-family')).toBe(false);
      } finally {
        unbind();
        unbindQueries();
      }
    });

    it(`${os}: under 5 minutes in the background the session stays`, async () => {
      setPlatform(os);
      const unbind = bindGrownUpBackgroundRule();
      try {
        typedPinNow();
        const { r } = await mountRoute('AccountHome', { below: ['ParentDashboard', 'AccountSpace'] });
        await toApp('background');
        vi.setSystemTime(Date.parse(NOW) + 4 * 60_000);
        await toApp('active');
        expect(useUiStore.getState().parentGateOpenedAt).not.toBeNull();
        expect(has(r.root, 'account-home-family')).toBe(true);
      } finally {
        unbind();
      }
    });
  }
});

describe('OA CS-15 (native): every learner change and every exit from the area closes the session', () => {
  it('the account routes are Grown-up area routes on iOS and Android: leaving one for a learner screen closes the session', async () => {
    for (const os of OSES) {
      vi.stubEnv('EXPO_OS', os);
      vi.resetModules();
      const session = await import('../../../logic/profiles/session');
      for (const route of ACCOUNT_ROUTE_NAMES) {
        expect(session.routeZone(route), `${os} ${route}`).toBe('area');
        const track = session.areaExitTracker();
        track(session.routeZone('ParentDashboard'));
        track(session.routeZone(route));
        expect(track(session.routeZone('Home')), `${os} ${route} → Home`).toBe(true);
      }
      const inside = session.areaExitTracker();
      inside(session.routeZone('AccountHome'));
      expect(inside(session.routeZone('AccountSpace'))).toBe(false);
      expect(inside(session.routeZone('PinEntry'))).toBe(false);
      expect(session.areaLeaveRoutes([{ name: 'Main' }, { name: 'ParentDashboard' }, { name: 'AccountHome' }, { name: 'AccountClassReport' }])).toEqual([{ name: 'Main' }]);
    }
  });

  it('a change of the active learner closes the session and clears the account (switch)', async () => {
    const unbind = bindAccountQueryClearing();
    try {
      await mountArea();
      typedPinNow();
      const { r } = await mountRoute('AccountHome');
      expect(has(r.root, 'account-home-family')).toBe(true);
      await act(async () => useProfileStore.getState().setActive('profile:jun'));
      await settle();
      expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
      expect(accountQueries()).toEqual([]);
      await unmount(r);
      env.fetches = [];
      const again = await mountRoute('AccountHome');
      expect(again.nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ typedOnly: true }));
      expect(accountRequests()).toEqual([]);
    } finally {
      unbind();
    }
  });
});

// =====================================================================================================================
// Section 9.2: the deny-list sweep, every state of every account screen, card and row, in en, es and ko, on iOS and
// Android, in one place. Names a grown-up typed (spaces, schools, learners) and the fixture's email are not checked
// (9.2, last bullet); the app's own words are.

type Sweep = { name: string; mount: () => Promise<ReactTestRenderer>; marker: string };

const typed = [EMAIL, 'Kim family', 'Grandma Park family', 'Spring family', 'Saturday class 3B', 'Sunflower class', 'Spring 2026 class', 'Maple Heritage School', 'Lakeside Korean School', 'Room 12', 'Room 7', 'New class', 'Week 1 letters', 'Jun', 'Mina', 'Sora', 'Ben', 'Ana', 'Chloe'];
const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The text with every typed name taken out as a whole word (a name inside an app word, as "Ana" in "Analysis", stays). */
const withoutTyped = (text: string): string => typed.reduce((t, name) => t.replace(new RegExp(`(?<![A-Za-z])${escaped(name)}(?![A-Za-z])`, 'g'), ''), text);

const screenState = (name: string, route: AccountRoute, marker: string, arrange: () => Promise<void> | void, o: { below?: string[]; params?: Record<string, unknown>; mount?: ClerkMountState; then?: (r: ReactTestRenderer) => Promise<void> } = {}): Sweep => ({
  name,
  marker,
  mount: async () => {
    await arrange();
    const { r } = await mountRoute(route, o);
    if (o.then) await o.then(r);
    return r;
  },
});
const fresh = (): void => typedPinNow();
const inside = ['ParentDashboard', 'AccountHome'];
const signInField = (r: ReactTestRenderer, kind: string): ReactTestInstance => r.root.findAll((n) => n.type === TextInput && n.props.testID === `sign-in-field-${kind}`)[0]!;
const typeIn = async (r: ReactTestRenderer, kind: string, text: string): Promise<void> => {
  await act(async () => signInField(r, kind).props.onChangeText(text));
};
const clerkError = (code: string, status = 422): Error => Object.assign(new Error(`Clerk English for ${code}`), { clerkError: true, status, errors: [{ code, message: `Clerk English for ${code}` }] });
const factorView = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ status: 'needs_first_factor', supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }, { strategy: 'password' }], supportedSecondFactors: null, createdSessionId: null, ...over });
const signedOut = (): void => {
  clerk.signedIn = false;
  clerk.answers.create = async () => factorView();
  clerk.answers.prepareFirstFactor = async () => factorView();
  clerk.answers.attemptFirstFactor = async () => factorView();
  clerk.answers.prepareSecondFactor = async () => factorView({ status: 'needs_second_factor' });
  typedPinNow();
};
const toCode = async (r: ReactTestRenderer): Promise<void> => {
  await typeIn(r, 'email', EMAIL);
  await tap(r.root, 'sign-in-submit');
};
const signIn = (name: string, marker: string, then: (r: ReactTestRenderer) => Promise<void>, arrange: () => void = () => undefined): Sweep =>
  screenState(
    `sign-in ${name}`,
    'SignIn',
    marker,
    () => {
      signedOut();
      arrange();
    },
    { params: {}, then },
  );

const SWEEP: Sweep[] = [
  // Sign-in (6.3): every step and every line.
  signIn('email', 'sign-in-step-email', async () => undefined),
  signIn('email offline', 'sign-in-offline', async () => undefined, () => void (env.online = false)),
  signIn('code', 'sign-in-step-code', toCode),
  signIn('wrong code', 'sign-in-error', async (r) => {
    clerk.answers.attemptFirstFactor = async () => Promise.reject(clerkError('form_code_incorrect'));
    await toCode(r);
    await typeIn(r, 'code', '111111');
    await tap(r.root, 'sign-in-submit');
  }),
  signIn('expired code', 'sign-in-error', async (r) => {
    clerk.answers.attemptFirstFactor = async () => Promise.reject(clerkError('verification_expired'));
    await toCode(r);
    await typeIn(r, 'code', '111111');
    await tap(r.root, 'sign-in-submit');
  }),
  signIn('password', 'sign-in-step-password', async (r) => {
    await toCode(r);
    await tap(r.root, 'sign-in-use-password');
  }),
  signIn('wrong password', 'sign-in-error', async (r) => {
    clerk.answers.attemptFirstFactor = async () => Promise.reject(clerkError('form_password_incorrect'));
    await toCode(r);
    await tap(r.root, 'sign-in-use-password');
    await typeIn(r, 'password', 'nope');
    await tap(r.root, 'sign-in-submit');
  }),
  signIn('second step', 'sign-in-step-second', async (r) => {
    clerk.answers.attemptFirstFactor = async () => factorView({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'totp' }, { strategy: 'backup_code' }] });
    await toCode(r);
    await typeIn(r, 'code', '123456');
    await tap(r.root, 'sign-in-submit');
  }),
  signIn('device check', 'sign-in-step-second', async (r) => {
    clerk.answers.attemptFirstFactor = async () => factorView({ status: 'needs_second_factor', clientTrustState: 'new', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }] });
    await toCode(r);
    await typeIn(r, 'code', '123456');
    await tap(r.root, 'sign-in-submit');
  }),
  signIn('unsupported', 'sign-in-unsupported', async (r) => {
    clerk.answers.create = async () => factorView({ status: 'needs_new_password' });
    await toCode(r);
  }),
  signIn('cant sign in', 'sign-in-error', async (r) => {
    clerk.answers.create = async () => Promise.reject(clerkError('form_identifier_not_found'));
    await toCode(r);
  }),
  signIn('too many', 'sign-in-error', async (r) => {
    clerk.answers.create = async () => Promise.reject(clerkError('too_many_requests', 429));
    await toCode(r);
  }),
  signIn('generic', 'sign-in-error', async (r) => {
    clerk.answers.create = async () => Promise.reject(new Error('boom'));
    await toCode(r);
  }),
  screenState('sign-in without Clerk', 'SignIn', 'account-lock-unknown', signedOut, { params: {}, mount: 'off' }),
  screenState('sign-in while Clerk is decided', 'SignIn', 'header-title', signedOut, { params: {}, mount: 'pending' }),
  // The gate's locks (7.2, 7.3), titled with each use.
  ...(['family', 'teacher', 'school', 'account'] as const).flatMap((use) => [
    screenState(`lock unknown ${use}`, 'AccountHome', 'account-lock-unknown', () => void useProfileStore.setState({ hydrated: false }), { params: { use } }),
    screenState(`lock no Clerk ${use}`, 'AccountHome', 'account-lock-unknown', fresh, { params: { use }, mount: 'off' }),
    screenState(`lock epoch 0 ${use}`, 'AccountHome', 'account-lock-epoch_zero', async () => {
      await device('pin', { epoch: 0 });
      fresh();
    }, { params: { use } }),
    screenState(`lock first sign-in ${use}`, 'AccountHome', 'account-lock-no_trust', async () => {
      await device('pin');
      fresh();
    }, { params: { use } }),
    screenState(`lock pin changed ${use}`, 'AccountHome', 'account-lock-pin_changed', async () => {
      await device('pin', { trust: { v: 1, epoch: EPOCH - 1 } });
      fresh();
    }, { params: { use } }),
    screenState(`lock re-trust ${use}`, 'AccountHome', 'account-lock-retrust_password', async () => {
      await device('pin', { trust: { v: 1, epoch: EPOCH - 1 } });
      useAccountVisit.setState({ retrustPending: true });
      fresh();
    }, { params: { use } }),
  ]),
  // Family home (8.2): roles, the code panel, archived, every plan row, every state.
  ...Object.keys(PLAN_VARIANTS).map((plans) => screenState(`family home, plans ${plans}`, 'AccountHome', plans === 'none' ? 'account-home-family' : 'account-family-space:kim-plan', () => {
    planCards = PLAN_VARIANTS[plans]!;
    fresh();
  })),
  screenState('family home, a caregiver’s family with a free plan', 'AccountHome', 'account-family-space:park-plan', fresh),
  screenState('family home, Grown-up account', 'AccountHome', 'account-home-family', fresh, { params: { use: 'account' } }),
  screenState('family home, re-trust notice', 'AccountHome', 'account-home-retrust', async () => {
    await AsyncStorage.setItem('hr:grownup:retrustNotice', JSON.stringify({ v: 1, at: Date.now() }));
    fresh();
  }),
  screenState('family home, no family', 'AccountHome', 'account-home-no-family', () => {
    spaces = [];
    fresh();
  }),
  screenState('family home, a roster refused', 'AccountHome', 'account-family-space:kim-refused', () => {
    env.answer = failing(403, 'forbidden', /space%3Akim\/roster/);
    fresh();
  }),
  screenState('family home, offline', 'AccountHome', 'account-home-state-offline', () => {
    env.answer = offlineAnswer;
    fresh();
  }),
  screenState('family home, not available (native_off)', 'AccountHome', 'account-home-state-unavailable', () => {
    env.answer = failing(403, 'native_off');
    fresh();
  }),
  screenState('family home, cannot load', 'AccountHome', 'account-home-state-cant_load', () => {
    env.answer = failing(500, 'error');
    fresh();
  }),
  // Teacher home and School use (8.3, 8.4).
  ...(['teacher', 'school'] as const).flatMap((use) => [
    screenState(`${use} home`, 'AccountHome', `account-home-${use}`, fresh, { params: { use } }),
    screenState(`${use} home, no class or school`, 'AccountHome', 'account-home-no-class', () => {
      spaces = [ALL_SPACES[0]!];
      fresh();
    }, { params: { use } }),
    screenState(`${use} home, offline`, 'AccountHome', 'account-home-state-offline', () => {
      env.answer = offlineAnswer;
      fresh();
    }, { params: { use } }),
    screenState(`${use} home, not available`, 'AccountHome', 'account-home-state-unavailable', () => {
      env.answer = failing(403, 'native_off');
      fresh();
    }, { params: { use } }),
    screenState(`${use} home, cannot load`, 'AccountHome', 'account-home-state-cant_load', () => {
      env.answer = failing(500, 'error');
      fresh();
    }, { params: { use } }),
  ]),
  screenState('school use, no school of its own', 'AccountHome', 'account-home-no-school', () => {
    spaces = ALL_SPACES.filter((s) => (s as { space: { id: string } }).space.id !== 'space:maple');
    fresh();
  }, { params: { use: 'school' } }),
  // The learner report (8.7).
  screenState('learner report', 'AccountLearnerReport', 'account-learner-report', fresh, { below: inside }),
  screenState('learner report, archived family', 'AccountLearnerReport', 'account-learner-report', fresh, { below: inside, params: { ...ROUTES.AccountLearnerReport.params, spaceId: 'space:spring' } }),
  ...(['day', 'month', 'all'] as const).map((period) => screenState(`learner report, ${period}`, 'AccountLearnerReport', 'account-learner-report', fresh, { below: inside, params: { ...ROUTES.AccountLearnerReport.params, period } })),
  screenState('learner report, error', 'AccountLearnerReport', 'learner-report-error', () => {
    env.answer = failing(500, 'error', /report$/);
    fresh();
  }, { below: inside }),
  screenState('learner report, offline', 'AccountLearnerReport', 'account-report-state-offline', () => {
    env.answer = offlineAnswer;
    fresh();
  }, { below: inside }),
  screenState('learner report, not available', 'AccountLearnerReport', 'account-report-state-unavailable', () => {
    env.answer = failing(403, 'native_off');
    fresh();
  }, { below: inside }),
  // The class page (8.3).
  ...Object.keys(PLAN_VARIANTS).map((plans) => screenState(`class page, plans ${plans}`, 'AccountSpace', plans === 'none' ? 'account-space' : 'account-space-plan', () => {
    planCards = PLAN_VARIANTS[plans]!;
    fresh();
  }, { below: inside })),
  screenState('class page, a school’s class with no date', 'AccountSpace', 'account-space-plan', () => {
    planCards = PLAN_VARIANTS.lapsed!;
    fresh();
  }, { below: inside, params: { spaceId: 'space:sunflower', use: 'teacher' } }),
  screenState('class page, archived', 'AccountSpace', 'account-space', fresh, { below: inside, params: { spaceId: 'space:old', use: 'teacher' } }),
  screenState('class page, no learner yet', 'AccountSpace', 'account-space-empty', fresh, { below: inside, params: { spaceId: 'space:empty', use: 'teacher' } }),
  screenState('class page, refused', 'AccountSpace', 'account-space-state', () => {
    env.answer = failing(403, 'forbidden', /roster$/);
    fresh();
  }, { below: inside }),
  screenState('class page, offline', 'AccountSpace', 'account-space-state-offline', () => {
    env.answer = offlineAnswer;
    fresh();
  }, { below: inside }),
  screenState('class page, not available', 'AccountSpace', 'account-space-state-unavailable', () => {
    env.answer = failing(403, 'native_off');
    fresh();
  }, { below: inside }),
  // The school page (8.4).
  ...Object.keys(PLAN_VARIANTS).map((plans) => screenState(`school page, plans ${plans}`, 'AccountSchool', plans === 'none' ? 'account-school' : 'account-school-plan', () => {
    planCards = PLAN_VARIANTS[plans]!;
    fresh();
  }, { below: inside })),
  screenState('school page, no usage', 'AccountSchool', 'account-school', () => {
    schoolUsage = null;
    fresh();
  }, { below: inside }),
  screenState('school page, cannot load', 'AccountSchool', 'account-school-state', () => {
    env.answer = failing(500, 'error', /school$/);
    fresh();
  }, { below: inside }),
  screenState('school page, offline', 'AccountSchool', 'account-school-state-offline', () => {
    env.answer = offlineAnswer;
    fresh();
  }, { below: inside }),
  screenState('school page, not available', 'AccountSchool', 'account-school-state-unavailable', () => {
    env.answer = failing(403, 'native_off');
    fresh();
  }, { below: inside }),
  // The class report (8.7): every window, an older one, archived, every state.
  ...(['day', 'week', 'month', 'all'] as const).map((period) => screenState(`class report, ${period}`, 'AccountClassReport', 'account-class-report-headline', fresh, { below: inside, params: { spaceId: 'space:saturday', period, use: 'teacher' } })),
  screenState('class report, an older week', 'AccountClassReport', 'account-class-report-headline', fresh, {
    below: inside,
    then: async (r) => {
      await tap(r.root, 'account-class-report-step-prev');
      await settle();
    },
  }),
  screenState('class report, archived', 'AccountClassReport', 'account-class-report-archived', fresh, { below: inside, params: { spaceId: 'space:old', period: 'week', use: 'teacher' } }),
  screenState('class report, not a class', 'AccountClassReport', 'account-class-report-unavailable', fresh, { below: inside, params: { spaceId: 'space:kim', period: 'week', use: 'teacher' } }),
  screenState('class report, error', 'AccountClassReport', 'account-class-report-error', () => {
    env.answer = failing(500, 'error', /class-report$/);
    fresh();
  }, { below: inside }),
  screenState('class report, offline', 'AccountClassReport', 'account-class-report-state', () => {
    env.answer = offlineAnswer;
    fresh();
  }, { below: inside }),
];

const cardState = (name: string, marker: string, arrange: () => Promise<void> | void, mount: ClerkMountState = 'ready'): Sweep => ({
  name: `card ${name}`,
  marker,
  mount: async () => {
    await arrange();
    const r = await render(providers(createElement(AccountCard, { navigation: makeNav(['ParentDashboard']) as never }), mount));
    await settle(14);
    await until(() => has(r.root, marker));
    return r;
  },
});
const CARD_SWEEP: Sweep[] = [
  cardState('signed out', 'account-card-sign-in', () => {
    clerk.signedIn = false;
    fresh();
  }),
  cardState('signed in, fresh', 'account-card-email', fresh),
  cardState('signed in, not fresh', 'account-card-sign-out', () => void useUiStore.setState({ parentGateOpenedAt: Date.now() })),
  cardState('first sign-in here', 'account-card-sign-in-again', async () => {
    await device('pin');
    fresh();
  }),
  cardState('pin changed', 'account-card-sign-in-again', async () => {
    await device('pin', { trust: { v: 1, epoch: EPOCH - 1 } });
    fresh();
  }),
  cardState('re-trust', 'account-card-sign-in-again', async () => {
    await device('pin', { trust: { v: 1, epoch: EPOCH - 1 } });
    useAccountVisit.setState({ retrustPending: true });
    fresh();
  }),
  cardState('cannot check', 'account-card-try-again', () => void useProfileStore.setState({ hydrated: false })),
  cardState('no Clerk', 'account-card-try-again', fresh, 'off'),
  cardState('offline', 'account-card', () => {
    env.online = false;
    clerk.signedIn = false;
  }),
];

const rowState = (name: string, arrange: () => Promise<void>): Sweep => ({
  name: `chooser ${name}`,
  marker: 'who-row-area',
  mount: async () => {
    await arrange();
    resetChooserState();
    const r = await render(createElement(QueryClientProvider, { client }, createElement(WhoIsUsingScreen, { navigation: makeNav(['WhoIsUsing']), route: { key: 'me', name: 'WhoIsUsing', params: { trigger: 'launch' } } } as never)));
    await settle();
    return r;
  },
});
const ROW_SWEEP: Sweep[] = [
  rowState('known uses', () => device('pin', { uses: usesRecord(['family', 'teacher', 'school']) })),
  rowState('Grown-up account', () => device('pin', { uses: usesRecord([]) })),
  rowState('sign in', () => device('pin')),
  rowState('nopin', () => device('nopin')),
  rowState('open', () => device('open')),
  rowState('offline', async () => {
    await device('pin', { uses: usesRecord(['family']) });
    env.online = false;
  }),
  ...[true, false].map((online) => ({
    name: `welcome ${online ? 'online' : 'offline'}`,
    marker: 'welcome-account',
    mount: async () => {
      await device('empty');
      env.online = online;
      const r = await render(providers(createElement(WelcomeAccountRow, { navigation: makeNav(['Welcome']) as never })));
      await settle();
      return r;
    },
  })),
];

describe('section 9.2: the deny-list sweep over every account state, in en, es and ko, on iOS and Android', () => {
  const openURL = () => vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);

  for (const os of OSES) {
    for (const locale of LOCALES) {
      it(`${os} ${locale}: ${SWEEP.length + CARD_SWEEP.length + ROW_SWEEP.length} states, no denied word, symbol or link`, async () => {
        const spy = openURL();
        const hits: string[] = [];
        for (const state of [...SWEEP, ...CARD_SWEEP, ...ROW_SWEEP]) {
          await device('pin', { trust: TRUSTED(), uses: usesRecord(['family', 'teacher', 'school']) });
          setPlatform(os);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, lastPinTypedAt: null });
          useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
          Object.assign(env, { online: true, answer: null, fetches: [] });
          Object.assign(clerk, { signedIn: true, answers: {} });
          spaces = ALL_SPACES;
          schoolUsage = { students: 34, teachers: 6 };
          planCards = PLAN_VARIANTS.own!;
          client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
          const r = await state.mount();
          expect(hostNodes(r.root, (n) => n.props['data-testid'] === state.marker || String(n.props['data-testid'] ?? '').startsWith(`${state.marker}-`)).length, `${os} ${locale} ${state.name}: reached`).toBeGreaterThan(0);
          for (const text of screenTexts(r.root)) for (const hit of accountDenyHits(withoutTyped(text), locale)) hits.push(`${state.name}: "${text}" has ${hit}`);
          if (hostNodes(r.root, (n) => n.props.href !== undefined).length > 0) hits.push(`${state.name}: a link`);
          await unmount(r);
        }
        expect(hits).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
        expect(env.externalLinks).toEqual([]);
      });
    }
  }

  it('no control on any open account screen opens a URL when pressed', async () => {
    const spy = openURL();
    for (const state of [...SWEEP, ...CARD_SWEEP].filter((s) => !s.name.startsWith('lock'))) {
      await device('pin', { trust: TRUSTED(), uses: usesRecord(['family', 'teacher', 'school']) });
      Object.assign(env, { online: true, answer: null });
      Object.assign(clerk, { signedIn: true, answers: {} });
      spaces = ALL_SPACES;
      planCards = PLAN_VARIANTS.own!;
      client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const r = await state.mount();
      for (const button of hostNodes(r.root, (n) => n.props.role === 'button')) {
        try {
          await press(button);
        } catch {
          // A press whose element left the tree with the one before it.
        }
      }
      await settle(4);
      await unmount(r);
    }
    expect(spy).not.toHaveBeenCalled();
    expect(env.externalLinks).toEqual([]);
  });
});

// ---- Sources ----

function sourcesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') return [];
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
