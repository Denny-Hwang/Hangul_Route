import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * AMENDMENTS-GROWNUP-UX section 8 T12 and section 9 P8, row GX-12: the re-link page ("New device requests") of a class
 * and of a family, and the class page's entry to it, in ko, en and es at 360 x 740 and 1280 x 800. The card is headed
 * by the name and what is asked, names the platform, counts down once a minute, keeps the safety hint right above
 * Approve; Approve, Deny and the learner picker are at least 64 px tall; "Another way" is said once; a family's Deny
 * names a grown-up; nothing scrolls sideways at 360. The account API is mocked with `page.route` (nothing leaves the
 * machine). It runs on the class-moves export:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.moves-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   RELINK_E2E=1 pnpm --filter @hangul-route/web exec playwright test relink-page.spec
 *
 * Like class-moves.spec.ts and button-size.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR that
 * touches the page runs it locally.
 */
test.skip(process.env.RELINK_E2E !== '1', 'needs the export built against the mocked API (RELINK_E2E=1)');

const API = 'https://api.moves-e2e.test';
const SESSION_KEY = 'hr:console:session';
const LOCALE_KEY = 'hr:console:uiLocale';
const TOUCH_MIN = 64;
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (ms: number): string => new Date(NOW.getTime() + ms).toISOString();

const space = (id: string, kind: 'class' | 'family', name: string) => ({
  id,
  kind,
  name,
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const CLASS = space('space:a', 'class', 'Sunday Class A');
const FAMILY = space('space:kim', 'family', 'Kim family');
const learner = (id: string, name: string) => ({ id, displayName: name, ageGroup: 'starter', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: at(0), lastSyncedAt: at(0), summary: null });
const LEARNERS = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];
// Asked 1 min 30 s ago from an iPhone; closes in 8 min 30 s ("9 min").
const REQUEST = { id: 'relink:one', learnerId: 'profile:mina', learnerName: 'Mina', platform: 'ios', requestedAt: at(-90_000), expiresAt: at(510_000), status: 'pending' };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockConsole(page: Page, kind: 'class' | 'family', locale: UiLocale): Promise<string[]> {
  const calls: string[] = [];
  const mine = kind === 'class' ? CLASS : FAMILY;
  let pending = [REQUEST];
  await page.clock.install({ time: NOW });
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
    calls.push(`${request.method()} ${path}`);
    if (path === '/api/spaces') return json(route, { spaces: [{ space: mine, role: 'owner', counts: { learners: LEARNERS.length, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, { space: mine, learners: LEARNERS, joinCode: 'K7PM4Q', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' });
    if (/\/relink-requests\/[^/]+\/deny$/.test(path)) {
      pending = [];
      return json(route, { request: { ...REQUEST, status: 'denied' } });
    }
    if (path.endsWith('/relink-requests')) return json(route, { requests: pending });
    if (path.endsWith('/class-moves')) return json(route, kind === 'family' ? { notices: [] } : { outgoing: [], incoming: [] });
    if (path.endsWith('/class-scope')) return json(route, { current: 'class-scope-2026-10', learners: [] });
    if (path.endsWith('/transfer-requests')) return json(route, { requests: [], options: [] });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
  return calls;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
];
const PAGES = [
  { kind: 'class' as const, path: '/teach/space/relink?id=space%3Aa', space: CLASS },
  { kind: 'family' as const, path: '/parent/space/relink?id=space%3Akim', space: FAMILY },
];

for (const locale of ['ko', 'en', 'es'] as const) {
  const c = getMessages(locale).console;
  test.describe(`new device requests (GX-12), ${locale}`, () => {
    test.use({ locale: locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'ko-KR' });

    for (const target of PAGES) {
      test(`${target.kind} page: title, card, 64 px buttons, the hint above Approve, at 360 and 1280`, async ({ page }, testInfo) => {
        const calls = await mockConsole(page, target.kind, locale);
        await page.goto(target.path);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByText(c.relink.titleFor(target.space.name), { exact: true }).first()).toBeVisible();
        const card = page.getByTestId('relink-card');
        await expect(card.getByRole('heading', { level: 2 })).toHaveText(c.relink.askingToBe('Mina'));
        await expect(card.getByTestId('relink-meta')).toHaveText(`${c.relink.platform.ios} · ${c.relink.askedAgo(1)}`);
        await expect(card.getByTestId('relink-countdown')).toHaveText(c.relink.expiresIn(9));
        const approve = card.getByRole('button', { name: c.relink.approve.cta });
        const deny = card.getByRole('button', { name: c.relink.deny.cta });
        await expect(approve).toHaveAccessibleDescription(c.relinkApproveHint);
        if (target.kind === 'family') {
          await expect(page.getByText(c.relink.anotherWay, { exact: true })).toHaveCount(1);
          await expect(page.getByText(c.relinkAnotherWay, { exact: true })).toBeVisible();
        }
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          for (const b of [approve, deny]) {
            const box = await b.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_MIN);
          }
          const hint = await card.getByText(c.relinkApproveHint, { exact: true }).boundingBox();
          const top = await approve.boundingBox();
          expect(hint && top ? top.y - (hint.y + hint.height) : -1).toBeGreaterThanOrEqual(0);
          expect(hint && top ? top.y - (hint.y + hint.height) : 999).toBeLessThanOrEqual(32);
          if (target.kind === 'family') {
            const select = await page.getByRole('combobox', { name: c.relink.learnerLabel }).boundingBox();
            expect(select?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_MIN);
          }
          if (viewport.width === 360) await noSidewaysScroll(page);
          await page.screenshot({ path: testInfo.outputPath(`relink-${target.kind}-${locale}-${viewport.width}.png`), fullPage: true });
        }
        // No learner name in any URL the page asked for.
        for (const call of calls) expect(call).not.toMatch(/Mina/);
      });
    }

    test('the countdown moves once a minute', async ({ page }) => {
      await mockConsole(page, 'class', locale);
      await page.goto('/teach/space/relink?id=space%3Aa');
      const countdown = page.getByTestId('relink-countdown');
      await expect(countdown).toHaveText(c.relink.expiresIn(9));
      await page.clock.runFor(31_000);
      await expect(countdown).toHaveText(c.relink.expiresIn(8));
      await page.clock.runFor(60_000);
      await expect(countdown).toHaveText(c.relink.expiresIn(7));
    });

    test("a family's Deny says the device will ask for a grown-up (P8)", async ({ page }) => {
      await mockConsole(page, 'family', locale);
      await page.goto('/parent/space/relink?id=space%3Akim');
      await page.getByTestId('relink-card').getByRole('button', { name: c.relink.deny.cta }).click();
      await expect(page.getByText(c.relink.deniedFamily('Mina'), { exact: true })).toBeVisible();
      await expect(page.getByText(c.relinkNothing, { exact: true })).toBeVisible();
    });

    test('the class page names its entry "new device requests", with the count', async ({ page }, testInfo) => {
      await mockConsole(page, 'class', locale);
      await page.goto('/teach/space?id=space%3Aa');
      const entry = page.getByRole('link', { name: c.space.relinkPending.cta(1) });
      await expect(entry).toBeVisible();
      await page.setViewportSize({ width: 360, height: 740 });
      await noSidewaysScroll(page);
      await page.screenshot({ path: testInfo.outputPath(`class-entry-${locale}-360.png`), fullPage: true });
    });
  });
}
