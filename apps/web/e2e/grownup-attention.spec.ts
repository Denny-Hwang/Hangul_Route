import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { STEADY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX GX-2 (owner request 2026-10-31: "make it obvious: a pop-up or a clearer alert"; section 14
 * `apps/web/e2e/grownup-attention.spec.ts`, the GX-2 part): the class page opens the re-link pop-up for a new device, shows
 * the attention banner under its title and opens the review sheet with every waiting item (a new device, two learners
 * asking to join, a move out of this class listed by its view); `#attention` opens the sheet on load and a device and a
 * move are answered there in two taps; with nothing pending at load a new re-link opens the pop-up within one 20 s read.
 * ko, en and es at 360 x 740 and 1280 x 800, with no sideways scroll at 360. Over the static export with the account API
 * mocked through `page.route` (nothing leaves the machine):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test grownup-attention.spec
 *
 * Like grownup-status.spec.ts, no CI lane runs it yet (a lane is a workflow change); each PR runs that build and suite locally.
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
const LEARNERS = [learner('profile:yuhan', 'Yuhan'), learner('profile:jaehan', 'Jaehan'), learner('profile:suji', 'Suji')];
const relinkFor = (learnerId: string, name: string) => ({ id: `relink:${name.toLowerCase()}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' });
const common = { agreedBySchoolAdmin: false, scheduledFor: null, blockReason: null, executedAt: null, endedAt: null, endedByYou: false, endReason: null };
const TRANSFER_IN = {
  ...common,
  id: 'transfer:in1',
  role: 'destination',
  status: 'requested',
  steps: { learner: 'yes', source: 'yes', destination: 'waiting' },
  createdAt: at(-60 * 24),
  expiresAt: at(60 * 24 * 12),
  learner: { name: 'M. K.', avatar: 'hoya-orange', level: '8-9' },
  comingFrom: { name: 'Class B' },
};
// A family-started move out: the source view carries no learner id before GX-W, so the sheet lists it by its own name.
const TRANSFER_OUT = {
  ...common,
  id: 'transfer:out1',
  role: 'source',
  status: 'requested',
  initiator: 'learner_side',
  steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
  createdAt: at(-60 * 24 * 2),
  expiresAt: at(60 * 24 * 11),
  learnerId: null,
  learner: { name: 'Suji', avatar: 'hoya-orange' },
  destination: { spaceId: 'space:d', name: 'Evening Class D' },
};
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'hoya-orange', level: '5-7' }, createdAt: at(-60), at: null };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

interface Mock {
  calls: Array<{ method: string; path: string }>;
  relinks: unknown[];
}

async function mockClass(page: Page, over: { relinks?: unknown[] } = {}): Promise<Mock> {
  const mock: Mock = { calls: [], relinks: over.relinks ?? [relinkFor('profile:jaehan', 'Jaehan')] };
  let incoming: unknown[] = [MOVE_IN];
  let transfers: unknown[] = [TRANSFER_IN, TRANSFER_OUT];
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    const method = request.method();
    mock.calls.push({ method, path });
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
      transfers = transfers.filter((t) => !path.includes((t as { id: string }).id));
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
  test.describe(`${locale}: the pop-up, the banner and the review sheet`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: a new device opens the pop-up; the banner counts everything; Review now lists every item`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockClass(page);
        await page.goto('/teach/space?id=space%3Aa');

        const popup = page.getByRole('alertdialog', { name: c.relinkPopup.title('Jaehan') });
        await expect(popup).toBeVisible();
        await expect(popup.getByText(c.relinkPopup.closes(8))).toBeVisible();
        await expect(popup.getByRole('heading', { name: c.relinkPopup.title('Jaehan') })).toBeFocused();
        // The title takes focus without a click: no focus ring boxes it (the buttons keep theirs).
        expect(await popup.getByRole('heading', { name: c.relinkPopup.title('Jaehan') }).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
        const buttons = popup.getByRole('button');
        await expect(buttons).toHaveText([c.relink.approve.cta, c.relink.deny.cta, c.relinkPopup.later.cta]);
        await page.screenshot({ path: test.info().outputPath(`grownup-attention-popup-${locale}-${label}.png`) });
        await page.keyboard.press('Escape');
        await expect(popup).toHaveCount(0);

        // 1 new device + 3 class moves (a transfer in, a teacher move in, a family-started move out).
        const banner = page.getByTestId('attention-banner');
        await expect(banner.getByRole('status')).toHaveText(`${c.attention.title(4)}${c.attention.devices(1)} · ${c.attention.moves(3)}`);
        await expect(page).toHaveTitle(/^\(4\) /);
        // Under the title, above the page's actions (GX-7: the join code is in Invite students at the end).
        const bannerBox = await banner.boundingBox();
        const actionsBox = await page.getByTestId('class-actions').boundingBox();
        expect((bannerBox?.y ?? 0) < (actionsBox?.y ?? 0)).toBeTruthy();
        await page.screenshot({ path: test.info().outputPath(`grownup-attention-banner-${locale}-${label}.png`) });
        if (label === '360') await noSidewaysScroll(page);

        await banner.getByRole('button', { name: c.attention.reviewNow.cta }).click();
        const sheet = page.getByRole('dialog', { name: c.attention.sheetTitle });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole('heading', { name: c.attention.devicesHeading })).toBeVisible();
        await expect(sheet.getByRole('heading', { name: c.attention.incomingHeading })).toBeVisible();
        await expect(sheet.getByRole('heading', { name: c.attention.outgoingHeading })).toBeVisible();
        await expect(sheet.getByTestId('sheet-device-row')).toContainText(c.status.newDevice(8));
        await expect(sheet.getByTestId('incoming-card')).toHaveCount(2);
        await expect(sheet.getByTestId('sheet-outgoing-row')).toContainText(c.status.moveTo('Evening Class D'));
        await page.screenshot({ path: test.info().outputPath(`grownup-attention-sheet-${locale}-${label}.png`) });
        if (label === '360') await noSidewaysScroll(page);
        // Close is a pill, never a circle, even with a two-letter label (ko "닫기").
        const closeBox = await sheet.getByRole('button', { name: getMessages(locale).common.buttons.close }).boundingBox();
        expect((closeBox?.width ?? 0) > (closeBox?.height ?? 0)).toBeTruthy();
        // The move out of this class: Review opens the shipped consent card inside the sheet.
        await sheet.getByTestId('sheet-outgoing-review').click();
        const consent = sheet.getByTestId('sheet-consent');
        await expect(consent.getByTestId('move-agree')).toBeVisible();
        await consent.scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath(`grownup-attention-sheet-outgoing-${locale}-${label}.png`) });
        if (label === '360') await noSidewaysScroll(page);
        await sheet.getByRole('button', { name: getMessages(locale).common.buttons.close }).click();
        await expect(sheet).toHaveCount(0);
        await expect(banner.getByRole('button', { name: c.attention.reviewNow.cta })).toBeFocused();
      });
    }
  });
}

