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

/**
 * Tap the tile for the letter whose sound the app just said. Rounds listed in
 * `missFirst` take a wrong tile first, so they count as missed (a 1-star run).
 */
async function playMatchSound(page: Page, rounds: number, missFirst: readonly number[] = []): Promise<void> {
  let heard = await spokenCount(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (let round = 1; round <= rounds; round += 1) {
    await expect(page.getByText(`${round} / ${rounds}`, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = jamoOfSpoken(await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? ''));
    heard = await spokenCount(page);
    const tiles = page.getByRole('button', { name: /^Korean letter / });
    if (missFirst.includes(round)) {
      await tiles.filter({ hasNotText: prompt }).first().click();
      // A miss replays the prompt after a beat; let it finish so the next round reads its own prompt.
      await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    }
    await tiles.filter({ hasText: prompt }).click();
    heard = await spokenCount(page);
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
async function playRitesQuest(page: Page, firstTime: boolean, missFirst: readonly number[] = []): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: /^Holidays.* episode for stage1$/ }).click();
  await page.getByRole('button', { name: firstTime ? 'Start' : 'Play again', exact: true }).first().click();
  if (firstTime) await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playMatchSound(page, 4, missFirst);
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
  await expect(banner.getByText('You finished New Year & Festivals!', { exact: true })).toBeVisible();
  await expect(banner.getByText('4 more cards joined your Library!')).toBeVisible();
  for (const title of EXTRA_TITLES) {
    await expect(banner.getByRole('button', { name: `Open card: ${title}` })).toBeVisible();
  }
  // The quest card is never repeated as an extra, and nothing counts what is left.
  await expect(banner.getByRole('button', { name: 'Open card: Lunar New Year' })).toHaveCount(0);
  await expect(banner).not.toContainText(/\d+\s*\/\s*\d+|%/);
  // Every thumbnail is a comfortable target (touchTarget.min = 64).
  for (const box of await Promise.all((await banner.getByRole('button').all()).map((b) => b.boundingBox()))) {
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  }
  await banner.scrollIntoViewIfNeeded();
  await shot(page, 'results-extra-cards');

  await banner.getByRole('button', { name: 'Open card: Songpyeon' }).click();
  await expect(page.getByText('Songpyeon', { exact: true }).filter({ visible: true }).first()).toBeVisible();
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

test('the banner names every card for screen readers in its live region, read once', async ({ page }) => {
  await captureSpeech(page);
  await newLearnerAtHome(page);
  await playRitesQuest(page, true);
  const banner = page.getByTestId('extra-cards-banner');
  await expect(banner.getByText('4 more cards joined your Library!')).toBeVisible();
  // Android and web read the live region's text, not the thumbnails' labels: the one sentence of §3.7 is in it.
  const live = page.locator('[aria-live="polite"]').filter({ has: banner });
  const sentence = live.getByText(/^You finished New Year & Festivals! 4 more cards joined your Library: /);
  await expect(sentence).toHaveCount(1);
  for (const title of EXTRA_TITLES) await expect(sentence).toContainText(title);
  // Drawn nowhere: a clipped 1 x 1 box.
  const box = await sentence.boundingBox();
  expect((box?.width ?? 0) * (box?.height ?? 0)).toBeLessThanOrEqual(1);
  // The visible lines say the same thing, so assistive tech skips them (no double read).
  for (const line of ['4 more cards joined your Library!', 'You finished New Year & Festivals!']) {
    const hidden = await banner.getByText(line, { exact: true }).evaluate((el) => el.closest('[aria-hidden="true"]') !== null);
    expect(hidden, line).toBe(true);
  }
  // The thumbnails stay reachable.
  await expect(banner.getByRole('button', { name: 'Open card: Songpyeon' })).toBeVisible();
});

test('a thumbnail cannot be tapped before it has faded in, and shows its pressed state', async ({ page }) => {
  await captureSpeech(page);
  await newLearnerAtHome(page);
  await playRitesQuest(page, true);
  const thumb = page.getByTestId('extra-cards-banner').getByRole('button', { name: 'Open card: Songpyeon' });
  await thumb.waitFor({ state: 'attached' });
  // Still entering (opacity 0 for the first 400 ms): not a target yet.
  expect(await thumb.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  // Settled: a target.
  await expect.poll(() => thumb.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('auto');
  // Keyboard focus draws the focus ring.
  await thumb.focus();
  await expect.poll(() => thumb.evaluate((el) => getComputedStyle(el).borderColor)).toBe('rgb(58, 127, 181)');
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the banner is there at once, fully drawn', async ({ page }) => {
    await captureSpeech(page);
    await newLearnerAtHome(page);
    await playRitesQuest(page, true);
    const banner = page.getByTestId('extra-cards-banner');
    await expect(banner).toBeVisible();
    // No entrance: opaque and in place from the first frame, and every thumbnail already a target.
    const thumb = banner.getByRole('button', { name: 'Open card: Songpyeon' });
    const look = await banner.evaluate((el) => ({ opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform }));
    const pointer = await thumb.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(look.opacity).toBe('1');
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(look.transform);
    expect(pointer).toBe('auto');
  });
});

test('a 1-star finish brings no quest card banner, and the episode cards still join', async ({ page }) => {
  await captureSpeech(page);
  await newLearnerAtHome(page);
  // One round of four right: 25 % accuracy, 1 star (no card from the quest itself).
  await playRitesQuest(page, true, [2, 3, 4]);
  await expect(page.getByText('You tried!').or(page.getByText('Good try!')).first()).toBeVisible();
  await expect(page.getByText('New card for your library!')).toHaveCount(0);
  const banner = page.getByTestId('extra-cards-banner');
  await expect(banner.getByText('You finished New Year & Festivals!', { exact: true })).toBeVisible();
  await expect(banner.getByText('5 more cards joined your Library!')).toBeVisible();
  for (const title of ['Lunar New Year', ...EXTRA_TITLES]) {
    await expect(banner.getByRole('button', { name: `Open card: ${title}` })).toBeVisible();
  }
});

test('an unfinished episode names how to earn its cards at 320 wide, inside each tile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await newLearnerAtHome(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: /^Holidays.* episode for stage1$/ }).click();
  const lines = page.getByText('Finish every quest to earn it', { exact: true });
  await expect(lines.first()).toBeVisible();
  for (const line of await lines.all()) {
    const fits = await line.evaluate((el) => {
      const tile = el.closest('[role="button"]');
      if (!tile) return false;
      const t = tile.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.left >= t.left - 1 && r.right <= t.right + 1 && el.scrollWidth <= el.clientWidth + 1;
    });
    expect(fits).toBe(true);
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});
