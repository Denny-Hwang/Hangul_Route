import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * AMENDMENTS-GROWNUP-UX GX-11 (section 9 P2, P3, P10; section 14 "parent-home render tests (extend)"; wireframe
 * design/wireframes/parent/needs-you.md, mock design/screens/approvals/mock/parent-*.html): on the family home each child
 * card says how the week went ("Practiced {d} of the last 7 days · {m} min" with the report's 7-day squares, fill only,
 * then "Next: {quest}"), a child who never started gets "Not started yet. Open the app on {name}'s device." with Open the
 * app on this device, a child quiet for 7 days the restart line; with 2 or more children on a phone the Lecture mode card
 * comes after the last child, and from 70em the Needs you strip comes before it in the page; the report chooser shows the
 * card's first line under each name. ko, en and es at 360 x 740 and 1280 x 800, over the static export with the account
 * API mocked through `page.route` (nothing leaves the machine). It runs on the class-moves export:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.moves-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   CLASS_MOVES_E2E=1 pnpm --filter @hangul-route/web exec playwright test family-week.spec
 */
test.skip(process.env.CLASS_MOVES_E2E !== '1', 'needs the export built against the mocked API (CLASS_MOVES_E2E=1)');

const API = 'https://api.moves-e2e.test';
const SESSION_KEY = 'hr:console:session';
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const FAMILY = {
  id: 'space:kim',
  kind: 'family',
  name: 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const day = (d: string, min: number) => ({ d, min, q: 1, c: 0, w: 0, j: [] });
const activity = (days: ReturnType<typeof day>[], over: Record<string, unknown> = {}) => ({
  v: 1,
  tz: 0,
  asOf: '2026-10-31',
  days,
  months: [],
  total: { since: '2026-09-05', min: 400, q: 6, c: 3, w: 0, days: 14 },
  milestones: [],
  ...over,
});
const stage1 = { questsDone: 6, questsTotal: 15, anchorAccuracy: null };
const kid = (id: string, name: string, joinedAt: string, summary: unknown) => ({ id, displayName: name, ageGroup: 'starter', avatar: 'hoya-orange', joinedAt, lastActiveAt: at(-60 * 20), lastSyncedAt: at(-60 * 20), summary });
// Mina practiced 4 of the last 7 days (Oct 25 to 31) for 36 min and has a next quest; Jun last practiced on Oct 12; Sora never started.
const MINA = kid('profile:mina', 'Mina', '2026-09-02T00:00:00.000Z', {
  lastActiveAt: at(-60 * 20),
  minutesLast7d: 36,
  stage1,
  cardsUnlocked: 3,
  activity: activity([day('2026-10-20', 9), day('2026-10-25', 10), day('2026-10-26', 8), day('2026-10-28', 12), day('2026-10-30', 6)], { next: { q: 'quest:stage1-letters-q1', plan: false } }),
});
const JUN = kid('profile:jun', 'Jun', '2026-09-03T00:00:00.000Z', { lastActiveAt: '2026-10-12T08:00:00.000Z', minutesLast7d: 0, stage1, cardsUnlocked: 1, activity: activity([day('2026-10-12', 15)], { asOf: '2026-10-12' }) });
const SORA = kid('profile:sora', 'Sora', '2026-09-04T00:00:00.000Z', null);

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockFamily(page: Page, learners: unknown[], relinks: unknown[] = []): Promise<string[]> {
  const paths: string[] = [];
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    paths.push(path);
    if (path === '/api/spaces') return json(route, { spaces: [{ space: FAMILY, role: 'owner', counts: { learners: learners.length, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, { space: FAMILY, learners, joinCode: 'KIM123', joinCodeExpiresAt: at(60 * 24 * 30) });
    if (path.endsWith('/relink-requests')) return json(route, { requests: relinks });
    if (path.endsWith('/transfer-requests')) return json(route, { requests: [], options: [] });
    if (path.endsWith('/class-moves')) return json(route, { notices: [] });
    if (path.endsWith('/class-scope')) return json(route, { current: 'class-scope-2026-10', learners: [] });
    return json(route, { plans: [], requests: [], entitlements: [] });
  });
  return paths;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const childCard = (page: Page, name: string) => page.getByTestId('learner-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RELINK = { id: 'relink:mina', learnerId: 'profile:mina', learnerName: 'Mina', deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' };

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
  const m = getMessages(locale);
  const p = m.console.parentHome;
  test.describe(`${locale}: each child card says how the week went (GX-11)`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: week line and squares, Next, never started, restart; the Lecture mode card after the last child`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockFamily(page, [MINA, JUN, SORA], [RELINK]);
        await page.goto('/parent');
        const mina = childCard(page, 'Mina');
        const week = mina.getByTestId('child-week-line');
        await expect(week).toHaveText(p.week(4, 36));
        // The 7 squares, oldest first: Oct 25, 26 and 28, 30 practiced; fill only, hidden from screen readers (the line says it).
        const squares = mina.getByTestId('child-week-squares');
        await expect(squares).toHaveAttribute('aria-hidden', 'true');
        await expect(squares.locator('li')).toHaveCount(7);
        expect(await squares.locator('li').evaluateAll((els) => els.map((el) => el.getAttribute('data-on')))).toEqual(['true', 'true', 'false', 'true', 'false', 'true', 'false']);
        await expect(mina.getByTestId('child-next')).toHaveText(new RegExp(`^${escape(p.next(''))}\\S`));
        await expect(childCard(page, 'Jun').getByTestId('child-week-line')).toHaveText(p.restart);
        await expect(childCard(page, 'Jun').getByTestId('child-week-squares')).toHaveCount(0);
        const sora = childCard(page, 'Sora');
        await expect(sora.getByTestId('child-week-line')).toHaveText(p.notStarted('Sora'));
        await expect(sora.getByRole('button', { name: p.empty.openApp })).toBeVisible();
        const lecture = page.getByTestId('lecture-card');
        await expect(lecture).toBeVisible();
        const order = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-testid="needs-you"], [data-testid="learner-card"], [data-testid="lecture-card"]')).map((el) => el.getAttribute('data-testid')),
        );
        // The strip first, then every child, then Lecture mode (P3: never between child 1 and child 2; the strip outranks it).
        expect(order).toEqual(['needs-you', 'learner-card', 'learner-card', 'learner-card', 'lecture-card']);
        if (label === '360') {
          // With the strip above it, the first child's name and week line are still on the first phone screen.
          const box = await week.boundingBox();
          expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(size.height);
          const last = await page.getByTestId('learner-card').last().boundingBox();
          const card = await lecture.boundingBox();
          expect(card?.y ?? 0).toBeGreaterThan((last?.y ?? 0) + (last?.height ?? 0) - 1);
          await noSidewaysScroll(page);
        } else {
          // From 70em the card is first in the side column, right of the children.
          const first = await page.getByTestId('learner-card').first().boundingBox();
          const card = await lecture.boundingBox();
          expect(card?.x ?? 0).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
        }
        await page.screenshot({ path: test.info().outputPath(`family-week-${locale}-${label}.png`), fullPage: true });
      });

      test(`${label}: the report chooser shows the card's first line under each name, in join order`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockFamily(page, [JUN, SORA, MINA]);
        await page.goto('/parent/learner');
        const rows = page.getByTestId('report-chooser').getByRole('link');
        await expect(rows).toHaveCount(3);
        await expect(page.getByTestId('report-chooser-name')).toHaveText(['Mina', 'Jun', 'Sora']);
        await expect(page.getByTestId('report-chooser-line')).toHaveText([p.week(4, 36), p.restart, p.lastActive.notStarted]);
        if (label === '360') await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`family-chooser-${locale}-${label}.png`), fullPage: true });
      });
    }
  });
}

test.describe('en: one child, and never a name in a request (GX-11)', () => {
  test('one child on a phone: the Lecture mode card right after that card', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockFamily(page, [MINA]);
    await page.goto('/parent');
    await expect(page.getByTestId('lecture-card')).toBeVisible();
    const order = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="learner-card"], [data-testid="lecture-card"]')).map((el) => el.getAttribute('data-testid')));
    expect(order).toEqual(['learner-card', 'lecture-card']);
  });

  test('Open the app on this device opens the learner app at "Who is using this?" with no code handed off', async ({ page }) => {
    const paths = await mockFamily(page, [SORA]);
    await page.goto('/parent');
    await childCard(page, 'Sora').getByRole('button', { name: getMessages('en').console.parentHome.empty.openApp }).click();
    await page.waitForURL(/who=1/);
    expect(new URL(page.url()).searchParams.get('who')).toBe('1');
    expect(await page.evaluate(() => window.sessionStorage.getItem('hr:shell:joinCode'))).toBeNull();
    for (const path of paths) expect(path).not.toMatch(/Mina|Jun|Sora/);
  });
});
