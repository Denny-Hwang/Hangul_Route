import { expect, test, type Page, type Route } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX row GX-14 (section 9 P5 and P6), on a mocked API:
 *
 * - P6: the grown-up nav is one row at every width, in ko, en and es, at 360 x 740 and 1280 x 800: every tab on one
 *   line, the row scrolls inside itself (never the page), and an end with tabs hidden past it fades ("Billing" no longer
 *   sits alone on a second row). Scrolled to its end, the end fade goes and the start fade shows.
 * - P5: a grown-up page that fails to draw (here: a spaces list of an unexpected shape) shows the console's own error
 *   page in the device's language with Try again, never the framework's white English "Application error"; Try again
 *   loads the page again.
 *
 * It runs on the console e2e export made with lecture mode on (the one `console-lecture-presets.spec.ts` uses, so the
 * nav holds its longest rows):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_LECTURE_MODE=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_NAV_E2E=1 pnpm --filter @hangul-route/web exec playwright test grownup-nav-error.spec
 */
test.skip(process.env.GROWNUP_NAV_E2E !== '1', 'needs the console e2e export with lecture mode on (GROWNUP_NAV_E2E=1)');

const LOCALE_KEY = 'hr:console:uiLocale';
const LOCALES = ['ko', 'en', 'es'] as const;
const SIZES = [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
] as const;

const space = (id: string, kind: 'class' | 'family', name: string) => ({
  space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  role: 'owner',
  counts: { learners: 2, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
});
const CLASS = space('space:sunflower', 'class', 'Sunflower');
const FAMILY = space('space:parks', 'family', 'The Parks');
const learner = (id: string, displayName: string) => ({ id, displayName, avatar: 'hoya-orange', ageGroup: 'starter', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: NOW, lastSyncedAt: NOW, summary: null });

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(status < 300 ? { data } : { error: 'mocked' }) });

/** The homes' reads; `broken` answers the spaces list with an entry the pages cannot draw (no `space`) while it is true. */
async function mock(page: Page, locale: string, spaces: unknown[], state: { broken: boolean } = { broken: false }): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key, session, localeKey, ui]) => {
      window.sessionStorage.setItem(key as string, session as string);
      window.localStorage.setItem(localeKey as string, ui as string);
    },
    [SESSION_KEY, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' }), LOCALE_KEY, locale],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (path === '/api/spaces') return json(route, 200, { spaces: state.broken ? [{ role: 'owner', counts: null }] : spaces });
    if (path.endsWith('/roster')) {
      const of = (spaces as (typeof CLASS)[]).find((s) => path === `/api/spaces/${s.space.id}/roster`);
      return json(route, 200, { space: of?.space, learners: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], joinCode: null, joinCodeExpiresAt: null });
    }
    if (/\/plans$/.test(path)) return json(route, 200, { plans: [] });
    if (path === '/api/entitlements') return json(route, 200, { entitlements: [] });
    return json(route, 404, null);
  });
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

/** The nav row as measured in the browser: the tabs' tops, bottoms and heights, the row's own scroll, its fade state. */
async function measureRow(page: Page) {
  return page.getByTestId('frame-nav-row').evaluate((row) => {
    const list = row.querySelector('ul') as HTMLUListElement;
    const tabs = Array.from(list.querySelectorAll('a'));
    return {
      tops: Array.from(new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)))),
      heights: tabs.map((tab) => tab.getBoundingClientRect().height),
      scrollWidth: list.scrollWidth,
      clientWidth: list.clientWidth,
      start: row.getAttribute('data-more-start'),
      end: row.getAttribute('data-more-end'),
      endFade: getComputedStyle(row, '::after').opacity,
      startFade: getComputedStyle(row, '::before').opacity,
      scrollbar: getComputedStyle(list).scrollbarWidth,
    };
  });
}

for (const locale of LOCALES) {
  const c = getMessages(locale).console;
  for (const size of SIZES) {
    for (const [persona, home, mine] of [
      ['teacher', '/teach/home', CLASS],
      ['parent', '/parent', FAMILY],
    ] as const) {
      test(`P6 ${locale} ${persona} at ${size.width}: the nav is one row that scrolls inside itself, with a fade only while tabs are hidden`, async ({ page }) => {
        await page.setViewportSize(size);
        await mock(page, locale, [mine]);
        await page.goto(home);
        const nav = page.getByTestId('frame-nav');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link').first()).toHaveText(persona === 'teacher' ? c.shell.nav.classes : c.shell.nav.home);
        const first = await measureRow(page);
        // One row, every tab a full touch target, and the page never scrolls sideways.
        expect(first.tops).toHaveLength(1);
        for (const h of first.heights) expect(h).toBeGreaterThanOrEqual(touchTarget.min);
        await noSidewaysScroll(page);
        expect(first.start).toBe('false');
        const overflows = first.scrollWidth > first.clientWidth + 1;
        expect(first.end).toBe(String(overflows));
        expect(first.endFade).toBe(overflows ? '1' : '0');
        expect(first.startFade).toBe('0');
        if (size.width === 360) expect(first.scrollbar).toBe('none');
        await page.screenshot({ path: test.info().outputPath(`gx14-nav-${persona}-${locale}-${size.width}.png`), clip: { x: 0, y: 0, width: size.width, height: 200 } });
        if (!overflows) return;
        // Scrolled to its end: the last tab shows whole, the end fade goes and the start fade shows.
        await page.getByTestId('frame-nav-row').locator('ul').evaluate((list) => {
          list.scrollLeft = list.scrollWidth;
        });
        await expect(page.getByTestId('frame-nav-row')).toHaveAttribute('data-more-end', 'false');
        await expect(page.getByTestId('frame-nav-row')).toHaveAttribute('data-more-start', 'true');
        const last = await nav.getByRole('link').last().boundingBox();
        expect((last?.x ?? -1) + (last?.width ?? Infinity)).toBeLessThanOrEqual(size.width);
        await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`gx14-nav-${persona}-${locale}-${size.width}-end.png`), clip: { x: 0, y: 0, width: size.width, height: 200 } });
      });
    }

    test(`P5 ${locale} at ${size.width}: a page that fails to draw shows the console error page in ${locale}; Try again loads it again`, async ({ page }) => {
      await page.setViewportSize(size);
      const state = { broken: true };
      await mock(page, locale, [CLASS], state);
      await page.goto('/teach/home');
      const box = page.getByTestId('console-error');
      await expect(box).toBeVisible();
      const heading = box.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText(c.errorPage.title);
      await expect(heading).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute('lang', locale === 'en' ? 'en' : locale);
      await expect(page.getByText('Application error')).toHaveCount(0);
      const retry = box.getByRole('button', { name: c.tryAgain });
      expect((await retry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
      await noSidewaysScroll(page);
      await page.screenshot({ path: test.info().outputPath(`gx14-error-${locale}-${size.width}.png`) });
      // The read answers properly again: Try again loads the page, with its nav.
      state.broken = false;
      await retry.click();
      await expect(page.getByTestId('frame-nav')).toBeVisible();
      await expect(page.getByTestId('console-error')).toHaveCount(0);
    });
  }
}
