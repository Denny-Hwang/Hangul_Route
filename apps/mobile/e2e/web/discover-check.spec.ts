import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { answerCheckRounds, completeChildForm } from './helpers';

/**
 * F-QUEST-002 Q-5a: a Stage 1 quest teaches before it asks (Discover) and
 * checks with two questions (Check, no Skip), on the web PWA.
 *
 * Quest 1 carries its Discover and Check steps since the content PR Q-6a (the
 * file skipped until then). It does not depend on which games sit between the
 * two steps (they are skipped), so the later content PRs need no edits here.
 */

type SpeechWindow = Window & { __spoken?: string[] };

/**
 * Headless Chromium has no Korean voice: stand in for speechSynthesis with one ko-KR
 * voice, end each utterance at once and keep what was said. The silent unlock
 * utterance of the first gesture (volume 0, F-AUDIO-004) is not a prompt and is not kept.
 */
async function stubVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as SpeechWindow).__spoken = spoken;
    const voice = { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false };
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
        getVoices: () => [voice],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
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

/** Onboard and pass the intro: quest 1 opens on its Discover step. */
async function openDiscover(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
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

  await answerCheckRounds(page);

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
  await answerCheckRounds(page);
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
  expect(errors).toEqual([]);
});
