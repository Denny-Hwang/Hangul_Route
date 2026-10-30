import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, headerBack, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-STORY-005 PR 5.5b: heritage stories on the Journey (wireframes journey/grid-with-stories A,
 * story/cell-stories B, episode/detail-cell-stories-row C), and PR 5.8: two volumes in a cell (journey/volumes, at the
 * end of this file, F-CURR-002 row CM-40). Needs the fixture bundle:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web journey-stories
 *
 * Its two reviewed shelf stories: `story:hangul-day` calls Stage 1 Letters home (a lesson cell, count 1)
 * and `story:cell-stories-fixture` calls Stage 7 Letters home (it moved from Stage 2 Letters when F-CURR-001 S2-1
 * shipped Word Builder there). Since S7-1 shipped Write Your Name there, and S7-5 the last placeholder, every grid
 * cell holds a lesson: Stage 7 Letters is a lesson cell with one story, and no cell is stories-only or coming
 * soon. The stories-only and placeholder cases check the bundle first and run only while such a cell exists.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

type E2eWindow = Window & {
  __hrStoryE2E?: {
    events(): Array<{ name: string; payload?: Record<string, unknown> }>;
    openCellStories(params: { stage: string; theme: string; source: string }): void;
  };
};

// A new learner's next quest is in this cell, so its label ends with the Next word (F-ENT-003 E3-5).
const LESSON_CELL = 'Stage 1 Hangul, Letters & Books: lesson, 1 heritage story. Next.';
const STORIES_CELL = 'Stage 7 Self-expression, Letters & Books: 1 heritage story';
const PLACEHOLDER = /, coming soon$/;
/** The fixture story's cell, a lesson cell since F-CURR-001 S7-1. */
const STORY_LESSON_CELL = 'Stage 7 Self-expression, Letters & Books: lesson, 1 heritage story';
/** True while Stage 7 Letters has no lesson, so the fixture story makes it a stories-only cell. */
const STORIES_ONLY = CATALOG.cells.find((c) => c.episodeId === 'episode:stage7-letters')?.status !== 'shipped';
/** True while some grid cell is still "Coming soon". */
const ANY_LATER = CATALOG.cells.some((c) => c.status === 'preview');
const NO_STORIES_ONLY = 'every grid cell holds a lesson since F-CURR-001 S7-1 / S7-5: no stories-only cell is left';
const LESSON_ROW = 'Heritage stories for this cell, 1 heritage story';
const PILL = 'Stage 7 · Letters & Books. Heritage stories for this cell in Stage 7 Self-expression';

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
  await headerBack(page).first().click();
}

