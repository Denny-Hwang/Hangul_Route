import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { swipeStage, type WindowPoint } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-PRESENTER-NAV section 12 (owner choice O8, row PN-6): the navigation counts of
 * `lecture.complete`, smoked on the real build. At each window of the matrix (568 x 320, 640 x 360
 * and 844 x 390 touch, the overlay layout until PN-4's rail; 1180 x 820 touch and mouse and
 * 1920 x 1080 mouse and touch, docked) a lesson takes one step from each source its device has (a
 * bar button, a swipe, a key, and with a mouse a click on the stage), a Previous at once after a
 * forward step, and Exit: the payload names the layout drawn, each source's own count, the quick
 * back and no points, and nothing else (no id, no place, no time, no title).
 *
 * The client sends events only from a build with an API address, so this spec runs on one
 * (`EXPO_PUBLIC_API_BASE_URL` at a mock host) and is reported as skipped elsewhere:
 *   EXPO_PUBLIC_API_BASE_URL=https://api.presenter-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test presenter-nav-telemetry
 * Swipes drive CDP touch events (`swipeStage`), Chromium only. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2enavcount1',
  title: 'Counts lesson',
  createdAt: '2026-10-29T09:00:00Z',
  seed: 7,
  // Letters first: their slides have no content targets, so a mouse click on the stage goes on.
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
};
const link = `/present#d=${encodeDeck(DECK)}`;

type Input = 'touch' | 'mouse';
interface Case {
  id: string;
  width: number;
  height: number;
  phone: boolean;
  input: Input;
  layout: 'docked' | 'overlay';
}

const MATRIX: readonly Case[] = [
  { id: 'V1', width: 568, height: 320, phone: true, input: 'touch', layout: 'overlay' },
  { id: 'V2c', width: 640, height: 360, phone: true, input: 'touch', layout: 'overlay' },
  { id: 'V2', width: 844, height: 390, phone: true, input: 'touch', layout: 'overlay' },
  { id: 'V3', width: 1180, height: 820, phone: false, input: 'touch', layout: 'docked' },
  { id: 'V3', width: 1180, height: 820, phone: false, input: 'mouse', layout: 'docked' },
  { id: 'V4', width: 1920, height: 1080, phone: false, input: 'mouse', layout: 'docked' },
  { id: 'V4', width: 1920, height: 1080, phone: false, input: 'touch', layout: 'docked' },
];

const NAV_KEYS = ['navLayout', 'stepsButton', 'stepsSwipe', 'stepsKey', 'stepsClick', 'quickBacks', 'points'];

/**
 * Start asks for fullscreen in its tap; headless Chromium would grant it and resize the window, which
 * no phone or tablet does, so the request is granted and the window left as it is.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
  });
});

/** The slide shown: the counter and the live region. */
async function slideNow(page: Page): Promise<string> {
  const counter = (await page.getByTestId('presenter-counter').textContent()) ?? '';
  const live = (await page.getByTestId('presenter-live').textContent()) ?? '';
  return `${counter} | ${live}`;
}

/** The slide and its build: a reveal changes what the stage draws (a build's opacity) even when no text changes. */
async function buildNow(page: Page): Promise<string> {
  return `${await slideNow(page)} | ${await page.getByTestId('presenter-stage').evaluate((el) => el.innerHTML)}`;
}

/** One step that must move the slide or the build (the payload's counts then hold that it was counted once). */
async function stepped(page: Page, run: () => Promise<void>): Promise<void> {
  const was = await buildNow(page);
  await run();
  await expect.poll(() => buildNow(page)).not.toBe(was);
  await page.waitForTimeout(150);
}

async function stageBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return (await page.getByTestId('presenter-stage').boundingBox())!;
}

