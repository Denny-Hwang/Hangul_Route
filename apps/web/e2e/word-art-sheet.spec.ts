import { expect, test, type Page } from '@playwright/test';

/**
 * WordArt contact-sheet smoke (F-VOC-002 §3.10): /design-preview/word-art
 * renders one card per glyph without a console error, draws the sprite at
 * 160 px, and `?topic=` keeps only that family's cards. Runs over the static
 * export.
 */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('the contact sheet shows every glyph, drawn at 160 px, with no console error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/word-art');
  await expect(page.getByRole('heading', { level: 1, name: 'WordArt: contact sheet' })).toBeVisible();
  const glyphs = Number(await page.getByTestId('count-glyphs').innerText());
  expect(glyphs).toBeGreaterThan(0);
  await expect(page.getByTestId('word-art-card')).toHaveCount(glyphs);
  const main = await page.locator('[data-testid="word-art-card"] [role="img"] svg').first().boundingBox();
  expect(main?.width).toBe(160);
  expect(main?.height).toBe(160);
  // the sprite symbol paints: the 160 px drawing has visible shapes
  const painted = await page.locator('[data-testid="word-art-card"] [role="img"] use').first().evaluate((el) => (el as SVGGraphicsElement).getBBox().width);
  expect(painted).toBeGreaterThan(10);
  expect(await page.locator('body').innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(errors).toEqual([]);
});

test('?topic= keeps only that family and marks its filter link', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/word-art?topic=food');
  const link = page.getByRole('link', { name: /^food \(\d+\)$/ });
  await expect(link).toHaveAttribute('aria-current', 'page');
  const n = Number(/\((\d+)\)/.exec(await link.innerText())?.[1]);
  await expect(page.locator('[data-testid="word-art-card"]:visible')).toHaveCount(n);
  for (const family of await page.locator('[data-testid="word-art-card"]:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-family')))) {
    expect(family).toBe('food');
  }
  await page.getByRole('link', { name: /^All \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/\/design-preview\/word-art$/);
  const glyphs = Number(await page.getByTestId('count-glyphs').innerText());
  await expect(page.locator('[data-testid="word-art-card"]:visible')).toHaveCount(glyphs);
  expect(errors).toEqual([]);
});

test('the card-art reuses draw the real heritage card art at 96 and 64 px', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/word-art');
  await expect(page.getByRole('heading', { level: 2, name: 'Card-art reuses' })).toBeVisible();
  const reuse = page.locator('[data-testid="card-reuse"][data-card="card:rice"]');
  await expect(reuse).toBeVisible();
  const sizes = await reuse.locator('svg[viewBox="0 0 200 200"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(sizes).toEqual([96, 64, 96, 64, 96, 64]);
  expect(await reuse.locator('path, circle, ellipse').count()).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test('fits a 320 px screen with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/design-preview/word-art');
  await expect(page.getByTestId('word-art-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('the design preview links the contact sheet', async ({ page }) => {
  await page.goto('/design-preview');
  await page.getByRole('link', { name: '→ Word pictures (contact sheet)' }).click();
  await expect(page).toHaveURL(/\/design-preview\/word-art\/?$/);
});
