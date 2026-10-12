import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.6 (design/components/CardArt/spec.md): every screen that
 * draws an owned card draws `CardArt`, one square face named "Card art for
 * <title>", in the Library tile and on the card page; a locked card keeps its
 * lock panel and draws no face. Which face (drawing, cover crop, plate or the
 * Korean word) is unit-tested in logic/__tests__/card-art.test.ts.
 */

/** A new learner (who holds Hoya's welcome card), on the Library tab. */
async function newLearnerLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
}

/** The visible square faces named for a card (the Library stays mounted under the card page). */
function faces(page: Page, title: string) {
  return page.locator(`[aria-label="Card art for ${title}"]`).filter({ visible: true });
}

test('an owned card shows one square face on its tile and its card page; a locked card shows none', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await newLearnerLibrary(page);

  // The welcome card's tile carries its face, a square.
  const tile = page.getByRole('button', { name: /^Tiger(\. New)?$/ });
  await expect(tile).toBeVisible();
  const tileFace = faces(page, 'Tiger').first();
  await expect(tileFace).toBeVisible();
  const tileBox = (await tileFace.boundingBox())!;
  expect(Math.abs(tileBox.width - tileBox.height)).toBeLessThanOrEqual(1);
  expect(tileBox.width).toBeGreaterThan(0);
  await tile.scrollIntoViewIfNeeded();
  await shot(page, 'card-art-library');

  // The card page front: a 200 square face.
  await tile.click();
  await expect(page.getByRole('button', { name: 'Tap to flip card to back' })).toBeVisible();
  const pageFace = faces(page, 'Tiger').last();
  await expect(pageFace).toBeVisible();
  const pageBox = (await pageFace.boundingBox())!;
  expect(Math.round(pageBox.width)).toBe(200);
  expect(Math.round(pageBox.height)).toBe(200);
  await shot(page, 'card-art-card-page');

  // A locked card page keeps its lock and never draws a face.
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters' }).first().click();
  await expect(page.getByText('How to earn it')).toBeVisible();
  // The card page covers the Library, so no face is on screen at all.
  await expect(page.locator('[aria-label^="Card art for"]').filter({ visible: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
