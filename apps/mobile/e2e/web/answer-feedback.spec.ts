import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, openPlaygroundWordsQuest, passDiscover } from './helpers';

/**
 * F-A11Y-001 row AF-2 (§6 test 18): in the Culture Quiz, after a right answer, one `aria-live="polite"` region holds
 * "Right answer:" once, the answered option carries a check and its state first in its name, and no element on the page
 * is `aria-live="assertive"`. The answer announcer is the region (answer-announcer.tsx); the web has no other channel.
 *
 * The quiz moves on `RESULT_MARK_MIN_MS` (1000 ms) after a right answer, so the page's own `setTimeout` is wrapped, as
 * the axe smoke does: while `window.__answerHold` is set, a 1000 ms timer is never scheduled.
 */
test('Culture Quiz: a right answer is said once, in one polite live region, and nothing is assertive', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as Window & { __answerHold?: boolean };
    const real = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      w.__answerHold && delay === 1000 ? 0 : real(handler, delay, ...args)) as typeof window.setTimeout;
  });
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('culture-quiz-hear')).toBeVisible();
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();

  // The quiz word is one of five (`minigame:s1-life-q3-apply`); its English meaning is the answer.
  const english: Record<string, string> = { 토마토: 'Tomato', 코코아: 'Cocoa', 쿠키: 'Cookie', 토스트: 'Toast', 김밥: 'Kimbap' };
  const word = await page.getByRole('heading').filter({ hasText: new RegExp(`^(${Object.keys(english).join('|')})$`) }).first().innerText();
  const answer = english[word.trim()];
  expect(answer, `the quiz word ${word} is one of the five`).toBeDefined();

  // Before any result the announcer is there and empty.
  const announcer = page.getByTestId('answer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');

  await page.evaluate(() => {
    (window as Window & { __answerHold?: boolean }).__answerHold = true;
  });
  const option = page.getByTestId(`culture-quiz-option-${answer}`);
  await expect(option).toHaveAccessibleName(answer!);
  await option.click();

  await expect(option).toHaveAccessibleName(`Right answer: ${answer}`);
  const said = page.locator('[aria-live="polite"]').filter({ hasText: 'Right answer:' });
  await expect(said).toHaveCount(1);
  await expect(said).toHaveText(new RegExp(`^Right answer: .+, ${answer}\\.$`));
  expect((await said.innerText()).match(/Right answer:/g)).toHaveLength(1);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
  // Still the answered round: the quiz has not moved on while it was read.
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
});

/**
 * F-A11Y-001 row AF-3 (§6 test 13, e2e): in Card Match a wrong meaning stays marked (named "Not this one: ...", with no
 * timer to let it go) while the Korean word is still picked, Hoya's try-another bubble is not a live region, the
 * announcer says each result once in the one polite region, a right pair names both cards "Right answer: ...", and
 * nothing on the page is `aria-live="assertive"`.
 */
test('Card Match: a miss stays marked, a right pair is named with its state first, each result is said once', async ({ page }) => {
  await openPlaygroundWordsQuest(page, { largest: false });
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('card-match-ko-board')).toBeVisible();

  // The first Korean word is geune (swing) and the second mikkeureomteul (slide); a pair shares its index across the columns.
  const announcer = page.getByTestId('answer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');
  const swing = page.getByTestId('card-match-en-0');
  const slide = page.getByTestId('card-match-en-1');
  await expect(swing).toHaveText('swing');
  await expect(slide).toHaveText('slide');

  await page.getByTestId('card-match-ko-0').click();
  await expect(page.getByTestId('card-match-ko-0')).toHaveAttribute('aria-selected', 'true');
  await slide.click();
  await expect(slide).toHaveAccessibleName('Not this one: English meaning slide');
  await expect(announcer).toHaveText('Not a match: geune and slide. Try another.');
  // The try-another line is on the page and is not a live region.
  await expect(page.getByText('Not a match. Try another meaning.')).toBeVisible();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Try another meaning' })).toHaveCount(0);

  // No timer lets the mark or the pick go.
  await page.waitForTimeout(2500);
  await expect(slide).toHaveAccessibleName('Not this one: English meaning slide');
  await expect(page.getByTestId('card-match-ko-0')).toHaveAttribute('aria-selected', 'true');

  // The right meaning at once: one result line, both cards named by their state first, the marks gone.
  await swing.click();
  await expect(swing).toHaveAccessibleName('Right answer: English meaning swing');
  await expect(page.getByTestId('card-match-ko-0')).toHaveAccessibleName('Right answer: Korean word geune');
  await expect(announcer).toHaveText('Right answer: geune, swing.');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Right answer:' })).toHaveCount(1);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
  await expect(slide).toHaveAccessibleName('English meaning slide');
});
