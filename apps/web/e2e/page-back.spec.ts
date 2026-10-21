import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * AMENDMENTS-DISPLAY-NAV section 13, `apps/web/e2e/page-back.spec.ts` (row DN-6): the console's one way back and its
 * one way out. PageBack sits at the top left of the content, above the h1, on the plan, settings, lecture and receipts
 * pages at 375 and 1280 and goes to the page above (a space's page, then its persona home); the Learner app exit sits
 * at the right end of the header; at 320 with Largest text, with 200 % browser text, and with both (a 300 % root) the
 * frame, those pages and the Display sheet do not scroll sideways; a confirm opens the ConfirmSheet, and Escape and the
 * backdrop cancel it.
 *
 * The console needs an API origin and a signed-in session, so this runs on the same export as `reports.spec.ts`:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   PAGE_BACK_E2E=1 pnpm --filter @hangul-route/web exec playwright test page-back.spec
 *
 * The API is mocked with `page.route` (nothing leaves the machine). No CI lane builds this export (nor the one
 * `reports.spec.ts` uses): adding one is a workflow change outside row DN-6, recorded as an open item (section 15).
 */
const FULL = process.env.PAGE_BACK_E2E === '1';
const en = getMessages('en');
const c = en.console;

const SPACE = {
  id: 'space:sunflower',
  kind: 'class',
  name: 'Sunflower',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const MINA = {
  id: 'profile:mina',
  displayName: 'Mina',
  avatar: 'hoya-orange',
  ageGroup: 'starter',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: NOW,
  lastSyncedAt: NOW,
  summary: null,
};
const ID = encodeURIComponent(SPACE.id);

const escape = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
/** Any one of `labels`, whole. */
const exactly = (...labels: string[]): RegExp => new RegExp(`^(${labels.map(escape).join('|')})$`);

/**
 * The four pages of section 13, each with its PageBack's test id and label. Lecture mode's page names the space once
 * it has read the roster (on by default since AMENDMENTS-LECTURE-V2 LV-7); with `NEXT_PUBLIC_LECTURE_MODE` off (the kill
 * switch) it shows its coming-soon note and goes back to "the space".
 */
const PAGES = [
  { name: 'plan', path: `/teach/space/plan?id=${ID}`, testId: 'page-back', label: exactly(c.plan.back(SPACE.name)) },
  { name: 'settings', path: `/teach/space/settings?id=${ID}`, testId: 'page-back', label: exactly(c.settings.back(SPACE.name)) },
  { name: 'lecture', path: `/teach/space/lecture?id=${ID}`, testId: 'page-back', label: exactly(c.lecture.back(SPACE.name), c.lecture.back(null)) },
  { name: 'receipts', path: `/account/billing/receipts?id=${ID}`, testId: 'receipts-back', label: exactly(c.billing.receipts.back.cta) },
] as const;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** A signed-in dev session and one class the account owns; every call is recorded. */
async function mockConsole(page: Page): Promise<{ calls: string[] }> {
  const calls: string[] = [];
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path}`);
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: SPACE, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: SPACE, learners: [MINA], joinCode: 'SUN123', joinCodeExpiresAt: '2026-11-15T12:00:00.000Z' });
    if (path.endsWith('/code') && request.method() === 'POST') return json(route, 200, { joinCode: 'SUN456', expiresAt: '2026-11-15T12:00:00.000Z' });
    if (path.endsWith('/members')) {
      return json(route, 200, {
        members: [
          { memberKind: 'account', memberId: 'acct-e2e', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Ms Kim', isOwner: true },
          { memberKind: 'learner', memberId: MINA.id, role: 'student', joinedAt: '2026-09-02T00:00:00.000Z', name: 'Mina', isOwner: false },
        ],
      });
    }
    if (path.endsWith('/plans')) return json(route, 200, { plans: [] });
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: [] });
    if (path === '/api/entitlements') return json(route, 200, { entitlements: [] });
    if (path === '/api/billing/receipts') return json(route, 200, { spaceName: SPACE.name, receipts: [] });
    return json(route, 404, null);
  });
  return { calls };
}

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, `${where}: no sideways scroll`).toBeLessThanOrEqual(inner);
}

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b as { x: number; y: number; width: number; height: number };
}

const pageBack = (page: Page, testId: string) => page.getByTestId(testId).first();
/** The page's title: its h1, or the frame's title line on the pages that name themselves there (settings, the space). */
const pageTitle = (page: Page) => page.getByRole('heading', { level: 1 }).or(page.getByTestId('frame-title')).first();

test.describe('PageBack and the Learner app exit (AMENDMENTS-DISPLAY-NAV section 7.3)', () => {
  test.skip(!FULL, 'needs the console e2e export (PAGE_BACK_E2E=1)');

  for (const width of [375, 1280]) {
    for (const p of PAGES) {
      test(`${p.name} at ${width}: PageBack top left above the h1, the exit at the right of the header`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await mockConsole(page);
        await page.goto(p.path);

        const back = pageBack(page, p.testId);
        await expect(back).toHaveText(p.label);
        await expect(pageTitle(page)).toBeVisible();
        const [b, h] = await Promise.all([box(back), box(pageTitle(page))]);
        // Above the title, starting at its left edge (pulled spacing.xs into the gutter so the glyph lines up).
        expect(b.y + b.height).toBeLessThanOrEqual(h.y + 1);
        expect(Math.abs(b.x - h.x)).toBeLessThanOrEqual(12);
        expect(b.height).toBeGreaterThanOrEqual(64);
        // The first control of the content.
        await expect(page.locator('main').locator('a, button').first()).toHaveAttribute('data-testid', p.testId);

        // The Learner app exit: one button, label then arrow, at the right end of the header row.
        const exit = page.getByTestId('frame-learner-app');
        await expect(exit).toHaveText(c.shell.backToLearning);
        await expect(exit.locator('svg')).toHaveCount(1);
        const [e, display] = await Promise.all([box(exit), box(page.getByTestId('frame-display'))]);
        expect(e.x).toBeGreaterThanOrEqual(display.x + display.width - 1);
        expect(e.x + e.width / 2).toBeGreaterThan(width / 2);
        expect(Math.abs(e.y + e.height / 2 - (display.y + display.height / 2))).toBeLessThanOrEqual(2);
        await expect(page.getByText(/Open the learner app|Back to learning/)).toHaveCount(0);
        await noSidewaysScroll(page, `${p.name} ${width}`);
        await page.screenshot({ path: test.info().outputPath(`page-back-${p.name}-${width}.png`), fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  }

  test('PageBack goes to the page above: the plan to its space, the space to Classes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockConsole(page);
    await page.goto(PAGES[0].path);
    await pageBack(page, 'page-back').click();
    await page.waitForURL((url) => url.pathname === '/teach/space' && url.searchParams.get('id') === SPACE.id);
    const toClasses = pageBack(page, 'page-back');
    await expect(toClasses).toHaveText(c.pageBack.to(c.shell.nav.classes));
    await expect(toClasses).toHaveAttribute('href', '/teach/home');
    await toClasses.click();
    await page.waitForURL((url) => url.pathname === '/teach/home');
  });

  test('the receipts page goes back to Billing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockConsole(page);
    await page.goto(PAGES[3].path);
    await expect(pageBack(page, 'receipts-back')).toHaveAttribute('href', '/account/billing');
  });
});

test.describe('the console at 320 with a large text size (AMENDMENTS-DISPLAY-NAV section 4)', () => {
  test.skip(!FULL, 'needs the console e2e export (PAGE_BACK_E2E=1)');

  test('Largest: the frame, the four pages and the Display sheet do not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockConsole(page);
    await page.goto(PAGES[0].path);
    await page.getByTestId('frame-display').click();
    await expect(page.getByTestId('console-display-sheet')).toBeVisible();
    await page.getByTestId('console-display-text-size-largest').click();
    await expect(page.getByTestId('console-display-text-size-largest')).toHaveAttribute('aria-checked', 'true');
    await noSidewaysScroll(page, 'the Display sheet at Largest');
    await page.screenshot({ path: test.info().outputPath('page-back-display-320-largest.png') });
    await page.getByTestId('console-display-done').click();
    await expect(page.getByTestId('console-display-sheet')).toHaveCount(0);

    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(pageBack(page, p.testId)).toHaveText(p.label);
      await expect(page.getByTestId('frame-learner-app')).toBeVisible();
      await noSidewaysScroll(page, `${p.name} at Largest`);
      await page.screenshot({ path: test.info().outputPath(`page-back-${p.name}-320-largest.png`), fullPage: true });
    }
  });

  test('200 % browser text: the frame, the four pages and the Display sheet do not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockConsole(page);
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
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(pageBack(page, p.testId)).toHaveText(p.label);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
      await noSidewaysScroll(page, `${p.name} at 200 %`);
      await page.screenshot({ path: test.info().outputPath(`page-back-${p.name}-320-text200.png`), fullPage: true });
    }
    await page.getByTestId('frame-display').click();
    await expect(page.getByTestId('console-display-sheet')).toBeVisible();
    await noSidewaysScroll(page, 'the Display sheet at 200 %');
  });
});

test.describe('the console at 320 with Largest and 200 % browser text together (AMENDMENTS-DISPLAY-NAV section 4)', () => {
  test.skip(!FULL, 'needs the console e2e export (PAGE_BACK_E2E=1)');

  test('a 300 % root (Largest x 200 %): the frame, the four pages and the Display sheet do not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockConsole(page);
    // The browser's own text size doubles the root; Largest multiplies it by 1.5 on top: 16 x 2 x 1.5 = 48 px.
    await page.addInitScript(() => {
      const apply = (): void => {
        const style = document.createElement('style');
        style.textContent = 'html{font-size:calc(200% * var(--hr-text-scale, 1)) !important}';
        document.head.appendChild(style);
      };
      if (document.head) apply();
      else document.addEventListener('DOMContentLoaded', apply);
    });
    await page.goto(PAGES[0].path);
    await page.getByTestId('frame-display').click();
    await expect(page.getByTestId('console-display-sheet')).toBeVisible();
    await page.getByTestId('console-display-text-size-largest').click();
    await expect(page.getByTestId('console-display-text-size-largest')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('48px');
    await noSidewaysScroll(page, 'the Display sheet at a 300 % root');
    await page.screenshot({ path: test.info().outputPath('page-back-display-320-root300.png') });
    await page.getByTestId('console-display-done').click();
    await expect(page.getByTestId('console-display-sheet')).toHaveCount(0);

    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(pageBack(page, p.testId)).toHaveText(p.label);
      await expect(page.getByTestId('frame-learner-app')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), p.name).toBe('48px');
      await noSidewaysScroll(page, `${p.name} at a 300 % root`);
      await page.screenshot({ path: test.info().outputPath(`page-back-${p.name}-320-root300.png`), fullPage: true });
    }
    await page.getByTestId('frame-display').click();
    await expect(page.getByTestId('console-display-sheet')).toBeVisible();
    await noSidewaysScroll(page, 'the Display sheet on a page at a 300 % root');
  });
});

test.describe('ConfirmSheet on the console (AMENDMENTS-DISPLAY-NAV section 8)', () => {
  test.skip(!FULL, 'needs the console e2e export (PAGE_BACK_E2E=1)');

  for (const width of [375, 1280]) {
    test(`at ${width}: a new join code asks first; Escape and the backdrop cancel, the verb confirms`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
      const { calls } = await mockConsole(page);
      await page.goto(`/teach/space?id=${ID}`);
      const regenerate = page.getByRole('button', { name: c.space.regenerate.cta, exact: true });
      const sheet = page.getByRole('alertdialog', { name: c.space.regenerateAsk(SPACE.name) });
      const posts = () => calls.filter((call) => call === `POST /api/spaces/${ID}/code`).length;

      // Escape cancels; the opener has the focus back.
      await regenerate.click();
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAccessibleDescription(c.oldCodeStops);
      await expect(page.getByTestId('confirm-sheet-cancel')).toBeFocused();
      await expect(sheet.getByRole('button')).toHaveText([en.common.buttons.cancel, c.confirm.newCode]);
      await page.screenshot({ path: test.info().outputPath(`confirm-sheet-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(regenerate).toBeFocused();

      // Tab stays inside: from the verb back to Cancel.
      await regenerate.click();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('confirm-sheet-confirm')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('confirm-sheet-cancel')).toBeFocused();
      // A click on the question takes focus off the buttons: Tab still comes back into the sheet (never the page
      // behind, which is inert), and Escape still cancels.
      await sheet.getByRole('heading').click();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('confirm-sheet-cancel')).toBeFocused();
      await sheet.getByRole('heading').click();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await regenerate.click();

      // The backdrop cancels (its top left corner is clear of the sheet at both widths).
      await page.getByTestId('confirm-sheet-backdrop').click({ position: { x: 4, y: 4 } });
      await expect(sheet).toHaveCount(0);
      expect(posts()).toBe(0);

      // The verb confirms: one new code.
      await regenerate.click();
      await page.getByTestId('confirm-sheet-confirm').click();
      await expect(sheet).toHaveCount(0);
      await expect.poll(posts).toBe(1);
      await noSidewaysScroll(page, `space page ${width}`);
    });
  }
});
