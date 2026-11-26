import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * AMENDMENTS-AUDIO-CANT-HEAR row CH-1e (section 3.12, OD-CH6 (c)): "Can't hear it?" in the Checks. In a Check (the quest
 * Check, AU-8; the Hangul Check, AMENDMENTS-STAGE1-DECODING-CHECK DC-1a: it has no romanization switch any more, every
 * Check holds its romanization until the answer) Show the letters prints the prompt's romanization only, never the
 * Hangul. Looked at on a 320 x 568 and a 360 x 740 phone.
 */

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const PROMPT_TEXT = 'listen-pick-prompt-text';

/** A device with a Korean voice that "plays" every utterance (headless Chromium has none, and with none the link gives way to the no-voice text). */
async function koreanVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: SpeechSynthesisUtterance) => {
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

/** The prompt text drawn above the options, Hangul and all. */
const promptText = (page: Page): Promise<string> => page.getByTestId(PROMPT_TEXT).innerText();

async function askForTheLetters(page: Page): Promise<void> {
  const link = page.getByTestId('cant-hear');
  await expect(link).toBeVisible();
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.getByTestId('cant-hear-sheet')).toBeVisible();
}

for (const size of SIZES) {
  test(`the quest Check at ${size.width} x ${size.height}: Show the letters prints the romanization only, the options keep theirs held`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await koreanVoice(page);
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Dami' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
    // Through Discover, then skip the practice and apply games to the Check.
    const pageText = await page.getByText(/^Page \d+ of \d+$/).first().innerText();
    const of = Number(/of (\d+)$/.exec(pageText)?.[1] ?? 1);
    for (let i = 1; i <= of; i += 1) await page.getByRole('button', { name: 'Continue' }).click();
    for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Go', exact: true }).click();

    // The link is there from the start, after the speaker and before the answers.
    await expect(page.getByTestId('listen-pick-options')).toBeVisible();
    const link = page.getByTestId('cant-hear');
    await expect(link).toBeVisible();
    await expect(page.getByTestId(PROMPT_TEXT)).toHaveCount(0);
    await shot(page, `ch-1e-check-link-${size.width}x${size.height}`);

    await askForTheLetters(page);
    await shot(page, `ch-1e-check-sheet-${size.width}x${size.height}`);
    await page.getByTestId('cant-hear-show-letters').click();

    // The text is the sound only: Latin letters, no Hangul anywhere in the prompt.
    await expect(page.getByTestId(PROMPT_TEXT)).toBeVisible();
    const asked = await promptText(page);
    expect(asked).toMatch(/^[A-Za-z/]+$/);
    expect(asked).not.toMatch(HANGUL);
    await expect(page.getByText('No sound? Read it here.')).toBeVisible();
    await expect(page.getByTestId('cant-hear')).toHaveCount(0);
    // The options still hold their romanization until the question is answered (AU-8): every line is the reserved,
    // invisible one, and none is drawn.
    const options = page.locator('[data-testid^="listen-pick-option-"]');
    const held = options.locator('[data-testid="korean-text-romanization-reserved"]');
    await expect(held).toHaveCount(await options.count());
    await expectNoHorizontalOverflow(page);
    await shot(page, `ch-1e-check-asked-${size.width}x${size.height}`);
    expect(errors).toEqual([]);
  });
}

// ---- the Hangul Check -------------------------------------------------------------------------------------

const AT = '2026-10-01T09:05:00.000Z';
const STAGE1: ReadonlyArray<readonly [string, number]> = [
  ['letters', 3],
  ['life', 3],
  ['rites', 3],
  ['nature', 3],
  ['crafts', 3],
];
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

async function openHangulCheck(page: Page): Promise<void> {
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
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByTestId('journey-stage-pill-stage1')).toHaveText('Complete');
  await page.getByTestId('journey-hangul-check').click();
  await expect(page.getByTestId('hangul-check-intro')).toBeVisible();
  // No attempt switch on the Hangul Check's intro (DC-1a).
  await expect(page.getByRole('switch', { name: 'Reading practice: hide the romanization until I tap' })).toHaveCount(0);
  await page.getByRole('button', { name: "Let's go" }).click();
  await expect(page.getByTestId('listen-pick-options')).toBeVisible();
}

for (const size of SIZES) {
  test(`the Hangul Check at ${size.width} x ${size.height}: Show the letters prints the romanization only, the options hold theirs`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await koreanVoice(page);
    await page.setViewportSize(size);
    await openHangulCheck(page);
    await expect(page.getByTestId('cant-hear')).toBeVisible();
    // Before any answer every option's romanization line is the reserved, invisible one (DC-1a).
    const options = page.locator('[data-testid^="listen-pick-option-"]');
    await expect(options.locator('[data-testid="korean-text-romanization-reserved"]')).toHaveCount(await options.count());
    await askForTheLetters(page);
    await page.getByTestId('cant-hear-show-letters').click();
    await expect(page.getByTestId(PROMPT_TEXT)).toBeVisible();
    const hidden = await promptText(page);
    expect(hidden).toMatch(/^[A-Za-z/]+$/);
    expect(hidden).not.toMatch(HANGUL);
    await expectNoHorizontalOverflow(page);
    await shot(page, `ch-1e-hangul-check-hidden-${size.width}x${size.height}`);
    expect(errors).toEqual([]);
  });
}
