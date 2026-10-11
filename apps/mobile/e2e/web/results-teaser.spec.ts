import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, jamoOfSpoken, passDiscover } from './helpers';

/**
 * F-QUEST-002 Q-5b: the Results "Next up" teaser and the soft prerequisite on
 * the episode page. Nothing here is locked: every path ends in a quest player.
 */

type SpeechWindow = Window & { __spoken?: string[] };

/** Headless Chromium has no Korean voice (and the app never speaks Hangul without one): stand in for speechSynthesis with a ko-KR voice and end each utterance at once. */
async function captureSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as SpeechWindow).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: SpeechSynthesisUtterance) => {
          if (u.volume !== 0) spoken.push(u.text);
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: true }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

const spokenCount = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__spoken?.length ?? 0);

/** Every round answered right: tap the tile for the letter whose sound the app just said. */
async function playMatchSound(page: Page, rounds: number): Promise<void> {
  let heard = await spokenCount(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (let round = 1; round <= rounds; round += 1) {
    // The quest's own step counter ("3 / 6") stays mounted, hidden, under the game: match the visible round counter.
    await expect(page.getByText(`${round} / ${rounds}`, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = jamoOfSpoken(await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? ''));
    heard = await spokenCount(page);
    await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: prompt }).click();
  }
}

async function startFirstQuest(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
}

/**
 * The two-question Check answered right first time (F-QUEST-002 §3.3): tap the speaker,
 * then the option for what was just said (a symbol's sound picks its letter, a word
 * picks itself).
 */
async function answerCheck(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  for (let round = 1; round <= 2; round += 1) {
    const heard = await spokenCount(page);
    await page.getByTestId('listen-pick-speaker').click(); // round 2 already spoke as it opened; ask again to read it
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const said = await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? '');
    const options = page.locator('[data-testid^="listen-pick-option-"]');
    const word = options.filter({ hasText: said });
    await ((await word.count()) === 1 ? word : options.filter({ hasText: jamoOfSpoken(said) })).click();
    if (round === 1) await page.waitForTimeout(900); // the next round opens 700 ms after the right tap
  }
}

/** Home, with the install guide out of the way. */
async function home(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/**
 * A quest whose games can all be skipped: Food & Life quest 1 (no Check step until
 * F-QUEST-002 Q-6b). Its predecessor is not done, so the soft-prerequisite sheet asks once.
 */
async function startLifeQuest(page: Page): Promise<void> {
  await home(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: /^Food.* episode for stage1$/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Skip every game of the quest, then open Results: nothing is scored. */
async function skipAllGames(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await page.getByRole('button', { name: 'See results' }).click();
}

/** The Letters episode page with nothing completed: quest 1 is left at its intro. */
async function lettersEpisodeWithNothingDone(page: Page): Promise<void> {
  await startFirstQuest(page);
  await home(page);
  await page.getByRole('button', { name: /Meet the Letters/ }).click();
}

test('a played quest teases the real next quest, and the CTA goes there', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await startFirstQuest(page);
  await passDiscover(page);
  await playMatchSound(page, 6);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await answerCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();

  await expect(page.getByText('Wonderful!')).toBeVisible();
  await expect(page.getByText('Next up')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meet o, u, m and the circle' })).toBeVisible();
  // The other two exits stay one tap away.
  await expect(page.getByRole('button', { name: 'Back home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Episode page' })).toBeVisible();
  await page.getByRole('button', { name: 'Play next quest' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await expect(page.getByText('Round Two')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every game skipped: the same quest is offered again, and nothing is locked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await startFirstQuest(page);
  await startLifeQuest(page);
  await skipAllGames(page);

  await expect(page.getByText('All done!')).toBeVisible();
  await expect(page.getByText('Next up')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hello Kimchi & Rice' })).toBeVisible();
  await page.getByRole('button', { name: 'Try this one again' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('soft prerequisite: a note, a one-time sheet, and both answers work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  // Nothing was completed, so quest 2 builds on an unfinished quest 1. Go to the episode page.
  await lettersEpisodeWithNothingDone(page);
  await expect(page.getByText('Builds on: Meet a, eo, g, n')).toBeVisible();

  // First Start on quest 2 asks; "Play anyway" goes there.
  const startButtons = page.getByRole('button', { name: 'Start', exact: true });
  await startButtons.nth(1).click();
  await expect(page.getByText('This one uses letters from Meet a, eo, g, n. Start there?')).toBeVisible();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Leave quest' }).click();

  // Back on the episode page (leaving replaces the player with a fresh page) the sheet does not ask a second time.
  await expect(page.getByText('Builds on: Meet a, eo, g, n').last()).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(1).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('soft prerequisite: "Start there" opens the earlier quest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await lettersEpisodeWithNothingDone(page);

  await page.getByRole('button', { name: 'Start', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Start there' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await expect(page.getByText('Hi from Hoya')).toBeVisible();
  expect(errors).toEqual([]);
});
