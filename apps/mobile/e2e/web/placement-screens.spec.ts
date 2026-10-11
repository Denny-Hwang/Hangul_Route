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
  /** Set by a test: every utterance fails from then on (an engine error, as a voice that stops working). */
  __speechFails?: boolean;
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
      onerror: ((ev: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          if ((window as E2eWindow).__speechFails === true) {
            setTimeout(() => u.onerror?.({ error: 'synthesis-failed' }), 0);
            return;
          }
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

/** No speech engine at all: no instruction voice (Short is unavailable) and no voice for the warm-up. */
async function noSpeechEngine(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
}

/** The open question of the saved run and the option test ids it should draw. */
async function savedQuestion(page: Page, profileId: string): Promise<{ id: string; optionTestIds: string[] }> {
  type Saved = { run: { responses: unknown[]; current: { start: number; questions: Array<{ id: string; options: Array<{ id: string }> }> } } };
  const saved = await readStored<Saved>(page, `placement-run:${profileId}`);
  const run = saved?.run;
  const question = run?.current.questions[run.responses.length - run.current.start];
  return { id: question?.id ?? '', optionTestIds: (question?.options ?? []).map((o) => `placement-option-${o.id}`) };
}

const drawnOptionTestIds = (page: Page): Promise<string[]> =>
  page.locator('[data-testid^="placement-option-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));

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

/**
 * The warm-up: the speaker checks the sound, then a picture. The pictures wait
 * for that check (with sound the speaker then reads "Hear it again"; without it
 * the note shows), so the picture is tapped only once it is offered.
 */
async function warmUp(page: Page, picture: 'rice' | 'tiger', sound = true): Promise<void> {
  await page.getByTestId('placement-warmup-speaker').click();
  if (sound) await expect(page.getByTestId('placement-warmup-speaker')).toHaveAttribute('aria-label', 'Hear it again');
  else await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
  await page.getByTestId(`placement-warmup-option-${picture}`).click();
}

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
    const learner = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    const beforeCheck = await readStored<{ quests?: unknown[]; cards?: unknown[] }>(page, `progress:${learner}`);
    await openCheck(page);

    // English only ships: the language screen is skipped. C2 with three equal radios, Standard pre-selected.
    // (Whether Short is enabled depends on when the browser's voice list arrives: an unknown list counts
    // as available, and the fixture bundle carries Korean clips.)
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Deep' })).toHaveAttribute('aria-checked', 'false');
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
    // Nothing but the result changed: no quest, no card, no star.
    expect(progress?.quests ?? []).toEqual(beforeCheck?.quests ?? []);
    expect(progress?.cards ?? []).toEqual(beforeCheck?.cards ?? []);
    expect(progress?.placements[0]).toMatchObject({ mode: 'standard', stopReason: 'quit' });
    const names = (await events(page)).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['placement.start', 'placement.item_answered', 'placement.complete']));

    // Start opens the start quest.
    await page.getByTestId('placement-result-primary').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
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
    await expect(page.getByTestId('placement-warmup-speaker')).toHaveAttribute('aria-label', 'Hear it again');
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

    // The pause sheet fits a phone on its side: both buttons inside the window.
    await page.getByTestId('placement-exit').click();
    await expect(page.getByTestId('placement-pause')).toBeVisible();
    await shot(page, 'placement-pause-568x320');
    for (const id of ['placement-keep-going', 'placement-enough']) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b).not.toBeNull();
      expect(b?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(320);
    }
    await page.getByTestId('placement-keep-going').click();
    await expect(page.getByTestId('placement-pause')).toHaveCount(0);

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
    await noSpeechEngine(page);
    await onboard(page, 'Pictures first');
    await openCheck(page);
    // No instruction voice: Short is disabled, so a Pictures first learner gets Standard on C2.
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Short' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('The short check needs sound.').first()).toBeVisible();
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

  test('a run closed mid-way offers Continue on reopening, at the same question, which plays on a tap', async ({ page }) => {
    // Short: every question starts from a sound, so the first one after the resume has a speaker.
    await voicedSpeech(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page, 'Pictures first');
    await openCheck(page);
    await page.getByTestId('placement-start').click();
    await page.getByTestId('placement-hoya-start').click();
    await warmUp(page, 'tiger');
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await expect.poll(async () => (await readStored<{ run: { responses: unknown[] } }>(page, `placement-run:${profileId}`))?.run.responses.length).toBe(1);
    const open = await savedQuestion(page, profileId);
    expect(open.id).toMatch(/^pitem:/);
    await expect.poll(() => drawnOptionTestIds(page)).toEqual(open.optionTestIds);

    await page.reload();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await openCheck(page);
    await expect(page.getByTestId('placement-resume')).toBeVisible();
    await shot(page, 'placement-resume');
    await page.getByTestId('placement-continue').click();
    await expect(page.getByTestId('placement-item')).toBeVisible();
    expect((await savedQuestion(page, profileId)).id).toBe(open.id);
    expect(await drawnOptionTestIds(page)).toEqual(open.optionTestIds);

    // The first question after a resume plays on a tap of the speaker...
    await expect(page.getByTestId('placement-speaker')).toHaveAttribute('aria-label', 'Tap to hear it.');
    await expect(page.getByText('Tap to hear it.').first()).toBeVisible();
    // ...and any tap unlocks sound again: the next question plays on open.
    await page.getByTestId('placement-not-sure').click();
    await expect(page.getByTestId('placement-speaker')).toHaveAttribute('aria-label', 'Hear it again');
  });

  test('45 seconds untouched opens the pause; For grown-ups: finish now ends the run (no PIN on this device)', async ({ page }) => {
    await page.clock.install();
    await onboard(page);
    await openCheck(page);
    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
    await page.getByTestId('placement-warmup-option-rice').click();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await expect(page.getByTestId('placement-pause')).toHaveCount(0);

    await page.clock.fastForward('00:46');
    await expect(page.getByTestId('placement-pause')).toBeVisible();
    await expect(page.getByText('Need a break?')).toBeVisible();
    await page.getByTestId('placement-grown-up-finish').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await expect
      .poll(async () => (await readStored<{ placements?: Array<{ stopReason: string }> }>(page, `progress:${profileId}`))?.placements?.[0]?.stopReason)
      .toBe('grown-up');
  });
  test('Short: a prompt that stops playing asks for a tap, then the sound pause; the skip is kept out of scoring', async ({ page }) => {
    await voicedSpeech(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page, 'Pictures first');
    await openCheck(page);
    await page.getByTestId('placement-start').click();
    await page.getByTestId('placement-hoya-start').click();
    await warmUp(page, 'tiger');
    await expect(page.getByTestId('placement-item')).toBeVisible();
    await expect(page.locator('[data-testid^="placement-option-"]').first()).toBeEnabled();

    // The voice stops working: the next prompt fails on open and is not skipped yet.
    await page.evaluate(() => {
      (window as E2eWindow).__speechFails = true;
    });
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await expect(page.getByTestId('placement-tap-to-hear')).toBeVisible();
    await expect(page.getByTestId('placement-speaker')).toHaveAttribute('aria-label', 'Tap to hear it.');
    await expect(page.getByTestId('placement-sound-pause')).toHaveCount(0);
    await shot(page, 'placement-item-tap-to-hear');

    // A tap that fails too skips the question and the run pauses: it never skips itself to the end.
    await page.getByTestId('placement-speaker').click();
    await expect(page.getByTestId('placement-sound-pause')).toBeVisible();
    await expect(page.getByText('Turn on sound to play')).toBeVisible();
    // The next question waits under the sheet: nothing plays (or fails) until Try again.
    await expect(page.getByTestId('placement-tap-to-hear')).toHaveCount(0);
    await shot(page, 'placement-sound-pause');
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await expect
      .poll(async () => (await readStored<{ run: { responses: Array<{ outcome: string; noSound?: boolean }> } }>(page, `placement-run:${profileId}`))?.run.responses)
      .toEqual([expect.not.objectContaining({ noSound: true }), expect.objectContaining({ outcome: 'skipped', noSound: true })]);
    const answered = (await events(page)).filter((e) => e.name === 'placement.item_answered');
    expect(answered.map((e) => e.payload?.noSound)).toEqual([false, true]);

    // Sound back on: Try again carries on, and the next prompt plays on open.
    await page.evaluate(() => {
      (window as E2eWindow).__speechFails = false;
    });
    await page.getByTestId('placement-keep-going').click();
    await expect(page.getByTestId('placement-sound-pause')).toHaveCount(0);
    await expect(page.getByTestId('placement-tap-to-hear')).toHaveCount(0);
    await expect(page.getByTestId('placement-speaker')).toHaveAttribute('aria-label', 'Hear it again');
  });

  test('the web: "I use a screen reader" pre-sets Take my time and the run leaves out the visual rung', async ({ page }) => {
    await onboard(page);
    await openCheck(page);
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByText('I use a screen reader')).toBeVisible();
    await page.getByTestId('placement-screen-reader').click();
    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    await warmUp(page, 'rice', false);
    await expect(page.getByTestId('placement-item')).toBeVisible();
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    type Saved = { run: { config: { visual: boolean; takeMyTime: boolean }; current: { gate: string } } };
    await expect.poll(async () => (await readStored<Saved>(page, `placement-run:${profileId}`))?.run.config).toMatchObject({ visual: false, takeMyTime: true });
    expect((await readStored<Saved>(page, `placement-run:${profileId}`))?.run.current.gate).not.toBe('recog');
  });

  test('the hand-off and the warm-up have an exit that leaves with nothing recorded', async ({ page }) => {
    await voicedSpeech(page);
    await onboard(page, 'Pictures first');
    await openCheck(page);
    await page.getByTestId('placement-start').click();
    await expect(page.getByTestId('placement-handoff')).toBeVisible();
    await page.getByTestId('placement-handoff-exit').click();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();

    await openCheck(page);
    await page.getByTestId('placement-start').click();
    await page.getByTestId('placement-hoya-start').click();
    await expect(page.getByTestId('placement-warmup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Let us start learning' })).toBeVisible();
    await page.getByTestId('placement-warmup-exit').click();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    expect(await readStored(page, `placement-run:${profileId}`)).toBeNull();
    expect((await events(page)).filter((e) => e.name.startsWith('placement.'))).toEqual([]);
  });
});
