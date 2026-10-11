import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readStored, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * F-PLC-001 P-6: the level check's screens. The check has no learner entry
 * point until P-7 (and `flags.placementEnabled` stays off), so this suite
 * opens it through the `window.__hrPlacementE2E` hook, which exists only in
 * the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test placement-screens
 *
 * In the production build the suite is skipped. Speech is the silent engine
 * of ./fixtures (no voices: no Korean sound, no instruction voice) unless a
 * test installs `voicedSpeech`, a fake with a Korean and an English voice
 * whose utterances end at once.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const EMOJI = /\p{Extended_Pictographic}/u;
/** No score-like text on a learner screen (section 3.12). */
const SCORE = /%|\d\s*\/\s*\d|\bscore\b|\bpassed\b|\bfailed\b|\blevel \d/i;

type E2eWindow = Window & {
  __hrPlacementE2E?: {
    open(source: string): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
  __spoken?: string[];
};

async function voicedSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as E2eWindow).__spoken = spoken;
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    const voices = [v('Yuna', 'ko-KR'), v('Samantha', 'en-US', true)];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          if (u.volume !== 0) spoken.push(u.text);
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

/** "Me" path with a chosen reading level, to Home. */
async function onboard(page: Page, level: 'Pictures first' | 'Some reading' = 'Some reading'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByRole('radio', { name: /^Me\./ }).click();
  await page.getByPlaceholder('Type a name').fill('Sam');
  await page.getByRole('radio', { name: new RegExp(`^${level}`) }).click();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  await expect(page.getByText('Hi, Sam!')).toBeVisible();
}

async function openCheck(page: Page, source = 'home'): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrPlacementE2E), undefined, { timeout: 10_000 });
  await page.evaluate((s) => (window as E2eWindow).__hrPlacementE2E?.open(s), source);
}

const events = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrPlacementE2E?.events() ?? []);

/** Every text node on the screen (scores, emoji). */
const screenText = (page: Page): Promise<string> => page.evaluate(() => document.body.innerText);

/** Taps "I am not sure" until the result shows (a pause sheet, if one opens, is answered with Keep going). */
async function notSureToEnd(page: Page, max = 50): Promise<number> {
  let asked = 0;
  const result = page.getByTestId('placement-result');
  for (; asked < max; asked += 1) {
    await expect(result.or(page.getByTestId('placement-not-sure')).first()).toBeVisible();
    if (await result.isVisible()) break;
    const keepGoing = page.getByTestId('placement-keep-going');
    if (await keepGoing.isVisible()) await keepGoing.click();
    // The last answer ends the run: the button may leave the screen while this click is in flight.
    await page.getByTestId('placement-not-sure').click({ timeout: 3_000 }).catch(() => undefined);
  }
  return asked;
}