/** A swipe left (next) or right (previous) across the middle of the stage: CDP touch, or a mouse drag. */
async function swipe(page: Page, input: Input, direction: 'left' | 'right'): Promise<void> {
  const box = await stageBox(page);
  const y = box.y + box.height / 2;
  const span = Math.min(240, box.width / 3);
  const from: WindowPoint = { x: box.x + box.width / 2 + (direction === 'left' ? span / 2 : -span / 2), y };
  const to: WindowPoint = { x: from.x + (direction === 'left' ? -span : span), y };
  if (input === 'touch') {
    await swipeStage(page, from, to);
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** On the overlay layout the bar hides at every step: a tap on empty stage shows it, and it takes taps after its grace. */
async function barReady(page: Page, c: Case): Promise<void> {
  if (c.layout !== 'overlay') return;
  const next = page.getByTestId('presenter-next');
  if ((await next.evaluate((el) => getComputedStyle(el).pointerEvents)) === 'none') {
    const box = await stageBox(page);
    await page.touchscreen.tap(box.x + 10, box.y + 10);
  }
  await expect(page.getByTestId('presenter-bar-compact')).toHaveCSS('opacity', '1');
  await expect(next).not.toHaveCSS('pointer-events', 'none');
}

async function press(page: Page, c: Case, id: 'presenter-next' | 'presenter-back'): Promise<void> {
  await barReady(page, c);
  if (c.input === 'touch') await page.getByTestId(id).tap();
  else await page.getByTestId(id).click();
}

for (const c of MATRIX) {
  test.describe(`${c.id} ${c.width} x ${c.height}, ${c.input} (${c.layout})`, () => {
    test.use({ viewport: { width: c.width, height: c.height }, isMobile: c.phone, hasTouch: c.input === 'touch' });

    test('lecture.complete names the layout and counts each source on its own', async ({ page }) => {
      test.skip(process.env.E2E_TELEMETRY !== '1', 'needs a web build with an API address (E2E_TELEMETRY=1)');
      test.skip(process.env.E2E_WEBKIT === '1', 'swipes drive CDP touch events (Chromium only)');
      const sent: Array<{ name: string; payload: Record<string, unknown> }> = [];
      await page.route('**/api/telemetry', async (route) => {
        const body = route.request().postDataJSON() as { name?: string; payload?: Record<string, unknown> } | null;
        if (body?.name?.startsWith('lecture.') && body.payload) sent.push({ name: body.name, payload: body.payload });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      });

      await page.goto(link);
      const start = page.getByTestId('presenter-start-button');
      await expect(start).toBeEnabled({ timeout: 10_000 });
      if (c.input === 'touch') await start.tap();
      else await start.click();
      await expect(page.getByTestId('presenter-stage')).toBeVisible();
      await expect(page.getByTestId(c.layout === 'docked' ? 'presenter-bar-band' : 'presenter-bar-compact')).toHaveCount(1);
      await expect.poll(() => sent.map((e) => e.name)).toContain('lecture.start');

      // One step from each source this device has.
      await stepped(page, () => press(page, c, 'presenter-next'));
      await stepped(page, () => swipe(page, c.input, 'left'));
      await stepped(page, () => page.keyboard.press('ArrowRight'));
      if (c.input === 'mouse') {
        // A letter slide has nothing to point at: a click on empty stage goes on.
        const box = await stageBox(page);
        await stepped(page, () => page.mouse.click(box.x + 10, box.y + 10));
      } else {
        // A touch tap on empty stage never steps (it rings Next, or shows the overlay bar).
        const was = await slideNow(page);
        const box = await stageBox(page);
        await page.touchscreen.tap(box.x + 10, box.y + 10);
        await page.waitForTimeout(300);
        expect(await slideNow(page)).toBe(was);
      }
      // Previous at once after a forward step: a quick back. A swipe back long after is not.
      await stepped(page, () => page.keyboard.press('ArrowRight'));
      await stepped(page, () => press(page, c, 'presenter-back'));
      await page.waitForTimeout(2_100);
      await stepped(page, () => swipe(page, c.input, 'right'));
      await shot(page, `presenter-nav-telemetry-${c.width}x${c.height}-${c.input}`);

      await page.keyboard.press('Escape');
      await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
      if (c.input === 'touch') await page.getByTestId('presenter-exit-confirm').tap();
      else await page.getByTestId('presenter-exit-confirm').click();
      await expect.poll(() => sent.filter((e) => e.name === 'lecture.complete').length).toBe(1);

      const payload = sent.find((e) => e.name === 'lecture.complete')!.payload;
      expect(Object.keys(payload).sort()).toEqual(['minutes', 'reveals', 'slidesShown', ...NAV_KEYS].sort());
      expect(payload).toMatchObject({
        navLayout: c.layout,
        stepsButton: 2,
        stepsSwipe: 2,
        stepsKey: 2,
        stepsClick: c.input === 'mouse' ? 1 : 0,
        quickBacks: 1,
        points: 0,
      });
      for (const key of NAV_KEYS.slice(1)) expect(Number.isInteger(payload[key]), key).toBe(true);
      expect(JSON.stringify(payload)).not.toMatch(/Counts lesson|lecture:|quest:|stage1/);
    });
  });
}
