import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';

/**
 * F-LEARN-001 §3.6 (L10, L11): the learner's own cub is drawn in the colour
 * its avatar NAME says, on the Home Profile entry and the profile switcher —
 * not in the Pillar theme colour PR #95 used for the ring (hoya-blue's theme
 * tint is gold). Hex values are design/tokens/colors.v1.md `hoya.furBlue` and
 * `hoya.furBlueDark`.
 */
const FUR_BLUE = '#4891CB';
const FUR_BLUE_DARK_RGB = 'rgb(46, 106, 158)'; // #2E6A9E
const THEME_LIFE_RGB = 'rgb(242, 179, 61)'; // theme.life, what the ring used to be

async function onboardWithBlueCub(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dani', avatar: 'Home Tiger' });
  // The helper waits until the profile is saved; a fresh load opens Home for it.
  await page.goto('/');
}

/** Fill of the cub's head circle (r=44 in the 128 viewBox) inside `scope`. */
async function headFill(scope: ReturnType<Page['locator']>): Promise<string | null> {
  return scope.locator('svg circle[r="44"]').first().getAttribute('fill');
}

test('Home entry and switcher draw the learner’s own blue cub, ringed in its own colour', async ({ page }) => {
  await onboardWithBlueCub(page);

  const entry = page.getByRole('button', { name: 'Profile and settings' });
  await expect(entry).toBeVisible();
  await expect(entry.getByText('Profile', { exact: true })).toBeVisible();

  // Cub body is the blue fur, the guide Hoya beside the greeting stays gold.
  expect((await headFill(entry))?.toUpperCase()).toBe(FUR_BLUE);
  const guide = page.locator('svg[aria-label="Hoya the tiger, waving"]');
  expect((await guide.locator('circle[r="44"]').first().getAttribute('fill'))?.toUpperCase()).toBe('#F2B33D');

  // Ring: the variant's shade, not the Pillar theme tint.
  const ring = entry.locator('div').filter({ has: page.locator('svg') }).first();
  const border = await ring.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(border).not.toBe(THEME_LIFE_RGB);
  expect(border).toBe(FUR_BLUE_DARK_RGB);

  // The cub is decorative: hidden from assistive tech, the control is named only "Profile and settings".
  await expect(entry.locator('[aria-hidden="true"] svg')).toHaveCount(1);

  // Switcher card carries the same blue cub.
  await entry.click();
  const card = page.getByRole('button', { name: 'Switch to Dani' });
  await expect(card).toBeVisible();
  expect((await headFill(card))?.toUpperCase()).toBe(FUR_BLUE);
});
