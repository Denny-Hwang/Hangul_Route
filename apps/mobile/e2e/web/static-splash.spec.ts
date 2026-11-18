import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The static splash of the HTML shell (AMENDMENTS-FINISH-2026-11 FN-2, design/screens/static-splash): the page paints
 * the brand mark, the app name and one Loading line before the start bundle runs, in the device's chosen language
 * (the record's synchronous mirror) or the browser's, and the app's first frame removes it, on the learner app and on
 * the presenter alike (both are this index.html).
 */

const START_BUNDLE = /\/_expo\/static\/js\/web\/index-[0-9a-f]{32}\.js$/;

/** Holds the start bundle back, so the page shows what the HTML alone paints. */
async function holdStartBundle(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(START_BUNDLE, async (route: Route) => {
    await held;
    await route.continue();
  });
  return release;
}

test('the HTML alone paints the splash in English, and the first frame of the app removes it', async ({ page }) => {
  const release = await holdStartBundle(page);
  await page.goto('/');
  const splash = page.locator('#hr-splash');
  await expect(splash).toBeVisible();
  await expect(splash.getByText('Hangul Route')).toBeVisible();
  await expect(splash.getByText('Loading', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  release();
  await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
  await expect(splash).toHaveCount(0);
});

test('the splash speaks the language the device chose before, over the browser language', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('hr:console:uiLocale', 'ko'));
  const release = await holdStartBundle(page);
  await page.goto('/');
  await expect(page.locator('#hr-splash').getByText('불러오는 중')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('ko');
  release();
});

test.describe('a Spanish browser with no choice stored', () => {
  test.use({ locale: 'es-MX' });

  test('the splash detects Spanish', async ({ page }) => {
    const release = await holdStartBundle(page);
    await page.goto('/');
    await expect(page.locator('#hr-splash').getByText('Cargando')).toBeVisible();
    release();
  });
});

test('reduced motion: nothing on the splash moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const release = await holdStartBundle(page);
  await page.goto('/');
  const animation = await page.locator('#hr-splash .hr-splash-line').evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const moving = await page.locator('#hr-splash .hr-splash-line').evaluate((el) => getComputedStyle(el).animationName);
  expect(moving).toBe('hr-splash-breathe');
  release();
});

test('a language chosen in the app is mirrored for the next splash', async ({ page }) => {
  await page.goto('/?lang=es');
  await expect(page.getByRole('button', { name: '¡Empecemos!' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('hr:console:uiLocale'))).toBe('es');
  await expect(page.locator('#hr-splash')).toHaveCount(0);
});

test('the presenter removes the splash on its first frame too', async ({ page }) => {
  await page.goto('/present');
  await expect(page.getByTestId('presenter-home')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#hr-splash')).toHaveCount(0);
});
