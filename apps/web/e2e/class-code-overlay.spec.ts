import { expect, test, type Page, type Route } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { STEADY } from './report-fixtures';

/**
 * [CO-1b] The same from the teacher home (OD-CO7 (a)): Show the code on a class row opens the overlay over the home, from
 * the spaces list; no roster is read, no learner name is anywhere on the page, the page content is inert, the print holds
 * the overlay only, and focus goes back to the row's button.
 *
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-1 (section 6 item 9, local lane): on a class page Show the code opens an opaque
 * full-window dialog with the class name, the code and a QR code, and nothing else, so a classroom screen shows no
 * learner. Keyboard only: Tab to Show the code, Enter opens it with focus on its heading, Escape (or Tab, Enter on Close)
 * puts focus back on Show the code, in Chromium and in WebKit (where a click does not focus a button). Open: every point
 * of a 12 x 8 grid hits the overlay, the roster cards are inside an `inert` element, the overlay's text holds no learner
 * name, and the print rendering holds none either. At seven window sizes: no sideways scroll, the code on one line
 * inside the window, on landscape windows the code and the whole QR in the first screen, the QR at least 256 px wide
 * (151 px at 640 x 360, the height cap), and read back as the join link where the browser has BarcodeDetector.
 *
 * Over the static export with the account API mocked through `page.route` (the export of class-page-order.spec.ts):
 *
 *   NEXT_PUBLIC_API_BASE_URL=https://api.gx-e2e.test NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_CLASS_TRANSFER=enabled pnpm --filter @hangul-route/web build
 *   GROWNUP_E2E=1 pnpm --filter @hangul-route/web exec playwright test class-code-overlay.spec
 *
 * `HR_SHOTS=1` also writes `design/screens/console/shots/class-code-overlay-built-{lc}-{w}.png` in en, es and ko.
 */
test.skip(process.env.GROWNUP_E2E !== '1', 'needs the export built against the mocked API (GROWNUP_E2E=1)');

const API = 'https://api.gx-e2e.test';
const SESSION_KEY = 'hr:console:session';
const NOW = new Date('2026-11-24T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const SHOTS = process.env.HR_SHOTS === '1' ? '../../design/screens/console/shots' : null;
const CODE = 'SUN234';
const LINK = `https://app.hangulroute.com/join#c=${CODE}`;

const CLASS = { id: 'space:a', kind: 'class', name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };
const SUMMARY = { ...STEADY, lastActiveAt: at(-60 * 20) };
const learner = (id: string, name: string, avatar: string) => ({
  id,
  displayName: name,
  ageGroup: '5-7',
  avatar,
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: at(-60 * 20),
  lastSyncedAt: at(-60 * 20),
  summary: SUMMARY,
});
const NAMES = ['Yuhan', 'Jaehan'];
const LEARNERS = [learner('profile:yuhan', NAMES[0] as string, 'hoya-orange'), learner('profile:jaehan', NAMES[1] as string, 'hoya-blue')];

// A class move into this class: its learner's alias is a name, shown by the page's Asking to join card once a re-read finds it.
const MOVE_IN = { id: 'move:in1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'hoya-orange', level: '5-7' }, createdAt: at(-60), at: null };
const late = { move: false, rosterReads: 0 };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data }) });

async function mockClass(page: Page): Promise<void> {
  late.move = false;
  late.rosterReads = 0;
  await page.clock.install({ time: NOW });
  await page.addInitScript(([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })), [SESSION_KEY]);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(request.url()).pathname);
    // The spaces list carries the live code and its expiry, as the Worker's list does (SpaceListItem); the teacher home reads them.
    if (path === '/api/spaces') return json(route, 200, { spaces: [{ space: CLASS, role: 'owner', counts: { learners: LEARNERS.length, accounts: 1, classes: 0 }, joinCode: CODE, joinCodeExpiresAt: at(60 * 24 * 18) }] });
    if (path.endsWith('/roster')) late.rosterReads += 1;
    if (path.endsWith('/roster')) return json(route, 200, { space: CLASS, learners: LEARNERS, joinCode: CODE, joinCodeExpiresAt: at(60 * 24 * 18) });
    if (path.endsWith('/relink-requests')) return json(route, 200, { requests: [] });
    if (path.endsWith('/class-moves')) return json(route, 200, { outgoing: [], incoming: late.move ? [MOVE_IN] : [] });
    if (path.endsWith('/transfer-requests')) return json(route, 200, { requests: [] });
    return json(route, 200, { plans: [], requests: [], entitlements: [] });
  });
}

