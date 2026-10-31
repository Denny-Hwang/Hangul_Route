import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Touchscreen, pointIn } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-1: the design-system `TapBoard` under real touches (section 3.3, rows T1-T16 with an e2e
 * half). No learner surface uses a board until rows KT-2 to KT-7, so this suite opens a board of four 96 x 96 targets,
 * 12 px apart, through `window.__hrTapBoardE2E`, which exists only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-tap-board
 *
 * Named under `type-hangul` so the fixture e2e run's `type-hangul` entry in .github/workflows/web-app.yml selects it
 * (the way realia-read-hidden-heritage rides realia-read): the Type Hangul keyboard is the board's multi-touch case
 * (row KT-7), whose cases join this file. Phone at 320 x 640 and tablet at 820 x 1180, both with touch.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** `colors.border.shape`, the press look's outline (section 4.3). */
const PRESS_OUTLINE = 'rgb(133, 115, 96)';
/** `TAP_LOCK_MS` and a little: the wait between two separate taps on a `board` board. */
const AFTER_LOCK = 450;

interface Params {
  lock: 'board' | 'target';
  layout: 'fit' | 'tall';
  disabled?: number[];
}
type E2eWindow = Window & { __hrTapBoardE2E?: { open(p: Params): void; log(): { commits: Array<{ index: number; at: number }>; controls: number } } };

async function open(page: Page, params: Params): Promise<Touchscreen> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTapBoardE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((p) => (window as E2eWindow).__hrTapBoardE2E?.open(p), params);
  await expect(page.getByTestId('tap-board')).toBeVisible();
  // The fit is measured after the first layout: wait for the board's touch-action before the first touch.
  await expect.poll(() => touchAction(page, 'tap-board')).toBe(params.layout === 'fit' ? 'pinch-zoom' : 'pan-y pinch-zoom');
  return Touchscreen.of(page);
}

const commits = async (page: Page): Promise<number[]> => (await page.evaluate(() => (window as E2eWindow).__hrTapBoardE2E!.log())).commits.map((c) => c.index);
const controls = async (page: Page): Promise<number> => (await page.evaluate(() => (window as E2eWindow).__hrTapBoardE2E!.log())).controls;
const outline = (page: Page, index: number): Promise<string> => page.getByTestId(`tap-target-${index}`).evaluate((el) => getComputedStyle(el).borderTopColor);
const touchAction = (page: Page, testId: string): Promise<string> => page.getByTestId(testId).evaluate((el) => getComputedStyle(el).touchAction);

