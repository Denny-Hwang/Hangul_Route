import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { API, NOW, SESSION_KEY, STEADY } from './report-fixtures';

/**
 * The class join link and its QR code on the teacher's roster (owner decision 2026-10-17): under the class code, the
 * link `app.hangulroute.com/join#c=<code>` (the code alone in the fragment, never a name), Copy link, and Show QR code,
 * which draws the link as a named image in place. A family roster has none. The API is mocked with `page.route`; the
 * learner app's side (the link opens Join a class with the code filled in) is `apps/mobile/e2e/web/join-link.spec.ts`.
 * Same export as reports.spec.ts:
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.report-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true pnpm --filter @hangul-route/web build
 *   REPORTS_E2E=1 pnpm --filter @hangul-route/web exec playwright test join-link
 *
 * Where the browser has the Shape Detection API (`BarcodeDetector`, Chrome on macOS), the drawn code is also read
 * back and must be the link; elsewhere that step is noted and skipped.
 */
test.skip(process.env.REPORTS_E2E !== '1', 'needs the export built against the mocked report API (REPORTS_E2E=1)');

const en = getMessages('en').console;
const CLASS_ID = 'space:sunflower';
const FAMILY_ID = 'space:kim-family';
const CODE = 'ABC234';
const LINK = `https://app.hangulroute.com/join#c=${CODE}`;

type Kind = 'class' | 'family';

const space = (kind: Kind) => ({
  id: kind === 'class' ? CLASS_ID : FAMILY_ID,
  kind,
  name: kind === 'class' ? 'Sunflower' : 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const json = (route: Route, status: number, data: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data }) });

/** The mocked Worker: a class or a family with a live code, with one learner or none. */
async function mockRoster(page: Page, withLearner: boolean): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    const kind: Kind = decodeURIComponent(url.pathname).includes(CLASS_ID) ? 'class' : 'family';
    if (/\/roster$/.test(url.pathname)) {
      const learners = withLearner
        ? [{ id: 'profile:mina', displayName: 'Mina', avatar: 'hoya-orange', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z', ageGroup: 'starter', lastSyncedAt: '2026-10-15T09:31:00.000Z', summary: STEADY }]
        : [];
      return json(route, 200, { space: space(kind), learners, joinCode: CODE, joinCodeExpiresAt: '2026-11-15T00:00:00.000Z' });
    }
    if (url.pathname === '/api/spaces') return json(route, 200, { spaces: [{ space: space(kind), role: 'owner', counts: { learners: withLearner ? 1 : 0, accounts: 1, classes: 0 } }] });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
}

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Reads the drawn QR code back with the browser's BarcodeDetector; null where the browser has none. */
async function readQr(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector) return null;
    const svg = document.querySelector('[data-testid="join-link-qr"]');
    if (!svg) return 'no svg';
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no canvas';
    ctx.drawImage(img, 0, 0, 512, 512);
    const found = await new Detector({ formats: ['qr_code'] }).detect(canvas);
    return found[0]?.rawValue ?? 'nothing read';
  });
}

test.describe('the class join link and its QR code', () => {
  for (const width of [320, 375, 1280]) {
    test(`${width} wide: the link under the code, Copy link, and the QR code drawn in place`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockRoster(page, width !== 320);
      await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
      const panel = page.getByTestId('join-link');
      await expect(panel).toBeVisible();
      await expect(page.getByTestId('join-code')).toHaveText(CODE);
      await expect(page.getByTestId('join-link-url')).toHaveText(`app.hangulroute.com/join#c=${CODE}`);
      await expect(panel.getByText(en.space.joinLink.note, { exact: true })).toBeVisible();
      // The link holds the code only: no learner's name anywhere in it.
      expect(await page.getByTestId('join-link-url').innerText()).not.toMatch(/Mina/);

      const toggle = page.getByRole('button', { name: en.space.joinLink.qr.show.cta, exact: true });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      const qr = page.getByRole('img', { name: en.space.joinLink.qr.label, exact: true });
      await expect(qr).toBeVisible();
      await expect(page.getByRole('button', { name: en.space.joinLink.qr.hide.cta, exact: true })).toHaveAttribute('aria-expanded', 'true');
      const box = await qr.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(200);
      expect(await noSideScroll(page)).toBe(true);
      const read = await readQr(page);
      if (read === null) test.info().annotations.push({ type: 'qr-read', description: 'BarcodeDetector not available in this browser: the drawn code was not read back' });
      else expect(read).toBe(LINK);
      await qr.scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`join-link-${width}.png`), fullPage: true });
    });
  }

  test('Copy link puts the whole link on the clipboard and says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockRoster(page, true);
    await page.goto(`/teach/space?id=${encodeURIComponent(CLASS_ID)}`);
    await page.getByRole('button', { name: en.space.joinLink.copy.cta, exact: true }).click();
    await expect(page.getByRole('button', { name: en.space.joinLink.copied.cta, exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LINK);
  });

  test('a family roster shows its code and no join link', async ({ page }) => {
    await mockRoster(page, true);
    await page.goto(`/teach/space?id=${encodeURIComponent(FAMILY_ID)}`);
    await expect(page.getByTestId('join-code')).toHaveText(CODE);
    await expect(page.getByTestId('join-link')).toHaveCount(0);
  });
});
