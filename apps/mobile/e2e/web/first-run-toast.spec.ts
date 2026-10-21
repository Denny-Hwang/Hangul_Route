import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { acceptConfirmSheets, agreeOnPrivacy, answerForkNew, headerBack, headerClose, WHO_CHILD } from './helpers';

/**
 * The offline-ready toast on a first visit (PwaBanners, `logic/pwa/banners`). It used to show for six seconds at the
 * top of Welcome and Steps 1 to 3, over the screen title and the step label, while a new learner read them. Now,
 * while no learner profile exists, it is queued and shown once on the first Home, above the tab bar, for four
 * seconds. Checked at the smallest phone the app supports (320x568).
 */

const TOAST = 'All set! You can play without Wi-Fi now.';

type Box = { x: number; y: number; width: number; height: number };

/** Two boxes share no pixel. */
function apart(a: Box, b: Box): boolean {
  return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

/** The toast box, when it is drawn, never meets the screen's title or step label. */
async function toastClearOf(page: Page, testIdOrText: { testId: string } | { text: string | RegExp }): Promise<void> {
  const target = 'testId' in testIdOrText ? page.getByTestId(testIdOrText.testId) : page.getByText(testIdOrText.text).first();
  await expect(target).toBeVisible();
  const banners = page.getByTestId('pwa-banners');
  if ((await banners.count()) === 0) return;
  const toast = await banners.boundingBox();
  const title = await target.boundingBox();
  if (toast && title) expect(apart(toast, title), 'toast clear of the title').toBe(true);
}

/** Fires the service worker's offline-ready event, as `pwa-postbuild` does once the app is cached. */
async function offlineReady(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('hr:offline-ready')));
  // Give the banner a frame to draw if it were going to.
  await page.waitForTimeout(300);
}

test.use({ viewport: { width: 320, height: 568 } });

test('a first visit: the offline toast never covers Welcome or Steps 1 to 3 and shows once on the first Home', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('heading', { name: "Hi! I'm Hoya." });
  await expect(welcome).toBeVisible();
  await offlineReady(page);
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await toastClearOf(page, { text: "Hi! I'm Hoya." });

  await page.getByRole('button', { name: "Let's start" }).click();
  // Step 1, Who is learning?
  await expect(page.getByTestId('create-profile-heading')).toContainText('Step 1');
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await toastClearOf(page, { testId: 'create-profile-heading' });

  await page.getByRole('radio', { name: WHO_CHILD }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Step 2, the name and the cub.
  await expect(page.getByTestId('create-profile-heading')).toContainText('Step 2');
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await toastClearOf(page, { testId: 'create-profile-heading' });
  await page.getByPlaceholder('Type a name').fill('Mina');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3, Privacy.
  await expect(page.getByTestId('create-profile-heading')).toContainText('Step 3');
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await toastClearOf(page, { testId: 'create-profile-heading' });
  await agreeOnPrivacy(page, 'child');
  await page.getByRole('button', { name: 'Continue' }).click();

  // The profile exists now, but the fork, the preview and the first quest still come before Home: the toast waits.
  await expect(page.getByTestId('placement-invite')).toBeVisible();
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await answerForkNew(page);
  await expect(page.getByText('Your first card is waiting.')).toBeVisible();
  await expect(page.getByText(TOAST)).toHaveCount(0);
  await page.getByRole('button', { name: 'Start my journey' }).click();
  const leave = headerClose(page);
  await expect(leave).toBeVisible();
  await expect(page.getByText(TOAST)).toHaveCount(0);

  // Leaving the quest opens its lesson page (no tab bar): the toast still waits.
  await acceptConfirmSheets(page);
  await leave.click();
  await expect(leave).toHaveCount(0);
  await expect(headerBack(page)).toBeVisible();
  await expect(page.getByText(TOAST)).toHaveCount(0);

  // The first Home: the toast shows once, above the tab bar, clear of the greeting.
  await headerBack(page).click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await expect(page.getByText(TOAST)).toBeVisible();
  await toastClearOf(page, { text: 'Hi, Mina!' });
  const toast = (await page.getByTestId('pwa-banners').boundingBox())!;
  const tabBar = (await page.getByRole('tablist').boundingBox())!;
  expect(toast.y + toast.height, 'toast clears the tab bar').toBeLessThanOrEqual(tabBar.y);
  // Four seconds, then it is gone and does not come back.
  await expect(page.getByText(TOAST)).toHaveCount(0, { timeout: 6000 });
  await page.waitForTimeout(1000);
  await expect(page.getByText(TOAST)).toHaveCount(0);
});

