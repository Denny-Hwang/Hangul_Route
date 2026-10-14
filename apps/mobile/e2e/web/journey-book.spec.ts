import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';
import { next, nextPage, position } from './story-reader-helpers';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-STORY-005 PR 5.6: the first Stage 5 book on the release bundle (wireframes
 * episode/detail-cell-stories-row D and story/cell-stories B). Festival Tales holds the read quests
 * of three festival stories; its cell (Stage 5 Rites) is also the home of one shelf story, so the
 * book page has the "Heritage stories for this cell" row, and the cell page names the book first.
 * The book plays its stories at the read level: a short Korean sentence per scene.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const BOOK_CELL = 'Stage 5 Stories, Holidays & Traditions: story book, 1 heritage story';
const ROW = 'Heritage stories for this cell, 1 heritage story';
const EMOJI = /\p{Extended_Pictographic}/u;

async function openJourney(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

async function openBook(page: Page): Promise<void> {
  await openJourney(page);
  await page.getByRole('button', { name: BOOK_CELL, exact: true }).click();
  await expect(page.getByTestId('story-episode-title')).toHaveText('Festival Tales');
}

test.describe('the Stage 5 rites book (regular build)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle owns its own cells: see journey-stories.spec.ts');

  test('the book cell opens the book page: three stories, then the cell stories row', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openBook(page);
    const rows = page.getByTestId('story-episode-rows').locator('[data-testid^="story-episode-row-story:"]');
    await expect(rows).toHaveCount(3);
    for (const id of ['story:seollal-new-year', 'story:dano-ssireum', 'story:chuseok-ganggangsullae']) {
      await expect(page.getByTestId(`story-episode-row-${id}`)).toBeVisible();
    }
    const row = page.getByRole('button', { name: ROW, exact: true });
    await expect(row).toBeVisible();
    await expect(page.getByTestId('story-episode-cell-stories-row')).toContainText('Heritage stories for this cell');
    // After the tale rows (the first row's Start stays the one primary above it).
    const rowBox = await row.boundingBox();
    const lastTale = await page.getByTestId('story-episode-row-story:chuseok-ganggangsullae').boundingBox();
    expect(rowBox && lastTale && rowBox.y > lastTale.y).toBe(true);
    await expectNoHorizontalOverflow(page);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);
    expect(errors).toEqual([]);
  });

  test('the row opens the cell page, which names the book first and lists its shelf story', async ({ page }) => {
    await openBook(page);
    await page.getByRole('button', { name: ROW, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Stories · Holidays & Traditions');
    const book = page.getByTestId('cell-stories-lesson');
    await expect(book).toHaveText('Festival Tales — the book for this cell');
    const tile = page.getByTestId('story-tile-story:uigwe-royal-birthday');
    await expect(tile).toBeVisible();
    const bookBox = await book.boundingBox();
    const tileBox = await tile.boundingBox();
    expect(bookBox && tileBox && bookBox.y < tileBox.y).toBe(true);
    // The book row returns to the book page under it (Back, not a second copy).
    await book.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByTestId('story-episode-title')).toHaveText('Festival Tales');
  });

  test('a book quest reads its story at the read level: a short Korean sentence and a caption', async ({ page }) => {
    await openBook(page);
    await page.getByTestId('story-episode-start-story:seollal-new-year').click();
    await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(next(page)).toBeVisible();
    await expect(position(page)).toHaveText('1 / 6');
    const reader = page.getByTestId('story-reader');
    await expect(reader).toContainText('설날은 음력 새해 첫날이에요.');
    await expect(reader).toContainText('Seollal, the first day of the lunar year');
    await nextPage(page);
    await expect(position(page)).toHaveText('2 / 6');
    await expect(reader).toContainText('설날에는 설빔을 입어요.');
    const shown = await reader.innerText();
    expect(shown).not.toContain('{kw:');
    expect(shown).not.toMatch(EMOJI);
  });
});
