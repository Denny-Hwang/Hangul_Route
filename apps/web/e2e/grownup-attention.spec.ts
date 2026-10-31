import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * AMENDMENTS-GROWNUP-UX GX-3 (owner request 2026-10-31; section 14 `apps/web/e2e/grownup-attention.spec.ts`, the GX-3
 * part; GX-2 adds the review sheet's): once the Worker sends GX-W's `attention`, the teacher home shows the amber
 * **{n} need your OK** chip after a class's name (to the class page's review, `#attention`), the Classes tab shows the
 * number on screen with its meaning in the tab's name, the tab title gets "(n) ", and every teacher page but the class
 * page shows the re-link bar while a new device waits; **Review** opens the class page. The counts are read again every
 * 30 s while the page is in view. ko, en and es at 360 x 740 and 1280 x 800, with no sideways scroll at 360. Over the
 * static export with the account API mocked through `page.route` (nothing leaves the machine), the build of
 * grownup-status.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test grownup-attention.spec
 *
 * Like class-moves.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR runs that build and suite locally.
 */
test.skip(process.env.GROWNUP_E2E !== '1', 'needs the export built against the mocked API (GROWNUP_E2E=1)');

const API = 'https://api.gx-e2e.test';
const SESSION_KEY = 'hr:console:session';
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const space = (id: string, kind: string, name: string) => ({ id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' });
const CLASS_NAMES: Record<UiLocale, [string, string]> = {
  en: ['Sunday Class A', 'Beginners B'],
  es: ['Clase del domingo A', 'Principiantes B'],
  ko: ['일요일 반 A', '초급 B반'],
};
const row = (id: string, name: string, attention: unknown) => ({ space: space(id, 'class', name), role: 'owner', counts: { learners: 4, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null, attention });

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

interface Mock {
  calls: Array<{ method: string; path: string }>;
  spaces: unknown[];
}

async function mockTeacher(page: Page, locale: UiLocale, over: { spaces?: unknown[] } = {}): Promise<Mock> {
  const [a, b] = CLASS_NAMES[locale];
  const mock: Mock = {
    calls: [],
    spaces: over.spaces ?? [row('space:a', a, { relinks: 1, moves: 2, relinkExpiresAt: at(7.5) }), row('space:b', b, { relinks: 0, moves: 0, relinkExpiresAt: null })],
  };
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    mock.calls.push({ method: request.method(), path });
    if (path === '/api/spaces') return json(route, 200, { spaces: mock.spaces });
    if (path.endsWith('/roster')) return json(route, 200, { space: space('space:a', 'class', a), learners: [], joinCode: 'SUN123', joinCodeExpiresAt: at(60 * 24 * 30) });
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: [] });
    if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming: [] });
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: [] });
    return json(route, 200, { plans: [], requests: [], entitlements: [], notes: [], spaces: [] });
  });
  return mock;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

const VIEWPORTS = [
  { label: '360', size: { width: 360, height: 740 } },
  { label: '1280', size: { width: 1280, height: 800 } },
] as const;
const LOCALES: Array<{ locale: UiLocale; browser: string }> = [
  { locale: 'ko', browser: 'ko-KR' },
  { locale: 'en', browser: 'en-US' },
  { locale: 'es', browser: 'es-ES' },
];

