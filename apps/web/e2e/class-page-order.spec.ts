import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { STEADY } from './report-fixtures';

/**
 * AMENDMENTS-GROWNUP-UX GX-7 (section 8 T3 to T5; section 14 `apps/web/e2e/class-page-order.spec.ts`): the class page
 * reads title, This week, the action bar (Plan first, More holding Notes, New devices, Class moves and Settings), the
 * roster and, last, **Invite students · code {code}**, collapsed while the class has learners; a roster card is the
 * name row, "Practiced {when} · {n} min this week", the stage segments with the quests, the revisit line, the plan
 * lines, and Report and Note in one row; an empty class leads with the invite open and the code hero-size (on the first
 * phone screen), then its three first steps. With something waiting (a new device, a learner asking to join, a class
 * move; the owner's request), the banner, the asking-to-join cards with Accept / Not now, This week, then the bar with
 * the waiting entries in view (their counts in words, never folded under More) and the action cards first with Needs
 * your OK. ko, en and es at 360 x 740 and 1280 x 800, with no sideways scroll at 360. The join code is a valid one
 * (SUN234), so the join link and Show QR code render as they do for a teacher. Over the static export with
 * the account API mocked through `page.route` (nothing leaves the machine), the export of grownup-status.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test class-page-order.spec
 *
 * `HR_SHOTS=1` also writes the PR's shots to `design/screens/class-page/shots/`. Like grownup-status.spec.ts, no CI
 * lane runs it yet (a lane is a workflow change); each PR runs that build and suite locally.
 */
test.skip(process.env.GROWNUP_E2E !== '1', 'needs the export built against the mocked API (GROWNUP_E2E=1)');

const API = 'https://api.gx-e2e.test';
const SESSION_KEY = 'hr:console:session';
const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const SHOTS = process.env.HR_SHOTS === '1' ? '../../design/screens/class-page/shots' : null;

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
const LEARNERS = [learner('profile:yuhan', 'Yuhan'), learner('profile:jaehan', 'Jaehan', { avatar: 'hoya-blue' })];
const PLAN = {
  id: 'plan:week',
  spaceId: 'space:a',
  authorAccountId: 'acct-e2e',
  title: 'Week of Oct 27',
  items: [{ kind: 'quest', id: 'quest:stage1-life-q2' }],
  targetLearnerIds: null,
  publishedAt: at(-60 * 24 * 3),
  archivedAt: null,
  createdAt: at(-60 * 24 * 3),
  updatedAt: at(-60 * 24 * 3),
  meta: null,
};

// The waiting state (GX-7 review): a new device for Jaehan, a transfer and a teacher move into this class.
const relinkFor = (learnerId: string, name: string) => ({ id: `relink:${name.toLowerCase()}`, learnerId, learnerName: name, deviceId: 'device:new', platform: 'ios', requestedAt: at(-2), expiresAt: at(7.5), status: 'pending' });
const TRANSFER_IN = {
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
  id: 'transfer:in1',
  role: 'destination',
  status: 'requested',
  steps: { learner: 'yes', source: 'yes', destination: 'waiting' },
  createdAt: at(-60 * 24),
  expiresAt: at(60 * 24 * 12),
  learner: { name: 'M. K.', avatar: 'hoya-orange', level: '8-9' },
  comingFrom: { name: 'Class B' },
};
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'hoya-orange', level: '5-7' }, createdAt: at(-60), at: null };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockClass(page: Page, learners: unknown[], waiting = false): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: CLASS, role: 'owner', counts: { learners: learners.length, accounts: 1, classes: 0 } }] });
    if (path.endsWith('/roster')) return json(route, 200, { space: CLASS, learners, joinCode: 'SUN234', joinCodeExpiresAt: at(60 * 24 * 30) });
    if (path.endsWith('/plans')) return json(route, 200, { plans: learners.length ? [PLAN] : [] });
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: waiting ? [relinkFor('profile:jaehan', 'Jaehan')] : [] });
    if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming: waiting ? [MOVE_IN] : [] });
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: waiting ? [TRANSFER_IN] : [] });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