/** Settles the click the browser sends after a touch, so a count read after it includes any echo. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(120);

test.describe('TapBoard under touch (AMENDMENTS-TOUCH KT-1)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  // Each case waits out the 400 ms lock between taps; the graze matrix alone is 15 taps.
  test.slow();

  for (const size of [
    { name: 'phone 320', width: 320, height: 640, isMobile: true },
    { name: 'tablet 820', width: 820, height: 1180, isMobile: true },
  ]) {
    test.describe(size.name, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: size.isMobile });

      test('a board on a screen that fits stops the browser pan (pinch-zoom); the screen has manipulation', async ({ page }) => {
        await open(page, { lock: 'board', layout: 'fit' });
        expect(await touchAction(page, 'tap-board-e2e')).toBe('manipulation');
        // 64 dp floor: every target and the control.
        for (const id of ['tap-target-0', 'tap-target-1', 'tap-target-2', 'tap-target-3', 'tap-control']) {
          const box = (await page.getByTestId(id).boundingBox())!;
          expect(Math.min(box.width, box.height), id).toBeGreaterThanOrEqual(64);
        }
      });

      test('T1 graze matrix: moves of 0 to 32 px on both axes each commit once', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const centre = await pointIn(page, 'tap-target-0');
        const moves = [0, 8, 16, 24, 32].flatMap((d) => [{ dx: 0, dy: d }, { dx: d, dy: 0 }, { dx: 0, dy: -d }]);
        for (const m of moves) {
          await touch.graze(centre, m.dx, m.dy);
          await page.waitForTimeout(AFTER_LOCK);
        }
        expect(await commits(page)).toEqual(moves.map(() => 0));
      });

      test('the press look shows at once on down, follows the finger out and back, and never stays', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const centre = await pointIn(page, 'tap-target-1');
        await touch.start({ id: 1, ...centre });
        await expect.poll(() => outline(page, 1)).toBe(PRESS_OUTLINE);
        await touch.move({ id: 1, x: centre.x, y: centre.y + 120 });
        await expect.poll(() => outline(page, 1)).not.toBe(PRESS_OUTLINE);
        await touch.move({ id: 1, x: centre.x, y: centre.y + 10 });
        await expect.poll(() => outline(page, 1)).toBe(PRESS_OUTLINE);
        await touch.end(1);
        await settle(page);
        await expect.poll(() => outline(page, 1)).not.toBe(PRESS_OUTLINE);
        expect(await commits(page)).toEqual([1]);
      });

      test('T2 a 40 px slide that ends 20 px past the edge commits; T3 one that ends 80 px away commits nothing', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const nearBottom = await pointIn(page, 'tap-target-0', { dx: 48, dy: 76 });
        await touch.graze(nearBottom, 0, 40);
        await page.waitForTimeout(AFTER_LOCK);
        const centre = await pointIn(page, 'tap-target-0');
        await touch.graze(centre, -80, 0);
        await settle(page);
        expect(await commits(page)).toEqual([0]);
        await expect.poll(() => outline(page, 0)).not.toBe(PRESS_OUTLINE);
      });

      test('T4 a touch in the gap 4 px from a target goes to it; T5 one exactly midway goes to nobody, not even through the browser click', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const a = (await page.getByTestId('tap-target-0').boundingBox())!;
        const b = (await page.getByTestId('tap-target-1').boundingBox())!;
        const y = a.y + a.height / 2;
        await touch.tap({ x: a.x + a.width + 4, y });
        await page.waitForTimeout(AFTER_LOCK);
        await touch.tap({ x: (a.x + a.width + b.x) / 2, y });
        await settle(page);
        expect(await commits(page)).toEqual([0]);
      });

      test('T6 a bounce: two taps 60, 150 or 300 ms apart commit once', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const centre = await pointIn(page, 'tap-target-2');
        for (const gap of [60, 150, 300]) {
          await touch.tap(centre, 20);
          await page.waitForTimeout(gap);
          await touch.tap(centre, 20);
          await page.waitForTimeout(AFTER_LOCK);
        }
        expect(await commits(page)).toEqual([2, 2, 2]);
      });

      test('T7 a target board: two different targets 150 ms apart both commit', async ({ page }) => {
        const touch = await open(page, { lock: 'target', layout: 'fit' });
        await touch.tap(await pointIn(page, 'tap-target-0'), 20);
        await page.waitForTimeout(150);
        await touch.tap(await pointIn(page, 'tap-target-1'), 20);
        await settle(page);
        expect(await commits(page)).toEqual([0, 1]);
      });

      test('T9 two fingers: the first commits when it lifts, the second does nothing', async ({ page }) => {
        const touch = await open(page, { lock: 'target', layout: 'fit' });
        const a = await pointIn(page, 'tap-target-0');
        const b = await pointIn(page, 'tap-target-1');
        await touch.start({ id: 1, ...a });
        await page.waitForTimeout(40);
        await touch.start({ id: 2, ...b });
        await page.waitForTimeout(100); // a press look would have painted by now
        await expect.poll(() => outline(page, 1)).not.toBe(PRESS_OUTLINE);
        await page.waitForTimeout(40);
        await touch.end(1);
        await page.waitForTimeout(40);
        await touch.end(2);
        await settle(page);
        expect(await commits(page)).toEqual([0]);
      });

      test('T10 a hold of 900 ms commits on release', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        await touch.tap(await pointIn(page, 'tap-target-3'), 900);
        await settle(page);
        expect(await commits(page)).toEqual([3]);
      });

      test('T16 a disabled target commits nothing and shows no press look', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit', disabled: [1] });
        const centre = await pointIn(page, 'tap-target-1');
        await touch.start({ id: 1, ...centre });
        await page.waitForTimeout(100); // a press look would have painted by now
        await expect.poll(() => outline(page, 1)).not.toBe(PRESS_OUTLINE);
        await touch.end(1);
        await settle(page);
        expect(await commits(page)).toEqual([]);
      });

      test('rule 2: a control inside the board is never claimed, even within the gap reach of a target', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const control = (await page.getByTestId('tap-control').boundingBox())!;
        // Just inside the control's edge nearest the targets.
        await touch.tap({ x: control.x + 2, y: control.y + control.height / 2 });
        await settle(page);
        expect(await controls(page)).toBe(1);
        expect(await commits(page)).toEqual([]);
      });

      test('T13 keyboard Enter on a focused target commits once through the click path', async ({ page }) => {
        await open(page, { lock: 'board', layout: 'fit' });
        await page.getByTestId('tap-target-2').focus();
        await page.keyboard.press('Enter');
        await settle(page);
        expect(await commits(page)).toEqual([2]);
      });

      test('a scrolling screen: T14 a 20 px sideways graze commits; T15 a 40 px vertical drag scrolls and commits nothing', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'tall' });
        await touch.graze(await pointIn(page, 'tap-target-0'), 20, 0);
        await page.waitForTimeout(AFTER_LOCK);
        expect(await commits(page)).toEqual([0]);
        const scroller = page.getByTestId('tap-board-e2e');
        const before = await scroller.evaluate((el) => el.scrollTop);
        await touch.graze(await pointIn(page, 'tap-target-1'), 0, -40, { steps: 8 });
        await settle(page);
        expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
        expect(await commits(page)).toEqual([0]);
        await expect.poll(() => outline(page, 1)).not.toBe(PRESS_OUTLINE);
      });
    });
  }
});
