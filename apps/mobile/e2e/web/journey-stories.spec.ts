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
const LESSON_ROW = 'Heritage stories for this cell, 1 heritage story';
const PILL = 'Stage 2 · Letters & Books. Heritage stories for this cell in Stage 2 Words';

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
    const pill = page.getByRole('button', { name: PILL, exact: true });
    await expect(pill).toContainText('Stage 2 · Letters & Books');
    await pill.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await expect.poll(async () => (await cellStoriesEvents(page)).map((p) => p?.source)).toEqual(['cell', 'story-pill']);
  });

  test('a lesson cell still opens its episode; the stories row opens the cell page with the lesson first', async ({ page }) => {
    await openJourney(page);
    await page.getByRole('button', { name: LESSON_CELL, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
    const row = page.getByRole('button', { name: LESSON_ROW, exact: true });
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
    await page.getByRole('button', { name: LESSON_ROW, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    await page.getByTestId('story-tile-story:hangul-day').click();
    await expect(page.getByTestId('story-episode-title')).toBeVisible();

    await goBack(page);
    await expect(page.getByTestId('story-episode-title')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    // Back from a story opened here is not a second open (§3.6 as built).
    const once = [{ stageKey: 'stage1', themeKey: 'letters', stories: 1, source: 'lesson-row' }];
    await expectCellStoriesEvents(page, once);
    await goBack(page);
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
    expect(await cellStoriesEvents(page)).toEqual(once);
  });

  test('the same door again while its cell page is on top is not a second open', async ({ page }) => {
    await openJourney(page);
    const params = { stage: 'stage2', theme: 'letters', source: 'cell' };
    await page.evaluate((p) => (window as E2eWindow).__hrStoryE2E?.openCellStories(p), params);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    const once = [{ stageKey: 'stage2', themeKey: 'letters', stories: 1, source: 'cell' }];
    await expectCellStoriesEvents(page, once);
    // A double tap: the second navigate finds this page by its id and swaps in equal params.
    await page.evaluate((p) => (window as E2eWindow).__hrStoryE2E?.openCellStories(p), params);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await goBack(page);
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
    expect(await cellStoriesEvents(page)).toEqual(once);
  });

  test('Library > Culture > a story > its home-cell pill opens that cell page', async ({ page }) => {
    await openJourney(page);
    await page.getByText('Library', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    const culture = page.getByRole('tab', { name: 'Culture', exact: true });
    await culture.click();
    await expect(culture).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('story-tile-story:cell-stories-fixture').filter({ visible: true }).click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('The Hangul Book');
    await page.getByRole('button', { name: PILL, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Words · Letters & Books');
    await expect(page.getByTestId('story-tile-story:cell-stories-fixture').filter({ visible: true })).toBeVisible();
    await expectCellStoriesEvents(page, [{ stageKey: 'stage2', themeKey: 'letters', stories: 1, source: 'story-pill' }]);
    // Back returns to the story page the pill was on.
    await goBack(page);
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByTestId('story-episode-title')).toHaveText('The Hangul Book');
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

  test('a link to a stage or theme the bundle does not know: the calm card, no blank header, no event', async ({ page }) => {
    await openJourney(page);
    await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.openCellStories({ stage: 'stage99', theme: 'nope', source: 'cell' }));
    await expect(page.getByTestId('cell-stories-empty')).toContainText('Nothing here yet');
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-title-unknown')).toHaveText('Heritage stories for this cell');
    await page.getByTestId('cell-stories-back').click();
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
    expect(await cellStoriesEvents(page)).toEqual([]);
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

    // The lesson page's stories row, and the cell page with its lesson row and a tile.
    await goBack(page);
    await page.getByRole('button', { name: LESSON_CELL, exact: true }).click();
    const row = page.getByRole('button', { name: LESSON_ROW, exact: true });
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    await expectNoHorizontalOverflow(page, 'lesson page at 320');
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await row.click();
    await expect(page.getByTestId('cell-stories-lesson')).toBeVisible();
    await expect(page.getByTestId('story-tile-story:hangul-day')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'cell page with its lesson row at 320');
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
  });
});

// Spec §3.12 / §5: a phone, a tablet upright, a phone on its side, and the 200 % zoom proxy of a 1180x820 tablet (590x410) for large text.
for (const vp of [
  { name: 'phone 375x667', width: 375, height: 667 },
  { name: 'tablet portrait 768x1024', width: 768, height: 1024 },
  { name: 'phone landscape 844x390', width: 844, height: 390 },
  { name: '200 % zoom proxy of 1180x820', width: 590, height: 410 },
]) {
  test.describe(`heritage stories on the Journey at ${vp.name} (fixture bundle)`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1)');
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('the lesson-page row and the cell page fit, with no control past the edge', async ({ page }) => {
      await openJourney(page);
      await page.getByRole('button', { name: LESSON_CELL, exact: true }).click();
      const row = page.getByRole('button', { name: LESSON_ROW, exact: true });
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expectNoHorizontalOverflow(page, `lesson page at ${vp.name}`);
      expect(await page.evaluate(controlsPastEdge)).toEqual([]);
      await row.click();
      await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
      await expect(page.getByTestId('story-tile-story:hangul-day')).toBeVisible();
      await expectNoHorizontalOverflow(page, `cell page at ${vp.name}`);
      expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    });
  });
}

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

  test('a lesson cell selected in the detail pane: its stories row opens the full-screen cell page, Back keeps the selection', async ({ page }) => {
    await openJourney(page);
    const cell = page.getByRole('button', { name: LESSON_CELL, exact: true });
    await cell.click();
    await expect(cell).toHaveAttribute('aria-selected', 'true');
    const row = page.getByRole('button', { name: LESSON_ROW, exact: true });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Hangul · Letters & Books');
    await expectCellStoriesEvents(page, [{ stageKey: 'stage1', themeKey: 'letters', stories: 1, source: 'lesson-row' }]);
    await goBack(page);
    await expect(page.getByTestId('cell-stories')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
    await expect(page.getByRole('button', { name: LESSON_CELL, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: LESSON_ROW, exact: true })).toBeVisible();
  });
});
