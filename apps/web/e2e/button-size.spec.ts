import { expect, test, type Page, type Route } from '@playwright/test';
import { STEADY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX section 8 T2, row GX-6 (GX-D11, "One button size"): on the grown-up pages a teacher and a
 * parent use most, every pill-shaped button and link-button in `main` is at least `touchTarget.min` (64 px) tall and wide, and every
 * one drawn from buttonBase is at least `touchTarget.child` (80 px) wide, in
 * ko, en and es, at 360 x 740 and 1280 x 800, with no sideways scroll at 360. The account API is mocked with
 * `page.route` (nothing leaves the machine). It runs on the class-moves export:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.moves-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   BUTTON_SIZE_E2E=1 pnpm --filter @hangul-route/web exec playwright test button-size.spec
 *
 * The frame's own header and foot controls are outside `main` and outside this row (GX-6 is the console page body).
 * Like class-moves.spec.ts, no CI lane runs it yet (a lane is a workflow change); each button PR runs it locally.
 */
test.skip(process.env.BUTTON_SIZE_E2E !== '1', 'needs the export built against the mocked API (BUTTON_SIZE_E2E=1)');

const API = 'https://api.moves-e2e.test';
const SESSION_KEY = 'hr:console:session';
const LOCALE_KEY = 'hr:console:uiLocale';
const TOUCH_MIN = 64;
/** `touchTarget.child`: buttonBase's own minimum width. Every pill on these pages is 64 x 64 or more (the cross-component
 * floor); a pill drawn from buttonBase (computed min-width 80 px) is also 80 wide, and each page draws at least one, so a
 * buttonBase that lost its width floor fails here. */
const BUTTON_BASE_WIDTH = 80;
const NOW = new Date().toISOString();

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
const learner = (id: string, name: string) => ({ id, displayName: name, ageGroup: 'starter', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: NOW, lastSyncedAt: NOW, summary: { ...STEADY, lastActiveAt: NOW } });
const LEARNERS = [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')];

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockConsole(page: Page, kind: 'class' | 'family', locale: string): Promise<void> {
  const mine = kind === 'class' ? CLASS : FAMILY;
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
    if (path === '/api/spaces') return json(route, { spaces: [{ space: mine, role: 'owner', counts: { learners: LEARNERS.length, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, { space: mine, learners: LEARNERS, joinCode: 'K7PM4Q', joinCodeExpiresAt: '2026-12-01T00:00:00.000Z' });
    if (path.endsWith('/members')) {
      return json(route, {
        members: [
          { memberKind: 'account', memberId: 'acct-e2e', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Ms Kim', isOwner: true },
          ...LEARNERS.map((l) => ({ memberKind: 'learner', memberId: l.id, role: 'student', joinedAt: l.joinedAt, name: l.displayName, isOwner: false })),
        ],
      });
    }
    if (path.endsWith('/class-moves/destinations')) return json(route, { destinations: [] });
    if (path.endsWith('/class-moves')) return json(route, kind === 'family' ? { notices: [] } : { outgoing: [], incoming: [] });
    if (path.endsWith('/class-scope')) return json(route, { current: 'class-scope-2026-10', learners: [] });
    if (path.endsWith('/transfer-requests')) return json(route, { requests: [], options: [] });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
}

/** Every visible pill (the console's button look) on the page: its label and size. */
async function pills(page: Page): Promise<{ label: string; width: number; height: number; minWidth: number }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main button, main a'))
      .filter((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && parseFloat(style.borderTopLeftRadius) >= 999;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const minWidth = parseFloat(getComputedStyle(el).minWidth);
        return { label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40), width: Math.round(rect.width), height: Math.round(rect.height), minWidth: Number.isFinite(minWidth) ? minWidth : 0 };
      }),
  );
}

const PAGES = [
  { name: 'class page', kind: 'class' as const, path: '/teach/space?id=space%3Aa', ready: 'see-report' },
  { name: 'class settings', kind: 'class' as const, path: '/teach/space/settings?id=space%3Aa', ready: 'move-row' },
  { name: 'teacher home', kind: 'class' as const, path: '/teach', ready: null },
  { name: 'parent home', kind: 'family' as const, path: '/parent', ready: null },
];
const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
];

for (const locale of ['ko', 'en', 'es']) {
  test.describe(`one button size (GX-6), ${locale}`, () => {
    test.use({ locale: locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'ko-KR' });
    for (const target of PAGES) {
      test(`${target.name}: every pill is at least 64 px tall and wide, buttonBase pills 80 wide, at 360 and 1280`, async ({ page }, testInfo) => {
        await mockConsole(page, target.kind, locale);
        await page.goto(target.path);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        if (target.ready) await expect(page.getByTestId(target.ready).first()).toBeVisible();
        else await page.waitForLoadState('networkidle');
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const found = await pills(page);
          expect(found.length, 'the page draws pills').toBeGreaterThan(0);
          const small = found.filter((p) => p.height < TOUCH_MIN || p.width < TOUCH_MIN);
          expect(small, `${target.name} ${locale} ${viewport.width}`).toEqual([]);
          const base = found.filter((p) => p.minWidth >= BUTTON_BASE_WIDTH);
          expect(base.length, `${target.name} draws buttonBase pills with their 80 px width floor`).toBeGreaterThan(0);
          expect(base.filter((p) => p.width < BUTTON_BASE_WIDTH), `${target.name} ${locale} ${viewport.width} buttonBase width`).toEqual([]);
          if (viewport.width === 360) {
            const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
            expect(scroll).toBeLessThanOrEqual(inner);
          }
          await page.screenshot({ path: testInfo.outputPath(`${target.name.replace(/ /g, '-')}-${locale}-${viewport.width}.png`), fullPage: true });
        }
      });
    }
  });
}
