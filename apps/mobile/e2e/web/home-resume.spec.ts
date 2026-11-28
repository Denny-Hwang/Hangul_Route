import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardSelf, passDiscover, waitForSavedRunStep } from './helpers';
import { closeInstallGuide } from './text-fit';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2, test 16): Home tells the learner where they stopped. Play quest 1
 * to its third step, reload (the player's run is kept on the device, AU-12), and go Home: the hero reads Continue and
 * "You can go on from step 3 of 6."; Continue opens that step. Reload again: Start again asks first (Keep my place changes
 * nothing), and Start again opens the lesson on its first step.
 */
const en = getMessages('en');
const next = en.learner.home.next;

const hero = (page: Page) => page.getByTestId('home-next-lesson');
const start = (page: Page) => page.getByTestId('home-next-lesson-start');
const line = (page: Page) => page.getByTestId('home-next-lesson-resume');
const startAgain = (page: Page) => page.getByTestId('home-next-lesson-start-again');
const sheet = (page: Page) => page.getByRole('alertdialog');
const playGame = (page: Page) => page.getByRole('button', { name: 'Play minigame' });
const hello = (page: Page) => page.getByText('Hi from Hoya', { exact: true });

/** Home with the saved run read: the hero shows (a reload, as an app kill or a discarded tab). */
async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Lee!')).toBeVisible();
  await closeInstallGuide(page);
  await expect(hero(page)).toBeVisible();
}

test.describe('Home says that a lesson goes on, and keeps a way to start it again (LR-2)', () => {
  test('a lesson left on its third step: Continue and the line; Start again asks first', async ({ page }) => {
    await onboardSelf(page, { name: 'Lee', startJourney: false });
    await openHome(page);

    // The plain hero first: Start, no line, no Start again.
    await expect(start(page)).toContainText(next.start.cta);
    await expect(line(page)).toHaveCount(0);
    await expect(startAgain(page)).toHaveCount(0);

    // Play to the third step (Hoya's hello, Look and learn, then the first game's launcher), then reload.
    await start(page).click();
    await expect(page.getByTestId('lesson-waiting')).toHaveCount(0);
    await expect(hello(page)).toBeVisible();
    await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
    await passDiscover(page);
    await expect(playGame(page)).toBeVisible();
    // The run is kept on the device at each step change by an async write (AU-12): the reload waits until step 3 (index
    // 2) is stored, as a learner who leaves after a moment would, instead of racing the write.
    await waitForSavedRunStep(page, 'quest:stage1-letters-q1', 2);

    await openHome(page);
    await expect(start(page)).toContainText(next.continue.cta);
    await expect(line(page)).toHaveText(next.resume.line(3, 6));
    await expect(startAgain(page)).toBeVisible();
    // The Learning Route link, when it shows, stays last.
    const route = page.getByTestId('home-next-lesson-route');
    if ((await route.count()) > 0) {
      const lower = (await route.boundingBox())!.y;
      expect(lower).toBeGreaterThan((await startAgain(page).boundingBox())!.y);
    }

    // Continue opens the saved step.
    await start(page).click();
    await expect(playGame(page)).toBeVisible();
    await expect(hello(page)).toHaveCount(0);

    // A reload again; Start again asks first, and Keep my place changes nothing.
    await openHome(page);
    await expect(line(page)).toHaveText(next.resume.line(3, 6));
    await startAgain(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).toContainText(next.resume.sheet.title);
    await expect(sheet(page)).toContainText(next.resume.sheet.message);
    const buttons = sheet(page).getByRole('button');
    await expect(buttons.first()).toHaveText(next.resume.sheet.keep.cta);
    await expect(buttons.last()).toHaveText(next.resume.startAgain.cta);
    await buttons.first().click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(line(page)).toHaveText(next.resume.line(3, 6));

    // Start again: the saved run is cleared first, and the lesson opens on its first step.
    await startAgain(page).click();
    await sheet(page).getByRole('button', { name: next.resume.startAgain.cta, exact: true }).click();
    await expect(hello(page)).toBeVisible();
    await expect(playGame(page)).toHaveCount(0);
  });
});
