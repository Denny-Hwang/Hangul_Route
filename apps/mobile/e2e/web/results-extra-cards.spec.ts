import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { completeChildForm, journeyCellName, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.5a: the Results "more cards joined your Library" banner
 * (wireframe results/extra-cards). Finishing the last quest of New Year &
 * Festivals completes the episode, so its other four cards arrive beside the
 * quest card; a replay brings nothing new. The episode has three quests since
 * F-QUEST-002 Q-7b: the first two are saved as done at one star (no card), and
 * the spec plays the third, Hanbok and the Bow.
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

const AT = '2026-10-01T09:05:00.000Z';

/** Holidays quests 1 and 2 finished at one star: complete, but no quest card earned. */
const ritesStarted = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: AT,
  episodes: [],
  quests: ['quest:stage1-rites-q1', 'quest:stage1-rites-q2'].map((questId) => ({
    questId,
    episodeId: 'episode:stage1-rites',
    startedAt: AT,
    completedAt: AT,
    stars: 1,
    attempts: 1,
    accuracy: 0.5,
  })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

/** A new learner with Holidays quests 1-2 saved as done, then Home with the install guide out of the way. */
async function newLearnerAtHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  await seedStored(page, `progress:${profileId}`, ritesStarted(profileId));
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/**
 * The last quest of New Year & Festivals (Hanbok and the Bow): Discover read, the practice
 * and the story order skipped, the Check played (the vowel yo, then the word 한복). `miss`
 * takes a wrong card first in round 2, so one of two counts: a 1-star run.
 */
async function playRitesQuest(page: Page, firstTime: boolean, miss = false): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
  // Quests 1-2 are done (Play again); the third is Start the first time and Play again after.
  await page.getByRole('button', { name: firstTime ? 'Start' : 'Play again', exact: true }).nth(firstTime ? 0 : 2).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: 'jamo:yo' }, miss ? { answer: '한복', missWith: '한국' } : { answer: '한복' }]);
  await page.getByRole('button', { name: 'See results' }).click();
}

/** The episode's cards other than the quest card (New Year Bow): quests 1-2 earned none at one star. */
const EXTRA_TITLES = ['Lunar New Year', 'Harvest Festival', 'Rice Cake Soup', 'Songpyeon'];

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
  await expect(banner.getByRole('button', { name: 'Open card: New Year Bow' })).toHaveCount(0);
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
  // One Check round of two right first time: 50 % accuracy, 1 star (no card from the quest itself).
  await playRitesQuest(page, true, true);
  await expect(page.getByText('You tried!').or(page.getByText('Good try!')).first()).toBeVisible();
  await expect(page.getByText('New card for your library!')).toHaveCount(0);
  const banner = page.getByTestId('extra-cards-banner');
  await expect(banner.getByText('You finished New Year & Festivals!', { exact: true })).toBeVisible();
  await expect(banner.getByText('5 more cards joined your Library!')).toBeVisible();
  for (const title of ['New Year Bow', ...EXTRA_TITLES]) {
    await expect(banner.getByRole('button', { name: `Open card: ${title}` })).toBeVisible();
  }
});

test('an unfinished episode names how to earn its cards at 320 wide, inside each tile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await newLearnerAtHome(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
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
