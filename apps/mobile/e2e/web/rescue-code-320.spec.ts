import { expect, test, type Page } from '@playwright/test';

/**
 * SEC-5: Rescue Codes grew from two words + four digits to four words + six
 * digits. The two screens that take or show a code (sync/restore,
 * sync/save-progress) must still work on the narrowest phone we support
 * (320 px) with the longest code the generator can draw: four 10-letter words.
 */
test.use({ viewport: { width: 320, height: 640 } });

const LONGEST = 'LIGHTHOUSE-SUNFLOWER-LIGHTHOUSE-SUNFLOWER-482139';

async function onboard(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByPlaceholder('Type your name').fill(name);
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
}

/** First grown-up entry creates the PIN (F-PROF-001 §10): 1234, twice. */
async function createPin(page: Page): Promise<void> {
  for (const round of [0, 1]) {
    for (const d of ['1', '2', '3', '4']) await page.getByRole('button', { name: `Digit ${d}` }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
  }
}

/** What a device looks like after its first cloud save: the sync record (idb-keyval) carries the code. */
function seedRescueCode(page: Page, code: string): Promise<void> {
  return page.evaluate(
    (rescueCode) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const profiles = store.get('hr:profiles');
          profiles.onsuccess = () => {
            const learnerId = (JSON.parse(String(profiles.result)) as Array<{ id: string }>)[0]?.id;
            store.put(JSON.stringify({ secret: 'x'.repeat(64), rev: 1, lastSyncedAt: new Date().toISOString(), rescueCode }), `hr:sync:${learnerId}`);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    code,
  );
}

test('sync/restore: the whole longest code is visible in the field, wrapped, with no sideways scroll', async ({ page }) => {
  await onboard(page, 'Dami');
  await page.getByRole('button', { name: 'Profiles and settings' }).click();
  await page.getByRole('button', { name: 'Restore from a file (grown-ups only)' }).click();
  await createPin(page);
  await page.getByRole('button', { name: 'I have a rescue code' }).click();

  const field = page.getByTestId('rescue-code-input');
  await field.pressSequentially(LONGEST.replaceAll('-', ' '));
  await expect(field).toHaveValue(LONGEST.replaceAll('-', ' '));

  const fit = await field.evaluate((el) => ({
    clipped: el.scrollHeight > el.clientHeight, // text taller than the box: the last row would be hidden
    sideways: el.scrollWidth > el.clientWidth,
    pageSideways: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(fit).toEqual({ clipped: false, sideways: false, pageSideways: false });

  // the older shape types in just as well
  await field.fill('');
  await field.pressSequentially('paddle glacier 4992');
  await expect(field).toHaveValue('PADDLE GLACIER 4992');
});

test('sync/save-progress: a code is shown one word per row — no word breaks mid-way, nothing scrolls sideways', async ({ page }) => {
  await onboard(page, 'Dami');
  await seedRescueCode(page, LONGEST);
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByRole('button', { name: 'Profiles and settings' }).click();
  await page.getByRole('button', { name: /Save my progress/ }).click();
  await createPin(page);

  const card = page.getByTestId('rescue-code');
  await expect(card).toBeVisible();
  await expect(card).toContainText('four words + 6 digits');
  const rows = await card.getByRole('heading').evaluate((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return {
      lines: Math.round(el.getBoundingClientRect().height / lineHeight),
      sideways: el.scrollWidth > el.clientWidth,
      pageSideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  // four words + the number = five rows; a word that did not fit would add a sixth
  expect(rows).toEqual({ lines: 5, sideways: false, pageSideways: false });
});