test.describe('en: answering in the sheet and the pop-up', () => {
  const m = getMessages('en');
  const c = m.console;

  test('#attention opens the sheet on load; a device and a move are answered there, and it stays open when empty', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const mock = await mockClass(page);
    await page.goto('/teach/space?id=space%3Aa#attention');
    const sheet = page.getByRole('dialog', { name: c.attention.sheetTitle });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await sheet.getByTestId('sheet-device-row').getByRole('button', { name: c.relink.approve.cta }).click();
    await expect(sheet.getByText(c.relink.approved('Jaehan')).first()).toBeVisible();
    const move = sheet.getByTestId('incoming-card').filter({ hasText: 'J. K.' });
    await move.getByRole('button', { name: c.teacherMove.section.accept.cta }).click();
    expect(mock.calls.some((call) => call.method === 'POST' && call.path === '/api/spaces/space:a/relink-requests/relink:jaehan/approve')).toBe(true);
    await expect.poll(() => mock.calls.some((call) => call.method === 'POST' && call.path === '/api/spaces/space:a/class-moves/move:in1/accept')).toBe(true);
    // The two that are left, then nothing: the sheet stays open on its empty state.
    await sheet.getByTestId('incoming-card').filter({ hasText: 'M. K.' }).getByRole('button', { name: c.teacherMove.section.accept.cta }).click();
    await sheet.getByTestId('sheet-outgoing-review').click();
    await sheet.getByTestId('move-agree').click();
    await page.clock.runFor(6_000);
    await expect(sheet.getByText(c.attention.empty)).toBeVisible();
    await expect(sheet.getByRole('button', { name: m.common.buttons.close })).toBeFocused();
    await expect(page.getByTestId('attention-banner')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('grownup-attention-sheet-empty-en.png') });
    for (const call of mock.calls) expect(call.path).not.toMatch(/Jaehan|Yuhan|Suji/);
  });

  test('with nothing pending at load, a new re-link opens the pop-up within one 20 s read', async ({ page }) => {
    const mock = await mockClass(page, { relinks: [] });
    await page.goto('/teach/space?id=space%3Aa');
    await expect(page.getByTestId('attention-banner')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    mock.relinks = [relinkFor('profile:yuhan', 'Yuhan')];
    await page.clock.runFor(20_000);
    const popup = page.getByRole('alertdialog', { name: c.relinkPopup.title('Yuhan') });
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: c.relink.approve.cta }).click();
    await expect(popup).toHaveCount(0);
    await expect(page.getByTestId('student-card').filter({ hasText: 'Yuhan' })).toContainText(c.relink.approved('Yuhan'));
  });
});

test.describe('en: the moves page has one incoming list', () => {
  test("another teacher's ask is under Joining this class with the transfer, Accept first", async ({ page }) => {
    const c = getMessages('en').console;
    await mockClass(page);
    await page.goto('/teach/space/transfers?id=space%3Aa');
    const joining = page.getByRole('region', { name: c.transfer.groups.joining });
    const ask = joining.getByTestId('teacher-move-incoming');
    await expect(ask).toContainText('J. K.');
    await expect(ask.getByRole('button').first()).toHaveText(c.teacherMove.section.accept.cta);
    await expect(joining.getByTestId('move-card')).toHaveCount(1);
    await expect(page.getByTestId('teacher-moves').getByRole('heading', { name: c.teacherMove.section.incoming })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('grownup-attention-moves-page-en.png'), fullPage: true });
  });
});
