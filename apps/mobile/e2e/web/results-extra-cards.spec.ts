import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, jamoOfSpoken } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.5a: the Results "more cards joined your Library" banner
 * (wireframe results/extra-cards). Finishing the one quest of New Year &
 * Festivals completes the episode, so its other four cards arrive beside the
 * quest card; a replay brings nothing new.
 */

type SpeechWindow = Window & { __spoken?: string[] };

/** Headless Chromium has no Korean voice: stand in for speechSynthesis with a ko-KR voice and end each utterance at once. */
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
    await expect(page.getByText(`${round} / ${rounds}`, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = jamoOfSpoken(await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? ''));
    heard = await spokenCount(page);
    await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: prompt }).click();
  }
}

/** A new learner, then Home with the install guide out of the way. */
async function newLearnerAtHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** The one quest of New Year & Festivals: the card match and the story order skipped, the sound match played. */
async function playRitesQuest(page: Page, firstTime: boolean): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: /^Holidays.* episode for stage1$/ }).click();
  await page.getByRole('button', { name: firstTime ? 'Start' : 'Play again', exact: true }).first().click();
  if (firstTime) await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playMatchSound(page, 4);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
}

const EXTRA_TITLES = ['Harvest Festival', 'Rice Cake Soup', 'Songpyeon', 'New Year Bow'];

test('finishing an episode shows its extra cards once, each opening its card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  await newLearnerAtHome(page);
  await playRitesQuest(page, true);

  // The quest card keeps its own banner; the other four cards of the episode join below it.
  await expect(page.getByText('New card for your library!')).toBeVisible();
  const banner = page.getByTestId('extra-cards-banner');
  await expect(banner.getByText('You finished New Year & Festivals!')).toBeVisible();
  await expect(banner.getByText('4 more cards joined your Library!')).toBeVisible();
  for (const title of EXTRA_TITLES) {
    await expect(banner.getByRole('button', { name: `See my card: ${title}` })).toBeVisible();
  }
  // The quest card is never repeated as an extra, and nothing counts what is left.
  await expect(banner.getByRole('button', { name: 'See my card: Lunar New Year' })).toHaveCount(0);
  await expect(banner).not.toContainText(/\d+\s*\/\s*\d+|%/);
  // Every thumbnail is a comfortable target (touchTarget.min = 64).
  for (const box of await Promise.all((await banner.getByRole('button').all()).map((b) => b.boundingBox()))) {
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  }
  await banner.scrollIntoViewIfNeeded();
  await shot(page, 'results-extra-cards');

  await banner.getByRole('button', { name: 'See my card: Songpyeon' }).click();
  await expect(page.getByText('Songpyeon').first()).toBeVisible();
  await expect(page.getByText('송편').first()).toBeVisible();

  // A replay brings nothing new: no banner.
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await playRitesQuest(page, false);
  await expect(page.getByText('Wonderful!').or(page.getByText('Great!')).or(page.getByText('You tried!'))).toBeVisible();
  await expect(page.getByTestId('extra-cards-banner')).toHaveCount(0);
  await expect(page.getByText('New card for your library!')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the banner wraps its thumbnails at 320 wide with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await captureSpeech(page);
  await newLearnerAtHome(page);
  await playRitesQuest(page, true);
  const banner = page.getByTestId('extra-cards-banner');
  await expect(banner.getByText('4 more cards joined your Library!')).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
  const bannerBox = await banner.boundingBox();
  for (const box of await Promise.all((await banner.getByRole('button').all()).map((b) => b.boundingBox()))) {
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((bannerBox?.x ?? 0) + (bannerBox?.width ?? 0) + 1);
  }
  await banner.scrollIntoViewIfNeeded();
  await shot(page, 'results-extra-cards-320');
});