/** The top of each element, in the order given; the page must draw them in that order. */
async function tops(page: Page, ids: string[]): Promise<number[]> {
  const out: number[] = [];
  for (const id of ids) out.push((await page.getByTestId(id).first().boundingBox())?.y ?? -1);
  return out;
}
const ascending = (values: number[]): boolean => values.every((v, i) => v >= 0 && (i === 0 || v > (values[i - 1] as number)));

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
  test.describe(`${locale}: the class page order (GX-7)`, () => {
    test.use({ locale: browser });
    for (const { label, size } of VIEWPORTS) {
      test(`${label}: This week, the action bar with More, the compact cards, and Invite students last`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockClass(page, LEARNERS);
        await page.goto('/teach/space?id=space%3Aa');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByTestId('student-card')).toHaveCount(2);

        expect(ascending(await tops(page, ['space-head', 'this-week', 'class-actions', 'student-card', 'invite']))).toBe(true);
        // The plan is the primary button and comes first; Lecture mode and Class report stay in view.
        const bar = page.getByTestId('class-actions');
        await expect(bar.getByTestId('open-plan')).toHaveText(c.space.openPlan.label(PLAN.title));
        await expect(bar.getByTestId('open-lecture')).toBeVisible();
        await expect(bar.getByTestId('class-report-link')).toBeVisible();
        // More holds the rest.
        const more = page.getByTestId('class-more-toggle');
        await expect(more).toHaveText(c.space.more);
        await expect(more).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('space-settings')).toHaveCount(0);

        // The compact card: one activity line, the stage line with the quests, Report and Note in one row.
        const card = page.getByTestId('student-card').first();
        await expect(card.getByTestId('practiced-line')).toHaveText(c.space.learner.practiced(getMessages(locale).common.time.yesterday, SUMMARY.minutesLast7d));
        await expect(card.getByTestId('journey-strip')).toContainText(c.space.learner.questsCards(7, 15, 5));
        await expect(card.locator('details')).toHaveCount(0);

        // Invite students, collapsed, with the code in its name.
        const invite = page.getByTestId('invite-toggle');
        await expect(invite).toHaveText(c.space.invite('SUN234'));
        await expect(invite).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('join-code')).toHaveCount(0);
        if (label === '360') await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`class-page-${locale}-${label}.png`), fullPage: true });
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/class-${locale}-${label}.png`, fullPage: true });

        await more.click();
        await expect(more).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('class-more').getByTestId('relink-requests')).toBeVisible();
        await expect(page.getByTestId('class-more').getByTestId('class-moves')).toBeVisible();
        await expect(page.getByTestId('class-more').getByTestId('space-settings')).toHaveText(c.space.settings.cta);
        // Every button in the bar and under More is at least the touch target tall (GX-6).
        for (const button of await page.getByTestId('class-actions').locator('button, a').all()) {
          expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
        }
        await invite.click();
        await expect(page.getByTestId('join-code')).toHaveText('SUN234');
        if (label === '360') await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`class-page-open-${locale}-${label}.png`), fullPage: true });
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/class-open-${locale}-${label}.png`, fullPage: true });
      });

      test(`${label}: an empty class shows the first steps and the code, and hides what needs a learner`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockClass(page, []);
        await page.goto('/teach/space?id=space%3Aa');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const steps = page.getByTestId('first-run');
        await expect(steps.getByRole('heading', { level: 2 })).toHaveText(c.space.firstRun.title);
        await expect(steps.getByRole('listitem')).toHaveText([...c.space.firstRun.steps]);
        await expect(page.getByTestId('invite-toggle')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('join-code')).toHaveText('SUN234');
        // A valid code: the join link and its QR control render inside Invite students, as step 1 says.
        await expect(page.getByTestId('invite-body').getByTestId('join-link-qr-toggle')).toBeVisible();
        expect(ascending(await tops(page, ['space-head', 'join-code', 'first-run', 'class-actions']))).toBe(true);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/empty-${locale}-${label}.png`, fullPage: true });
        // On a phone the code is on the first screen.
        if (label === '360') {
          const code = await page.getByTestId('join-code').boundingBox();
          expect((code?.y ?? 9999) + (code?.height ?? 0)).toBeLessThanOrEqual(size.height);
        }
        await expect(page.getByTestId('open-lecture')).toHaveCount(0);
        await expect(page.getByTestId('class-report-link')).toHaveCount(0);
        await expect(page.getByTestId('this-week')).toHaveCount(0);
        await page.getByTestId('class-more-toggle').click();
        await expect(page.getByTestId('class-more').locator('[data-testid]')).toHaveCount(1);
        await expect(page.getByTestId('space-settings')).toBeVisible();
        await expect(page.getByTestId('relink-requests')).toHaveCount(0);
        await expect(page.getByTestId('class-moves')).toHaveCount(0);
        if (label === '360') await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`class-page-empty-${locale}-${label}.png`), fullPage: true });
      });

      test(`${label}: something waiting: the banner, the asking cards, This week, the bar with the waiting entries in view, the action cards first`, async ({ page }) => {
        await page.setViewportSize(size);
        await mockClass(page, LEARNERS, true);
        await page.goto('/teach/space?id=space%3Aa');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // The new device opens the pop-up (GX-2); Later leaves the page in its waiting state.
        const popup = page.getByRole('alertdialog', { name: c.relinkPopup.title('Jaehan') });
        await expect(popup).toBeVisible();
        if (SHOTS && label === '360') await page.screenshot({ path: `${SHOTS}/waiting-popup-${locale}-${label}.png` });
        await popup.getByRole('button', { name: c.relinkPopup.later.cta }).click();
        await expect(popup).toHaveCount(0);

        // 1 new device + 2 class moves in, said in words under the title.
        const banner = page.getByTestId('attention-banner');
        await expect(banner.getByRole('status')).toHaveText(`${c.attention.title(3)}${c.attention.devices(1)} · ${c.attention.moves(2)}`);
        const asking = page.getByTestId('asking-to-join');
        await expect(asking.getByTestId('incoming-card')).toHaveCount(2);
        expect(ascending(await tops(page, ['space-head', 'attention-banner', 'asking-to-join', 'this-week', 'class-actions', 'student-card', 'invite']))).toBe(true);

        // The waiting entries stand in the bar with their counts; More keeps its plain look and holds only the rest.
        const bar = page.getByTestId('class-actions');
        await expect(bar.getByTestId('relink-requests')).toHaveText(c.space.relinkPending.cta(1));
        await expect(bar.getByTestId('class-moves')).toHaveText(c.transfer.waiting(2));
        await expect(bar.getByTestId('relink-requests')).toBeVisible();
        await expect(bar.getByTestId('class-moves')).toBeVisible();
        await expect(page.getByTestId('class-more-toggle')).toHaveText(c.space.more);

        // The action card leads the roster: Jaehan, Needs your OK right after the name, Approve / Deny on the card.
        const first = page.getByTestId('student-card').first();
        await expect(first).toContainText('Jaehan');
        await expect(first.getByTestId('learner-status')).toHaveText(c.status.needsOk);
        await expect(first.getByRole('button', { name: c.relink.approve.cta, exact: true })).toBeVisible();
        await expect(first.getByRole('button', { name: c.relink.deny.cta, exact: true })).toBeVisible();
        // The other learner reads In class (the "on board" state).
        await expect(page.getByTestId('student-card').nth(1).getByTestId('learner-status')).toHaveText(c.status.inClass);

        if (label === '360') await noSidewaysScroll(page);
        await page.screenshot({ path: test.info().outputPath(`class-page-waiting-${locale}-${label}.png`), fullPage: true });
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/waiting-${locale}-${label}.png`, fullPage: true });
        await page.getByTestId('class-more-toggle').click();
        await expect(page.getByTestId('class-more').getByTestId('relink-requests')).toHaveCount(0);
        await expect(page.getByTestId('class-more').getByTestId('class-moves')).toHaveCount(0);
        await expect(page.getByTestId('class-more').getByTestId('space-settings')).toBeVisible();
      });
    }
  });
}
