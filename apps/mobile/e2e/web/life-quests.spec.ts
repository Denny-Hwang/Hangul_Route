import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, playCheck } from './helpers';

/**
 * F-QUEST-002 Q-6b: the Food & Life quests 4-6 teach before they ask (Discover),
 * quest 4 plays the first Pic-Word board in a real quest, and each ends on its
 * two-question Check, on the web PWA.
 */

/** Onboard and open the Food & Daily Life episode page from the Journey tab. */
async function openLifeEpisode(page: Page): Promise<void> {
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
  await page.getByRole('button', { name: 'Food & Daily Life episode for stage1' }).click();
}

/** Start the nth quest of the episode page (the letters quests are not done, so the soft-prerequisite sheet asks). */
async function startQuest(page: Page, nth: number): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).nth(nth).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

const FOODS = ['gimchi', 'bap', 'gimbap', 'jeotgarak'] as const;

test('quest 4: Discover ㅈ ㅊ, the first Pic-Word board on card pictures, then the Check and Results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLifeEpisode(page);
  await startQuest(page, 0);

  // Discover: ㅈ with 자두 and ㅊ with 치즈 on page 1, then the words 고추 and 차.
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  await expect(page.getByText('자두').first()).toBeVisible();
  await expect(page.getByText('치즈').first()).toBeVisible();
  await passDiscover(page);

  // Practice (Match Sound) is skipped; the apply step is the Pic-Word board.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const id of FOODS) {
    await expect(page.getByTestId(`pic-word-picture-${id}`)).toBeVisible();
    await expect(page.getByTestId(`pic-word-word-${id}`)).toBeVisible();
  }
  // Every picture is card art (an svg), never the gloss fallback tile.
  for (const id of FOODS) await expect(page.getByTestId(`pic-word-picture-${id}`).locator('svg').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('life-q1-pic-word.png'), fullPage: true });

  for (const id of FOODS) {
    await page.getByTestId(`pic-word-picture-${id}`).click();
    await page.getByTestId(`pic-word-word-${id}`).click();
  }
  // The board ends by itself once every pair is matched; the Check launcher follows.
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toHaveCount(0);
  await playCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

/** Quest 5's Build a Letter syllables, in round order, as the tiles to tap. */
const FAMILY_SYLLABLES = [
  ['바', ['ㅂ', 'ㅏ']],
  ['보', ['ㅂ', 'ㅗ']],
  ['사', ['ㅅ', 'ㅏ']],
  ['수', ['ㅅ', 'ㅜ']],
] as const;

test('quest 5: Family at the Table pages through a 3-page Discover with a pictured word, builds 바 보 사 수, then the Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLifeEpisode(page);
  await expect(page.getByText('Family at the Table', { exact: true })).toBeVisible();
  await startQuest(page, 1);

  // Discover: ㅂ ㅅ on page 1, 아버지 and 아기 on page 2, 엄마 and the pictured 가족 on page 3.
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('바나나').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('아버지').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('엄마').first()).toBeVisible();
  await expect(page.getByText('가족').first()).toBeVisible();
  // 가족 carries the family-table card art (an svg), not the text-tile fallback.
  await expect(page.getByTestId('discover-item-word:가족').locator('svg')).toHaveCount(2);
  // A theme page under its own caption: 엄마 and 가족 hold finals not taught yet, so it never says "Words you can read now".
  await expect(page.getByText('Family words', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('life-q2-discover-page3.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);

  // Practice (Match Sound) is skipped; Build a Letter is played round by round.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
  for (const [syllable, parts] of FAMILY_SYLLABLES) {
    await expect(page.getByTestId('build-letter-speaker')).toContainText(syllable);
    for (const part of parts) await page.getByRole('button', { name: `Korean letter ${part}, tap to select` }).click();
  }
  // The last right block ends the game; the Check launcher follows.
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeVisible();
  await playCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 6: Picnic Snacks teaches ㅋ ㅌ as the puff-of-air twins of ㄱ ㄷ', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLifeEpisode(page);
  await expect(page.getByText('Picnic Snacks', { exact: true })).toBeVisible();
  await startQuest(page, 2);

  await expect(page.getByText('Tap Hear it: k is like g with a puff of air, and t is like d with a puff of air.')).toBeVisible();
  await expect(page.getByText('쿠키').first()).toBeVisible();
  await expect(page.getByText('토마토').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('life-q3-discover.png'), fullPage: true });
  await passDiscover(page);

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});