test.describe('heritage stories on the Journey (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1)');

  test('cells read their stage and stories; a stories-only cell is a button, a placeholder is not', async ({ page }) => {
    await openJourney(page);
    await expect(page.getByRole('button', { name: LESSON_CELL, exact: true })).toBeEnabled();
    await expect(page.getByTestId('journey-count-stage1-letters')).toHaveText('1');
    await expect(page.getByTestId('journey-count-stage7-letters')).toHaveText('1');
    if (STORIES_ONLY) {
      await expect(page.getByRole('button', { name: STORIES_CELL, exact: true })).toBeEnabled();
      await expect(page.getByTestId('journey-stories-note-stage7')).toHaveText('Heritage stories are open in the cells with the books icon.');
    } else {
      await expect(page.getByRole('button', { name: STORY_LESSON_CELL, exact: true })).toBeEnabled();
      await expect(page.getByTestId('journey-stories-note-stage7')).toHaveCount(0);
    }
    await expect(page.getByTestId('journey-stories-note-stage1')).toHaveCount(0);
    if (ANY_LATER) await expect(page.getByRole('button', { name: PLACEHOLDER }).first()).toBeDisabled();
    else await expect(page.getByRole('button', { name: PLACEHOLDER })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stage 1 Hangul, Food & Daily Life: lesson', exact: true })).toBeEnabled();
    await expect(page.getByTestId('journey-stories-how')).toBeVisible();
  });

  test('a stories-only cell opens its cell page with no PIN; a tile opens the story page, whose pill comes back', async ({ page }) => {
    test.skip(!STORIES_ONLY, NO_STORIES_ONLY);
    await openJourney(page);
    await page.getByRole('button', { name: STORIES_CELL, exact: true }).click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
    await expect(page.getByText('Heritage stories for this cell', { exact: true })).toBeVisible();
    await expect(page.getByTestId('cell-stories-lesson')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-empty')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-grid').locator('[data-testid^="story-tile-"]')).toHaveCount(1);
    await expectCellStoriesEvents(page, [{ stageKey: 'stage7', themeKey: 'letters', stories: 1, source: 'cell' }]);

    await page.getByTestId('story-tile-story:cell-stories-fixture').click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('The Hangul Book');
    const pill = page.getByRole('button', { name: PILL, exact: true });
    await expect(pill).toContainText('Stage 7 · Letters & Books');
    await pill.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
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
    const params = { stage: 'stage7', theme: 'letters', source: 'cell' };
    await page.evaluate((p) => (window as E2eWindow).__hrStoryE2E?.openCellStories(p), params);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
    const once = [{ stageKey: 'stage7', themeKey: 'letters', stories: 1, source: 'cell' }];
    await expectCellStoriesEvents(page, once);
    // A double tap: the second navigate finds this page by its id and swaps in equal params.
    await page.evaluate((p) => (window as E2eWindow).__hrStoryE2E?.openCellStories(p), params);
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
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
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
    await expect(page.getByTestId('story-tile-story:cell-stories-fixture').filter({ visible: true })).toBeVisible();
    await expectCellStoriesEvents(page, [{ stageKey: 'stage7', themeKey: 'letters', stories: 1, source: 'story-pill' }]);
    // Back returns to the story page the pill was on.
    await goBack(page);
    await expect(page.getByTestId('cell-stories-title')).toHaveCount(0);
    await expect(page.getByTestId('story-episode-title')).toHaveText('The Hangul Book');
  });

  test('a stale link to a cell with no story: one calm card and Back', async ({ page }) => {
    // A cell with neither a story nor a lesson: none is left since F-CURR-001 S7-5 (Stage 6 Nature has Hike & Ask
    // since S6-4). The next case, a stage or theme the bundle does not know, keeps the calm card covered.
    test.skip(!CATALOG.cells.some((c) => c.episodeId === 'episode:stage6-nature' && c.status !== 'shipped'), 'every grid cell holds a lesson since F-CURR-001 S7-5');
    await openJourney(page);
    await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.openCellStories({ stage: 'stage6', theme: 'nature', source: 'cell' }));
    const empty = page.getByTestId('cell-stories-empty');
    await expect(empty).toContainText('Nothing here yet');
    await expect(page.getByTestId('cell-stories-lesson')).toHaveCount(0);
    await expect(page.getByTestId('cell-stories-grid')).toHaveCount(0);
    await expectCellStoriesEvents(page, [{ stageKey: 'stage6', themeKey: 'nature', stories: 0, source: 'cell' }]);
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
    if (STORIES_ONLY) {
      await page.getByRole('button', { name: STORIES_CELL, exact: true }).click();
      await expect(page.getByTestId('cell-stories-title')).toBeVisible();
      await expectNoHorizontalOverflow(page, 'cell page at 320');
      expect(await page.evaluate(controlsPastEdge)).toEqual([]);
      await goBack(page);
    }

    // The lesson page's stories row, and the cell page with its lesson row and a tile.
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
    test.skip(!STORIES_ONLY, NO_STORIES_ONLY);
    await openJourney(page);
    const cell = page.getByRole('button', { name: STORIES_CELL, exact: true });
    await expect(cell).toBeEnabled();
    await expect(cell).not.toHaveAttribute('aria-selected', 'true');
    await cell.click();
    await expect(page.getByTestId('cell-stories-title')).toHaveText('Self-expression · Letters & Books');
    await expectCellStoriesEvents(page, [{ stageKey: 'stage7', themeKey: 'letters', stories: 1, source: 'cell' }]);
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

/**
 * F-STORY-005 PR 5.8 and F-CURR-002 row CM-40 (wireframe `journey/volumes.md`): two volumes in a cell. The fixture
 * bundle gives Stage 2 Nature & Animals a Volume 2 (`build-lessons.mjs --include-fixtures`: a copy of Outdoor Words
 * named "Outdoor Words 2", no Volume 2 ships yet). `volumes` is at built-in pct 0, so each case turns it on through the
 * stored remote copy, as a ramp would; with it off the cell is its Volume 1 alone.
 */
const NATURE_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-nature');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const V2_BUNDLE = /\/_expo\/static\/js\/web\/lessons-cell-stage2-nature-v2-[0-9a-f]{32}\.js$/;
const natureCell = (page: Page) => page.getByRole('button', { name: /^Stage 2 [^,]+, Nature & Animals/ });

/** A learner with Stage 2 Nature's Volume 1 done, and `volumes` as given. */
async function volumesLearner(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = NATURE_V1?.questIds ?? [];
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage2-nature', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  const questDoneAt = Object.fromEntries(questIds.map((q) => [q, AT]));
  await seedStoredAll(page, {
    [`progress:${id}`]: { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt },
    'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags },
  });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('two volumes in a cell (fixture bundle, F-STORY-005 PR 5.8, F-CURR-002 CM-40)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1)');

  for (const [label, size] of [
    ['320', { width: 320, height: 800 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: volume dots on the cell, it opens Volume 2 once Volume 1 is done, and Vol 1 / Vol 2 on its page`, async ({ page }) => {
      await page.setViewportSize(size);
      await volumesLearner(page, VOLUMES_ON);
      await expect(natureCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
      await expect(page.getByTestId('journey-volumes-stage2-nature-1-done')).toHaveCount(1);
      await expect(page.getByTestId('journey-volumes-stage2-nature-2-open')).toHaveCount(1);
      await expect(page.getByTestId('journey-volumes-stage2-nature')).toHaveAttribute('aria-hidden', 'true');
      // Only the cell with two volumes has dots.
      await expect(page.getByTestId('journey-volumes-stage2-life')).toHaveCount(0);
      if (label === '320') {
        // The dots never make a cell wider than its neighbours (54 dp at 320).
        const nature = await natureCell(page).boundingBox();
        const life = await page.getByRole('button', { name: /^Stage 2 [^,]+, Food & Daily Life/ }).boundingBox();
        expect(nature?.width).toBeCloseTo(life?.width ?? 0, 1);
        await expectNoHorizontalOverflow(page);
      }
      await natureCell(page).scrollIntoViewIfNeeded();
      await shot(page, `volumes-grid-${label}`);
      await natureCell(page).click();
      await expect(page.getByText('Outdoor Words 2').first()).toBeVisible();
      const tabs = page.getByRole('tablist', { name: 'Volumes' });
      await expect(tabs.getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.getByRole('tab', { name: 'Volume 1' })).toHaveAttribute('aria-selected', 'false');
      await expect(tabs.getByText('Vol 1', { exact: true })).toBeVisible();
      await shot(page, `volumes-page-${label}`);
      await tabs.getByRole('tab', { name: 'Volume 1' }).click();
      await expect(page.getByRole('tablist', { name: 'Volumes' }).getByRole('tab', { name: 'Volume 1' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('Outdoor Words', { exact: true }).first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
    });
  }

  test('volumes off: no dots, no volume sentence, the cell opens Volume 1 and its page has no tabs', async ({ page }) => {
    await volumesLearner(page, {});
    await expect(page.getByTestId('journey-volumes-stage2-nature')).toHaveCount(0);
    await expect(natureCell(page)).not.toHaveAccessibleName(/Volume/);
    await natureCell(page).click();
    await expect(page.getByText('Outdoor Words', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('Outdoor Words 2')).toHaveCount(0);
  });

  test('offline: Volume 2 is a precached chunk of its own, and its first quest plays from it with the network gone', async ({ page, context }) => {
    await volumesLearner(page, VOLUMES_ON);
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active && !!navigator.serviceWorker.controller), { timeout: 30_000 })
      .toBe(true);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
      return urls;
    });
    expect(cached.filter((p) => V2_BUNDLE.test(p))).toHaveLength(1);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.getByText('Journey', { exact: true }).last().click();
    await natureCell(page).click();
    await expect(page.getByText('Outdoor Words 2').first()).toBeVisible();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname));
    expect(loaded.filter((p) => V2_BUNDLE.test(p))).toHaveLength(1);
  });
});
