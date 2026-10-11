import { expect, test } from '@playwright/test';
import { onboardChild, unlockWithPin } from './helpers';

/**
 * F-SYNC-002 §3.3 — the server-less path: export a backup file, then
 * restore it on a fresh device (new browser context) and get the learner back.
 */
test('backup file round-trips a learner between two devices', async ({ browser }) => {
  const deviceA = await browser.newContext();
  const a = await deviceA.newPage();
  await onboardChild(a, { name: 'Yuna' });
  await expect(a.getByRole('button', { name: 'Continue' })).toBeVisible();
  await a.goto('/');
  await expect(a.getByText('Hi, Yuna!')).toBeVisible();

  // Settings → Back up to a file → a .hangulroute.json download.
  await a.getByRole('button', { name: 'Profile and settings' }).click();
  const download = a.waitForEvent('download');
  await a.getByRole('button', { name: 'Back up to a file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^hangul-route-yuna-\d{4}-\d{2}-\d{2}\.hangulroute\.json$/);
  // Downloads are deleted with their context — copy it out first.
  const path = test.info().outputPath('yuna.hangulroute.json');
  await file.saveAs(path);
  await deviceA.close();

  // Device B: onboard a different learner, then restore Yuna from the file.
  const deviceB = await browser.newContext();
  const b = await deviceB.newPage();
  await onboardChild(b, { name: 'Bo' });
  await b.goto('/');
  await b.getByRole('button', { name: 'Profile and settings' }).click();
  await b.getByRole('button', { name: 'Restore from a file (grown-ups only)' }).click();
  // The grown-up PIN was created in the onboarding form (F-LEARN-001 §3.3): the gate asks for it.
  await unlockWithPin(b);
  await expect(b.getByRole('heading', { name: 'Bring back progress' })).toBeVisible();
  const chooser = b.waitForEvent('filechooser');
  await b.getByRole('button', { name: 'Open a saved file' }).click();
  await (await chooser).setFiles(path);
  await expect(b.getByTestId('restore-notice')).toBeVisible();
  await expect(b.getByText('Welcome back, Yuna! Your journey is here.')).toBeVisible();
  await b.getByRole('button', { name: 'Great' }).click();
  await b.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(b.getByRole('button', { name: 'Switch to Yuna' })).toBeVisible();
  await deviceB.close();
});
