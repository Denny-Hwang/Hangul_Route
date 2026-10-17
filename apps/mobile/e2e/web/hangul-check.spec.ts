import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, jamoOfSpoken, keepSidewaysIfAsked, readStored, seedStored, waitForNextListenPickRound, headerClose } from './helpers';
import { shot } from './shots';

/**
 * F-QUEST-002 PR Q-10b: the Hangul Check (wireframe reviews/hangul-check). A learner who finished
 * Stage 1 opens it from the Journey (and from the ceremony), reads the intro, answers 35 Listen &
 * Pick items in 5 parts with a Hoya pause between parts, and sees stars, a certificate and the
 * tip letters; one stage-certificate review is saved for the caregiver channel. Stopping asks
 * first and saves nothing. Never a number of right answers, a fraction or a percent.
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

const lastSpoken = (page: Page): Promise<string | undefined> => page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1));

const AT = '2026-10-01T09:05:00.000Z';

const STAGE1: ReadonlyArray<readonly [string, number]> = [
  ['letters', 3],
  ['life', 3],
  ['rites', 3],
  ['nature', 3],
  ['crafts', 3],
];

/** All 15 Stage 1 quests done: Stage 1 is complete. */
const stage1Done = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: AT,
  episodes: [],
  quests: STAGE1.flatMap(([theme, n]) =>
    Array.from({ length: n }, (_, i) => ({
      questId: `quest:stage1-${theme}-q${i + 1}`,
      episodeId: `episode:stage1-${theme}`,
      startedAt: AT,
      completedAt: AT,
      stars: 2 as const,
      attempts: 1,
      accuracy: 0.8,
    })),
  ),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

async function finishedLearner(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `progress:${profileId}`, stage1Done(profileId));
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  return profileId;
}

const WORD_PICTURES: Readonly<Record<string, string>> = {
  한글: 'card:hangul-day',
  밥: 'card:rice',
  한복: 'card:hanbok',
  산: 'card:mountain',
  연: 'card:kite',
};

const OPTIONS = '[data-testid^="listen-pick-option-"]';

/** The option that answers `spoken`: a picture for a word, the syllable for a final, the letter otherwise. */
function answerFor(page: Page, spoken: string) {
  const picture = WORD_PICTURES[spoken];
  if (picture) return page.getByTestId(`listen-pick-option-${picture}`);
  const code = spoken.charCodeAt(0) - 0xac00;
  if (spoken.length === 1 && code % 28 > 0) return page.getByTestId(`listen-pick-option-${spoken}`);
  return page.locator(OPTIONS).filter({ hasText: jamoOfSpoken(spoken) });
}

async function tapUntil(option: ReturnType<Page['locator']>, verdict: RegExp): Promise<void> {
  // A tap inside the game's double-touch window is dropped: tap again until the card answers.
  await expect(async () => {
    await option.click();
    await expect(option).toHaveAttribute('aria-label', verdict, { timeout: 250 });
  }).toPass();
}

/**
 * Answer one part (7 items) right, reading each prompt from the captured speech. `missFirst`
 * takes a wrong card first on the part's first item (a first-try miss).
 */
async function playPart(page: Page, previous: string | undefined, missFirst = false): Promise<string | undefined> {
  let before = previous;
  for (let item = 0; item < 7; item += 1) {
    await expect(page.locator(OPTIONS).first()).toBeVisible();
    // The first item of a part waits for a tap on the speaker; the others play on open.
    if (item === 0) await page.getByTestId('listen-pick-speaker').click();
    await expect.poll(() => lastSpoken(page)).not.toBe(before);
    const spoken = (await lastSpoken(page)) as string;
    const right = answerFor(page, spoken);
    if (missFirst && item === 0) {
      const rightId = await right.getAttribute('data-testid');
      const options = page.locator(OPTIONS);
      for (let i = 0; i < (await options.count()); i += 1) {
        if ((await options.nth(i).getAttribute('data-testid')) === rightId) continue;
        await tapUntil(options.nth(i), /^Not this one/);
        break;
      }
    }
    await tapUntil(right, /^Right answer/);
    before = spoken;
    if (item < 6) await waitForNextListenPickRound(page);
  }
  return before;
}

async function openFromJourney(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByTestId('journey-stage-pill-stage1')).toHaveText('Complete');
  await page.getByTestId('journey-hangul-check').click();
  await expect(page.getByTestId('hangul-check-intro')).toBeVisible();
}

