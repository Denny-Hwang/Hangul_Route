import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, playCheckByIds } from './helpers';

/**
 * F-QUEST-002 Q-7b: the Holidays quests 7-9 bring the first final letters. Quest 7
 * opens on the Seollal greeting in Korean with romanization and gloss (hoyaLineKo),
 * shows a final at the bottom of its block, builds closed syllables from batchim
 * tiles, and every quest ends on its two-question Check, on the web PWA. Quest 9's
 * "New Year Order" is covered by story-order.spec.ts.
 */

/** Onboard and open the Holidays & Traditions episode page from the Journey tab. */
async function openRitesEpisode(page: Page): Promise<void> {
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
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays & Traditions') }).click();
}

/** Start the nth quest of the episode page (the earlier quests are not done, so the soft-prerequisite sheet asks). */
async function startQuest(page: Page, nth: number): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).nth(nth).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
}

/** Quest 7's Build a Letter blocks, in round order: the initial and the vowel, then the final as its batchim tile. */
const CLOSED_SYLLABLES = [
  ['달', ['Korean letter ㄷ, tap to select', 'Korean letter ㅏ, tap to select', 'final l']],
  ['물', ['Korean letter ㅁ, tap to select', 'Korean letter ㅜ, tap to select', 'final l']],
  ['문', ['Korean letter ㅁ, tap to select', 'Korean letter ㅜ, tap to select', 'final n']],
  ['산', ['Korean letter ㅅ, tap to select', 'Korean letter ㅏ, tap to select', 'final n']],
] as const;

test('quest 7: the Seollal greeting in Korean, finals n and l at the bottom of the block, closed blocks built, then the Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openRitesEpisode(page);
  await expect(page.getByText('Bow & Eat Tteokguk', { exact: true })).toBeVisible();
  await startQuest(page, 0);

  // Intro: the greeting is Korean with its romanization and gloss, never Hangul inside the English line.
  await expect(page.getByText('새해 복 많이 받으세요.').first()).toBeVisible();
  await expect(page.getByText('saehae bok mani badeuseyo').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('rites-q1-intro.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Discover: final ㄴ with 문 and final ㄹ with 달, then the pictured festival words 설날 and 떡국.
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByText('문').first()).toBeVisible();
  await expect(page.getByText('달').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('rites-q1-discover-finals.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-item-word:설날').locator('svg')).toHaveCount(2);
  await expect(page.getByTestId('discover-item-word:떡국').locator('svg')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('rites-q1-discover-theme.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);

  // Practice (Listen & Pick by ear) is skipped; Build a Letter makes four closed blocks.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
  for (const [syllable, tiles] of CLOSED_SYLLABLES) {
    await expect(page.getByTestId('build-letter-speaker')).toContainText(syllable);
    if (syllable === '달') await page.screenshot({ path: test.info().outputPath('rites-q1-build.png'), fullPage: true });
    for (const name of tiles) await page.getByRole('button', { name, exact: true }).click();
  }

  // The Check: 달 among 다 달 단, then the word 설날.
  await playCheckByIds(page, [{ answer: '달' }, { answer: '설날' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 8: Rice Cakes of Chuseok pages through ya, yeo, p and final ng to the pictured 추석 and 송편, then the Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openRitesEpisode(page);
  await expect(page.getByText('Rice Cakes of Chuseok', { exact: true })).toBeVisible();
  await startQuest(page, 1);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('야구').first()).toBeVisible();
  await expect(page.getByText('여우').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('포도').first()).toBeVisible();
  // Final ㅇ: its block diagram with the final at the bottom, and the example 송편.
  await expect(page.getByTestId('discover-block-jamo:ieung-batchim')).toBeVisible();
  await expect(page.getByTestId('discover-item-jamo:ieung-batchim')).toContainText('송편');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-item-word:추석').locator('svg')).toHaveCount(2);
  await expect(page.getByTestId('discover-item-word:송편').locator('svg')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('rites-q2-discover-theme.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Match Sound and Build a Letter are skipped; the Check asks 송 among 소 송 손, then 송편.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: '송' }, { answer: '송편' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 9: Hanbok and the Bow teaches yo, yu, h and final k before its Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openRitesEpisode(page);
  await expect(page.getByText('Hanbok and the Bow', { exact: true })).toBeVisible();
  await startQuest(page, 2);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('효도').first()).toBeVisible();
  await expect(page.getByText('우유').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('한복').first()).toBeVisible();
  await expect(page.getByText('한국').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('rites-q3-discover.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: 'jamo:yo' }, { answer: '한복' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});
