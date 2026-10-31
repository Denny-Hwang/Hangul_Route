import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { STEADY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX GX-1 (owner request 2026-10-31; section 14 `apps/web/e2e/grownup-status.spec.ts`): the class page
 * shows **Needs your OK** beside the learner whose new device waits, with the reason and inline Approve / Deny, the quiet
 * **In class** beside the others and **New** beside a learner who joined today; the learners asking to join (a transfer
 * and another teacher's move) get their own cards above the roster with Accept first; a new re-link appears within one
 * 20 s re-link read. ko, en and es at 360 x 740 and 1280 x 800, with no sideways scroll at 360. Over the static export
 * with the account API mocked through `page.route` (nothing leaves the machine):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test grownup-status.spec
 *
 * Like class-moves.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR runs that build and suite locally.
 */
test.skip(process.env.GROWNUP_E2E !== '1', 'needs the export built against the mocked API (GROWNUP_E2E=1)');

const API = 'https://api.gx-e2e.test';
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
const LEARNERS = [learner('profile:yuhan', 'Yuhan'), learner('profile:jaehan', 'Jaehan'), learner('profile:mina', 'Mina', { joinedAt: at(-120), summary: null, lastSyncedAt: null })];
const relinkFor = (learnerId: string, name: string) => ({ id: `relink:${name.toLowerCase()}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' });
const TRANSFER_IN = {
  id: 'transfer:in1',
  role: 'destination',
  status: 'requested',
  steps: { learner: 'yes', source: 'yes', destination: 'waiting' },
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: at(-60 * 24),
  expiresAt: at(60 * 24 * 12),
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  learner: { name: 'M. K.', avatar: 'hoya-orange', level: '8-9' },
  comingFrom: { name: 'Class B' },
};
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'hoya-orange', level: '5-7' }, createdAt: at(-60), at: null };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

interface Mock {
  calls: Array<{ method: string; path: string; body: unknown }>;
  relinks: unknown[];
}

async function mockClass(page: Page, over: { relinks?: unknown[] } = {}): Promise<Mock> {
  const mock: Mock = { calls: [], relinks: over.relinks ?? [relinkFor('profile:jaehan', 'Jaehan')] };
  let incoming: unknown[] = [MOVE_IN];
  let transfers: unknown[] = [TRANSFER_IN];
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    const method = request.method();
    mock.calls.push({ method, path, body: request.postData() ? (JSON.parse(request.postData() ?? '{}') as unknown) : null });
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: CLASS, role: 'owner', counts: { learners: 3, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: CLASS, learners: LEARNERS, joinCode: 'SUN123', joinCodeExpiresAt: at(60 * 24 * 30) });
    if (/\/relink-requests\/[^/]+\/(approve|deny)$/.test(path)) {
      const request0 = mock.relinks[0];
      mock.relinks = [];
      return json(route, 200, { request: { ...(request0 as object), status: path.endsWith('approve') ? 'approved' : 'denied' } });
    }
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: mock.relinks });
    if (/\/class-moves\/[^/]+\/accept$/.test(path)) {
      incoming = [];
      return json(route, 200, { move: { ...MOVE_IN, status: 'moved', learner: { name: 'Jun', avatar: 'hoya-orange' }, at: NOW.toISOString() } });
    }
    if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming });
    if (/\/transfer-requests\/[^/]+\/approve$/.test(path)) {
      transfers = [];
      return json(route, 200, { request: { ...TRANSFER_IN, status: 'approved' } });
    }
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: transfers });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
  return mock;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

const card = (page: Page, name: string) => page.getByTestId('student-card').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });

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
  test.describe(`${locale}: a status next to every learner's name`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: Needs your OK with the reason and inline answers, In class, New, and the asking-to-join cards above the roster`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockClass(page);
        await page.goto('/teach/space?id=space%3Aa');
        const jaehan = card(page, 'Jaehan');
        const chip = jaehan.getByRole('button', { name: c.status.chipName(c.status.needsOk, c.status.newDevice(8)) });
        await expect(chip).toBeVisible();
        await expect(jaehan.getByText(c.status.newDevice(8), { exact: true })).toBeVisible();
        await expect(jaehan.getByRole('button', { name: c.relink.approve.cta, exact: true })).toBeVisible();
        await expect(jaehan.getByRole('button', { name: c.relink.deny.cta, exact: true })).toBeVisible();
        await expect(card(page, 'Yuhan').getByText(c.status.inClass, { exact: true })).toBeVisible();
        await expect(card(page, 'Mina').getByText(c.status.new, { exact: true })).toBeVisible();
        await expect(card(page, 'Mina').getByText(c.status.noPractice, { exact: true })).toBeVisible();
        // The action card is first.
        await expect(page.getByTestId('student-card').first()).toHaveAttribute('data-status', 'relink');
        // The chip sits on the name's row (above or beside it, never pushing the name off).
        const nameBox = await jaehan.locator('strong').first().boundingBox();
        const chipBox = await chip.boundingBox();
        expect(nameBox && chipBox && chipBox.y + chipBox.height > nameBox.y).toBeTruthy();
        expect(chipBox?.height ?? 0).toBeGreaterThanOrEqual(64);

        const group = page.getByTestId('asking-to-join');
        await expect(group.getByRole('heading', { name: c.attention.incomingHeading })).toBeVisible();
        const items = group.getByTestId('incoming-card');
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText('M. K.');
        await expect(items.nth(0)).toContainText(c.attention.from('Class B'));
        await expect(items.nth(1)).toContainText('J. K.');
        // Accept first, then Not now.
        const buttons = items.nth(1).getByRole('button');
        await expect(buttons.nth(1)).toHaveText(c.teacherMove.section.accept.cta);
        await expect(buttons.nth(2)).toHaveText(c.teacherMove.section.notNow.cta);
        // The group is above the first learner card.
        const groupBox = await group.boundingBox();
        const firstCard = await page.getByTestId('student-card').first().boundingBox();
        expect((groupBox?.y ?? 0) < (firstCard?.y ?? 0)).toBeTruthy();
        // Counts include the teacher move.
        await expect(page.getByText(c.transfer.waiting(2), { exact: true })).toBeVisible();

        await group.scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath(`grownup-status-${locale}-${label}.png`), fullPage: true });
        if (label === '360') await noSidewaysScroll(page);
      });
    }
  });
}

