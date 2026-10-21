import { expect, test, type Page, type Route } from '@playwright/test';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 5.3 (row SA-3; mock design/screens/console/rename-inline.md): the one-tap rename
 * on the class page, the school page and its class rows, and the family home, at 320 px and wide. The API is mocked
 * with `page.route`; the Worker side (`PATCH /:id/name`) is covered by the backend's space-rename test. Same export as
 * reports.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   REPORTS_E2E=1 pnpm --filter @hangul-route/web exec playwright test space-rename
 *
 * `SHOTS_DIR` saves a screenshot of each state for a look by eye.
 */
test.skip(process.env.REPORTS_E2E !== '1', 'needs the export built against the mocked report API (REPORTS_E2E=1)');

const CLASS_ID = 'space:sunday-a';
const SCHOOL_ID = 'space:maple';
const FAMILY_ID = 'space:kim-family';

const space = (id: string, kind: 'class' | 'family' | 'school', name: string, parentSpaceId: string | null = null) => ({
  id,
  kind,
  name,
  parentSpaceId,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

interface Mock {
  renames: Array<{ id: string; name: string }>;
  /** The next rename answers this status and code instead of saving. */
  refuse: (status: number, code: string) => void;
}

async function mockConsole(page: Page, role: 'teacher' | 'owner'): Promise<Mock> {
  const names: Record<string, string> = { [CLASS_ID]: 'Sunday Class A', [SCHOOL_ID]: 'Maple School', [FAMILY_ID]: 'Kim family', 'space:saturday-k': 'Saturday K' };
  const mock: Mock & { refusal: { status: number; code: string } | null } = { renames: [], refusal: null, refuse: (status, code) => void (mock.refusal = { status, code }) };
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    const id = Object.keys(names).find((key) => path.includes(`/${key}/`) || path.endsWith(`/${key}`)) ?? CLASS_ID;
    if (request.method() === 'PATCH' && path.endsWith('/name')) {
      const name = (JSON.parse(request.postData() ?? '{}') as { name: string }).name;
      mock.renames.push({ id, name });
      if (mock.refusal) {
        const { status, code } = mock.refusal;
        mock.refusal = null;
        return json(route, status, { error: { code, message: code } });
      }
      names[id] = name;
      return json(route, 200, { data: { space: space(id, id === FAMILY_ID ? 'family' : id === SCHOOL_ID ? 'school' : 'class', name), changed: true } });
    }
    if (path.endsWith('/roster')) {
      const kind = id === FAMILY_ID ? 'family' : id === SCHOOL_ID ? 'school' : 'class';
      const count = kind === 'family' ? 4 : 18;
      return json(route, 200, {
        data: {
          space: space(id, kind, names[id] as string),
          learners: [],
          joinCode: 'K7MPQ4',
          joinCodeExpiresAt: '2026-11-30T00:00:00.000Z',
          seats: { learners: kind === 'family' ? count : 0, cap: kind === 'family' ? 4 : 20, schoolLearners: null, schoolCap: null },
          canRename: true,
          openMoves: kind === 'class',
        },
      });
    }
    if (path.endsWith('/school')) {
      const row = (classId: string) => ({ space: space(classId, 'class', names[classId] as string, SCHOOL_ID), teacher: { accountId: 'ms-han', name: 'Ms Han' }, students: 18, practiced: 3, lastActiveAt: NOW, hasPublishedPlan: true, canRename: true, openMoves: false });
      return json(route, 200, {
        data: {
          school: space(SCHOOL_ID, 'school', names[SCHOOL_ID] as string),
          invite: { joinCode: 'SCH234', joinCodeExpiresAt: '2026-11-30T00:00:00.000Z' },
          license: null,
          limits: { licensed: false, students: 50, teachers: null },
          usage: { students: 50, teachers: 2 },
          thisWeek: { students: 50, practiced: 31, classes: 2, classesWithPlan: 2 },
          classes: [row(CLASS_ID), row('space:saturday-k')],
          canRename: true,
        },
      });
    }
    if (path.endsWith('/members')) return json(route, 200, { data: { members: [] } });
    if (url.pathname === '/api/spaces') {
      const list = role === 'owner' ? [space(FAMILY_ID, 'family', names[FAMILY_ID] as string)] : [space(CLASS_ID, 'class', names[CLASS_ID] as string), space(SCHOOL_ID, 'school', names[SCHOOL_ID] as string)];
      return json(route, 200, { data: { spaces: list.map((s) => ({ space: s, role: 'owner', counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null })) } });
    }
    return json(route, 200, { data: { plans: [], requests: [], entitlements: [], learners: [], notices: [] } });
  });
  return mock;
}

async function shot(page: Page, name: string): Promise<void> {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
}

