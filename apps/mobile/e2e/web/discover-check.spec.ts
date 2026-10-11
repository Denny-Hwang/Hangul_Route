import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';

/**
 * F-QUEST-002 Q-5a: a Stage 1 quest teaches before it asks (Discover) and
 * checks with two questions (Check, no Skip), on the web PWA.
 *
 * The shipped Stage 1 quests gain their Discover and Check steps in the
 * content PRs (Q-6a onward). Until quest 1 carries them this file skips with
 * that reason instead of failing; from Q-6a it runs unchanged. It does not
 * depend on which games sit between the two steps (they are skipped), so the
 * content PRs need no edits here.
 */

type SpeechWindow = Window & { __spoken?: string[] };

/** Headless Chromium has no Korean voice: stand in for speechSynthesis, end each utterance at once and keep what was said. */
async function stubVoice(page: Page): Promise<void> {
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

/** A browser with no speech engine at all: every prompt must fall back to text. */
async function noVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
}

const spokenCount = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__spoken?.length ?? 0);
const lastSpoken = (page: Page): Promise<string> => page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? '');

/** Onboard, pass the intro, and skip the whole test when quest 1 has no Discover step yet. */
async function openDiscover(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
  const hasDiscover = await page
    .getByText('Look and learn', { exact: true })
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(
      () => true,
      () => false,
    );
  test.skip(!hasDiscover, 'Stage 1 quest 1 has no Discover step yet: it arrives with the content PR Q-6a.');
}

/** Read "Page n of m" from the header of a Discover page. */
async function pageOf(page: Page): Promise<{ at: number; of: number }> {
  const text = await page.getByText(/^Page \d+ of \d+$/).first().innerText();
  const [, at, of] = /^Page (\d+) of (\d+)$/.exec(text) ?? [];
  return { at: Number(at), of: Number(of) };
}

/** Continue through every Discover page; returns the number of pages. */
async function continueThroughDiscover(page: Page): Promise<number> {
  const { of } = await pageOf(page);
  for (let i = 1; i <= of; i += 1) {
    await expect(page.getByText(`Page ${i} of ${of}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  return of;
}

/** Skip the practice and apply games: this spec is about the steps around them. */
async function skipGamesToCheck(page: Page): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await expect(page.getByText('Quick check', { exact: true }).first()).toBeVisible();
}

/**
 * Answer the two Check rounds without knowing the content: tap the options in
 * order. A wrong tap only locks that card (amber nudge); the right one ends the
 * round. The 50 ms pause keeps each tap outside the game's double-touch window.
 */
async function playCheck(page: Page): Promise<void> {
  for (let round = 1; round <= 2; round += 1) {
    const options = page.locator('[data-testid^="listen-pick-option-"]');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      await options.nth(i).click();
      await page.waitForTimeout(60);
    }
    if (round === 1) await page.waitForTimeout(900); // the next round opens 700 ms after the right tap
  }
}

test('Discover teaches before it asks; nothing autoplays and Continue never waits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await stubVoice(page);
  await openDiscover(page);

  // Nothing played by itself, and Continue is enabled before anything was heard.
  expect(await spokenCount(page)).toBe(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();

  // Hear it says the SOUND of the symbol (one syllable), never the letter name.
  await page.getByRole('button', { name: /^Hear it\. / }).first().click();
  await expect.poll(() => spokenCount(page)).toBe(1);
  expect(await lastSpoken(page)).toMatch(/^[가-힣]$/);
  await expect(page.getByText('Heard', { exact: true }).first()).toBeVisible();

  const pages = await continueThroughDiscover(page);
  expect(pages).toBeGreaterThanOrEqual(1);
  // The next step is the first game: the Discover step is behind us.
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the Check is two questions with no Skip, and leads on to the results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await stubVoice(page);
  await openDiscover(page);
  await continueThroughDiscover(page);
  await skipGamesToCheck(page);

  // Launcher variant: one Go, no Skip for now.
  await expect(page.getByText('Two quick ones')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go' }).click();

  // Round 1 waits for a tap (the first sound needs a gesture), then plays.
  await expect(page.getByText('Listen, then pick')).toBeVisible();
  const before = await spokenCount(page);
  await page.getByTestId('listen-pick-speaker').click();
  await expect.poll(() => spokenCount(page)).toBeGreaterThan(before);

  await playCheck(page);

  // Back on the quest: the Check step is over and the reward step follows.
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByRole('button', { name: 'Back home' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('with no speech engine Discover and the Check fall back to text', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await noVoice(page);
  await openDiscover(page);

  // Hear it cannot play: the item says what to say out loud, and nothing else changes.
  await page.getByRole('button', { name: /^Hear it\. / }).first().click();
  await expect(page.getByText(/^Say it out loud: /).first()).toBeVisible();
  await expect(page.getByText('Heard', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();

  await continueThroughDiscover(page);
  await skipGamesToCheck(page);
  await page.getByRole('button', { name: 'Go' }).click();

  // The prompt shows as text, the round still scores and ends.
  await page.getByTestId('listen-pick-speaker').click();
  await expect(page.getByText('No sound? Read it here.')).toBeVisible();
  await expect(page.getByTestId('listen-pick-prompt-text')).toBeVisible();
  await playCheck(page);
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
  expect(errors).toEqual([]);
});