async function openClassPage(page: Page, size: { width: number; height: number }, textScale = 1): Promise<void> {
  await page.setViewportSize(size);
  await mockClass(page);
  await page.goto('/teach/space?id=space%3Aa');
  await expect(page.getByTestId('student-card')).toHaveCount(2);
  if (textScale !== 1) await page.evaluate((scale) => document.documentElement.style.setProperty('--hr-text-scale', String(scale)), textScale);
}

const activeTestId = (page: Page): Promise<string | null> => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null);
const activeTag = (page: Page): Promise<string | null> => page.evaluate(() => document.activeElement?.tagName ?? null);

/**
 * Tab until the element with `testId` has focus (at most 60 presses): the keyboard route to a control. `key` is
 * Alt+Tab in WebKit on macOS, which (like Safari) skips buttons on a plain Tab.
 */
async function tabTo(page: Page, testId: string, key = 'Tab'): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press(key);
    if ((await activeTestId(page)) === testId) return;
  }
  throw new Error(`Tab never reached ${testId}`);
}

/** Reads the overlay's QR back with the browser's BarcodeDetector; null where the browser has none. */
async function readQr(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector) return null;
    const svg = document.querySelector('[data-testid="class-code-qr"]');
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

/** Section 6 item 9, keyboard only: the round trip from Show the code to the dialog and back, by Escape and by Close. */
async function keyboardRoundTrip(page: Page, tabKey = 'Tab'): Promise<void> {
  await openClassPage(page, { width: 1280, height: 720 });
  await tabTo(page, 'class-code-open', tabKey);
  await page.keyboard.press('Enter');
  const dialog = page.getByTestId('class-code-overlay');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await activeTag(page)).toBe('H2');
  await expect(page.locator('h2:focus')).toHaveText('Sunday Class A');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await activeTestId(page)).toBe('class-code-open');

  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  // Tab from the heading goes to Close, and Tab again (or Shift+Tab) stays on it.
  await page.keyboard.press('Tab');
  expect(await activeTestId(page)).toBe('class-code-close');
  await page.keyboard.press('Tab');
  expect(await activeTestId(page)).toBe('class-code-close');
  await page.keyboard.press('Shift+Tab');
  expect(await activeTestId(page)).toBe('class-code-close');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  expect(await activeTestId(page)).toBe('class-code-open');
}

test.describe('Show the code with the keyboard only', () => {
  test('Chromium: Tab to Show the code, Enter opens it on its heading; Escape and Tab then Enter on Close give focus back', async ({ page }) => {
    await keyboardRoundTrip(page);
  });

  // WebKit does not focus a button on a click, so this is the browser that proves focus returns from the opener's ref.
  // It needs `playwright install webkit`; the Playwright config here runs Chromium only, so the browser is launched by hand.
  test('WebKit: the same round trip', async ({ playwright }) => {
    const browser = await playwright.webkit.launch();
    try {
      const context = await browser.newContext({ locale: 'en-US' });
      await keyboardRoundTrip(await context.newPage(), process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    } finally {
      await browser.close();
    }
  });
});

test.describe('the overlay shows no learner', () => {
  test('every point of a 12 x 8 grid hits the overlay, the roster is inert, and neither the overlay nor the print holds a name', async ({ page }) => {
    await openClassPage(page, { width: 1280, height: 720 });
    await page.getByTestId('class-code-open').click();
    const dialog = page.getByTestId('class-code-overlay');
    await expect(dialog).toBeVisible();

    const misses = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="class-code-overlay"]');
      const out: string[] = [];
      for (let col = 0; col < 12; col += 1) {
        for (let row = 0; row < 8; row += 1) {
          const x = ((col + 0.5) / 12) * window.innerWidth;
          const y = ((row + 0.5) / 8) * window.innerHeight;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !overlay?.contains(hit)) out.push(`${Math.round(x)},${Math.round(y)}`);
        }
      }
      return out;
    });
    expect(misses).toEqual([]);

    expect(await page.evaluate(() => document.querySelector('[data-testid="student-card"]')?.closest('[inert]') !== null)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-hr-code-overlay'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');

    const text = await dialog.innerText();
    for (const name of NAMES) expect(text).not.toContain(name);
    expect(text).not.toContain('ㅂ');
    expect(text).toContain(CODE);

    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => document.body.innerText);
    for (const name of NAMES) expect(printed).not.toContain(name);
    expect(printed).toContain(CODE);
    await page.emulateMedia({ media: 'screen' });

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-hr-code-overlay'))).toBe(false);
    expect(await page.evaluate(() => document.querySelector('[inert]'))).toBeNull();
  });
});