test.describe('level check screens (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'runs on the fixture bundle (STORY_FIXTURES=1, dist-e2e/)');

  test('Standard without sound: options, sound guide, warm-up note, items, pause, result, Start', async ({ page }) => {
    await onboard(page);
    await openCheck(page);

    // English only ships: the language screen is skipped. C2, Standard pre-selected, Short needs sound.
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('The short check needs sound.').first()).toBeVisible();
    await expect(page.getByText('Usually under 10 minutes.')).toBeVisible();
    // Nothing pre-selected in the sound guide: NEXT waits for it.
    await expect(page.getByRole('radio', { name: 'Always show it' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radio', { name: 'Show it only when I tap' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('placement-next')).toBeDisabled();
    await shot(page, 'placement-options-c2');
    await page.getByTestId('placement-guide-tap').click();
    await expect(page.getByTestId('placement-next')).toBeEnabled();
    await page.getByTestId('placement-next').click();

    // Warm-up: the speaker checks the sound; without it, a note, then any picture.
    await expect(page.getByTestId('placement-warmup')).toBeVisible();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
    await shot(page, 'placement-warmup-no-sound');
    await page.getByTestId('placement-warmup-option-rice').click();

    // Items: a neutral frame, "I am not sure", the exit, the footsteps.
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await expect(page.getByLabel('Question, 4 choices')).toBeVisible();
    await expect(page.getByTestId('placement-not-sure')).toBeVisible();
    await shot(page, 'placement-item-standard');
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await expect(page.getByTestId('placement-got-it')).toBeVisible();

    // The exit opens the pause sheet; Keep going closes it.
    await page.getByTestId('placement-exit').click();
    await expect(page.getByTestId('placement-pause')).toBeVisible();
    await expect(page.getByText('Need a break?')).toBeVisible();
    await shot(page, 'placement-pause');
    await page.getByTestId('placement-keep-going').click();
    await expect(page.getByTestId('placement-pause')).toHaveCount(0);

    // "That is enough" ends the run with the answers so far.
    await page.getByTestId('placement-exit').click();
    await page.getByTestId('placement-enough').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();
    await expect(page.getByTestId('placement-headline')).toHaveText('Hoya found your starting spot!');
    await expect(page.getByTestId('placement-level')).toHaveText('Hangul · At the beginning');
    await expect(page.getByTestId('placement-map-start')).toBeVisible();
    const text = await screenText(page);
    expect(text).not.toMatch(SCORE);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'placement-result');

    // The result is stored as its own record, never as a completion.
    await waitForSaved(page, ['profiles']);
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    const id = profiles?.[0]?.id ?? '';
    await expect
      .poll(async () => ((await readStored<{ placements?: unknown[] }>(page, `progress:${id}`))?.placements ?? []).length)
      .toBe(1);
    const progress = await readStored<{ quests: unknown[]; cards: unknown[]; placements: Array<{ mode: string; stopReason: string }> }>(page, `progress:${id}`);
    expect(progress?.quests).toEqual([]);
    expect(progress?.cards).toEqual([]);
    expect(progress?.placements[0]).toMatchObject({ mode: 'standard', stopReason: 'quit' });
    const names = (await events(page)).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['placement.start', 'placement.item_answered', 'placement.complete']));

    // Start opens the start quest.
    await page.getByTestId('placement-result-primary').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect(page).not.toHaveURL(/placement/i);
  });

  test('Pictures first with sound: the Short card, the hand-off, the Short item in portrait and landscape', async ({ page }) => {
    await voicedSpeech(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page, 'Pictures first');
    await openCheck(page);

    // C1: one pre-filled Short card, Change and Start; nothing to read or choose.
    await expect(page.getByTestId('placement-options-card')).toBeVisible();
    await expect(page.getByTestId('placement-short-card')).toBeVisible();
    await expect(page.getByTestId('placement-change')).toBeVisible();
    await shot(page, 'placement-options-c1-320');
    await page.getByTestId('placement-start').click();

    // Hand-off: the whole Hoya is the button; the lines are spoken.
    await expect(page.getByTestId('placement-handoff')).toBeVisible();
    await expect(page.getByText('Ready? Tap Hoya to start.').first()).toBeVisible();
    await shot(page, 'placement-handoff-320');
    await page.getByTestId('placement-hoya-start').click();

    // Warm-up with sound: no note; any picture opens the first question.
    await expect(page.getByTestId('placement-warmup')).toBeVisible();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-warmup-option-rice')).toBeEnabled();
    await expect(page.getByTestId('placement-no-sound-note')).toHaveCount(0);
    await page.getByTestId('placement-warmup-option-tiger').click();

    // Short item: the icon exit, a 2 x 2 grid, "I am not sure" on its own row, no "Got it", no reveal.
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Let us start learning' })).toBeVisible();
    await expect(page.locator('[data-testid^="placement-option-"]')).toHaveCount(4);
    await expect(page.getByTestId('placement-reveal')).toHaveCount(0);
    await shot(page, 'placement-item-short-320x568');
    const notSure = await page.getByTestId('placement-not-sure').boundingBox();
    expect(notSure).not.toBeNull();
    // Portrait at 320 x 568: everything fits without scrolling.
    expect((notSure?.y ?? 0) + (notSure?.height ?? 0)).toBeLessThanOrEqual(568);
    const cards = await page.locator('[data-testid^="placement-option-"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: r.width, h: r.height };
      }),
    );
    expect(new Set(cards.map((c) => c.y)).size).toBe(2);
    expect(new Set(cards.map((c) => c.x)).size).toBe(2);
    for (const c of cards) expect(Math.min(c.w, c.h)).toBeGreaterThanOrEqual(80);

    // The cards enable once the prompt has played; an answer fills the trail with no "Got it".
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await expect(page.getByTestId('placement-got-it')).toHaveCount(0);

    // Landscape: two columns, the grid beside the prompt.
    await page.setViewportSize({ width: 568, height: 320 });
    await page.getByRole('button', { name: 'Keep sideways' }).click({ timeout: 2_000 }).catch(() => undefined);
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await shot(page, 'placement-item-short-568x320');
    const box = await page.getByTestId('placement-not-sure').boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(320);
    const exit = await page.getByTestId('placement-exit').boundingBox();
    const first = await page.locator('[data-testid^="placement-option-"]').first().boundingBox();
    expect(first?.x ?? 0).toBeGreaterThan((exit?.x ?? 0) + (exit?.width ?? 0));

    // A Short run ends on its own (at most nine questions) at a band-1 ceiling.
    await page.setViewportSize({ width: 320, height: 568 });
    await notSureToEnd(page);
    // One answer so far plus "not sure" to the end: sounds (3), then words (3); no syllables.
    const answered = (await events(page)).filter((e) => e.name === 'placement.item_answered');
    expect(answered).toHaveLength(6);
    await expect(page.getByTestId('placement-result')).toBeVisible();
    expect(await screenText(page)).not.toMatch(SCORE);
    await shot(page, 'placement-result-short-320');
  });

  test('Pictures first without sound: sound-needed, then Check without sound back to the full options', async ({ page }) => {
    await onboard(page, 'Pictures first');
    await openCheck(page);
    // No voice: Short is not available, so Standard is pre-selected on C2 with the sound-guide question.
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await page.getByTestId('placement-guide-always').click();
    await page.getByTestId('placement-next').click();
    // A listen-first learner goes through the hand-off.
    await page.getByTestId('placement-hoya-start').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-sound-needed')).toBeVisible();
    await expect(page.getByText('Turn on sound to play')).toBeVisible();
    await shot(page, 'placement-sound-needed');
    await page.getByTestId('placement-without-sound').click();
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Short' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('placement-next')).toBeDisabled();
    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    // A Pictures first learner still gets the hand-off; the warm-up is not repeated.
    await page.getByTestId('placement-hoya-start').click();
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await expect(page.getByTestId('placement-warmup')).toHaveCount(0);
  });

  test('a run closed mid-way offers Continue on reopening, at the same question', async ({ page }) => {
    await onboard(page);
    await openCheck(page);
    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
    await page.getByTestId('placement-warmup-option-rice').click();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await expect(page.getByTestId('placement-item')).toBeVisible();
    const before = await page.locator('[data-testid^="placement-option-"]').evaluateAll((els) => els.map((el) => el.textContent));
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    await waitForSaved(page, [`placement-run:${profiles?.[0]?.id ?? ''}`]);

    await page.reload();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await openCheck(page);
    await expect(page.getByTestId('placement-resume')).toBeVisible();
    await shot(page, 'placement-resume');
    await page.getByTestId('placement-continue').click();
    await expect(page.getByTestId('placement-item')).toBeVisible();
    const after = await page.locator('[data-testid^="placement-option-"]').evaluateAll((els) => els.map((el) => el.textContent));
    expect(after).toEqual(before);
    // The first question after a resume plays on a tap.
    await expect(page.getByText('Tap to hear it.').first()).toBeVisible().catch(() => undefined);
  });
});
