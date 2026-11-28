import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { headerClose, onboardSelf, openLettersEpisode, passDiscover, pastTapLock } from './helpers';
import { closeInstallGuide } from './text-fit';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-1 (section 3.1, test 10): a game is never left by accident. In quest 1's first
 * game, Match the Sound (it reaches the guard through `answerRound` as Listen and Pick does), with no answer a browser
 * back leaves to the step's launcher at once; after one answer it opens the Keep playing sheet; Keep playing shows the
 * same round; a back while the sheet is open closes it; Leave goes back to the launcher of the same step, and the game
 * opens at its first round next time. The learner stack and the guest stack (`/?try=1`) run the same guard.
 */
const en = getMessages('en');

/** The round counter pill ("1 / 6"): which round the game shows. */
const pill = (page: Page) => page.getByText(/^\d+ \/ \d+$/).filter({ visible: true }).last();
/**
 * The round's prompt heading. Exact: the round's header node around it (F-A11Y-001 AF-4a, section 3.4) is a heading too,
 * named "Question 1 of 6. Tap the letter for this sound".
 */
const heading = (page: Page) => page.getByRole('heading', { name: 'Tap the letter for this sound', exact: true });
const sheet = (page: Page) => page.getByRole('alertdialog');
const playGame = (page: Page) => page.getByRole('button', { name: 'Play minigame' });

/** The learner's quest 1 opened on its Discover step, the saved-run wait over. */
async function openQuestOne(page: Page): Promise<void> {
  await onboardSelf(page, { name: 'Lee', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Lee!')).toBeVisible();
  await closeInstallGuide(page);
  await openLettersEpisode(page);
  await page.getByRole('button', { name: en.learner.episode.quests.start.cta, exact: true }).first().click();
  await expect(page.getByTestId('lesson-waiting')).toHaveCount(0);
  // Hoya's hello, then Look and learn.
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
}

/**
 * Answers round 1 without knowing which letter it asks: taps the options in order until the round moves on (a wrong tap
 * is an answer too). A missed tile is renamed "Not this one: ..." and takes no tap (F-A11Y-001 AF-4a), so the first
 * option still open is the next one in order.
 */
async function answerRoundOne(page: Page): Promise<void> {
  const options = page.getByRole('button', { name: /^Korean letter .*tap to select$/ });
  const count = await options.count();
  for (let i = 0; i < count; i += 1) {
    await pastTapLock(page);
    await options.first().click();
    const moved = await expect(pill(page))
      .toHaveText(/^2 \/ \d+$/, { timeout: 2500 })
      .then(
        () => true,
        () => false,
      );
    if (moved) return;
  }
  throw new Error('no option moved round 1 on');
}

/** From the quest's first step: no answer, back leaves at once; one answer, back asks; Keep playing; Leave. */
async function exerciseGuard(page: Page): Promise<void> {
  await passDiscover(page);
  await playGame(page).click();
  await expect(heading(page)).toBeVisible();
  await expect(pill(page)).toHaveText(/^1 \/ \d+$/);

  // No answer yet: the browser back leaves at once, to the same step's launcher.
  await page.goBack();
  await expect(sheet(page)).toHaveCount(0);
  await expect(playGame(page)).toBeVisible();

  // The game opens at its first round again; one round is answered.
  await playGame(page).click();
  await expect(pill(page)).toHaveText(/^1 \/ \d+$/);
  await answerRoundOne(page);

  // With an answer: the browser back asks. Keep playing first, and the same round shows.
  await page.goBack();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toContainText(en.learner.minigame.leave.title);
  await expect(sheet(page)).toContainText(en.learner.minigame.leave.message);
  const buttons = sheet(page).getByRole('button');
  await expect(buttons.first()).toHaveText(en.learner.quest.leave.keep.cta);
  await expect(buttons.last()).toHaveText(en.learner.quest.leave.confirm.cta);
  await buttons.first().click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(pill(page)).toHaveText(/^2 \/ \d+$/);

  // The Close asks the same; a back while the sheet is open is Keep playing, never a second sheet.
  await headerClose(page).click();
  await expect(sheet(page)).toBeVisible();
  await page.goBack();
  await expect(sheet(page)).toHaveCount(0);
  await expect(pill(page)).toHaveText(/^2 \/ \d+$/);

  // Leave: the launcher of the same step, not advanced; the game opens at its first round next time.
  await page.goBack();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole('button', { name: en.learner.quest.leave.confirm.cta, exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(playGame(page)).toBeVisible();
  await playGame(page).click();
  await expect(pill(page)).toHaveText(/^1 \/ \d+$/);
}

test.describe('a game asks before a back throws away its answers (LR-1)', () => {
  test('the learner stack', async ({ page }) => {
    await openQuestOne(page);
    await exerciseGuard(page);
  });

  test.describe('the guest stack', () => {
    test.skip(process.env.E2E_GUEST === '0', 'a build with the kill switch EXPO_PUBLIC_GUEST_LESSON=false (E2E_GUEST=0)');

    test('quest 1 of /?try=1', async ({ page }) => {
      await page.goto('/?try=1');
      await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
      await exerciseGuard(page);
    });
  });
});
