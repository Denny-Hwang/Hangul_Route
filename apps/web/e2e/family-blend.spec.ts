import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 8 and 11 (BL-OD-6, BL-OD-11), row BL-9; wireframe
 * design/wireframes/parent/route-class-blend.md P1 and P2, mock design/screens/route-blend/mock/parent.html.
 *
 * P1, the family home: Mina's class line says how her class meets ("In: Evening Class D · class on Tuesday, practice 3
 * times a week", on GX-4's row), the card names the class's practice days and **Pause the family weekly plan while class
 * runs** saves the same plan with Mina left out. P2, Mina's report: "Practiced on 3 days this week" with 7 marks, 3
 * filled, hidden from screen readers. en, es and ko at 320 x 568 and 1280 x 800, and at 320 with 200 % text, over the
 * static export with the account API mocked through `page.route` (nothing leaves the machine):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.blend-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled \
 *     pnpm --filter @hangul-route/web build
 *   ROUTE_BLEND_E2E=1 pnpm --filter @hangul-route/web exec playwright test family-blend.spec
 *
 * Class days and practice days are on by default since BL-10, so the export needs no blend setting. No CI lane builds
 * this export (a workflow change, outside the BL rows).
 */
test.skip(process.env.ROUTE_BLEND_E2E !== '1', 'needs the export built against the mocked API (ROUTE_BLEND_E2E=1)');

const API = 'https://api.blend-e2e.test';
const SESSION_KEY = 'hr:console:session';
// Thursday 5 November 2026: the learner's week runs Monday 2 to Sunday 8 November.
const NOW = new Date('2026-11-05T12:00:00.000Z');

