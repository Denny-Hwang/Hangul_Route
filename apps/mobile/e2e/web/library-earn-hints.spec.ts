import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.5b (wireframe library/earn-hints F): the Library counts
 * the cards collected with no total, every locked tile says how it is earned,
 * a card earned since the last visit wears "New" until it is opened, and the
 * explainer says only what this build can do.
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

/** The saved progress record's "New" flag of the welcome card, read straight from IndexedDB (idb-keyval). */
function savedTigerIsNew(page: Page): Promise<boolean | null> {
  return page.evaluate(
    () =>
      new Promise<boolean | null>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve(null);
            return;
          }
          const all = db.transaction('keyval').objectStore('keyval').getAll();
          all.onerror = () => resolve(null);
          all.onsuccess = () => {
            db.close();
            const record = (all.result as unknown[]).map(String).find((v) => v.includes('"card:tiger"'));
            if (!record) return resolve(null);
            const snap = JSON.parse(record) as { cards: { cardId: string; newSinceLastView: boolean }[] };
            resolve(snap.cards.find((c) => c.cardId === 'card:tiger')?.newSinceLastView ?? null);
          };
        };
      }),
  );
}

test('a plain count, earn hints on locked tiles, an honest explainer, and New until opened', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await newLearnerLibrary(page);

  // A plain count: no "N of M", no N/M pill.
  await expect(page.getByText('1 card collected', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ collected|^\d+\/\d+$/)).toHaveCount(0);

  // A locked tile says how it is earned, in its label and on the tile.
  const hanji = page.getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters' }).first();
  await expect(hanji).toBeVisible();
  await expect(hanji).toContainText('Finish the episode: Meet the Letters');
  await expect(page.getByRole('button', { name: 'Locked card. Finish every quest in Stage 1' }).first()).toBeVisible();
  await expect(page.getByText('Locked', { exact: true })).toHaveCount(0);

  // The explainer: one line per rule this build can fire, the story line too since the launch stories
  // are reviewed (F-STORY-001 PR 1.9).
  for (const line of [
    'Finish a quest to earn its card.',
    'Finish a story to earn its card.',
    'Finish every quest in an episode to earn more cards.',
    'Finish all of Stage 1 for the legendary cards.',
    "Hoya's tiger card is a welcome gift.",
  ]) {
    await expect(page.getByText(line, { exact: true })).toBeVisible();
  }

  // The welcome card is new until it is opened.
  const tigerNew = page.getByRole('button', { name: 'Tiger. New', exact: true });
  await expect(tigerNew).toBeVisible();
  await expect(tigerNew.getByText('New', { exact: true })).toBeVisible();
  await shot(page, 'library-earn-hints');
  await tigerNew.scrollIntoViewIfNeeded();
  await shot(page, 'library-new-pill');
  await page.getByText('How to collect more').scrollIntoViewIfNeeded();
  await shot(page, 'library-explainer');
  await tigerNew.click();
  await expect(page.getByRole('button', { name: 'Tap to flip card to back' })).toBeVisible();
  // Seen is saved (wait for the write to land), so after a fresh open the pill is gone.
  await expect.poll(() => savedTigerIsNew(page)).toBe(false);
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Tiger', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiger. New', exact: true })).toHaveCount(0);

  // A locked card page names its hint and says how to earn it.
  await page.getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters' }).first().click();
  await expect(page.getByText('How to earn it')).toBeVisible();
  // The Library stays mounted under the card page: look at what is on screen.
  await expect(page.getByText('Finish the episode: Meet the Letters', { exact: true }).filter({ visible: true }).last()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters', exact: true }).filter({ visible: true }).last(),
  ).toBeVisible();
  await shot(page, 'library-locked-card');
  expect(errors).toEqual([]);
});

test('320 wide: tiles and hints fit with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await newLearnerLibrary(page);
  await expect(page.getByText('1 card collected', { exact: true })).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
  const tile = page.getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters' }).first();
  const box = (await tile.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(64);
  await shot(page, 'library-earn-hints-320');
});
