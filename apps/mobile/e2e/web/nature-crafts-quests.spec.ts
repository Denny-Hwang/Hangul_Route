import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, playCheckByIds } from './helpers';

/**
 * F-QUEST-002 Q-8: the Nature and Crafts quests 10-15 on the web PWA. Quest 10 brings
 * the last two finals (m and p) and pays off with words met earlier; quests 11-15 teach
 * nothing new and read "Words you can read now" with card pictures, then build, trace or
 * pair, and every quest ends on its two-question Check (a picture, then a reading word).
 */

type Episode = 'Nature & Animals' | 'Play & Crafts';

/** Onboard and open a Stage 1 episode page from the Journey tab. */
async function openEpisode(page: Page, episode: Episode): Promise<void> {
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
  await page.getByRole('button', { name: `${episode} episode for stage1` }).click();
}

/** Start the nth quest of the episode page (the quests before it are not done, so the soft-prerequisite sheet asks), past its intro. */
async function startQuest(page: Page, nth: number): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).nth(nth).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
}

/** Turn the Discover page (the last Continue leaves the step). */
const nextPage = (page: Page) => page.getByRole('button', { name: 'Continue' }).click();

/** A Discover word item and its card picture (an svg, never the text fallback). */
async function expectPicturedWord(page: Page, ko: string): Promise<void> {
  await expect(page.getByTestId(`discover-item-word:${ko}`).locator('svg').first()).toBeVisible();
}

/** A word item that has no picture: the Korean shows, and no art is drawn for it. */
async function expectPlainWord(page: Page, ko: string): Promise<void> {
  await expect(page.getByTestId(`discover-item-word:${ko}`)).toContainText(ko);
}

/** Every Build a Letter block in round order: the initial and vowel tiles, then the final as its batchim tile. */
async function buildBlocks(page: Page, blocks: ReadonlyArray<readonly [string, readonly string[]]>): Promise<void> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
  for (const [syllable, tiles] of blocks) {
    await expect(page.getByTestId('build-letter-speaker')).toContainText(syllable);
    for (const name of tiles) await page.getByRole('button', { name, exact: true }).click();
  }
}

const letter = (char: string): string => `Korean letter ${char}, tap to select`;

/** A Pic-Word board played right: every picture is card art, then each pair is matched. */
async function playPicWord(page: Page, ids: readonly string[], shot: string): Promise<void> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const id of ids) await expect(page.getByTestId(`pic-word-picture-${id}`).locator('svg').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(shot), fullPage: true });
  for (const id of ids) {
    await page.getByTestId(`pic-word-picture-${id}`).click();
    await page.getByTestId(`pic-word-word-${id}`).click();
  }
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeVisible();
}

