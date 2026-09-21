import { expect, test } from '@playwright/test';

/**
 * F-PWA-001 §3.1 — the install guide appears on the third open of a browser
 * tab once the app is cached, and a dismissal snoozes it.
 */
test('install guide shows on the third cached open and snoozes on dismiss', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText("Hi! I'm Hoya.")).toBeVisible();
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByPlaceholder('Type your name').fill('Mina');
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  // Opens 2 and 3 → the guide may show on Home from the third open.
  await page.reload();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await expect(page.getByTestId('install-guide')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await expect(guide).toBeVisible();
  await expect(guide.getByText('Ask a grown-up to add me to your home screen.')).toBeVisible();

  // Home stays usable underneath; "Not now" hides it for the next opens.
  await guide.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByTestId('install-guide')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await expect(page.getByTestId('install-guide')).toHaveCount(0);
});
