import { expect, test, type Page, type Route } from '@playwright/test';
import { formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX row GX-8 (sections 8 and 9: T7, T8, T9, T10, P4): the class and family roster pages' week lines,
 * quest lines, plan lines and the family's join order, heading and dated join, in ko, en and es at 360 x 740 and
 * 1280 x 800, over the static export with the account API mocked through `page.route`. Same export as reports.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   REPORTS_E2E=1 pnpm --filter @hangul-route/web exec playwright test grownup-readouts
 *
 * `SHOTS_DIR` saves a full-page screenshot of each page, locale and width for a look by eye.
 */
test.skip(process.env.REPORTS_E2E !== '1', 'needs the export built against the mocked report API (REPORTS_E2E=1)');

const CLASS_ID = 'space:sunday-a';
const FAMILY_ID = 'space:kim-family';
const LOCALE_KEY = 'hr:console:uiLocale';
const DAY_MS = 86_400_000;
const ago = (days: number): string => new Date(Date.parse(NOW) - days * DAY_MS).toISOString();

const space = (id: string, kind: 'class' | 'family', name: string) => ({
  id,
  kind,
  name,
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const summary = (over: Record<string, unknown> = {}) => ({
  lastActiveAt: ago(0),
  streakDays: 1,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 4,
  minutesLast7d: 12,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
  ...over,
});

const learner = (id: string, displayName: string, over: Record<string, unknown> = {}) => ({
  id,
  displayName,
  ageGroup: 'starter',
  avatar: 'hoya-orange',
  joinedAt: ago(30),
  lastActiveAt: ago(0),
  lastSyncedAt: ago(0),
  summary: summary(),
  ...over,
});

/** Published a day before NOW; three items. */
const PLAN = {
  id: 'plan:week-3',
  authorAccountId: 'acct-e2e',
  title: 'Week 3',
  items: [
    { kind: 'quest', id: 'quest:stage1-q1' },
    { kind: 'quest', id: 'quest:stage1-q2' },
    { kind: 'quest', id: 'quest:stage1-q3' },
  ],
  targetLearnerIds: null,
  publishedAt: ago(1),
  archivedAt: null,
  createdAt: ago(1),
  updatedAt: ago(1),
};

// The owner's screenshot of 2026-10-31, as rows: a learner on the first quest, one who synced today with no plan
// progress, one who has not opened the app since the plan, a learner who joined today, one away for nine days.
const CLASS_LEARNERS = [
  learner('profile:mina', 'Mina', { lastSyncedAt: ago(0), summary: summary({ stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 2 }) }),
  learner('profile:sam', 'Sam', { lastSyncedAt: ago(2), summary: summary({ planProgress: {} }) }),
  learner('profile:ana', 'Ana', { summary: summary({ planProgress: { 'plan:week-3': { done: 1, total: 3, notReady: 0 } } }) }),
  learner('profile:jun', 'Jun', { lastActiveAt: ago(9), lastSyncedAt: ago(9), joinedAt: ago(40), summary: summary({ lastActiveAt: ago(9), minutesLast7d: 0 }) }),
  learner('profile:new', 'Noa', { joinedAt: ago(0), lastSyncedAt: null, summary: null }),
];

// The Worker sends a family roster most recent activity first; the page shows join order.
const FAMILY_LEARNERS = [
  learner('profile:junho', 'Junho', { joinedAt: '2026-10-14T09:00:00.000Z', lastSyncedAt: null, summary: null }),
  learner('profile:mina', 'Mina', { joinedAt: '2026-09-02T09:00:00.000Z', summary: summary({ stage1: { questsDone: 5, questsTotal: 15, anchorAccuracy: 0.86 } }) }),
];

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function mockConsole(page: Page, locale: UiLocale): Promise<string[]> {
  const paths: string[] = [];
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([sessionKey, localeKey, chosen]) => {
      window.sessionStorage.setItem(sessionKey as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' }));
      window.localStorage.setItem(localeKey as string, chosen as string);
    },
    [SESSION_KEY, LOCALE_KEY, locale],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    paths.push(`${path}${url.search}`);
    const family = path.includes(FAMILY_ID);
    if (path.endsWith('/roster')) {
      return json(route, 200, {
        data: {
          space: family ? space(FAMILY_ID, 'family', 'Kim family') : space(CLASS_ID, 'class', 'Sunday Class A'),
          learners: family ? FAMILY_LEARNERS : CLASS_LEARNERS,
          joinCode: 'K7MPQ4',
          joinCodeExpiresAt: '2026-11-30T00:00:00.000Z',
          seats: { learners: family ? 2 : 5, cap: family ? 4 : 20, schoolLearners: null, schoolCap: null },
          canRename: true,
        },
      });
    }
    if (path.endsWith('/plans')) return json(route, 200, { data: { plans: family ? [] : [{ ...PLAN, spaceId: CLASS_ID }] } });
    if (url.pathname === '/api/spaces') {
      const list = [space(CLASS_ID, 'class', 'Sunday Class A'), space(FAMILY_ID, 'family', 'Kim family')];
      return json(route, 200, { data: { spaces: list.map((s) => ({ space: s, role: 'owner', counts: { learners: 2, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null })) } });
    }
    return json(route, 200, { data: { plans: [], requests: [], entitlements: [], learners: [], notices: [], members: [] } });
  });
  return paths;
}

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

/** Nothing on the page scrolls sideways. */
async function noSideScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const cardOf = (page: Page, name: string) => page.getByTestId('student-card').filter({ has: page.getByText(name, { exact: true }) });

for (const [width, height] of [
  [360, 740],
  [1280, 800],
] as const) {
  for (const locale of ['ko', 'en', 'es'] as const) {
    test.describe(`${locale} at ${width} px`, () => {
      test.use({ viewport: { width, height } });
      const m = getMessages(locale).console;

      test('class page: week lines, quest lines and plan lines say what is true', async ({ page }) => {
        const paths = await mockConsole(page, locale);
        await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
        await expect(page.getByTestId('student-card')).toHaveCount(5);
        // T7: Noa joined today and is not counted; Jun has been away nine days.
        await expect(page.getByTestId('week-not-synced')).toHaveText(m.space.week.notSynced(1));
        // T8: nobody has a Stage 1 first-try figure: no anchor line, no dash.
        await expect(page.getByTestId('week-anchor')).toHaveCount(0);
        // T10: Mina has minutes and no quest done; Ana shows the named count.
        await expect(cardOf(page, 'Mina').getByTestId('quests-line')).toHaveText(m.space.learner.firstQuest);
        await expect(cardOf(page, 'Ana').getByTestId('quests-line')).toHaveText(m.space.learner.questsCards(3, 15, 4));
        // T9: synced after the plan with no progress, synced before it, progress.
        await expect(cardOf(page, 'Mina')).toContainText(m.space.learner.planReadout('Week 3', m.plan.readout.notStarted(3)));
        await expect(cardOf(page, 'Sam')).toContainText(m.space.learner.planReadout('Week 3', m.plan.readout.notDelivered));
        await expect(cardOf(page, 'Ana')).toContainText(m.space.learner.planReadout('Week 3', m.plan.readout.progress(1, 3)));
        // The class keeps the Worker's order and its heading.
        await expect(page.getByTestId('roster-heading')).toHaveText(m.space.recentFirst);
        await noSideScroll(page);
        await shot(page, `gx8-class-${locale}-${width}`);
        for (const p of paths) expect(p).not.toMatch(/Mina|Sam|Ana|Jun|Noa/);
      });

      test('family page: join order, the family heading and practiced line, a dated join', async ({ page }) => {
        await mockConsole(page, locale);
        await page.goto(`/parent/space?id=${encodeURIComponent(FAMILY_ID)}`);
        await expect(page.getByTestId('student-card')).toHaveCount(2);
        await expect(page.getByTestId('student-card').first()).toContainText('Mina');
        await expect(page.getByTestId('student-card').nth(1)).toContainText('Junho');
        await expect(page.getByTestId('roster-heading')).toHaveText(m.space.rosterHeadingFamily);
        await expect(page.getByText(m.space.week.practicedFamily(1, 2), { exact: true })).toBeVisible();
        await expect(page.getByTestId('week-anchor')).toHaveText(m.space.week.anchor('86%'));
        await expect(cardOf(page, 'Junho')).toContainText(m.space.joinedOn(formatDate(locale, '2026-10-14T09:00:00.000Z', 'monthDay')));
        await expect(page.getByText(m.space.recentFirst, { exact: true })).toHaveCount(0);
        await noSideScroll(page);
        await shot(page, `gx8-family-${locale}-${width}`);
      });
    });
  }
}
