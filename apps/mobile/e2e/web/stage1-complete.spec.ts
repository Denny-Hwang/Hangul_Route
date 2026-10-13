import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-QUEST-002 PR Q-9: Stage 1 completion (wireframe results/stage1-complete). A learner with 14 of
 * the 15 Stage 1 quests saved as done at one star plays the last one, Read Hangul!. Results offers
 * See your Stage 1 prize as its one primary; the ceremony shows Hoya cheering, every one of the 30
 * symbols lit and the three legendary cards; the Journey's Stage 1 pill reads Complete; a replay
 * shows ordinary Results.
 */

const AT = '2026-10-01T09:05:00.000Z';

const STAGE1: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['episode:stage1-letters', ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']],
  ['episode:stage1-life', ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']],
  ['episode:stage1-rites', ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']],
  ['episode:stage1-nature', ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']],
  ['episode:stage1-crafts', ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2']],
];

/** Every Stage 1 quest but Read Hangul! done at one star (no quest card earned by a run). */
const fourteenDone = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: AT,
  episodes: [],
  quests: STAGE1.flatMap(([episodeId, questIds]) =>
    questIds.map((questId) => ({ questId, episodeId, startedAt: AT, completedAt: AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })),
  ),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

async function learnerOneQuestShort(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  await seedStored(page, `progress:${profileId}`, fourteenDone(profileId));
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** Read Hangul! (Play & Crafts quest 3): Discover read, practice and build skipped, the Check played right. */
async function playLastQuest(page: Page, firstTime: boolean): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Play & Crafts') }).click();
  await expect(page.getByText('Read Hangul!', { exact: true }).last()).toBeVisible();
  // Quests 1-2 are done (Play again); the third is Start the first time and Play again after.
  await page.getByRole('button', { name: firstTime ? 'Start' : 'Play again', exact: true }).nth(firstTime ? 0 : 2).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: 'card:hangul-day' }, { answer: '안녕' }]);
  await page.getByRole('button', { name: 'See results' }).click();
}

const LEGENDARY = ['Hangul Day', 'Paper Lantern', 'Gayageum Zither'];

test('the last Stage 1 quest opens the prize: Hoya, every symbol lit, the legendary cards, then Complete on the Journey', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await learnerOneQuestShort(page);
  await playLastQuest(page, true);

  // Results: the prize is the one primary; the next-quest teaser, Back home and Episode page are quieter.
  const prize = page.getByRole('button', { name: 'See your Stage 1 prize' });
  await expect(prize).toBeVisible();
  await expect(page.getByTestId('extra-cards-banner')).toBeVisible();
  await prize.scrollIntoViewIfNeeded();
  await shot(page, 'results-stage1-prize');
  await page.screenshot({ path: test.info().outputPath('results-stage1-prize.png'), fullPage: true });
  await prize.click();

  // The ceremony.
  const ceremony = page.getByTestId('stage-complete');
  await expect(ceremony).toBeVisible();
  await expect(page.getByText('Hangul complete!')).toBeVisible();
  await expect(ceremony.getByLabel('Hoya the tiger, cheering')).toBeVisible();
  const wall = page.getByTestId('stage-complete-wall');
  await expect(wall.locator('[data-testid^="stage-complete-tile-"]')).toHaveCount(30);
  await expect(wall.getByLabel('Korean letter g/k', { exact: true })).toBeVisible();
  await expect(wall.getByLabel('Korean letter silent/ng', { exact: true })).toBeVisible();
  await expect(wall.getByLabel('Korean final consonant ng', { exact: true })).toBeVisible();
  const cards = page.getByTestId('stage-complete-cards');
  for (const title of LEGENDARY) await expect(cards.getByRole('button', { name: `Open card: ${title}` })).toBeVisible();
  // Never a count, a fraction or a percent in the copy, and never a price or Premium (D3, D5).
  const copy = await page.locator('body').innerText();
  const withoutWall = copy.replace(await page.getByTestId('stage-complete-wall').innerText(), '');
  expect(withoutWall).not.toMatch(/\d+\s*\/\s*\d+|%/);
  expect(copy).not.toMatch(/premium|price|upgrade|\$/i);
  await expect(page.getByRole('button', { name: 'See my cards' })).toBeVisible();
  await shot(page, 'stage1-complete');
  await page.screenshot({ path: test.info().outputPath('stage1-complete.png'), fullPage: true });
  await wall.screenshot({ path: test.info().outputPath('stage1-complete-wall.png') });
  await cards.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('stage1-complete-cards.png') });

  // See my cards opens the Library.
  await page.getByRole('button', { name: 'See my cards' }).click();
  await expect(page.getByTestId('stage-complete')).toHaveCount(0);

  // The Journey's Stage 1 header reads Complete.
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByTestId('journey-stage-pill-stage1')).toHaveText('Complete');
  await expect(page.getByTestId('journey-stage-pill-stage2')).not.toHaveText('Complete');
  await page.getByTestId('journey-stage-stage1').screenshot({ path: test.info().outputPath('journey-stage1-complete.png') });

  // A replay is ordinary Results: no prize.
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await playLastQuest(page, false);
  await expect(page.getByText('Wonderful!').or(page.getByText('All done!')).or(page.getByText('Great!'))).toBeVisible();
  await expect(page.getByRole('button', { name: 'See your Stage 1 prize' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the ceremony fits 320 wide with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await learnerOneQuestShort(page);
  await playLastQuest(page, true);
  await page.getByRole('button', { name: 'See your Stage 1 prize' }).click();
  await expect(page.getByTestId('stage-complete')).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
  for (const title of LEGENDARY) {
    const box = await page.getByRole('button', { name: `Open card: ${title}` }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  }
  await shot(page, 'stage1-complete-320');
  await page.screenshot({ path: test.info().outputPath('stage1-complete-320.png'), fullPage: true });

  // A card opens its page.
  await page.getByRole('button', { name: 'Open card: Hangul Day' }).click();
  await expect(page.getByText('한글날').filter({ visible: true }).first()).toBeVisible();
});
