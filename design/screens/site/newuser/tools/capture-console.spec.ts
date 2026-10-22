/*
 * AMENDMENTS-SITE-NEWUSER item 7: the console captures of the mocks (a parent's weekly report, a teacher's class page;
 * review round 3 crops, spec section 3.13).
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
  // The weekly report at 390 x 844, 2x: from the period tabs to the end of "What to practice next". Review round 3: no
  // print hint at the top edge, no "Now on Stage" line (its stage name is English in the Korean UI, spec section 11),
  // no tiles cut at the bottom. The encoder drops the top 16 px (8 CSS px) so the line above the tabs never shows.
  test(`report ${loc}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await mockReport(page, { kind: 'family' });
    await page.goto(`${reportUrl('family', 'period=week&from=home')}&lang=${loc}`);
    await page.getByTestId('report-headline').waitFor();
    await page.waitForTimeout(800);
    const box = await page.evaluate(() => {
      const top = (n: Element | null) => (n ? n.getBoundingClientRect().top + window.scrollY : 0);
      const tabs = document.querySelector('[role="tablist"]');
      const practice = [...document.querySelectorAll('h2,h3')][1]?.parentElement ?? null; // "What to practice next"
      return { top: top(tabs), bottom: practice ? practice.getBoundingClientRect().bottom + window.scrollY : 0 };
    });
    const y = Math.round(box.top - 12);
    await page.screenshot({ path: `${OUT}/${loc}/report.png`, fullPage: true, clip: { x: 0, y, width: 390, height: Math.round(box.bottom - y + 16) } });
    await ctx.close();
  });
  // The class page (class-list.webp wide, class-list-narrow.webp below 45em). Review round 3: no student cards, which carry
  // the Learning Route row (`learningRoute` is off on the site) and the level check's starting spot (`levelCheck` off).
  // Wide: from the class name to the end of "This week" at 720 px. Narrow: the "This week" card alone at 390 px, 2x.
  for (const [tag, width, scale] of [['class-list', 720, 1], ['class-list-narrow', 390, 2]] as const) {
    test(`${tag} ${loc}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
      const page = await ctx.newPage();
      await mockRoster(page);
      await page.goto(`/teach/space?id=space%3Asunflower&lang=${loc}`);
      await page.waitForTimeout(2500);
      const week = { en: 'This week', es: 'Esta semana', ko: '이번 주' }[loc];
      const box = await page.evaluate((w) => {
        const h = [...document.querySelectorAll('h1,h2')].find((n) => n.textContent?.trim() === 'Sunflower');
        const t = [...document.querySelectorAll('h2,h3,div,span,p')].find((n) => n.textContent?.trim() === w && n.children.length === 0);
        let card = t as HTMLElement | null;
        while (card && parseFloat(getComputedStyle(card).borderTopWidth) === 0) card = card.parentElement;
        const abs = (r: DOMRect | undefined, k: 'top' | 'bottom') => (r ? r[k] + window.scrollY : 0);
        return { name: abs(h?.getBoundingClientRect(), 'top'), cardTop: abs(card?.getBoundingClientRect(), 'top'), bottom: abs(card?.getBoundingClientRect(), 'bottom') };
      }, week);
      const y = Math.max(0, Math.round((tag === 'class-list' ? box.name : box.cardTop) - 16));
      await page.screenshot({ path: `${OUT}/${loc}/${tag}.png`, fullPage: true, clip: { x: 0, y, width, height: Math.round(box.bottom - y + 16) } });
      await ctx.close();
    });
  }
}