for (const { locale, browser } of LOCALES) {
  const c = getMessages(locale).console;
  const [a, b] = CLASS_NAMES[locale];
  test.describe(`${locale}: requests you cannot miss outside the class page`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: the home row chip, the Classes tab number, the title count and the re-link bar`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockTeacher(page, locale);
        await page.goto('/teach/home');
        // The Classes tab: the number on screen, its meaning in the tab's name.
        const tab = page.getByTestId('nav-classes');
        await expect(tab).toHaveAccessibleName(c.shell.navAttention.classes(3));
        await expect(page.getByTestId('nav-count')).toHaveText('3');
        await expect(page.getByTestId('nav-count')).toHaveAttribute('aria-hidden', 'true');
        // The class row's chip after its name, to the class page's review; nothing on a class with nothing waiting.
        const chip = page.getByTestId('class-attention-space:a');
        await expect(chip).toHaveText(c.home.attention(3));
        await expect(chip).toHaveAttribute('href', /\/teach\/space\?id=space%3Aa#attention$/);
        await expect(page.getByTestId('space-row-space:b')).toContainText(b);
        await expect(page.getByTestId('class-attention-space:b')).toHaveCount(0);
        const nameBox = await page.getByTestId('space-row-space:a').getByText(a, { exact: true }).boundingBox();
        const chipBox = await chip.boundingBox();
        expect(nameBox && chipBox && chipBox.y + chipBox.height > nameBox.y).toBeTruthy();
        // The re-link bar under the nav: the class name, the minutes, Review.
        const bar = page.getByTestId('relink-bar');
        await expect(bar.getByRole('status')).toHaveText(c.relinkBar.one(a));
        await expect(page.getByTestId('relink-bar-minutes')).toHaveText(c.status.minutesLeft(8));
        const review = page.getByTestId('relink-bar-review');
        await expect(review).toHaveText(c.status.review.cta);
        expect((await review.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
        const navBox = await page.getByTestId('frame-nav').boundingBox();
        const barBox = await bar.boundingBox();
        expect((navBox?.y ?? 0) < (barBox?.y ?? 0)).toBeTruthy();
        // The tab title: a count only.
        expect(await page.title()).toMatch(/^\(3\) /);
        await page.screenshot({ path: test.info().outputPath(`grownup-attention-home-${locale}-${label}.png`), fullPage: true });
        if (label === '360') await noSidewaysScroll(page);
      });
    }
  });
}

test.describe('en: the bar on another page, its Review, and the 30 s read', () => {
  const c = getMessages('en').console;
  const [a] = CLASS_NAMES.en;

  test('the Notes page shows the bar; Review opens the class page at its review, which draws no bar', async ({ page }) => {
    const mock = await mockTeacher(page, 'en');
    await page.goto('/teach/notes');
    await expect(page.getByTestId('relink-bar').getByRole('status')).toHaveText(c.relinkBar.one(a));
    await page.screenshot({ path: test.info().outputPath('grownup-attention-notes-en.png') });
    await page.getByTestId('relink-bar-review').click();
    await expect(page).toHaveURL(/\/teach\/space\?id=space%3Aa#attention$/);
    await expect(page.getByTestId('space-head')).toBeVisible();
    await expect(page.getByTestId('relink-bar')).toHaveCount(0);
    // No name of a learner in any address the console asked for.
    for (const call of mock.calls) expect(call.path).not.toMatch(/Jaehan|Yuhan|Mina/);
  });

  test('two new devices: the count, and Review goes to the class whose one closes first', async ({ page }) => {
    const [x, y] = CLASS_NAMES.en;
    await mockTeacher(page, 'en', { spaces: [row('space:a', x, { relinks: 1, moves: 0, relinkExpiresAt: at(9) }), row('space:b', y, { relinks: 1, moves: 0, relinkExpiresAt: at(3) })] });
    await page.goto('/teach/home');
    await expect(page.getByTestId('relink-bar').getByRole('status')).toHaveText(c.relinkBar.many(2));
    await expect(page.getByTestId('relink-bar-review')).toHaveAttribute('href', /id=space%3Ab#attention$/);
    await expect(page.getByTestId('relink-bar-minutes')).toHaveText(c.status.minutesLeft(3));
  });

  test('read again within 30 s while in view: an answered request leaves the bar, the chip and the number', async ({ page }) => {
    const [x, y] = CLASS_NAMES.en;
    const mock = await mockTeacher(page, 'en');
    await page.goto('/teach/home');
    await expect(page.getByTestId('relink-bar')).toBeVisible();
    const before = mock.calls.filter((call) => call.path === '/api/spaces').length;
    mock.spaces = [row('space:a', x, { relinks: 0, moves: 0, relinkExpiresAt: null }), row('space:b', y, { relinks: 0, moves: 0, relinkExpiresAt: null })];
    await page.clock.runFor(30_000);
    await expect(page.getByTestId('relink-bar')).toHaveCount(0);
    await expect(page.getByTestId('nav-count')).toHaveCount(0);
    await expect(page.getByTestId('class-attention-space:a')).toHaveCount(0);
    await expect(page.getByTestId('nav-classes')).toHaveAccessibleName(c.shell.nav.classes);
    expect(await page.title()).not.toMatch(/^\(\d/);
    // One read of the spaces list per tick, nothing else.
    expect(mock.calls.filter((call) => call.path === '/api/spaces').length).toBe(before + 1);
  });

  test('an older Worker (no attention): no number, no bar, no chip and no timer', async ({ page }) => {
    const [x] = CLASS_NAMES.en;
    const mock = await mockTeacher(page, 'en', { spaces: [{ ...row('space:a', x, null), attention: undefined }] });
    await page.goto('/teach/home');
    await expect(page.getByTestId('space-row-space:a')).toBeVisible();
    await expect(page.getByTestId('nav-count')).toHaveCount(0);
    await expect(page.getByTestId('relink-bar')).toHaveCount(0);
    const before = mock.calls.length;
    await page.clock.runFor(10 * 60_000);
    expect(mock.calls.filter((call) => call.path === '/api/spaces').length).toBe(mock.calls.slice(0, before).filter((call) => call.path === '/api/spaces').length);
  });
});
