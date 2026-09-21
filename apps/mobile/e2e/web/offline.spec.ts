import { expect, test } from '@playwright/test';

/**
 * PWA acceptance (roadmap web-pwa-offline P2): after one online visit the
 * whole Stage 1 shell must load and play with the network gone.
 */
test('onboards, enters the first quest, and keeps working offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.getByText("Hi! I'm Hoya.")).toBeVisible();

  // Onboarding: name + consent → first-quest preview → quest player.
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByPlaceholder('Type your name').fill('Suni');
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your first card is waiting.')).toBeVisible();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  // Wait until the service worker has finished precaching AND controls this
  // page (clientsClaim); `reg.active` alone can be true a tick before the
  // claim lands, and a reload in that gap goes to the (dead) network.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active && !!navigator.serviceWorker.controller;
  });
  await context.setOffline(true);
  await page.reload();
  // Profile persisted (IndexedDB) → app reopens on the learner surface, offline.
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByText(/collected/)).toBeVisible();

  expect(errors).toEqual([]);
});
