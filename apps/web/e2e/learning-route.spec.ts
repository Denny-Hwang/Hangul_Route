import { expect, test, type Page, type Route } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY, mockReport, reportUrl } from './report-fixtures';

/**
 * AMENDMENTS-ROUTE-LEARNING-ROUTE section 12, `apps/web/e2e/learning-route.spec.ts` (LR-10): the grown-up stage
 * list page under `/parent/space/route` (a family) and `/teach/space/route` (a class) on a mocked roster, at 320
 * and 1280, and the report's At a glance link to it (RP-7a2). Wireframes `parent/learning-route.md` and
 * `console/learning-route.md`; screen spec `design/screens/learning-route/stage-list.md`.
 *
 * The page is a build-time switch (`learningRouteEnabled()`), so the full cases need an export made with
 *
 *   NEXT_PUBLIC_LEARNING_ROUTE_ENABLED=true NEXT_PUBLIC_REPORTS_ENABLED=true \
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *
 * run with `LEARNING_ROUTE_E2E=1`. On the default export (the preview gate's) only the switched-off case runs:
 * the address goes back to the space page.
 */
const FULL = process.env.LEARNING_ROUTE_E2E === '1';
const en = getMessages('en');
const lr = en.console.learningRoute;
const canDo = en.learner.myRoute.stage.canDo;

type Kind = 'family' | 'class';
const SPACE: Record<Kind, { id: string; name: string; prefix: string }> = {
  family: { id: 'space:kim-family', name: 'Kim family', prefix: '/parent/space/route' },
  class: { id: 'space:sunflower', name: 'Sunflower', prefix: '/teach/space/route' },
};

const routeUrl = (kind: Kind, learner = 'profile:mina'): string =>
  `${SPACE[kind].prefix}?id=${encodeURIComponent(SPACE[kind].id)}&learner=${encodeURIComponent(learner)}`;

/** Mina at 15 October 2026: Stage 1 open with four known from the level check, the Stage 2 and 4 tastes, the rest later. */
const JOURNEY = {
  v: 1,
  here: 'stage1',
  seeded: true,
  stages: [
    { stage: 'stage1', state: 'open', done: 2, known: 4, total: 8 },
    { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
    { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage4', state: 'open', done: 0, known: 0, total: 1 },
    { stage: 'stage5', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage6', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage7', state: 'later', done: 0, known: 0, total: 0 },
  ],
};

const SUMMARY = {
  lastActiveAt: '2026-10-15T09:30:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 2, questsTotal: 8, anchorAccuracy: null },
  cardsUnlocked: 2,
  minutesLast7d: 30,
  jamoRecognized: ['ㄱ', 'ㄴ'],
  needsPractice: [],
  journey: JOURNEY,
};

/** The class's live weekly plan (a curriculum from Monday 12 October, four weeks) whose one lesson is in Stage 2. */
function classPlan(): unknown {
  const draft = generateCurriculum(
    {
      audience: 'class',
      level: { stage: 'stage1', band: 0 },
      startDate: '2026-10-12',
      weeks: 4,
      sessionsPerWeek: 2,
      sessionDays: ['mon', 'wed'],
      minutesPerSession: 10,
      goals: { focus: 'balanced', motivation: 'kculture' },
      unlockedStages: ['stage1', 'stage2'],
      reviewEvery: 4,
    },
    CATALOG,
  );
  return {
    id: 'plan:class-week',
    spaceId: SPACE.class.id,
    authorAccountId: 'acct-e2e',
    title: 'Weekly plan',
    items: [{ kind: 'quest', id: 'quest:stage2-life-q1', week: 1 }],
    targetLearnerIds: null,
    publishedAt: '2026-10-12T09:00:00.000Z',
    archivedAt: null,
    createdAt: '2026-10-11T09:00:00.000Z',
    updatedAt: '2026-10-12T09:00:00.000Z',
    meta: toMeta(draft),
  };
}

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** A signed-in dev session and the roster and plans of one space, mocked with `page.route`. */
async function mockRoster(page: Page, kind: Kind): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  const space = {
    id: SPACE[kind].id,
    kind,
    name: SPACE[kind].name,
    parentSpaceId: null,
    settings: { consentMode: 'parent', anonymizeRoster: false },
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
  // The family device sends the goal it shows (LR-W1, family only); the class card reads its own plan instead.
  const summary = kind === 'family' ? { ...SUMMARY, routeGoal: { stage: 'stage1', from: 'default' } } : SUMMARY;
  const learner = { id: 'profile:mina', displayName: 'Mina', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: SUMMARY.lastActiveAt, ageGroup: 'starter', lastSyncedAt: '2026-10-15T09:31:00.000Z', summary };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) return json(route, 200, { space, learners: [learner], joinCode: null, joinCodeExpiresAt: null });
    if (/\/plans$/.test(url.pathname)) return json(route, 200, { plans: kind === 'class' ? [classPlan()] : [] });
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space, role: kind === 'class' ? 'teacher' : 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }] });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