test('the Hangul Check from the Journey: intro, 35 items in 5 parts, then stars, a certificate and a tip; one review saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);
  const profileId = await finishedLearner(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByTestId('journey-stage-stage1').screenshot({ path: test.info().outputPath('journey-hangul-check.png') });
  await openFromJourney(page);

  // Intro: words only, a switch for this attempt.
  await expect(page.getByText('About four minutes. Pictures and sounds. No timer.')).toBeVisible();
  const toggle = page.getByRole('switch', { name: 'Reading practice: hide the romanization until I tap' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await shot(page, 'hangul-check-intro');
  await page.screenshot({ path: test.info().outputPath('hangul-check-intro.png'), fullPage: true });
  await page.getByRole('button', { name: "Let's go" }).click();

  let previous: string | undefined;
  for (let part = 0; part < 5; part += 1) {
    // Fill-only dots, never "n / N".
    await expect(page.getByText(/^\d+ \/ \d+$/)).toHaveCount(0);
    if (part === 0) await page.screenshot({ path: test.info().outputPath('hangul-check-item.png'), fullPage: true });
    previous = await playPart(page, previous, part === 0);
    if (part < 4) {
      await expect(page.getByTestId('hangul-check-pause')).toBeVisible();
      if (part === 0) await page.screenshot({ path: test.info().outputPath('hangul-check-pause.png'), fullPage: true });
      await page.getByRole('button', { name: 'Keep going' }).click();
    }
  }

  // Result: stars, a certificate, Hoya's tip for the one letter missed first try.
  const result = page.getByTestId('hangul-check-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('hangul-check-certificate')).toContainText('Stage 1: Hangul');
  await expect(page.getByTestId('hangul-check-certificate')).toContainText('Dami');
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\d+\s*\/\s*\d+|%/);
  await shot(page, 'hangul-check-result');
  await page.screenshot({ path: test.info().outputPath('hangul-check-result.png'), fullPage: true });

  // One stage-certificate review, 35 items, saved for the caregiver channel.
  const saved = await readStored<ProgressSnapshot>(page, `progress:${profileId}`);
  const reviews = saved?.reviews ?? [];
  expect(reviews).toHaveLength(1);
  expect(reviews[0]).toMatchObject({ kind: 'stage-certificate', scope: 'stage1' });
  expect(reviews[0]?.itemIds).toHaveLength(35);
  expect(reviews[0]?.missedItemIds).toHaveLength(1);
  // The miss was a symbol or a word: a symbol shows its tip, a word keeps "Every letter!".
  const missed = reviews[0]?.missedItemIds?.[0] ?? '';
  if (missed.startsWith('jamo:')) await expect(page.getByTestId(`hangul-check-tip-${missed}`)).toBeVisible();
  else await expect(page.getByTestId('hangul-check-every-letter')).toBeVisible();
  expect(errors).toEqual([]);
});

test('stopping the Hangul Check asks first and saves nothing; Maybe later goes straight back', async ({ page }) => {
  await captureSpeech(page);
  const profileId = await finishedLearner(page);
  await openFromJourney(page);
  await page.getByRole('button', { name: "Let's go" }).click();
  await expect(page.locator(OPTIONS).first()).toBeVisible();
  await headerClose(page).click();
  await expect(page.getByText('Stop the check?')).toBeVisible();
  await expect(page.getByText('You can take it again any time.')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('hangul-check-leave.png'), fullPage: true });
  // Keep going returns to the item.
  await page.getByTestId('hangul-check-leave').getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByText('Stop the check?')).toHaveCount(0);
  await headerClose(page).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByTestId('journey-hangul-check')).toBeVisible();
  const saved = await readStored<ProgressSnapshot>(page, `progress:${profileId}`);
  expect(saved?.reviews ?? []).toEqual([]);

  // Maybe later on the intro goes straight back.
  await page.getByTestId('journey-hangul-check').click();
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByTestId('journey-hangul-check')).toBeVisible();
});

test('at 320 wide the intro and the Journey button fit with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await captureSpeech(page);
  await finishedLearner(page);
  await openFromJourney(page);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
  await page.screenshot({ path: test.info().outputPath('hangul-check-intro-320.png'), fullPage: true });
});
