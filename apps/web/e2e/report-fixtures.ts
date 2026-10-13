import type { Page, Route } from '@playwright/test';

/**
 * Frozen data for `reports.spec.ts` (F-REPORT-001 section 5): Thursday 15 October 2026, 12:00 UTC, the same learners
 * as the console view's unit fixtures (`src/lib/console/__tests__/fixtures/report.ts`). Never edit the counts to follow
 * the code; add a new dated fixture instead.
 */
export const NOW = '2026-10-15T12:00:00.000Z';
/** The API origin a reports e2e build is made with (`NEXT_PUBLIC_API_BASE_URL`); every call to it is mocked. */
export const API = 'https://api.report-e2e.test';
export const SESSION_KEY = 'hr:console:session';

const JOURNEY = {
  v: 1,
  here: 'stage1',
  stages: [
    { stage: 'stage1', state: 'open', done: 7, known: 0, total: 15 },
    { stage: 'stage2', state: 'later', done: 0, known: 0, total: 2 },
  ],
};

const PLACEMENT = {
  takenAt: '2026-10-10T09:00:00.000Z',
  level: { stage: 'stage1', band: 1 },
  oralStage: 'stage2',
  strands: { 'hangul-recognition': 'secure', 'sound-letter': 'getting-there', 'syllable-reading': 'not-yet', vocabulary: 'not-tested', sentences: 'not-tested' },
  beyondContent: false,
  overridden: false,
};

/** Mina, a steady week: Mon 12, Wed 14 and Thu 15 October (36 minutes), two new quests. */
export const STEADY = {
  lastActiveAt: '2026-10-15T09:30:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 7, questsTotal: 15, anchorAccuracy: 0.86 },
  cardsUnlocked: 5,
  minutesLast7d: 36,
  jamoRecognized: ['ㄱ', 'ㄴ', 'ㅁ', 'ㅇ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'],
  needsPractice: ['ㅂ', 'ㅅ'],
  placement: PLACEMENT,
  planProgress: { 'plan:family-week': { done: 3, total: 5, notReady: 1 } },
  journey: JOURNEY,
  activity: {
    v: 1,
    tz: -420,
    asOf: '2026-10-15',
    days: [
      { d: '2026-09-15', min: 20, q: 1, c: 1, w: 0, j: ['ㅏ', 'ㅓ'] },
      { d: '2026-09-18', min: 15, q: 0, c: 0, w: 0, j: [] },
      { d: '2026-09-22', min: 15, q: 1, c: 1, w: 0, j: ['ㅗ', 'ㅜ'] },
      { d: '2026-09-26', min: 15, q: 0, c: 0, w: 0, j: ['ㅁ'] },
      { d: '2026-10-03', min: 20, q: 1, c: 1, w: 0, j: ['ㅇ'] },
      { d: '2026-10-06', min: 20, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-12', min: 12, q: 1, c: 1, w: 0, j: ['ㄱ'] },
      { d: '2026-10-14', min: 9, q: 0, c: 0, w: 0, j: [] },
      { d: '2026-10-15', min: 15, q: 1, c: 0, w: 0, j: ['ㄴ'] },
    ],
    months: [
      { m: '2026-09', min: 95, q: 3, c: 3, w: 0, days: 6 },
      { m: '2026-10', min: 76, q: 4, c: 2, w: 0, days: 5 },
    ],
    total: { since: '2026-09-05', min: 171, q: 7, c: 5, w: 0, days: 11 },
    milestones: [],
    next: { q: 'quest:stage1-life-q2', plan: true },
    revisit: 'quest:stage1-life-q2',
  },
};

/** The steady learner whose device last saved four days ago (behaviour 13: the partial window). */
export const PARTIAL = {
  ...STEADY,
  lastActiveAt: '2026-10-11T09:30:00.000Z',
  activity: {
    ...STEADY.activity,
    asOf: '2026-10-11',
    days: [...STEADY.activity.days.filter((d) => d.d < '2026-10-09'), ...['2026-10-09', '2026-10-10', '2026-10-11'].map((d) => ({ d, min: 10, q: 0, c: 0, w: 0, j: [] }))],
  },
};

/** Sora on an app build from before RP-4: no `activity`, the legacy state. */
export const LEGACY = {
  lastActiveAt: '2026-10-14T16:00:00.000Z',
  streakDays: 1,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 2,
  minutesLast7d: 20,
  jamoRecognized: ['ㅏ', 'ㄱ'],
  needsPractice: ['ㄴ'],
  journey: JOURNEY,
  planProgress: { 'plan:class-week': { done: 2, total: 2, notReady: 0 } },
};

/** Hana, who joined and never practiced: the empty state with the app's next quest. */
export const EMPTY = {
  lastActiveAt: '',
  stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 0,
  journey: JOURNEY,
  activity: {
    v: 1,
    tz: 0,
    asOf: '2026-10-15',
    days: [],
    months: [],
    total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 },
    milestones: [],
    next: { q: 'quest:stage1-letters-q1', plan: false },
  },
};