const FAMILY = {
  id: 'space:kim',
  kind: 'family',
  name: 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const day = (d: string, min: number) => ({ d, min, q: 1, c: 0, w: 0, j: [] });
const SUMMARY = {
  lastActiveAt: '2026-11-05T09:00:00.000Z',
  minutesLast7d: 30,
  stage1: { questsDone: 6, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 3,
  practiceWeek: { practicedDays: 3 },
  activity: {
    v: 1,
    tz: 0,
    asOf: '2026-11-05',
    days: [day('2026-11-02', 10), day('2026-11-04', 10), day('2026-11-05', 10)],
    months: [],
    total: { since: '2026-09-05', min: 300, q: 6, c: 3, w: 0, days: 14 },
    milestones: [],
  },
};
const MINA = { id: 'profile:mina', displayName: 'Mina', ageGroup: 'starter', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-11-05T09:00:00.000Z', lastSyncedAt: '2026-11-05T09:01:00.000Z', summary: SUMMARY };
const JUN = { ...MINA, id: 'profile:jun', displayName: 'Jun', summary: null };
const MEETING = { classDays: ['tue'], perWeek: 3, practiceDays: ['wed', 'fri', 'sun'] };
const OPTIONS = [
  { learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: 'space:d', name: 'Evening Class D', meeting: MEETING }], selfManaged: false, blockTeacherRequests: false },
  { learnerId: 'profile:jun', name: 'Jun', classes: [], selfManaged: false, blockTeacherRequests: false },
];
const FAMILY_PLAN = {
  id: 'plan:fam',
  spaceId: 'space:kim',
  authorAccountId: 'acct-e2e',
  title: 'Our week',
  items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-11-06' }],
  targetLearnerIds: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockFamily(page: Page): Promise<{ saves: unknown[]; urls: string[] }> {
  const saves: unknown[] = [];
  const urls: string[] = [];
  let plans: Array<Record<string, unknown>> = [FAMILY_PLAN];
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    urls.push(url.pathname + url.search);
    const path = decodeURIComponent(url.pathname);
    if (path === '/api/spaces') return json(route, { spaces: [{ space: FAMILY, role: 'owner', counts: { learners: 2, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, { space: FAMILY, learners: [MINA, JUN], joinCode: 'KIM123', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' });
    if (/\/learners\/[^/]+\/report$/.test(path)) {
      return json(route, { space: FAMILY, learner: MINA, summary: SUMMARY, lastSyncedAt: MINA.lastSyncedAt, serverTime: NOW.toISOString() });
    }
    if (path.endsWith('/relink-requests')) return json(route, { requests: [] });
    if (path.endsWith('/transfer-requests')) return json(route, { requests: [], options: OPTIONS });
    if (path.endsWith('/class-moves')) return json(route, { notices: [] });
    if (path.endsWith('/class-scope')) return json(route, { current: 'class-scope-2026-10', learners: [] });
    if (path.endsWith('/plans') && request.method() === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      saves.push(body);
      plans = plans.map((p) => (p.id === body.id ? { ...p, targetLearnerIds: body.targetLearnerIds ?? null } : p));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data: { plan: plans[0] } }) });
    }
    if (path.endsWith('/plans')) return json(route, { plans });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
  return { saves, urls };
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function text200(page: Page): Promise<void> {
  // The browser's own text size: the console's rem sizes follow the root, so a doubled root is 200 % text.
  await page.addInitScript(() => {
    const apply = (): void => {
      const style = document.createElement('style');
      style.textContent = 'html{font-size:calc(200% * var(--hr-text-scale, 1)) !important}';
      document.head.appendChild(style);
    };
    if (document.head) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  });
}

const childCard = (page: Page, name: string) => page.getByTestId('learner-card').filter({ has: page.getByRole('heading', { name, exact: true }) });

const VIEWS = [
  { label: '320', size: { width: 320, height: 568 }, big: false },
  { label: '1280', size: { width: 1280, height: 800 }, big: false },
  { label: '320-text200', size: { width: 320, height: 568 }, big: true },
] as const;
const LOCALES: Array<{ locale: UiLocale; browser: string; classLine: string; hasPractice: string }> = [
  { locale: 'en', browser: 'en-US', classLine: 'In: Evening Class D · class on Tuesday, practice 3 times a week', hasPractice: "Mina's class has practice days on Wednesday, Friday, and Sunday." },
  { locale: 'es', browser: 'es-ES', classLine: 'En: Evening Class D · clase los martes, práctica 3 veces por semana', hasPractice: 'La clase de Mina tiene días de práctica los miércoles, viernes y domingos.' },
  { locale: 'ko', browser: 'ko-KR', classLine: '소속: Evening Class D · 화요일 수업, 주 3회 연습', hasPractice: 'Mina의 반은 수요일·금요일·일요일에 연습해요.' },
];

for (const { locale, browser, classLine, hasPractice } of LOCALES) {
  const f = getMessages(locale).console.curriculum.blend;
  test.describe(`${locale}: a class with practice days in the family views (BL-9)`, () => {
    test.use({ locale: browser });
    for (const { label, size, big } of VIEWS) {
      test(`${label}: the class line, the practice days and Pause on the card; the practice-week strip on the report`, async ({ page }) => {
        await page.setViewportSize(size);
        if (big) await text200(page);
        const { saves, urls } = await mockFamily(page);
        await page.goto('/parent');
        const mina = childCard(page, 'Mina');
        await expect(mina.getByTestId('child-class-line')).toHaveText(classLine);
        await expect(mina.getByTestId('child-family-plan')).toContainText(hasPractice);
        // Jun has no class: GX-4's line, and nothing about practice days.
        await expect(childCard(page, 'Jun').getByTestId('child-family-plan')).toHaveCount(0);
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`family-blend-card-${locale}-${label}.png`), fullPage: true });
        await mina.getByRole('button', { name: f.family.pause }).click();
        await expect(mina.getByRole('button', { name: f.family.resume })).toBeVisible();
        expect(saves).toEqual([{ id: 'plan:fam', title: 'Our week', items: FAMILY_PLAN.items, targetLearnerIds: ['profile:jun'], publish: true }]);

        await page.goto('/parent/learner?id=space%3Akim&learner=profile%3Amina&period=week');
        const week = page.getByTestId('report-practice-week');
        await expect(week).toContainText(f.report.practiceWeek(3));
        const strip = page.getByTestId('report-practice-strip');
        await expect(strip).toHaveAttribute('aria-hidden', 'true');
        expect(await strip.locator('li').evaluateAll((els) => els.map((el) => el.getAttribute('data-on')))).toEqual(['true', 'true', 'true', 'false', 'false', 'false', 'false']);
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`family-blend-report-${locale}-${label}.png`), fullPage: true });
        // Ids and codes only leave the page: never a class name, a weekday or a count.
        for (const u of urls) expect(u).not.toMatch(/Evening|tue|wed|practiceWeek|practicedDays/i);
      });
    }
  });
}
