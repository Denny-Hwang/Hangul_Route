import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardSelf, openLettersEpisode, seedStored } from './helpers';
import { closeInstallGuide, expectNoSidewaysScroll } from './text-fit';

/**
 * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE row TC-1b: the trace page of Discover, "Trace the new letters", on quest 1 (ㅏ ㅓ ㄱ ㄴ).
 * A finished letter is drawn with the mouse on `#trace-canvas`; nothing is scored; Next letter passes a letter; Continue goes
 * on to Match the Sound. The sizes of the page at every window are in `layout.spec.ts`.
 */

const PRAISE = 'Beautiful! That looks like the letter.';

async function toTracePage(page: Page, name: string, textSize?: 'largest'): Promise<void> {
  await onboardSelf(page, { name, startJourney: false });
  if (textSize) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
  await openLettersEpisode(page);
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // The two letter pages, then the trace page (page 3 of 3).
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('discover-write-heading')).toHaveAttribute('aria-label', 'Trace the letter a');
}

/** One stroke of a letter's skeleton (viewBox 200) drawn with the mouse across the canvas. */
async function drawStroke(page: Page, points: ReadonlyArray<readonly [number, number]>): Promise<void> {
  const box = (await page.locator('#trace-canvas').boundingBox())!;
  const at = ([x, y]: readonly [number, number]): { x: number; y: number } => ({ x: box.x + (box.width * x) / 200, y: box.y + (box.height * y) / 200 });
  await page.mouse.move(at(points[0]!).x, at(points[0]!).y);
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(at(p).x, at(p).y, { steps: 10 });
  await page.mouse.up();
}

test('quest 1 trace page: a finished ㄱ is praised and the next letter comes up; Next letter passes one; Continue goes on', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toTracePage(page, 'Tia');

  // It opens quiet: three pages, the first letter, the idle line, a canvas at least 160 wide that never scrolls.
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-write-line')).toHaveText('Trace each line slowly.');
  const canvas = page.locator('#trace-canvas');
  expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(160);
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);

  // Next letter twice: ㅏ and ㅓ are passed over, never marked.
  await page.getByRole('button', { name: 'Next letter' }).click();
  await expect(page.getByTestId('discover-write-heading')).toHaveAttribute('aria-label', 'Trace the letter eo');
  await page.getByRole('button', { name: 'Next letter' }).click();
  await expect(page.getByTestId('discover-write-heading')).toHaveAttribute('aria-label', 'Trace the letter g or k');
  await expect(page.getByTestId('discover-write-done-jamo:a')).toHaveCount(0);

  // A finished ㄱ (one stroke: across, then down): praise after a pause, the chip fills, then ㄴ comes up.
  await drawStroke(page, [[40, 50], [160, 50], [160, 150]]);
  await expect(page.getByTestId('discover-write-live-line')).toHaveText(PRAISE, { timeout: 5_000 });
  await expect(page.getByTestId('discover-write-done-jamo:giyeok')).toBeVisible();
  await expect(page.getByTestId('discover-write-heading')).toHaveAttribute('aria-label', 'Trace the letter n', { timeout: 5_000 });
  // The last letter has no Next letter; Continue is the way on.
  await expect(page.getByRole('button', { name: 'Next letter' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('Largest text on 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quest 1 trace page at Largest text on 390 x 844: the canvas is at least 160 and every control is on screen', async ({ page }) => {
    test.setTimeout(90_000);
    await toTracePage(page, 'Lia', 'largest');
    const canvas = page.locator('#trace-canvas');
    await expect(canvas).toBeInViewport({ ratio: 1 });
    expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(160);
    for (const name of ['Hear it', 'Show me', 'Clear', 'Next letter', 'Previous', 'Continue']) {
      await expect(page.getByRole('button', { name, exact: false }).first(), name).toBeInViewport({ ratio: 1 });
    }
    await expectNoSidewaysScroll(page, 'the trace page at Largest');
  });
});
