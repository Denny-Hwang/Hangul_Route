import { expect, test, type Page, type Route } from '@playwright/test';
import { API, NOW, SESSION_KEY, STEADY } from './report-fixtures';

/**
 * F-LEARN-001 section 3.11: a learner renamed on their device ("Test" to "Sungjoo") shows on a console tab that
 * stayed open, without a reload. The teacher roster, the learner report, the family home and the family report read
 * again when the tab comes back into view (`visibilitychange` to `visible`), at most every 30 seconds. The API is
 * mocked with `page.route`; the Worker side (the PATCH and the roster, report and family views that read the live
 * learner row) is covered by the backend's learner-rename integration test. Same export as reports.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   REPORTS_E2E=1 pnpm --filter @hangul-route/web exec playwright test learner-rename
 */
test.skip(process.env.REPORTS_E2E !== '1', 'needs the export built against the mocked report API (REPORTS_E2E=1)');

const CLASS_ID = 'space:sunflower';
const FAMILY_ID = 'space:kim-family';

type Kind = 'class' | 'family';

const space = (kind: Kind) => ({
  id: kind === 'class' ? CLASS_ID : FAMILY_ID,
  kind,
  name: kind === 'class' ? 'Sunflower' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });

/** The mocked Worker: one learner whose name the test changes, as the device's PATCH would. */
async function mockConsole(page: Page, role: 'teacher' | 'owner'): Promise<{ rename: (name: string) => void; reads: string[] }> {
  let name = 'Test';
  const reads: string[] = [];
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const kind: Kind = decodeURIComponent(url.pathname).includes(CLASS_ID) ? 'class' : 'family';
    const learner = { id: 'profile:mina', displayName: name, avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z' };
    if (/\/learners\/[^/]+\/report$/.test(url.pathname)) {
      reads.push('report');
      return json(route, 200, { space: space(kind), learner, summary: STEADY, lastSyncedAt: '2026-10-15T09:31:00.000Z', serverTime: NOW });
    }
    if (/\/roster$/.test(url.pathname)) {
      reads.push('roster');
      return json(route, 200, { space: space(kind), learners: [{ ...learner, ageGroup: 'starter', lastSyncedAt: '2026-10-15T09:31:00.000Z', summary: STEADY }], joinCode: null, joinCodeExpiresAt: null });
    }
    if (url.pathname === '/api/spaces') {
      const kinds: Kind[] = role === 'teacher' ? ['class'] : ['family'];
      return json(route, 200, { spaces: kinds.map((k) => ({ space: space(k), role, counts: { learners: 1, accounts: 1, classes: 0 } })) });
    }
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return { rename: (next) => void (name = next), reads };
}

/** The tab comes back into view `afterMs` after the page loaded. */
async function comeBack(page: Page, afterMs: number): Promise<void> {
  await page.clock.setFixedTime(new Date(Date.parse(NOW) + afterMs));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

test.describe('the teacher console', () => {
  test('the roster row shows the new name when the tab comes back into view, without a reload', async ({ page }) => {
    const mock = await mockConsole(page, 'teacher');
    await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
    await expect(page.getByText('Test', { exact: true }).first()).toBeVisible();
    const loads = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    mock.rename('Sungjoo');

    // Back into view at once: the 30 second gap keeps the page as it is.
    const before = mock.reads.filter((r) => r === 'roster').length;
    await comeBack(page, 5_000);
    await page.waitForTimeout(300);
    expect(mock.reads.filter((r) => r === 'roster').length).toBe(before);
    await expect(page.getByText('Test', { exact: true }).first()).toBeVisible();

    await comeBack(page, 31_000);
    await expect(page.getByText('Sungjoo', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Test', { exact: true })).toHaveCount(0);
    // The same document: no reload happened.
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(loads);
  });

  test('the learner report header becomes "Sungjoo: report" without a reload', async ({ page }) => {
    const mock = await mockConsole(page, 'teacher');
    await page.goto(`/teach/space/learner?id=${encodeURIComponent(CLASS_ID)}&learner=profile%3Amina&period=week&from=roster`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test: report');
    mock.rename('Sungjoo');
    await comeBack(page, 31_000);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sungjoo: report');
    // The browser title never holds the name (F-REPORT-001 section 3.10).
    await expect(page).toHaveTitle('Report - Hangul Route');
  });
});

test.describe('the family console', () => {
  test('the family home card shows the new name without a reload', async ({ page }) => {
    const mock = await mockConsole(page, 'owner');
    await page.goto('/parent');
    await expect(page.getByText('Test', { exact: true }).first()).toBeVisible();
    mock.rename('Sungjoo');
    await comeBack(page, 31_000);
    await expect(page.getByText('Sungjoo', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Test', { exact: true })).toHaveCount(0);
  });

  test('the family roster and the family report show the new name without a reload', async ({ page }) => {
    const mock = await mockConsole(page, 'owner');
    await page.goto(`/parent/space?id=${encodeURIComponent(FAMILY_ID)}`);
    await expect(page.getByText('Test', { exact: true }).first()).toBeVisible();
    mock.rename('Sungjoo');
    await comeBack(page, 31_000);
    await expect(page.getByText('Sungjoo', { exact: true }).first()).toBeVisible();

    mock.rename('Test');
    // A new page load starts its own 30 seconds.
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto(`/parent/learner?id=${encodeURIComponent(FAMILY_ID)}&learner=profile%3Amina&period=week&from=home`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test: report');
    mock.rename('Sungjoo');
    await comeBack(page, 31_000);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sungjoo: report');
  });
});
