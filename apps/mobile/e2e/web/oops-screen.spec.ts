import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, seedStored } from './helpers';

/**
 * The crash screen ("Hoya tripped over a rock") after a lesson chunk cannot load: Try again, its only way out, is in
 * view without scrolling at 320 x 568, at the default text and at the largest step. The service worker is blocked
 * and every lesson body chunk fails, so opening a Stage 2 quest throws to the crash screen.
 */
test.use({ serviceWorkers: 'block', viewport: { width: 320, height: 568 } });

for (const textSize of ['default', 'largest'] as const) {
  test(`Try again is fully in view on the crash screen at 320 x 568, ${textSize} text`, async ({ page }) => {
    await page.route(/lessons-cell-.*\.js/, (route) => route.abort('failed'));
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Dami' });
    if (textSize === 'largest') await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: /^Stage 2 [^,]+, Letters/ }).first().click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();

    await expect(page.getByText('Hoya tripped over a rock.')).toBeVisible();
    const again = page.getByRole('button', { name: 'Try again' });
    await expect(again).toBeVisible();
    const box = await again.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(568);
    await page.screenshot({ path: test.info().outputPath(`oops-320x568-${textSize}.png`) });

    // Try again returns to Home.
    await again.click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
  });
}
