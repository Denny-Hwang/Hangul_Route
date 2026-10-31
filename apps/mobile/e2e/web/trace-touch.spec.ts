import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, openLettersEpisode, passDiscover } from './helpers';
import { Finger, canvasBox, paths } from './trace-fingers';
import { expectReachable } from './viewport';

/**
 * AMENDMENTS-TOUCH KT-8 (6.8, KT-D9, R1) on Trace: a trace stroke starts after 4 px (`spacing.xs`)
 * instead of the gesture handler's 15 px, and a touch that never travelled 4 px leaves no ink and
 * re-arms the idle check. Real touches through CDP `Input.dispatchTouchEvent` (the Pixel 5 profile has
 * `hasTouch`), at 320 px and on a tablet, on the release build. Trace a Word's touch tests need the
 * fixture bundle and are in `trace-word-touch.spec.ts`.
 *
 * Trace (one letter) is reached through Meet the Letters, quest 2, as in `layout.spec.ts`.
 */

const STROKE_CANVAS = '#trace-canvas';

async function openTraceStroke(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  const start = page.getByRole('button', { name: "Let's start" });
  await expectReachable(page, start);
  await start.click();
  await completeChildForm(page, { name: 'Tia' });
  await page.goto('/');
  await expect(page.getByText('Hi, Tia!')).toBeVisible();
  // Journey → Meet the Letters → quest 2 → skip to its Trace game (as layout.spec.ts).
  await openLettersEpisode(page);
  await page.getByRole('button', { name: 'Start' }).nth(1).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByText('Trace Each Letter')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText(/^Trace the letter /)).toBeVisible();
}

for (const vp of [
  { name: 'phone 320', width: 320, height: 640 },
  { name: 'tablet 820', width: 820, height: 1180 },
]) {
  test.describe(`Trace touch, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('a dot leaves no ink, a 6 px stroke draws, and a dot after a stroke still lets the idle check score it', async ({ page }) => {
      await openTraceStroke(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, STROKE_CANVAS);
      const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const ghosts = await paths(page, STROKE_CANVAS);
      const border = (): Promise<string> => page.locator(STROKE_CANVAS).evaluate((el) => getComputedStyle(el).borderTopColor);
      const live = await border();

      await finger.dot(mid);
      await page.waitForTimeout(100);
      expect(await paths(page, STROKE_CANVAS), 'a dot leaves no ink').toBe(ghosts);
      await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();

      await finger.drag({ x: box.x + box.width * 0.2, y: mid.y }, { x: box.x + box.width * 0.2 + 6, y: mid.y + 6 }, 3);
      await expect.poll(() => paths(page, STROKE_CANVAS), { message: 'a 6 px stroke draws' }).toBe(ghosts + 1);

      // A stray tap right after: no ink, and the drawing is still scored without Done.
      await finger.dot({ x: box.x + box.width * 0.8, y: box.y + box.height * 0.8 });
      await page.waitForTimeout(100);
      expect(await paths(page, STROKE_CANVAS)).toBe(ghosts + 1);
      await expect.poll(border, { timeout: 5_000, message: 'the idle check scored the drawing' }).not.toBe(live);
    });
  });
}
