import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Contact-sheet smoke (F-STORY-002 §3.9.6, §5): /design-preview/scenes renders
 * every story scene from content/stories without a console error, its counts
 * match the files, the size toggle draws the 160 and 96 thumbnails, and the
 * library page lists the five Hoya poses. Runs over the static export.
 */
const STORIES = resolve(process.cwd(), '../../content/stories');
const files = readdirSync(STORIES).filter((n) => n.endsWith('.json'));
const scenes = files.reduce((n, f) => {
  const story = JSON.parse(readFileSync(join(STORIES, f), 'utf8')) as { tiers: Array<{ scenes: unknown[] }> };
  return n + story.tiers.reduce((m, t) => m + t.scenes.length, 0);
}, 0);

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('the contact sheet renders every scene, with counts that match the story files', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/scenes');
  await expect(page.getByRole('heading', { level: 1, name: 'Story scenes: contact sheet' })).toBeVisible();
  await expect(page.getByTestId('count-stories')).toHaveText(String(files.length));
  await expect(page.getByTestId('count-scenes')).toHaveText(String(scenes));
  await expect(page.getByTestId('story-section')).toHaveCount(files.length);
  await expect(page.getByTestId('scene-row')).toHaveCount(scenes);
  expect(await page.locator('[data-testid="scene-row"] svg[data-state]').count()).toBe(scenes);
  expect(await page.locator('body').innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(errors).toEqual([]);
});

test('the size toggle shows a 4-up 160 grid and 96-wide sequence cards', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/scenes');
  await page.getByRole('button', { name: 'Thumbnails 160' }).click();
  await expect(page.getByRole('button', { name: 'Thumbnails 160' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('scene-thumb')).toHaveCount(scenes);
  await expect(page.getByTestId('scene-row').first()).toBeHidden();
  const thumb = await page.locator('[data-testid="scene-thumb"] svg').first().boundingBox();
  expect(thumb?.width).toBe(160);
  expect(thumb?.height).toBe(120);
  await page.getByRole('button', { name: 'Sequence cards 96' }).click();
  expect((await page.locator('[data-testid="scene-thumb"] svg').first().boundingBox())?.width).toBe(96);
  await page.getByRole('button', { name: 'Review rows' }).click();
  await expect(page.getByTestId('scene-thumb')).toHaveCount(0);
  await expect(page.getByTestId('scene-row').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('the library page lists the five Hoya poses beside the shipped Hoya', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/design-preview/scenes/library');
  await expect(page.getByRole('heading', { level: 1, name: 'Scene-art library' })).toBeVisible();
  const poses = page.getByTestId('hoya-pose');
  await expect(poses).toHaveCount(5);
  expect(await poses.evaluateAll((els) => els.map((e) => e.getAttribute('data-pose')))).toEqual(['idle', 'cheering', 'thinking', 'reading', 'waving']);
  for (const pose of ['idle', 'cheering', 'thinking', 'reading', 'waving']) await expect(page.getByLabel(`Hoya ${pose}`, { exact: true })).toBeVisible();
  expect(await page.getByTestId('library-item').count()).toBeGreaterThanOrEqual(16);
  await expect(page.getByTestId('count-errors')).toHaveText('0');
  expect(errors).toEqual([]);
});

test.describe('at phone width (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  const noSidewaysScroll = async (page: Page): Promise<void> => {
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  };

  test('no sideways page scroll in any contact-sheet mode', async ({ page }) => {
    await page.goto('/design-preview/scenes');
    await noSidewaysScroll(page);
    for (const mode of ['Thumbnails 160', 'Sequence cards 96']) {
      await page.getByRole('button', { name: mode }).click();
      await expect(page.getByTestId('scene-thumb')).toHaveCount(scenes);
      await noSidewaysScroll(page);
    }
  });

  test('no sideways page scroll on the library page', async ({ page }) => {
    await page.goto('/design-preview/scenes/library');
    await expect(page.getByTestId('hoya-pose')).toHaveCount(5);
    await noSidewaysScroll(page);
  });
});

test('wide screens keep the 4-up thumbnail grid and 8-up sequence cards', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/design-preview/scenes');
  // the biggest story grid: how many cells its first row holds, and how many cells it has
  const firstRow = async (): Promise<{ row: number; size: number }> =>
    page.locator('[data-testid="thumb-grid"]').evaluateAll((grids) => {
      const grid = grids.reduce((a, b) => (b.children.length > a.children.length ? b : a));
      const tops = [...grid.children].map((c) => (c as HTMLElement).offsetTop);
      return { row: tops.filter((t) => t === tops[0]).length, size: tops.length };
    });
  await page.getByRole('button', { name: 'Thumbnails 160' }).click();
  const thumbs = await firstRow();
  expect(thumbs.row).toBe(Math.min(4, thumbs.size));
  await page.getByRole('button', { name: 'Sequence cards 96' }).click();
  const cards = await firstRow();
  expect(cards.size).toBeGreaterThanOrEqual(8);
  expect(cards.row).toBe(8);
});
