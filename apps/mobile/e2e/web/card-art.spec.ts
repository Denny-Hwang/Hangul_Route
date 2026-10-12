import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.6 (design/components/CardArt/spec.md): every screen that
 * draws an owned card draws `CardArt`, one square face named "Card art for
 * <title>", in the Library tile and on the card page; a locked card keeps its
 * lock panel and draws no face. A stage-2 card with no drawing (Apple, 사과)
 * shows the Korean-word face, at 320 wide and in the wide split pane. Which
 * face (drawing, cover crop, plate or the Korean word) is unit-tested in
 * logic/__tests__/card-art.test.ts.
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

/**
 * Give the learner a card they could earn in a stage-2 episode, straight into
 * the saved progress record (idb-keyval), then reload so it is read back.
 * Only adds a card: nothing the learner holds is taken away.
 */
async function holdCard(page: Page, cardId: string): Promise<void> {
  const saved = await page.evaluate(
    (id) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.transaction('keyval', 'readwrite').objectStore('keyval');
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const key = keys.result.find((k) => typeof k === 'string' && k.startsWith('hr:progress:'));
            if (key === undefined) return resolve(false);
            const get = store.get(key);
            get.onsuccess = () => {
              const snap = JSON.parse(String(get.result)) as { cards: { cardId: string; unlockedAt?: string }[] };
              snap.cards.push({ cardId: id, unlockedAt: new Date().toISOString() });
              const put = store.put(JSON.stringify(snap), key);
              put.onsuccess = () => resolve(true);
              put.onerror = () => resolve(false);
            };
          };
        };
      }),
    cardId,
  );
  expect(saved).toBe(true);
}

async function libraryAfterReload(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
}

/** A square face of side `side` (within a pixel), carrying the card's Korean word. */
async function expectWordFace(page: Page, title: string, word: string, side?: number): Promise<void> {
  const face = faces(page, title).last();
  await expect(face).toBeVisible();
  await expect(face.getByText(word, { exact: true })).toBeVisible();
  const box = (await face.boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  if (side !== undefined) expect(Math.round(box.width)).toBe(side);
  // The word stays inside its square.
  const text = (await face.getByText(word, { exact: true }).boundingBox())!;
  expect(text.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(text.x + text.width).toBeLessThanOrEqual(box.x + box.width + 1);
}

test('a card with no drawing shows its Korean word face on the tile and the card page, at 320 wide', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 320, height: 720 });
  await newLearnerLibrary(page);
  await holdCard(page, 'card:sagwa');
  await libraryAfterReload(page);

  const tile = page.getByRole('button', { name: /^Apple(\. New)?$/ });
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toBeVisible();
  await expectWordFace(page, 'Apple', '사과');
  // The tile still fits the 320 screen with its face.
  const tileBox = (await tile.boundingBox())!;
  expect(tileBox.x).toBeGreaterThanOrEqual(0);
  expect(tileBox.x + tileBox.width).toBeLessThanOrEqual(320);
  await shot(page, 'card-art-word-library-320');

  await tile.click();
  await expect(page.getByRole('button', { name: 'Tap to flip card to back' })).toBeVisible();
  await expectWordFace(page, 'Apple', '사과', 200);
  await shot(page, 'card-art-word-card-page-320');
  expect(errors).toEqual([]);
});

test.describe('wide split pane', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('a card with no drawing shows its Korean word face in the tile and the detail pane', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearnerLibrary(page);
    await holdCard(page, 'card:sagwa');
    await libraryAfterReload(page);

    const tile = page.getByRole('button', { name: /^Apple(\. New)?$/ });
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    await expect(tile).toHaveAttribute('aria-selected', 'true');
    await expect(faces(page, 'Apple')).toHaveCount(2);
    await expectWordFace(page, 'Apple', '사과', 200);
    await shot(page, 'card-art-word-split-pane');
    expect(errors).toEqual([]);
  });
});
