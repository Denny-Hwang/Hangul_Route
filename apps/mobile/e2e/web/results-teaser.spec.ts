import { expect, test, type Page } from '@playwright/test';

/**
 * F-QUEST-002 Q-5b: the Results "Next up" teaser and the soft prerequisite on
 * the episode page. Nothing here is locked: every path ends in a quest player.
 */

type SpeechWindow = Window & { __spoken?: string[] };

/** Headless Chromium has no Korean voice: stand in for speechSynthesis and end each utterance at once. */
async function captureSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as SpeechWindow).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.call(u, new Event('end') as SpeechSynthesisEvent), 0);
        },
        cancel: () => undefined,
        getVoices: () => [],
      },
    });
  });
}

const spokenCount = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__spoken?.length ?? 0);

/** Every round answered right: tap the tile for the letter the app just said. */
async function playMatchSound(page: Page, rounds: number): Promise<void> {
  let heard = await spokenCount(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (let round = 1; round <= rounds; round += 1) {
    await expect(page.getByText(`${round} / ${rounds}`)).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? '');
    heard = await spokenCount(page);
    await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: prompt }).click();
  }
}

async function startFirstQuest(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByPlaceholder('Type your name').fill('Dami');
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Skip every game of the quest, then open Results: nothing is scored. */
async function skipAllGames(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await page.getByRole('button', { name: 'See results' }).click();
}

test('a played quest teases the real next quest, and the CTA goes there', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await startFirstQuest(page);
  await playMatchSound(page, 4);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'See results' }).click();

  await expect(page.getByText('Wonderful!')).toBeVisible();
  await expect(page.getByText('Next up')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meet m, b, s, ng' })).toBeVisible();
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
  await skipAllGames(page);

  await expect(page.getByText('All done!')).toBeVisible();
  await expect(page.getByText('Next up')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meet g, n, d, l' })).toBeVisible();
  await page.getByRole('button', { name: 'Try this one again' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('soft prerequisite: a note, a one-time sheet, and both answers work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await startFirstQuest(page);
  await skipAllGames(page);

  // Nothing was completed, so quest 2 builds on an unfinished quest 1. Go to the episode page.
  await page.getByRole('button', { name: 'Episode page' }).click();
  await expect(page.getByText('Builds on: Meet g, n, d, l')).toBeVisible();

  // First Start on quest 2 asks; "Play anyway" goes there.
  const startButtons = page.getByRole('button', { name: 'Start', exact: true });
  await startButtons.nth(1).click();
  await expect(page.getByText('This one uses letters from Meet g, n, d, l. Start there?')).toBeVisible();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Leave quest' }).click();

  // Back on the episode page (leaving replaces the player with a fresh page) the sheet does not ask a second time.
  await expect(page.getByText('Builds on: Meet g, n, d, l').last()).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(1).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('soft prerequisite: "Start there" opens the earlier quest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await startFirstQuest(page);
  await skipAllGames(page);
  await page.getByRole('button', { name: 'Episode page' }).click();

  await page.getByRole('button', { name: 'Start', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Start there' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await expect(page.getByText('Hi from Hoya')).toBeVisible();
  expect(errors).toEqual([]);
});
