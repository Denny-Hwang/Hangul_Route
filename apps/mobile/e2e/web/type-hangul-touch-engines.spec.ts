import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Touchscreen, pointIn } from './touch';
import { FULL_MATRIX } from './touch-matrix';
import { SyntheticTouchscreen } from './touch-synthetic';

/**
 * AMENDMENTS-TOUCH row KT-12 (section 10, U1, U2, U4): what the engines do with the forgiving tap, on the fixture
 * board (`window.__hrTapBoardE2E`, fixture bundle only), at 320 x 640 with touch.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-touch-engines
 *   E2E_WEBKIT=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-touch-engines   # WebKit, iPhone 13
 *
 * CI runs Chromium only (the Playwright browsers it installs). The WebKit run is local, on demand
 * (`playwright.config.ts`); its result is in the PR that added this file and in section 10 of the amendment.
 *
 * - U1: `touch-action: pinch-zoom` is supported by the engine, and the board and every target have it computed.
 * - U2: a click with no touch before it (what VoiceOver and TalkBack send for an activation, and a keyboard's Enter)
 *   commits once, and a second within the lock commits nothing.
 * - The graze matrix, the move that ends 40 px outside, a bounce and two fingers, with synthetic touch events
 *   (`touch-synthetic.ts`), which WebKit can take where the DevTools protocol is Chromium's. They show the engine runs the
 *   board's code the same; the engine's own touch handling (pan and zoom arbitration, the click after a tap) is an owner
 *   check on a phone. On Chromium the same cases also run with the DevTools protocol's real touches (type-hangul-tap-board).
 * - U4 (Chromium, real touches): a 1.4 s hold commits on release and selects no text.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const AFTER_LOCK = 450;
const PRESS_OUTLINE = 'rgb(133, 115, 96)';

type E2eWindow = Window & {
  __hrTapBoardE2E?: { open(p: { lock: 'board' | 'target'; layout: 'fit' | 'tall' }): void; log(): { commits: Array<{ index: number; at: number }> } };
};

async function open(page: Page, lock: 'board' | 'target'): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTapBoardE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((l) => (window as E2eWindow).__hrTapBoardE2E?.open({ lock: l, layout: 'fit' }), lock);
  await expect(page.getByTestId('tap-board')).toBeVisible();
  await expect.poll(() => page.getByTestId('tap-board').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pinch-zoom');
  await page.waitForTimeout(AFTER_LOCK);
}

const commits = async (page: Page): Promise<number[]> => (await page.evaluate(() => (window as E2eWindow).__hrTapBoardE2E!.log())).commits.map((c) => c.index);
const outline = (page: Page, index: number): Promise<string> => page.getByTestId(`tap-target-${index}`).evaluate((el) => getComputedStyle(el).borderTopColor);

test.describe('the forgiving tap in the engines (AMENDMENTS-TOUCH KT-12)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('U1 the engine supports touch-action pinch-zoom, and the board and its targets have it', async ({ page, browserName }) => {
    await open(page, 'board');
    const supported = await page.evaluate(() => CSS.supports('touch-action', 'pinch-zoom'));
    test.info().annotations.push({ type: 'U1', description: `${browserName}: CSS.supports('touch-action', 'pinch-zoom') is ${supported}` });
    expect(supported).toBe(true);
    for (const id of ['tap-target-0', 'tap-target-3']) expect(await page.getByTestId(id).evaluate((el) => getComputedStyle(el).touchAction)).toBe('pinch-zoom');
    // The screen's own content keeps zoom and drops the double-tap zoom and the click delay.
    expect(await page.getByTestId('tap-board-e2e').evaluate((el) => getComputedStyle(el).touchAction)).toBe('manipulation');
  });

  test('U2 a click with no touch before it commits once; a second within the lock commits nothing', async ({ page }) => {
    await open(page, 'board');
    const target = page.getByTestId('tap-target-1');
    await target.dispatchEvent('click');
    await page.waitForTimeout(100);
    await target.dispatchEvent('click');
    await page.waitForTimeout(AFTER_LOCK);
    expect(await commits(page)).toEqual([1]);
    await target.dispatchEvent('click');
    await page.waitForTimeout(150);
    expect(await commits(page)).toEqual([1, 1]);
  });

  test('a real tap through the engine commits once, with no second commit from the click after it', async ({ page }) => {
    await open(page, 'board');
    const box = (await page.getByTestId('tap-target-2').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(AFTER_LOCK + 300);
    expect(await commits(page)).toEqual([2]);
  });

  test('the graze matrix: 0 to 32 px on both axes each commit; a move ending 40 px outside commits nothing', async ({ page }) => {
    await open(page, 'board');
    const touch = new SyntheticTouchscreen(page);
    const centre = await pointIn(page, 'tap-target-0');
    // CI: both axes, one direction each (nine moves); E2E_TOUCH_MATRIX=full: all four directions (the 20 of the KT-1 matrix).
    const moves = [0, 8, 16, 24, 32].flatMap((d) => (FULL_MATRIX ? [{ dx: 0, dy: d }, { dx: d, dy: 0 }, { dx: 0, dy: -d }, { dx: -d, dy: 0 }] : d === 0 ? [{ dx: 0, dy: 0 }] : [{ dx: 0, dy: d }, { dx: -d, dy: 0 }]));
    for (const m of moves) {
      await touch.graze(centre, m.dx, m.dy);
      await page.waitForTimeout(AFTER_LOCK);
    }
    expect(await commits(page)).toEqual(moves.map(() => 0));
    // Up and away from the neighbours: a move that ends 40 px outside the 96 px target (48 + 40 from its centre) commits nothing.
    await touch.graze(centre, 0, -88);
    await page.waitForTimeout(AFTER_LOCK);
    expect(await commits(page)).toHaveLength(moves.length);
    await expect.poll(() => outline(page, 0)).not.toBe(PRESS_OUTLINE);
  });

  test('a bounce 60 and 150 ms after a tap commits once; the later finger of two commits and the earlier does not', async ({ page }) => {
    await open(page, 'board');
    const touch = new SyntheticTouchscreen(page);
    const centre = await pointIn(page, 'tap-target-2');
    for (const gap of [60, 150]) {
      await touch.tap(centre, 20);
      await page.waitForTimeout(gap);
      await touch.tap(centre, 20);
      await page.waitForTimeout(AFTER_LOCK);
    }
    expect(await commits(page)).toEqual([2, 2]);
    await open(page, 'target');
    const a = await pointIn(page, 'tap-target-0');
    const b = await pointIn(page, 'tap-target-1');
    await touch.start({ id: 1, ...a });
    await page.waitForTimeout(40);
    await touch.start({ id: 2, ...b });
    await expect.poll(() => outline(page, 1)).toBe(PRESS_OUTLINE);
    await page.waitForTimeout(40);
    await touch.end(1);
    await page.waitForTimeout(40);
    await touch.end(2);
    await page.waitForTimeout(150);
    expect(await commits(page)).toEqual([1]);
  });

  test('U4 a 1.4 s hold commits on release and selects no text', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'real touches go through the DevTools protocol (Chromium)');
    await open(page, 'board');
    await page.evaluate(() => {
      const w = window as Window & { __menus?: number };
      w.__menus = 0;
      window.addEventListener('contextmenu', () => (w.__menus = (w.__menus ?? 0) + 1), { capture: true });
    });
    const touch = await Touchscreen.of(page);
    await touch.graze(await pointIn(page, 'tap-target-3'), 0, 0, { holdMs: 1_400 });
    await page.waitForTimeout(AFTER_LOCK);
    expect(await commits(page)).toEqual([3]);
    const state = await page.evaluate(() => ({ selected: window.getSelection()?.toString() ?? '', menus: (window as Window & { __menus?: number }).__menus ?? 0 }));
    test.info().annotations.push({ type: 'U4', description: `Chromium touch emulation: ${state.menus} contextmenu event(s), selection "${state.selected}"` });
    expect(state.selected).toBe('');
    expect(await page.getByTestId('tap-target-3').evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
  });
});