/**
 * Never on the page body: a ratio, "0 quests", a comparison word, a billing link or word (section 6.1, LR-OD-8).
 * The adult shell's own navigation (Home, Reports, Billing for an owner) is outside `main` and not the page's.
 */
async function calmWords(page: Page): Promise<void> {
  const main = page.getByRole('main');
  const text = await main.innerText();
  expect(text).not.toMatch(/\/\s*\d+/);
  expect(text).not.toMatch(/\b0 quests\b/i);
  expect(text).not.toMatch(/\bbehind\b/i);
  expect(text).not.toMatch(/billing|premium|upgrade|\$/i);
  await expect(main.locator('a[href*="billing"]')).toHaveCount(0);
}

test.describe('Learning Route switched off (the default export)', () => {
  test.skip(FULL, 'the export was built with the Learning Route on');

  test('the stage list address goes back to the space page', async ({ page }) => {
    await page.goto(routeUrl('class'));
    await expect(page).not.toHaveURL(/\/space\/route/);
    await expect(page.locator('ol')).toHaveCount(0);
  });
});

test.describe('the stage list page (LR-8)', () => {
  test.skip(!FULL, 'needs an export built with the Learning Route on (LEARNING_ROUTE_E2E=1)');

  for (const kind of ['family', 'class'] as const) {
    for (const width of [320, 1280]) {
      test(`${kind} at ${width}: back link, the card, an ordered list of stages with can-do lines, calm words`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
        await mockRoster(page, kind);
        await page.goto(routeUrl(kind));

        await expect(page.getByRole('heading', { level: 1 })).toHaveText(lr.title('Mina'));
        await expect(page.getByRole('link', { name: lr.back[kind], exact: true })).toHaveAttribute('href', new RegExp(`id=${encodeURIComponent(SPACE[kind].id)}`));
        const card = page.getByRole('region', { name: lr.section, exact: true });
        await expect(card).toBeVisible();
        await expect(card.getByText(lr.now('Mina', 1, 'Hangul'), { exact: true })).toBeVisible();
        if (kind === 'class') {
          // Case 2: a statement about the class's plan, never a claim about the learner's own goal.
          await expect(card.getByText(lr.planReaches.class(2, 'Words'), { exact: true })).toBeVisible();
        } else {
          await expect(card.getByText(lr.learnerGoal('Mina', 1, 'Hangul'), { exact: true })).toBeVisible();
          await expect(card.getByText(lr.fromLead.default, { exact: true })).toBeVisible();
        }

        await expect(page.getByRole('heading', { level: 2, name: lr.stagesTitle })).toBeVisible();
        const list = page.locator('ol');
        await expect(list).toHaveCount(1);
        // Seven stages, the quiet later runs merged: Stage 3 alone, then Stages 5 to 7.
        await expect(list.getByRole('listitem')).toHaveCount(5);
        await expect(list.getByText(canDo[1], { exact: true })).toBeVisible();
        await expect(list.getByText(canDo[2], { exact: true })).toBeVisible();
        await expect(list.getByText(lr.hereTag('Mina'), { exact: true })).toBeVisible();

        await calmWords(page);
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`learning-route-${kind}-${width}.png`), fullPage: true });
      });
    }
  }

  test('not found: a learner who is not on this roster gets one calm line and the back link, no other learner', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockRoster(page, 'family');
    await page.goto(routeUrl('family', 'profile:nobody'));
    await expect(page.getByText(lr.notFound, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: lr.back.family, exact: true })).toBeVisible();
    await expect(page.getByText('Mina')).toHaveCount(0);
    await expect(page.locator('ol')).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("the report's At a glance card links to the page (RP-7a2)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReport(page, { kind: 'family' });
    await page.goto(reportUrl('family', 'period=week&from=home'));
    const glance = page.getByTestId('report-glance');
    await expect(glance).toBeVisible();
    const link = glance.getByRole('link', { name: en.report.glance.openRoute, exact: true });
    await expect(link).toHaveAttribute('href', /\/parent\/space\/route\?id=space%3Akim-family&learner=profile%3Amina/);
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lr.title('Mina'));
    await expect(page.locator('ol')).toHaveCount(1);
  });
});