/** Nothing on the page scrolls sideways. */
async function noSideScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [320, 1280]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('class page: Rename, the field with both hints, Enter saves, the title follows, focus back on Rename', async ({ page }) => {
      const mock = await mockConsole(page, 'teacher');
      await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sunday Class A');
      const rename = page.getByRole('button', { name: 'Rename Sunday Class A' });
      await expect(rename).toBeVisible();
      expect((await rename.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await shot(page, `class-closed-${width}`);
      await rename.click();
      const input = page.getByLabel('Name', { exact: true });
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('Sunday Class A');
      await expect(page.getByText('Students see this name in the app.')).toBeVisible();
      await expect(page.getByText('Some moves into or out of this space are waiting.', { exact: false })).toBeVisible();
      await noSideScroll(page);
      await shot(page, `class-open-${width}`);
      await input.fill('');
      await expect(page.getByText('Type a name.')).toBeVisible();
      await shot(page, `class-invalid-${width}`);
      await input.fill('Sunday Hangul A');
      await input.press('Enter');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sunday Hangul A');
      await expect(page.getByRole('button', { name: 'Rename Sunday Hangul A' })).toBeFocused();
      await expect(page.getByRole('status').filter({ hasText: 'Name saved.' })).toHaveCount(1);
      expect(mock.renames).toEqual([{ id: CLASS_ID, name: 'Sunday Hangul A' }]);
      // The tab title never carries the name.
      await expect(page).not.toHaveTitle(/Sunday/);
      await shot(page, `class-saved-${width}`);
    });

    test('class page: Escape cancels; a refused save gives the old name back with the line', async ({ page }) => {
      const mock = await mockConsole(page, 'teacher');
      await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
      await page.getByRole('button', { name: 'Rename Sunday Class A' }).click();
      await page.getByLabel('Name', { exact: true }).fill('Other');
      await page.getByLabel('Name', { exact: true }).press('Escape');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sunday Class A');
      await expect(page.getByRole('button', { name: 'Rename Sunday Class A' })).toBeFocused();
      mock.refuse(422, 'archived');
      await page.getByRole('button', { name: 'Rename Sunday Class A' }).click();
      await page.getByLabel('Name', { exact: true }).fill('Sunday Hangul A');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Unarchive it first to change the name.')).toBeVisible();
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sunday Hangul A');
      await expect(page.getByRole('heading', { level: 1, includeHidden: true })).toHaveText('Sunday Class A');
      await shot(page, `class-archived-${width}`);
    });

    test('school page: the title and a class row; the row buttons step aside while its field is open', async ({ page }) => {
      const mock = await mockConsole(page, 'teacher');
      await page.goto(`/teach/space?id=${encodeURIComponent(SCHOOL_ID)}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maple School · school');
      await expect(page.getByText('This school has 50 students, the most it holds without a contract.', { exact: false })).toBeVisible();
      await shot(page, `school-closed-${width}`);
      await page.getByRole('button', { name: 'Rename Saturday K' }).click();
      const row = page.getByTestId('class-row').nth(1);
      await expect(row.getByRole('button', { name: 'Open roster' })).toHaveCount(0);
      await noSideScroll(page);
      await shot(page, `school-row-open-${width}`);
      await row.getByLabel('Name', { exact: true }).fill('Saturday Hangul');
      await row.getByLabel('Name', { exact: true }).press('Enter');
      await expect(page.getByTestId('class-row').nth(1)).toContainText('Saturday Hangul');
      await expect(page.getByRole('button', { name: 'Rename Saturday Hangul' })).toBeFocused();
      await page.getByRole('button', { name: 'Rename Maple School' }).click();
      await page.getByLabel('Name', { exact: true }).fill('Maple Hangul School');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maple Hangul School · school');
      expect(mock.renames).toEqual([
        { id: 'space:saturday-k', name: 'Saturday Hangul' },
        { id: SCHOOL_ID, name: 'Maple Hangul School' },
      ]);
    });

    test('family home: Rename beside the family heading; the count and the at-cap line under the code', async ({ page }) => {
      const mock = await mockConsole(page, 'owner');
      await page.goto('/parent');
      await expect(page.getByRole('heading', { level: 2, name: 'Kim family' })).toBeVisible();
      await page.getByRole('button', { name: 'Rename Kim family' }).click();
      await expect(page.getByText('Everyone in the family sees this name.')).toBeVisible();
      await noSideScroll(page);
      await shot(page, `family-open-${width}`);
      await page.getByLabel('Name', { exact: true }).fill('Kim and Park family');
      await page.getByLabel('Name', { exact: true }).press('Enter');
      await expect(page.getByRole('heading', { level: 2, name: 'Kim and Park family' })).toBeVisible();
      expect(mock.renames).toEqual([{ id: FAMILY_ID, name: 'Kim and Park family' }]);
      await page.goto(`/parent/space/settings?id=${encodeURIComponent(FAMILY_ID)}`);
      await expect(page.getByText('4 of 4 learners')).toBeVisible();
      await expect(page.getByText('This family has 4 learners, the most it can hold.', { exact: false })).toBeVisible();
      await shot(page, `family-settings-${width}`);
    });
  });
}
