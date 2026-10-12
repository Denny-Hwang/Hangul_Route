import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-VOC-004 S-4b: the shared vocabulary question view (design/screens/vocab/question-view.md).
 * No learner screen hosts it until the Speed Round (S-5) and the quick check
 * (F-VOC-003 C-5) ship, so this suite opens it on real catalogue words through
 * the `window.__hrVocabE2E` hook, which exists only in the fixture bundle
 * (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-question
 *
 * In the production build the suite is skipped. Speech is the silent engine of
 * ./fixtures (no Korean voice: a sound question shows its word as text) unless
 * a test installs `voicedSpeech`.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** More than the view's 50 ms double-tap window between two deliberate taps. */
const TAP_GAP_MS = 120;
/** Words and marks a learner never reads here (F-VOC-004 §3.6, §3.8). */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose)\b|%|\d\s*\/\s*\d/i;
/** The status marks drawn on a card (design-system Icon glyphs): the Speed Round's dash, the quick check's try-another. */
const DASH = 'path[d="M7 12 H17"]';
const REPLAY = 'path[d^="M19.5 12 A7.5"]';
/** The narrowest picture card: a 96 dp picture in a tile card (choiceCardTileWidth). */
const MIN_TILE = 134;

interface QuestionParams {
  format: 'word-to-image' | 'image-to-word' | 'audio-to-image';
  mode: 'speed' | 'check';
  optionCount?: 3 | 4;
  romanizationShown?: boolean;
  canPlay?: boolean;
  topicChip?: boolean;
  ring?: boolean;
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  firstTaps: string[];
  advances: number;
  answerId: string | null;
  /** ms from the last accepted tap to the advance, per question. */
  beats: number[];
}

interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}

type E2eWindow = Window & {
  __hrVocabE2E?: { openQuestion(params: QuestionParams): void; log(): Log; events(): TelemetryEvent[] };
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

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
}

/** Opens one question; `fresh: false` keeps the page as it is (a test that seeded storage first). */
async function open(page: Page, params: QuestionParams, { fresh = true }: { fresh?: boolean } = {}): Promise<string> {
  if (fresh) await ready(page);
  await page.evaluate((p) => (window as E2eWindow).__hrVocabE2E?.openQuestion(p), params);
  await expect(page.getByTestId('vocab-question-options')).toBeVisible();
  // The app shell's "ready offline" toast is not part of the view; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  return answerId(page);
}

/** The harness writes the answer id in an effect after the first render, so it is polled. */
async function answerId(page: Page): Promise<string> {
  await expect
    .poll(() => page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.log().answerId ?? null), { message: 'the fixture question has an answer' })
    .not.toBeNull();
  return (await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.log().answerId))!;
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrVocabE2E!.log());
const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...((window as E2eWindow).__spoken ?? [])]);
const fallbacks = (page: Page): Promise<TelemetryEvent[]> =>
  page.evaluate(() => ((window as E2eWindow).__hrVocabE2E?.events() ?? []).filter((e) => e.name === 'audio.fallback_shown'));
/** The first gesture unlocks sound on the web (F-AUDIO-004 §3.6); a click on the empty canvas, not on a control. */
const unlockAudio = (page: Page): Promise<void> => page.mouse.click(2, 2);
/** Whether focus sits on the prompt (the word or picture block, the large speaker of a sound question, or its text). */
const focusOnPrompt = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.activeElement;
    return Boolean(el?.closest('[data-testid="vocab-question-prompt"], [data-testid="vocab-question-speaker"], [data-testid="vocab-question-text-prompt"]'));
  });
const option = (page: Page, id: string) => page.getByTestId(`vocab-question-option-${id}`);
const optionIds = (page: Page): Promise<string[]> =>
  page
    .locator('[data-testid^="vocab-question-option-"]')
    .evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('vocab-question-option-', '')));

async function aWrongId(page: Page, answer: string): Promise<string> {
  const ids = await optionIds(page);
  const wrong = ids.find((id) => id !== answer);
  expect(wrong).toBeDefined();
  return wrong!;
}