export type Kind = 'family' | 'class';

export interface ReportMock {
  kind?: Kind;
  summary?: unknown;
  name?: string;
  spaceName?: string;
  archivedAt?: string | null;
  role?: 'owner' | 'teacher' | 'caregiver';
  /** A status for the learner route instead of a body. */
  status?: number;
  /** Hold the learner route until `release()` (the loading state). */
  hold?: boolean;
}

export const spaceId = (kind: Kind): string => (kind === 'class' ? 'space:sunflower' : 'space:kim-family');

/** The learner route's body for one learner in a space of `kind`. */
function body(mock: ReportMock): unknown {
  const kind = mock.kind ?? 'family';
  return {
    space: {
      id: spaceId(kind),
      kind,
      name: mock.spaceName ?? (kind === 'class' ? 'Sunflower' : 'Kim family'),
      parentSpaceId: null,
      settings: { consentMode: 'parent', anonymizeRoster: false },
      archivedAt: mock.archivedAt ?? null,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    learner: { id: 'profile:mina', displayName: mock.name ?? 'Mina', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z' },
    summary: mock.summary === undefined ? STEADY : mock.summary,
    lastSyncedAt: '2026-10-15T09:31:00.000Z',
    serverTime: NOW,
  };
}

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/**
 * A signed-in dev session (the console's session key) and the API mocked with `page.route`: the learner route
 * answers `mock`, the spaces list holds the space with `mock.role`, and anything else answers an empty list. Returns
 * the learner route's periods in call order and, with `hold`, a function that lets the held answers through.
 */
export async function mockReport(page: Page, first: ReportMock, later: ReportMock = first): Promise<{ periods: string[]; release: () => void }> {
  const periods: string[] = [];
  let waiting: (() => void)[] = [];
  let held = first.hold === true;
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const mock = periods.length === 0 ? first : later;
    if (/\/learners\/[^/]+\/report$/.test(url.pathname)) {
      periods.push(url.searchParams.get('period') ?? '');
      if (held) await new Promise<void>((resolve) => waiting.push(resolve));
      return mock.status ? json(route, mock.status, null) : json(route, 200, body(mock));
    }
    if (url.pathname === '/api/spaces') {
      const { space } = body(first) as { space: unknown };
      return json(route, 200, { spaces: [{ space, role: first.role ?? 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }] });
    }
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return {
    periods,
    release: () => {
      held = false;
      for (const go of waiting) go();
      waiting = [];
    },
  };
}

/** The report address, ids and codes only. */
export function reportUrl(kind: Kind, extra = 'period=week'): string {
  return `/teach/space/learner?id=${encodeURIComponent(spaceId(kind))}&learner=profile%3Amina&${extra}`;
}
