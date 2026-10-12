import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-STORY-005 PR 5.5b: heritage stories on the Journey (wireframes journey/grid-with-stories A,
 * story/cell-stories B, episode/detail-cell-stories-row C). Needs the fixture bundle:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web journey-stories
 *
 * Its two reviewed shelf stories: `story:hangul-day` calls Stage 1 Letters home (a lesson cell, count 1)
 * and `story:cell-stories-fixture` calls Stage 2 Letters home (a preview cell, so a stories-only cell).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

type E2eWindow = Window & {
  __hrStoryE2E?: {
    events(): Array<{ name: string; payload?: Record<string, unknown> }>;
    openCellStories(params: { stage: string; theme: string; source: string }): void;
  };
};

const LESSON_CELL = 'Stage 1 Hangul, Letters & Books: lesson, 1 heritage story';
const STORIES_CELL = 'Stage 2 Words, Letters & Books: 1 heritage story';
const PLACEHOLDER = 'Stage 3 Sentences, Holidays & Traditions, coming soon';

async function openJourney(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

async function cellStoriesEvents(page: Page): Promise<Array<Record<string, unknown> | undefined>> {
  const events = await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
  return events.filter((e) => e.name === 'journey.cell_stories_opened').map((e) => e.payload);
}

/** The event is sent from an effect after the paint, so the read retries until it lands. */
async function expectCellStoriesEvents(page: Page, expected: unknown): Promise<void> {
  await expect.poll(() => cellStoriesEvents(page)).toEqual(expected);
}

/** The top screen's back arrow (screens under it stay mounted, hidden). */
async function goBack(page: Page): Promise<void> {
  await page.getByLabel('Go back', { exact: true }).filter({ visible: true }).first().click();
}

test.describe('heritage stories on the Journey (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1)');

  test('cells read their stage and stories; a stories-only cell is a button, a placeholder is not', async ({ page }) => {
    await openJourney(page);
    await expect(page.getByRole('button', { name: LESSON_CELL, exact: true })).toBeEnabled();
    await expect(page.getByTestId('journey-count-stage1-letters')).toHaveText('1');
    await expect(page.getByRole('button', { name: STORIES_CELL, exact: true })).toBeEnabled();
    await expect(page.getByTestId('journey-count-stage2-letters')).toHaveText('1');
    await expect(page.getByTestId('journey-stories-note-stage2')).toHaveText('Heritage stories are open in the cells with the books icon.');
    await expect(page.getByTestId('journey-stories-note-stage1')).toHaveCount(0);
    await expect(page.getByRole('button', { name: PLACEHOLDER, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Stage 1 Hangul, Food & Daily Life: lesson', exact: true })).toBeEnabled();
    await expect(page.getByTestId('journey-stories-how')).toBeVisible();
  });

  test('a stories-only cell opens its cell page with no PIN; a tile opens the story page, whose pill comes back', async ({ page }) => {
    await openJourney(page);
    await page.getByRole('button', { name: STORIES_CELL, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await expect(page.getByText('Heritage stories for this cell', { exact: true })).toBeVisible();
    await expect(page.getByTestId('cell-stories-lesson')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-empty')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-grid').locator('[data-testid^="story-tile-"]')).toHaveCount(1);
    await expectCellStoriesEvents(page, [{ stageKey: 'stage2', themeKey: 'letters', stories: 1, source: 'cell' }]);

    await page.getByTestId('story-tile-story:cell-stories-fixture').click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('The Hangul Book');
    const pill = page.getByRole('button', { name: 'Heritage stories for Stage 2 Words, Letters & Books', exact: true });
    await expect(pill).toContainText('Stage 2 · Letters & Books');
    await pill.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await expect.poll(async () => (await cellStoriesEvents(page)).map((p) => p?.source)).toEqual(['cell', 'story-pill']);
  });

  test('a lesson cell still opens its episode; the stories row opens the cell page with the lesson first', async ({ page }) => {
    await openJourney(page);
    await page.getByRole('button', { name: LESSON_CELL, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
    const row = page.getByRole('button', { name: 'Heritage stories for this cell, 1 story', exact: true });
    await expect(row).toBeVisible();
    // After the quest list, before "Cards in this episode".
    const rowBox = await row.boundingBox();
    const cardsBox = await page.getByRole('heading', { name: 'Cards in this episode' }).boundingBox();
    expect(rowBox && cardsBox && rowBox.y < cardsBox.y).toBe(true);
    await row.click();

    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    const lesson = page.getByTestId('cell-stories-lesson');
    await expect(lesson).toHaveText('Meet the Letters — the lesson for this cell');
    const tile = page.getByTestId('story-tile-story:hangul-day');
    const lessonBox = await lesson.boundingBox();
    const tileBox = await tile.boundingBox();
    expect(lessonBox && tileBox && lessonBox.y < tileBox.y).toBe(true);
    await expectCellStoriesEvents(page, [{ stageKey: 'stage1', themeKey: 'letters', stories: 1, source: 'lesson-row' }]);

    await lesson.click();
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
  });

  test('lesson > stories row > tile: Back shows the cell page, then the lesson page', async ({ page }) => {
    await openJourney(page);
    await page.getByRole('button', { name: LESSON_CELL, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
    await page.getByRole('button', { name: 'Heritage stories for this cell, 1 story', exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    await page.getByTestId('story-tile-story:hangul-day').click();
    await expect(page.getByTestId('story-episode-title')).toBeVisible();

    await goBack(page);
    await expect(page.getByTestId('story-episode-title')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    await goBack(page);
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
  });

  test('a stale link to a cell with no story: one calm card and Back', async ({ page }) => {
    await openJourney(page);
    await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.openCellStories({ stage: 'stage7', theme: 'crafts', source: 'cell' }));
    const empty = page.getByTestId('cell-stories-empty');
    await expect(empty).toContainText('Nothing here yet');
    await expect(page.getByTestId('cell-stories-lesson')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-grid')).toHaveCount(0);
    await expectCellStoriesEvents(page, [{ stageKey: 'stage7', themeKey: 'crafts', stories: 0, source: 'cell' }]);
    await page.getByTestId('cell-stories-back').click();
    await expect(page.getByTestId('cell-stories')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
  });

  test('a lesson page whose cell has no stories is today’s page', async ({ page }) => {
    await openJourney(page);
    await page.getByRole('button', { name: 'Stage 1 Hangul, Food & Daily Life: lesson', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cards in this episode' })).toBeVisible();
    await expect(page.getByTestId('episode-cell-stories-row')).toHaveCount(0);
  });

  test('320 wide: the Journey and the cell page never scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openJourney(page);
    await expectNoHorizontalOverflow(page, 'Journey at 320');
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await page.getByRole('button', { name: STORIES_CELL, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'cell page at 320');
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
  });
});

test.describe('heritage stories on the Journey, two panes (fixture bundle, 1180x820)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1)');
  test.use({ viewport: { width: 1180, height: 820 } });

  test('a stories-only cell opens its cell page as on one pane, and is never the selected cell', async ({ page }) => {
    await openJourney(page);
    const cell = page.getByRole('button', { name: STORIES_CELL, exact: true });
    await expect(cell).toBeEnabled();
    await expect(cell).not.toHaveAttribute('aria-selected', 'true');
    await cell.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await expectCellStoriesEvents(page, [{ stageKey: 'stage2', themeKey: 'letters', stories: 1, source: 'cell' }]);
    await goBack(page);
    await expect(page.getByTestId('cell-stories')).toHaveCount(0);
    await expect(page.getByRole('button', { name: STORIES_CELL, exact: true })).not.toHaveAttribute('aria-selected', 'true');
  });
});
