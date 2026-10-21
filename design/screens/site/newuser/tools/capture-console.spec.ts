/*
 * AMENDMENTS-SITE-NEWUSER item 7: the console captures of the mocks (a parent's weekly report, a teacher's class page).
 * A design tool, not a test: it lives here so no suite collects it. To run it, copy it into apps/web/e2e (it imports
 * the reports e2e fixtures there), build the export the reports e2e uses, and run it alone:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true CONSOLE_ORIGIN=false \
 *     pnpm --filter @hangul-route/web build
 *   cp design/screens/site/newuser/tools/capture-console.spec.ts apps/web/e2e/zz-site-captures.spec.ts
 *   (cd apps/web && CAP_OUT=<dir> pnpm exec playwright test zz-site-captures; rm e2e/zz-site-captures.spec.ts)
 *
 * The API is mocked with page.route (no network), the dev session is the reports e2e's, and the class holds eight
 * made-up first names. Row SN-1 folds this into apps/web/scripts/site-captures.mjs (spec section 3.13).
 */
import { test, type Page, type Route } from '@playwright/test';
import { API, NOW, SESSION_KEY, STEADY, mockReport, reportUrl } from './report-fixtures';

const OUT = process.env.CAP_OUT ?? '/tmp/cap';
const LOCS = ['en', 'es', 'ko'] as const;
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });
const NAMES = ['Mina', 'Jun', 'Ava', 'Leo', 'Sofia', 'Noah', 'Hana', 'Diego'];

async function mockRoster(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  const space = { id: 'space:sunflower', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (/\/roster$/.test(url.pathname)) {
      const learners = NAMES.map((n, i) => ({
        id: `profile:${n.toLowerCase()}`, displayName: n, avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z', ageGroup: 'starter', lastSyncedAt: '2026-10-15T09:31:00.000Z',
        summary: { ...STEADY, minutesLast7d: [36, 24, 18, 42, 12, 30, 0, 21][i], streakDays: [2, 1, 3, 4, 1, 2, 0, 1][i], stage1: { ...STEADY.stage1, questsDone: [7, 5, 4, 9, 3, 6, 0, 5][i] }, cardsUnlocked: [5, 4, 3, 7, 2, 5, 0, 4][i] },
      }));
      return json(route, { space, learners, joinCode: 'HYRA42', joinCodeExpiresAt: '2026-11-15T00:00:00.000Z' });
    }
    if (url.pathname === '/api/spaces') return json(route, { spaces: [{ space, role: 'owner', counts: { learners: 8, accounts: 1, classes: 0 } }] });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
}

for (const loc of LOCS) {
  test(`report ${loc}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReport(page, { kind: 'family' });
    await page.goto(`${reportUrl('family', 'period=week&from=home')}&lang=${loc}`);
    await page.getByTestId('report-headline').waitFor();
    await page.waitForTimeout(800);
    const h = await page.getByRole('heading', { level: 1 }).first().boundingBox();
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, (h?.y ?? 0) - 12));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${loc}/report.png` });
  });
  test(`roster ${loc}`, async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await mockRoster(page);
    await page.goto(`/teach/space?id=space%3Asunflower&lang=${loc}`);
    await page.waitForTimeout(2500);
    // The student cards: from the "Most recent activity first" heading to the bottom of the first row of cards.
    const heading = { en: 'Most recent activity first', es: 'Primero la actividad más reciente', ko: '최근 활동 순서' }[loc];
    const top = await page.getByText(heading, { exact: true }).first().boundingBox();
    const y = Math.max(0, (top?.y ?? 900) - 16);
    const bottom = await page.evaluate((from) => {
      const cards = [...document.querySelectorAll('li, article, section, div')].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.top + window.scrollY > from + 20 && r.width > 200 && r.width < 400 && r.height > 150;
      });
      const first = cards.sort((p, q) => p.getBoundingClientRect().top - q.getBoundingClientRect().top)[0];
      return first ? first.getBoundingClientRect().bottom + window.scrollY : from + 480;
    }, y);
    await page.screenshot({ path: `${OUT}/${loc}/roster.png`, fullPage: true, clip: { x: 0, y, width: 720, height: Math.round(bottom - y + 6) } });
  });
}