test('quest 10: finals m and p at the bottom of the block, the payoff words, the tiger and magpie board, then the Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Nature & Animals');
  await expect(page.getByText('Tiger, Magpie, Moon', { exact: true })).toBeVisible();
  await startQuest(page, 0);

  // Page 1: final ㅁ with 곰 and final ㅂ with 집, each with its block diagram.
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-block-jamo:mieum-batchim')).toBeVisible();
  await expect(page.getByTestId('discover-item-jamo:mieum-batchim')).toContainText('곰');
  await expect(page.getByTestId('discover-block-jamo:bieup-batchim')).toBeVisible();
  await expect(page.getByTestId('discover-item-jamo:bieup-batchim')).toContainText('집');
  await page.screenshot({ path: test.info().outputPath('nature-q1-discover-finals.png'), fullPage: true });
  await nextPage(page);

  // Page 2: 봄 and 밥 (on the rice card), words you can read now.
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('Words you can read now', { exact: true })).toBeVisible();
  await expectPlainWord(page, '봄');
  await expectPicturedWord(page, '밥');
  await nextPage(page);

  // Page 3: the payoff, 김치 (on the kimchi card) and 엄마.
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('You can read these now!', { exact: true })).toBeVisible();
  await expectPicturedWord(page, '김치');
  await expectPlainWord(page, '엄마');
  await page.screenshot({ path: test.info().outputPath('nature-q1-discover-payoff.png'), fullPage: true });
  await nextPage(page);
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);

  // Practice (finals by ear) is skipped; the apply step pairs the tiger, magpie, moon and mountain.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playPicWord(page, ['horangi', 'kkachi', 'dal', 'san'], 'nature-q1-pic-word.png');

  // The Check: 곰 among 고 곰 공 골, then the word 집.
  await playCheckByIds(page, [{ answer: '곰' }, { answer: '집' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 11: Mountain, River, Sea reads nature words, builds four closed blocks, then a picture and a word', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Nature & Animals');
  await expect(page.getByText('Mountain, River, Sea', { exact: true })).toBeVisible();
  await startQuest(page, 1);

  await expect(page.getByText('Words you can read now', { exact: true })).toBeVisible();
  await expectPicturedWord(page, '산');
  await expectPlainWord(page, '강');
  await page.screenshot({ path: test.info().outputPath('nature-q2-discover.png'), fullPage: true });
  await nextPage(page);
  await expectPicturedWord(page, '바다');
  await expectPlainWord(page, '하늘');
  await nextPage(page);

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await buildBlocks(page, [
    ['산', [letter('ㅅ'), letter('ㅏ'), 'final n']],
    ['강', [letter('ㄱ'), letter('ㅏ'), 'final ng']],
    ['별', [letter('ㅂ'), letter('ㅕ'), 'final l']],
    ['곰', [letter('ㄱ'), letter('ㅗ'), 'final m']],
  ]);

  // Round 1 hears 산 and picks the mountain card; round 2 reads 강.
  await page.getByRole('button', { name: 'Go', exact: true }).waitFor();
  await page.screenshot({ path: test.info().outputPath('nature-q2-check-launcher.png'), fullPage: true });
  await playCheckByIds(page, [{ answer: 'card:mountain', missWith: 'card:sea' }, { answer: '강' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 12: Moon, Stars and Night reads the night sky and traces a final before its Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Nature & Animals');
  await expect(page.getByText('Moon, Stars and Night', { exact: true })).toBeVisible();
  await startQuest(page, 2);

  await expectPicturedWord(page, '달');
  await expectPlainWord(page, '별');
  await nextPage(page);
  await expectPlainWord(page, '밤');
  await expectPlainWord(page, '보름달');
  await nextPage(page);

  // The trace step draws one of the finals m, p, l and ng; it is skipped here.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByRole('heading', { name: /^Trace the letter (m|p|l|ng)$/ }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('nature-q3-trace-final.png'), fullPage: true });
  await page.getByRole('button', { name: 'Skip', exact: true }).click();

  await playCheckByIds(page, [{ answer: 'card:moon' }, { answer: '보름달' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 13: Yut, Kite, Top reads game words, builds six closed blocks, then the kite and the word nori', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Play & Crafts');
  await expect(page.getByText('Yut, Kite, Top', { exact: true })).toBeVisible();
  await startQuest(page, 0);

  await expectPicturedWord(page, '연');
  await expectPlainWord(page, '공');
  await nextPage(page);
  await expectPlainWord(page, '줄');
  await expect(page.getByTestId('discover-item-word:놀이')).toContainText('Read it smoothly: nol + i sounds like nori.');
  await page.screenshot({ path: test.info().outputPath('crafts-q1-discover-nori.png'), fullPage: true });
  await nextPage(page);

  // Practice: six closed blocks, every final but m.
  await buildBlocks(page, [
    ['연', [letter('ㅇ'), letter('ㅕ'), 'final n']],
    ['공', [letter('ㄱ'), letter('ㅗ'), 'final ng']],
    ['줄', [letter('ㅈ'), letter('ㅜ'), 'final l']],
    ['놀', [letter('ㄴ'), letter('ㅗ'), 'final l']],
    ['북', [letter('ㅂ'), letter('ㅜ'), 'final k']],
    ['밥', [letter('ㅂ'), letter('ㅏ'), 'final p']],
  ]);

  // The folk-game board is skipped; the Check hears 연 (kite card), then reads 놀이.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: 'card:kite' }, { answer: '놀이' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 14: Paper and Pottery reads craft words, pairs the craft cards, then the celadon picture and hanji', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Play & Crafts');
  await expect(page.getByText('Paper and Pottery', { exact: true })).toBeVisible();
  await startQuest(page, 1);

  await expectPicturedWord(page, '한지');
  await expectPlainWord(page, '종이');
  await nextPage(page);
  await expectPicturedWord(page, '청자');
  await expectPlainWord(page, '도자기');
  await nextPage(page);

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playPicWord(page, ['hanji', 'cheongja', 'but', 'jongijeopgi'], 'crafts-q2-pic-word.png');
  await playCheckByIds(page, [{ answer: 'card:pottery' }, { answer: '한지' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('quest 15: Read Hangul! shows hangeul and hoya on their cards, builds 한 글 호 야, then the Check', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openEpisode(page, 'Play & Crafts');
  await expect(page.getByText('Read Hangul!', { exact: true })).toBeVisible();
  await startQuest(page, 2);

  await expectPicturedWord(page, '한글');
  await expectPicturedWord(page, '호야');
  await page.screenshot({ path: test.info().outputPath('crafts-q3-discover.png'), fullPage: true });
  await nextPage(page);
  await expectPlainWord(page, '안녕');
  await expectPlainWord(page, '사랑');
  await nextPage(page);

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await buildBlocks(page, [
    ['한', [letter('ㅎ'), letter('ㅏ'), 'final n']],
    ['글', [letter('ㄱ'), letter('ㅡ'), 'final l']],
    ['호', [letter('ㅎ'), letter('ㅗ')]],
    ['야', [letter('ㅇ'), letter('ㅑ')]],
  ]);

  await playCheckByIds(page, [{ answer: 'card:hangul-day' }, { answer: '안녕' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(errors).toEqual([]);
});