test.describe('en: answering where it is shown', () => {
  const c = getMessages('en').console;

  test('Approve inline removes the chip and says so on the card', async ({ page }) => {
    const mock = await mockClass(page);
    await page.goto('/teach/space?id=space%3Aa');
    const jaehan = card(page, 'Jaehan');
    await jaehan.getByRole('button', { name: c.relink.approve.cta, exact: true }).click();
    await expect(jaehan.getByText(c.relink.approved('Jaehan'))).toBeVisible();
    await expect(jaehan.getByRole('button', { name: c.status.chipName(c.status.needsOk, c.status.newDevice(8)) })).toHaveCount(0);
    expect(mock.calls.some((call) => call.method === 'POST' && call.path === '/api/spaces/space:a/relink-requests/relink:jaehan/approve')).toBe(true);
    for (const call of mock.calls) expect(call.path).not.toMatch(/Jaehan|Yuhan|Mina/);
  });

  test("Accept on another teacher's move accepts it and the card leaves", async ({ page }) => {
    const mock = await mockClass(page);
    await page.goto('/teach/space?id=space%3Aa');
    const item = page.getByTestId('incoming-card').filter({ hasText: 'J. K.' });
    await item.getByRole('button', { name: c.teacherMove.section.accept.cta }).click();
    await expect(page.getByTestId('incoming-card').filter({ hasText: 'J. K.' })).toHaveCount(0);
    expect(mock.calls.some((call) => call.method === 'POST' && call.path === '/api/spaces/space:a/class-moves/move:in1/accept')).toBe(true);
  });

  test('a new re-link appears within one 20 s re-link read, with nothing pending before', async ({ page }) => {
    const mock = await mockClass(page, { relinks: [] });
    await page.goto('/teach/space?id=space%3Aa');
    await expect(card(page, 'Yuhan').getByText(c.status.inClass, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: c.status.chipName(c.status.needsOk, c.status.newDevice(8)) })).toHaveCount(0);
    const rostersBefore = mock.calls.filter((call) => call.path.endsWith('/roster')).length;
    mock.relinks = [relinkFor('profile:yuhan', 'Yuhan')];
    await page.clock.runFor(20_000);
    await expect(card(page, 'Yuhan').getByRole('button', { name: c.status.chipName(c.status.needsOk, c.status.newDevice(8)) })).toBeVisible();
    // The 20 s read asks for the re-links alone, never the whole page.
    expect(mock.calls.filter((call) => call.path.endsWith('/roster')).length).toBe(rostersBefore);
    await page.screenshot({ path: test.info().outputPath('grownup-status-new-relink-en.png') });
  });
});