/** Distinct option tops: one per row of cards. */
async function rows(page: Page): Promise<number> {
  const tops = await page
    .locator('[data-testid^="vocab-question-option-"]')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return new Set(tops).size;
}

/** The narrowest option card, in CSS px (= dp on the web). */
async function narrowestCard(page: Page): Promise<number> {
  const widths = await page
    .locator('[data-testid^="vocab-question-option-"]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  return Math.min(...widths);
}

async function expectNoShame(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(SHAME);
}

test.describe('vocabulary question view (F-VOC-004 S-4b)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('word to picture, speed: a right tap marks the card, shows the meaning, says so, and the next question opens after the beat', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'speed' });
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play the word again' })).toBeVisible();
    // Pictures carry no written word while asking: each card is named by its meaning only.
    const four = await optionIds(page);
    expect(four).toHaveLength(4);
    expect(await rows(page)).toBe(2);
    await shot(page, 'vocab-question-word-asking');

    await option(page, answer).click();
    await expect(page.getByRole('button', { name: /^Right answer: / })).toBeVisible();
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Right\. .+\.$/);
    await expect(page.getByTestId('vocab-question-hoya')).toBeVisible();
    await shot(page, 'vocab-question-word-right');
    expect((await log(page)).answers).toEqual([expect.objectContaining({ correct: true, itemId: answer })]);
    expect((await log(page)).firstTaps).toEqual([answer]);

    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
    // A right answer rests for 600 ms before the next question (§3.6).
    expect((await log(page)).beats[0]).toBeGreaterThanOrEqual(590);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveCount(0);
    // After each advance focus moves to the new prompt (§3.8).
    await expect.poll(() => focusOnPrompt(page)).toBe(true);
    await expectNoShame(page);
  });

  test('speed miss: the tapped card is the amber nudge with a dash, the right one is marked, every card is locked, the beat is longer', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'speed' });
    const wrong = await aWrongId(page, answer);
    const resting = (await optionIds(page)).find((id) => id !== answer && id !== wrong)!;
    await option(page, wrong).click();

    await expect(option(page, wrong)).toHaveAccessibleName(/^Not this one: /);
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    // No retry in the Speed Round: the miss carries the short dash, never the try-another mark (§3.6, §3.8).
    await expect(option(page, wrong).locator(DASH)).toHaveCount(1);
    await expect(option(page, wrong).locator(REPLAY)).toHaveCount(0);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Not this one\. The answer is .+\.$/);
    await shot(page, 'vocab-question-word-miss');

    // The question is over: no card answers a tap any more.
    for (const id of [resting, answer, wrong]) await option(page, id).click({ force: true });
    const after = await log(page);
    expect(after.answers).toEqual([expect.objectContaining({ correct: false, itemId: answer })]);
    expect(after.firstTaps).toEqual([wrong]);
    await expectNoShame(page);

    // A miss rests for 1000 ms (a right answer for 600 ms) before the next question.
    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
    expect((await log(page)).beats[0]).toBeGreaterThanOrEqual(990);
  });

  test('check mode: a miss stays locked and asks for another, two misses ring the answer, the right tap ends it', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'check' });
    const others = (await optionIds(page)).filter((id) => id !== answer);
    await option(page, others[0]!).click();
    const outcome = page.getByTestId('vocab-question-outcome');
    await expect(outcome).toHaveText('Not this one. Try another.');
    await expect(option(page, others[0]!)).toHaveAccessibleName(/^Not this one: /);
    // A retry follows, so the miss carries the try-another mark here, not the Speed Round's dash.
    await expect(option(page, others[0]!).locator(REPLAY)).toHaveCount(1);
    await expect(option(page, others[0]!).locator(DASH)).toHaveCount(0);
    await expect(option(page, answer)).not.toHaveAccessibleName(/^Right answer/);
    await outcome.evaluate((el) => el.setAttribute('data-said', '1'));

    // A touch within 50 ms of the last one is dropped (F-001 §3.4); a person never taps that fast.
    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, others[1]!).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Look here: /);
    // The same words again, in a new node of the live region, so the second miss is said too (§3.8).
    await expect(outcome).toHaveText('Not this one. Try another.');
    await expect(page.locator('[data-testid="vocab-question-outcome"][data-said]')).toHaveCount(0);
    await shot(page, 'vocab-question-check-ring');

    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, answer).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Right\. /);
    const after = await log(page);
    expect(after.answers.map((a) => a.correct)).toEqual([false, false, true]);
    expect(after.firstTaps).toEqual([others[0]]);
    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
    // The quick check's right answer rests for 700 ms (F-VOC-003 §3.5).
    expect((await log(page)).beats[0]).toBeGreaterThanOrEqual(690);
  });

  test('picture to word, romanization hidden: the picture is named by its meaning; words show romanization once answered', async ({ page }) => {
    const answer = await open(page, { format: 'image-to-word', mode: 'speed', romanizationShown: false });
    await expect(page.getByTestId('vocab-question-picture')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play the word again' })).toHaveCount(0);
    const name = await option(page, answer).getAttribute('aria-label');
    expect(name, 'no romanization while asking').not.toContain(',');
    await shot(page, 'vocab-question-image-asking');

    await option(page, answer).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: .+, .+$/);
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    await shot(page, 'vocab-question-image-right');
  });

  test('picture to word, check mode: a miss asks for another, the right word ends it and shows under the picture', async ({ page }) => {
    const answer = await open(page, { format: 'image-to-word', mode: 'check' });
    const wrong = await aWrongId(page, answer);
    await option(page, wrong).click();
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText('Not this one. Try another.');
    await expect(option(page, wrong).locator(REPLAY)).toHaveCount(1);
    await expect(page.getByTestId('vocab-question-word')).toHaveCount(0);

    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, answer).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Right\. /);
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    expect((await log(page)).answers.map((a) => a.correct)).toEqual([false, true]);
    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
  });

  test('sound to picture with a voice: only the large speaker; the word plays once sound is unlocked, and again on the reveal', async ({ page }) => {
    await voicedSpeech(page);
    const answer = await open(page, { format: 'audio-to-image', mode: 'speed' });
    await expect(page.getByRole('button', { name: 'Play the word again' })).toBeVisible();
    await expect(page.getByTestId('vocab-question-word')).toHaveCount(0);
    await expect(page.getByText('No sound? Read it here.')).toHaveCount(0);
    // Nothing plays before the first gesture: a locked page would fail and flip the question to text.
    // Focus is on the speaker of a sound question (§3.8).
    await expect.poll(() => focusOnPrompt(page)).toBe(true);
    await page.waitForTimeout(300);
    expect(await spoken(page)).toEqual([]);
    await unlockAudio(page);
    await expect.poll(async () => (await spoken(page)).length).toBe(1);
    await shot(page, 'vocab-question-audio-asking');

    // The reveal speaks the answer word (§3.6, behaviour 4).
    await option(page, answer).click();
    await expect.poll(async () => (await spoken(page)).length).toBe(2);
    const said = await spoken(page);
    expect(said[1]).toBe(said[0]);
    expect(await fallbacks(page)).toEqual([]);
  });

  test('sound to picture with no voice: the word shows as text with "No sound? Read it here." and the question still scores', async ({ page }) => {
    const answer = await open(page, { format: 'audio-to-image', mode: 'speed' });
    await expect(page.getByText('No sound? Read it here.')).toBeVisible();
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    // The text sits in a polite live region, so a learner resting on the speaker hears it arrive.
    await expect(page.getByTestId('vocab-question-text-prompt')).toHaveAttribute('aria-live', 'polite');
    await expect.poll(() => fallbacks(page)).toEqual([expect.objectContaining({ payload: { source: 'vocab-speed', reason: 'no_voice' } })]);
    await shot(page, 'vocab-question-audio-no-voice');
    await option(page, answer).click();
    expect((await log(page)).answers).toEqual([expect.objectContaining({ correct: true })]);
  });

  test('no voice for this session (canPlay false): no speaker, the sound question shows its word, and nothing is ever spoken', async ({ page }) => {
    await voicedSpeech(page);
    const answer = await open(page, { format: 'word-to-image', mode: 'speed', canPlay: false });
    await expect(page.getByRole('button', { name: 'Play the word again' })).toHaveCount(0);
    await unlockAudio(page);
    await option(page, answer).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    await page.waitForTimeout(500);
    expect(await spoken(page)).toEqual([]);

    await open(page, { format: 'audio-to-image', mode: 'speed', canPlay: false });
    await expect(page.getByRole('button', { name: 'Play the word again' })).toHaveCount(0);
    await expect(page.getByText('No sound? Read it here.')).toBeVisible();
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    await expect.poll(() => focusOnPrompt(page)).toBe(true);
    await unlockAudio(page);
    await page.waitForTimeout(300);
    expect(await spoken(page)).toEqual([]);
  });

  test('sound switched off: the speaker says so, a tap shows Turn sound on, and turning it on plays the word', async ({ page }) => {
    await voicedSpeech(page);
    await ready(page);
    await seedStored(page, 'device:audio', { muted: true });
    await page.reload();
    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
    await open(page, { format: 'word-to-image', mode: 'speed' }, { fresh: false });

    const speaker = page.getByTestId('vocab-question-speaker');
    await expect(speaker).toHaveAccessibleName('Play sound, sound is off');
    await speaker.click();
    const turnOn = page.getByTestId('vocab-question-sound').getByRole('button', { name: 'Turn sound on' });
    await expect(turnOn).toBeVisible();
    await expect.poll(() => fallbacks(page)).toEqual([expect.objectContaining({ payload: { source: 'vocab-speed', reason: 'muted' } })]);
    expect(await spoken(page)).toEqual([]);
    await shot(page, 'vocab-question-sound-off');

    await turnOn.click();
    await expect.poll(async () => (await spoken(page)).length).toBe(1);
    await expect(speaker).toHaveAccessibleName('Play the word again');
  });

  test('homonym chip and the session hint ring', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'speed', topicChip: true, ring: true });
    await expect(page.getByLabel('Topic: Food')).toBeVisible();
    await expect(option(page, answer)).toHaveAccessibleName(/^Look here: /);
  });

  test('320 wide: four pictures stay 2 x 2 and three sit 2 + 1 at full size, words take one column, nothing past the edge', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, { format: 'word-to-image', mode: 'speed' });
    expect(await rows(page)).toBe(2);
    expect(await narrowestCard(page)).toBeGreaterThanOrEqual(MIN_TILE);
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await shot(page, 'vocab-question-320-four');

    // The mark of an answered tile sits on its corner, so the 2 x 2 grid holds through the reveal.
    const answer = await answerId(page);
    await option(page, await aWrongId(page, answer)).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    expect(await rows(page)).toBe(2);
    await shot(page, 'vocab-question-320-four-miss');

    await open(page, { format: 'word-to-image', mode: 'speed', optionCount: 3 });
    expect(await optionIds(page)).toHaveLength(3);
    expect(await rows(page)).toBe(2);
    expect(await narrowestCard(page)).toBeGreaterThanOrEqual(MIN_TILE);
    await expectNoHorizontalOverflow(page);

    await open(page, { format: 'image-to-word', mode: 'speed' });
    expect(await rows(page)).toBe(4);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'vocab-question-320-words');
  });

  test('375 and 360 wide phones: four pictures 2 x 2, three pictures 2 + 1', async ({ page }) => {
    for (const width of [375, 360]) {
      await page.setViewportSize({ width, height: 667 });
      await open(page, { format: 'audio-to-image', mode: 'speed' });
      expect(await rows(page), `${width} wide`).toBe(2);
      await open(page, { format: 'word-to-image', mode: 'speed', optionCount: 3 });
      expect(await rows(page), `${width} wide`).toBe(2);
      await expectNoHorizontalOverflow(page);
    }
  });
});
