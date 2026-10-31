import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { STEADY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX row GX-10 (section 8 T11, section 9 P7): the settings learner rows. On a class: the status chip
 * next to each name (Needs your OK for a new device, with its reason; In class otherwise), **Move to another class** off
 * with "A move is already open." for a learner whose move is open, Move and Remove the same height, Remove a text
 * button with no border. On a family: the class line under each name, no default chip, and **Invite another grown-up**,
 * which copies the family code and says so. ko, en and es at 360 x 740 and 1280 x 800, no sideways scroll at 360. The
 * account API is mocked with `page.route` (nothing leaves the machine); it runs on the class-moves export:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.moves-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   SETTINGS_ROWS_E2E=1 pnpm --filter @hangul-route/web exec playwright test settings-rows.spec
 *
 * Like class-moves.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR runs it locally.
 */
test.skip(process.env.SETTINGS_ROWS_E2E !== '1', 'needs the export built against the mocked API (SETTINGS_ROWS_E2E=1)');

const API = 'https://api.moves-e2e.test';
const SESSION_KEY = 'hr:console:session';
const LOCALE_KEY = 'hr:console:uiLocale';
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const space = (id: string, kind: 'class' | 'family', name: string) => ({ id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' });
const CLASS = space('space:a', 'class', 'Sunday Class A');
const FAMILY = space('space:kim', 'family', 'Kim family');
const learner = (id: string, name: string) => ({ id, displayName: name, ageGroup: 'starter', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: at(-60), lastSyncedAt: at(-60), summary: { ...STEADY, lastActiveAt: at(-60) } });
const LEARNERS = [learner('profile:yuhan', 'Yuhan'), learner('profile:jaehan', 'Jaehan'), learner('profile:mina', 'Mina')];
const RELINK = { id: 'relink:jaehan', learnerId: 'profile:jaehan', learnerName: 'Jaehan', deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' };
const MOVE_OUT = {
  id: 'transfer:out',
  role: 'source',
  status: 'requested',
  initiator: 'source',
  learnerId: 'profile:mina',
  steps: { learner: 'waiting', source: 'yes', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: at(-60),
  expiresAt: at(60 * 24 * 13),
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  learner: { name: 'Mina', avatar: 'hoya-orange' },
  destination: { name: 'Evening Class D' },
};
const OPTIONS = [
  { learnerId: 'profile:yuhan', name: 'Yuhan', classes: [{ spaceId: 'space:a', name: 'Sunday Class A' }], selfManaged: false, blockTeacherRequests: false },
  { learnerId: 'profile:jaehan', name: 'Jaehan', classes: [{ spaceId: 'space:a', name: 'Sunday Class A' }, { spaceId: 'space:d', name: 'Evening Class D' }], selfManaged: false, blockTeacherRequests: false },
  { learnerId: 'profile:mina', name: 'Mina', classes: [], selfManaged: false, blockTeacherRequests: false },
];

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockSettings(page: Page, kind: 'class' | 'family', locale: string): Promise<string[]> {
  const mine = kind === 'class' ? CLASS : FAMILY;
  const paths: string[] = [];
  await page.clock.install({ time: NOW });
  await page.addInitScript(
    ([key, session, localeKey, ui]) => {
      window.sessionStorage.setItem(key as string, session as string);
      window.localStorage.setItem(localeKey as string, ui as string);
      // The copy lands here (a headless page has no clipboard to read back).
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void copied.push(text) } });
    },
    [SESSION_KEY, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' }), LOCALE_KEY, locale],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    paths.push(request.url());
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
    if (path.endsWith('/relink-requests')) return json(route, { requests: kind === 'class' ? [RELINK] : [] });
    if (path.endsWith('/class-moves')) return json(route, kind === 'family' ? { notices: [] } : { outgoing: [], incoming: [] });
    if (path.endsWith('/transfer-requests')) return json(route, kind === 'class' ? { requests: [MOVE_OUT] } : { requests: [], options: OPTIONS });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
  return paths;
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

const row = (page: Page, name: string) => page.getByTestId('settings-learner-row').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

for (const { locale, browser } of LOCALES) {
  const c = getMessages(locale).console;
  test.describe(`${locale}: settings learner rows (GX-10)`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: class rows: the chip by each name, Move off while a move is open, Move and Remove one height`, async ({ page }) => {
        await page.setViewportSize(size);
        const paths = await mockSettings(page, 'class', locale);
        await page.goto('/teach/space/settings?id=space%3Aa');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const jaehan = row(page, 'Jaehan');
        await expect(jaehan.getByRole('button', { name: c.status.chipName(c.status.needsOk, c.status.newDevice(8)) })).toBeVisible();
        await expect(jaehan.getByText(c.status.newDevice(8), { exact: true })).toBeVisible();
        await expect(row(page, 'Yuhan').getByText(c.status.inClass, { exact: true })).toBeVisible();
        const mina = row(page, 'Mina');
        await expect(mina.getByText(c.status.moveWaiting, { exact: true })).toBeVisible();
        const move = mina.getByTestId('move-row');
        await expect(move).toHaveAttribute('aria-disabled', 'true');
        await expect(mina.getByText(c.settings.moveOpen, { exact: true })).toBeVisible();
        await expect(row(page, 'Yuhan').getByTestId('move-row')).not.toHaveAttribute('aria-disabled', 'true');
        // One height for the row's two buttons; Remove has no border and no fill.
        const yuhanMove = await row(page, 'Yuhan').getByTestId('move-row').boundingBox();
        const remove = row(page, 'Yuhan').getByTestId('remove-learner');
        const removeBox = await remove.boundingBox();
        expect(Math.round(yuhanMove?.height ?? 0)).toBe(Math.round(removeBox?.height ?? -1));
        expect(removeBox?.height ?? 0).toBeGreaterThanOrEqual(64);
        const look = await remove.evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, fill: getComputedStyle(el).backgroundColor, line: getComputedStyle(el).textDecorationLine }));
        expect(look).toEqual({ border: 'rgba(0, 0, 0, 0)', fill: 'rgba(0, 0, 0, 0)', line: 'underline' });
        // No learner name in any request address.
        for (const url of paths) expect(url).not.toMatch(/Jaehan|Mina|Yuhan/);
        await page.getByRole('heading', { name: c.settings.learners.title.class }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath(`settings-rows-class-${locale}-${label}.png`), fullPage: true });
        if (label === '360') await noSidewaysScroll(page);
      });

      test(`${label}: family rows: the class line, no default chip; Invite another grown-up copies the code`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockSettings(page, 'family', locale);
        await page.goto('/parent/space/settings?id=space%3Akim');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(row(page, 'Yuhan').getByText(c.parentHome.classLine.one('Sunday Class A'), { exact: false })).toBeVisible();
        await expect(row(page, 'Jaehan').getByText(c.parentHome.classLine.many(2), { exact: false })).toBeVisible();
        await expect(row(page, 'Jaehan').getByText('Sunday Class A, Evening Class D', { exact: true })).toBeVisible();
        await expect(row(page, 'Mina').getByText(c.parentHome.classLine.none, { exact: false })).toBeVisible();
        await expect(page.getByTestId('learner-status')).toHaveCount(0);
        await expect(page.getByText(c.settings.inviteGrownUpLine('K7PM4Q'), { exact: true })).toBeVisible();
        await page.getByRole('button', { name: c.settings.inviteGrownUp.cta }).click();
        await expect(page.getByTestId('invite-grown-up-status')).toHaveText(c.joinCode.copied.cta);
        expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual(['K7PM4Q']);
        await page.screenshot({ path: test.info().outputPath(`settings-rows-family-${locale}-${label}.png`), fullPage: true });
        if (label === '360') await noSidewaysScroll(page);
      });
    }
  });
}
