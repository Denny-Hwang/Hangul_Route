import { expect, test, type Page, type Route } from '@playwright/test';
import { auditScreen } from './axe-scan';
import { STEADY } from './report-fixtures';

/**
 * The axe smoke on the teacher class page (AMENDMENTS-A11Y-CI row AC-2, OD-AC8, WO-08): `/teach/space?id=space%3Aa`
 * with two learners and a plan, scanned with axe-core and compared with `fixtures/axe-baseline.json` (`axe-scan.ts`).
 * The class page needs a signed-in teacher and the account API, so the session is seeded in `sessionStorage` and every
 * cross-origin `/api/` call is answered by `page.route` (the data and mock of `class-page-order.spec.ts`; nothing
 * leaves the machine). It runs where there is a build with an API base:
 *
 * - `AXE_CONSOLE_E2E=1`: the billing lane of `web-app.yml` on `main`, on the merged app-host dist
 *   (`E2E_OUT=../mobile/dist`), as its own step "Console axe (merged dist)";
 * - `GROWNUP_E2E=1`: locally, on the export `class-page-order.spec.ts` uses.
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.billing-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   AXE_CONSOLE_E2E=1 E2E_OUT=../mobile/dist pnpm --filter @hangul-route/web exec playwright test axe-console.spec
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test axe-console.spec
 */
test.skip(process.env.AXE_CONSOLE_E2E !== '1' && process.env.GROWNUP_E2E !== '1', 'needs a build with an API base (AXE_CONSOLE_E2E=1 or GROWNUP_E2E=1)');

const SESSION_KEY = 'hr:console:session';
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const CLASS = { id: 'space:a', kind: 'class', name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };
const SUMMARY = { ...STEADY, lastActiveAt: at(-60 * 20) };
const learner = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  displayName: name,
  ageGroup: '5-7',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: at(-60 * 20),
  lastSyncedAt: at(-60 * 20),
  summary: SUMMARY,
  ...over,
});
const LEARNERS = [learner('profile:yuhan', 'Yuhan'), learner('profile:jaehan', 'Jaehan', { avatar: 'hoya-blue' })];
const PLAN = {
  id: 'plan:week',
  spaceId: 'space:a',
  authorAccountId: 'acct-e2e',
  title: 'Week of Oct 27',
  items: [{ kind: 'quest', id: 'quest:stage1-life-q2' }],
  targetLearnerIds: null,
  publishedAt: at(-60 * 24 * 3),
  archivedAt: null,
  createdAt: at(-60 * 24 * 3),
  updatedAt: at(-60 * 24 * 3),
  meta: null,
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockClass(page: Page): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  // Every cross-origin API call (the build's API base, whatever host it names); the page's own origin is localhost.
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.hostname !== 'localhost',
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const path = decodeURIComponent(new URL(request.url()).pathname);
      if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: CLASS, role: 'owner', counts: { learners: LEARNERS.length, accounts: 1, classes: 0 } }] });
      if (path.endsWith('/roster')) return json(route, 200, { space: CLASS, learners: LEARNERS, joinCode: 'SUN234', joinCodeExpiresAt: at(60 * 24 * 30) });
      if (path.endsWith('/plans')) return json(route, 200, { plans: [PLAN] });
      if (path.endsWith('/relink-requests')) return json(route, 200, { requests: [] });
      if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming: [] });
      if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: [] });
      return json(route, 200, { plans: [], requests: [], entitlements: [] });
    },
  );
}

test.describe('axe smoke on the teacher class page (AMENDMENTS-A11Y-CI AC-2)', () => {
  test('class-page: the class page with two learners and a plan', async ({ page }) => {
    await mockClass(page);
    await page.goto('/teach/space?id=space%3Aa');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('student-card')).toHaveCount(2);
    await auditScreen(page, 'class-page');
  });
});
