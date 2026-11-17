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

test('no word reuses a card picture, and the card-art sheet draws all 60 real cards at 200, 64 and 54 px', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/word-art');
  await expect(page.getByRole('heading', { level: 2, name: 'Card-art reuses' })).toBeVisible();
  await expect(page.getByTestId('card-reuse')).toHaveCount(0);
  await expect(page.getByTestId('card-reuse-none')).toBeVisible();
  await page.getByTestId('card-reuse-none').getByRole('link', { name: 'card-art sheet' }).click();
  await expect(page).toHaveURL(/\/design-preview\/cards$/);
  await expect(page.getByTestId('card-art')).toHaveCount(60);
  for (const id of ['card:kimchi', 'card:won']) {
    const cell = page.locator(`[data-testid="card-art"][data-card="${id}"]`);
    const sizes = await cell.locator('svg[viewBox="0 0 200 200"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(sizes).toEqual([200, 64, 54]);
    expect(await cell.locator('svg[viewBox="0 0 200 200"]').first().locator('path, circle, ellipse, rect').count()).toBeGreaterThan(3);
  }
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