test.describe('a part that mounts while the overlay is open', () => {
  test('a learner asking to join, found by the 20 s re-read, is inert, off the screen reader\'s reach and out of the print', async ({ page }) => {
    await openClassPage(page, { width: 1280, height: 720 });
    await page.getByTestId('class-code-open').click();
    await expect(page.getByTestId('class-code-overlay')).toBeVisible();
    await expect(page.getByTestId('asking-to-join')).toHaveCount(0);

    late.move = true;
    await page.clock.runFor(21_000);
    // It is in the page (the re-read mounted it) but behind the overlay and inert.
    await expect(page.getByTestId('asking-to-join')).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector('[data-testid="asking-to-join"]')?.closest('[inert]') !== null)).toBe(true);
    expect(await page.evaluate(() => document.querySelector('[data-testid="attention-banner"]')?.closest('[inert]') !== null)).toBe(true);
    expect(await page.getByTestId('class-code-overlay').innerText()).not.toContain('J. K.');

    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => document.body.innerText);
    expect(printed).not.toContain('J. K.');
    expect(printed).not.toContain('Class C');
    for (const name of NAMES) expect(printed).not.toContain(name);
    expect(printed).toContain(CODE);
    await page.emulateMedia({ media: 'screen' });

    // Closed, the page is whole again: the card is reachable and nothing is inert.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('class-code-overlay')).toHaveCount(0);
    await expect(page.getByTestId('asking-to-join')).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('[inert]'))).toBeNull();
  });
});

async function openHome(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await mockClass(page);
  await page.goto('/teach/home');
  await expect(page.getByTestId('space-row-space:a')).toBeVisible();
}

test.describe('Show the code from the teacher home (CO-1b, OD-CO7 (a))', () => {
  test('keyboard only: Tab to the row\'s button, Enter opens it on its heading, Escape gives focus back; no roster is read and no name is on the page', async ({ page }) => {
    await openHome(page, { width: 1280, height: 720 });
    await tabTo(page, 'class-code-open-space:a');
    await page.keyboard.press('Enter');
    const dialog = page.getByTestId('class-code-overlay');
    await expect(dialog).toBeVisible();
    expect(await activeTag(page)).toBe('H2');
    await expect(page.locator('h2:focus')).toHaveText('Sunday Class A');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await activeTestId(page)).toBe('class-code-open-space:a');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    expect(await activeTestId(page)).toBe('class-code-close');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    expect(await activeTestId(page)).toBe('class-code-open-space:a');
    expect(late.rosterReads).toBe(0);
    for (const name of NAMES) expect(await page.evaluate(() => document.body.innerText)).not.toContain(name);
  });

  test('open: every point of a 12 x 8 grid hits the overlay, the home is inert, and neither the overlay nor the print holds a learner name', async ({ page }) => {
    await openHome(page, { width: 1280, height: 720 });
    await page.getByTestId('class-code-open-space:a').click();
    const dialog = page.getByTestId('class-code-overlay');
    await expect(dialog).toBeVisible();
    const misses = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="class-code-overlay"]');
      const out: string[] = [];
      for (let col = 0; col < 12; col += 1) {
        for (let row = 0; row < 8; row += 1) {
          const hit = document.elementFromPoint(((col + 0.5) / 12) * window.innerWidth, ((row + 0.5) / 8) * window.innerHeight);
          if (!hit || !overlay?.contains(hit)) out.push(`${col},${row}`);
        }
      }
      return out;
    });
    expect(misses).toEqual([]);
    expect(await page.evaluate(() => document.querySelector('[data-testid="teacher-home-content"]')?.hasAttribute('inert'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-hr-code-overlay'))).toBe(true);
    const text = await dialog.innerText();
    expect(text).toContain(CODE);
    expect(text).toContain('Sunday Class A');
    for (const name of NAMES) expect(text).not.toContain(name);

    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => document.body.innerText);
    expect(printed).toContain(CODE);
    expect(printed).not.toContain(getMessages('en').console.home.open.cta);
    for (const name of NAMES) expect(printed).not.toContain(name);
    await page.emulateMedia({ media: 'screen' });

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelector('[inert]'))).toBeNull();
    expect(late.rosterReads).toBe(0);
  });
});

