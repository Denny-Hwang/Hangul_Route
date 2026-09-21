import { expect, test } from '@playwright/test';

/**
 * F-SYNC-002 §3.3 — the server-less path: export a backup file, then
 * restore it on a fresh device (new browser context) and get the learner back.
 */
test('backup file round-trips a learner between two devices', async ({ browser }) => {
  const deviceA = await browser.newContext();
  const a = await deviceA.newPage();
  await a.goto('/');
  await a.getByRole('button', { name: "Let's start" }).click();
  await a.getByPlaceholder('Type your name').fill('Yuna');
  await a.getByRole('checkbox').click();
  await a.getByRole('button', { name: 'Continue' }).click();
  await a.getByRole('button', { name: 'Start my journey' }).click();
  await expect(a.getByRole('button', { name: 'Continue' })).toBeVisible();
  await a.goto('/');
  await expect(a.getByText('Hi, Yuna!')).toBeVisible();

  // Settings → Back up to a file → a .hangulroute.json download.
  await a.getByRole('button', { name: 'Profiles and settings' }).click();
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
  await b.goto('/');
  await b.getByRole('button', { name: "Let's start" }).click();
  await b.getByPlaceholder('Type your name').fill('Bo');
  await b.getByRole('checkbox').click();
  await b.getByRole('button', { name: 'Continue' }).click();
  await b.getByRole('button', { name: 'Start my journey' }).click();
  await b.goto('/');
  await b.getByRole('button', { name: 'Profiles and settings' }).click();
  await b.getByRole('button', { name: 'Restore from a file (grown-ups only)' }).click();
  // First grown-up entry creates the PIN (F-PROF-001 §10): 1234, twice.
  for (const round of [0, 1]) {
    for (const d of ['1', '2', '3', '4']) await b.getByRole('button', { name: `Digit ${d}` }).click();
    await b.getByRole('button', { name: 'Next' }).click();
    if (round === 0) await expect(b.getByText('Enter it once more')).toBeVisible();
  }
  await expect(b.getByRole('heading', { name: 'Restore from a file' })).toBeVisible();
  const chooser = b.waitForEvent('filechooser');
  await b.getByRole('button', { name: 'Choose a backup file' }).click();
  await (await chooser).setFiles(path);
  await expect(b.getByTestId('restore-notice')).toBeVisible();
  await expect(b.getByText('Welcome back, Yuna! Your journey is here.')).toBeVisible();
  await b.getByRole('button', { name: 'Done' }).click();
  await b.getByRole('button', { name: 'Profiles and settings' }).click();
  await expect(b.getByRole('button', { name: 'Switch to Yuna' })).toBeVisible();
  await deviceB.close();
});