const SIZES = [
  { width: 1920, height: 1080, textScale: 1, qrMin: 256 },
  { width: 1280, height: 720, textScale: 1, qrMin: 256 },
  { width: 1024, height: 768, textScale: 1, qrMin: 256 },
  { width: 683, height: 512, textScale: 1, qrMin: 256 },
  { width: 640, height: 360, textScale: 1, qrMin: 151 },
  { width: 360, height: 740, textScale: 1, qrMin: 256 },
  { width: 320, height: 568, textScale: 2, qrMin: 256 },
] as const;

test.describe('the overlay at each window size', () => {
  for (const { width, height, textScale, qrMin } of SIZES) {
    test(`${width} x ${height}${textScale === 1 ? '' : ' at 200 % text'}: one line, nothing sideways, the QR where it should be`, async ({ page }) => {
      await openClassPage(page, { width, height }, textScale);
      await page.getByTestId('class-code-open').click();
      await expect(page.getByTestId('class-code-overlay')).toBeVisible();

      const m = await page.evaluate(() => {
        const overlay = document.querySelector('[data-testid="class-code-overlay"]') as HTMLElement;
        const code = document.querySelector('[data-testid="class-code"]') as HTMLElement;
        const qr = document.querySelector('[data-testid="class-code-qr"]') as SVGElement;
        const cr = code.getBoundingClientRect();
        const qrr = qr.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(code).lineHeight);
        return {
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          overlayOverflow: overlay.scrollWidth - overlay.clientWidth,
          codeFont: parseFloat(getComputedStyle(code).fontSize),
          codeOneLine: code.scrollWidth <= code.clientWidth + 1 && cr.height <= lineHeight * 1.6,
          codeInside: cr.left >= 0 && cr.right <= window.innerWidth,
          codeBottom: cr.bottom,
          qrWidth: qrr.width,
          qrBottom: qrr.bottom,
          qrRight: qrr.right,
          qrInside: qrr.left >= 0 && qrr.right <= window.innerWidth,
          innerHeight: window.innerHeight,
        };
      });
      expect(m.docOverflow).toBeLessThanOrEqual(0);
      expect(m.overlayOverflow).toBeLessThanOrEqual(0);
      expect(m.codeOneLine).toBe(true);
      expect(m.codeInside).toBe(true);
      expect(m.qrInside).toBe(true);
      expect(m.qrWidth).toBeGreaterThanOrEqual(qrMin - 1);
      if (width >= 600 && width > height) {
        // Landscape: the code and the whole QR are in the first screen, with no scrolling.
        expect(m.codeBottom).toBeLessThanOrEqual(m.innerHeight);
        expect(m.qrBottom).toBeLessThanOrEqual(m.innerHeight + 1);
      }
      const read = await readQr(page);
      if (read === null) test.info().annotations.push({ type: 'qr-read', description: 'BarcodeDetector not available in this browser: the drawn code was not read back' });
      else expect(read).toBe(LINK);
    });
  }
});

const SHOT_LOCALES: Array<{ locale: UiLocale; browser: string }> = [
  { locale: 'en', browser: 'en-US' },
  { locale: 'es', browser: 'es-ES' },
  { locale: 'ko', browser: 'ko-KR' },
];

for (const { locale, browser } of SHOT_LOCALES) {
  test.describe(`${locale}: Show the code in the console language`, () => {
    test.use({ locale: browser });
    for (const width of [1280, 360]) {
      test(`${width}: the button, the heading, the caption, the join line and Close`, async ({ page }) => {
        const m = getMessages(locale);
        await openClassPage(page, { width, height: width === 1280 ? 720 : 740 });
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const open = page.getByTestId('class-code-open');
        await expect(open).toHaveText(m.console.space.codeOverlay.open.cta);
        await open.click();
        const dialog = page.getByTestId('class-code-overlay');
        await expect(dialog).toContainText(m.console.space.codeLabel.class);
        await expect(dialog).toContainText(m.console.space.codeOverlay.howToJoin(m.caregiver.spaces.join.cta));
        await expect(dialog).toContainText(m.console.space.joinLink.qr.caption);
        await expect(page.getByTestId('class-code-close')).toHaveText(m.common.buttons.close);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/class-code-overlay-built-${locale}-${width}.png` });
      });
    }
  });
}
