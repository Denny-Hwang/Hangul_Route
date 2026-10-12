import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
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
/** Words and marks a learner never reads here (F-VOC-004 §3.6, §3.8). */
/** More than the view's 50 ms double-tap window between two deliberate taps. */
const TAP_GAP_MS = 120;
const SHAME = /\b(wrong|fail\w*|missed|lost|lose)\b|%|\d\s*\/\s*\d/i;

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
}

type E2eWindow = Window & {
  __hrVocabE2E?: { openQuestion(params: QuestionParams): void; log(): Log };
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

async function open(page: Page, params: QuestionParams): Promise<string> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
  await page.evaluate((p) => (window as E2eWindow).__hrVocabE2E?.openQuestion(p), params);
  await expect(page.getByTestId('vocab-question-options')).toBeVisible();
  // The app shell's "ready offline" toast is not part of the view; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  return answerId(page);
}

async function answerId(page: Page): Promise<string> {
  const id = await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.log().answerId ?? null);
  expect(id, 'the fixture question has an answer').not.toBeNull();
  return id!;
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrVocabE2E!.log());
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
    await expect(page.getByTestId('vocab-question-outcome')).toHaveCount(0);
    await expectNoShame(page);
  });

  test('speed miss: the tapped card is the amber nudge, the right one is marked, the rest rest, a second tap is ignored', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'speed' });
    const wrong = await aWrongId(page, answer);
    await option(page, wrong).click();

    await expect(option(page, wrong)).toHaveAccessibleName(/^Not this one: /);
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Not this one\. The answer is .+\.$/);
    await shot(page, 'vocab-question-word-miss');

    // The question is over: another tap changes nothing.
    await option(page, answer).click({ force: true });
    const after = await log(page);
    expect(after.answers).toEqual([expect.objectContaining({ correct: false, itemId: answer })]);
    expect(after.firstTaps).toEqual([wrong]);
    await expectNoShame(page);

    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
  });

  test('check mode: a miss stays locked and asks for another, two misses ring the answer, the right tap ends it', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'check' });
    const others = (await optionIds(page)).filter((id) => id !== answer);
    await option(page, others[0]!).click();
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText('Not this one. Try another.');
    await expect(option(page, others[0]!)).toHaveAccessibleName(/^Not this one: /);
    await expect(option(page, answer)).not.toHaveAccessibleName(/^Right answer/);

    // A touch within 50 ms of the last one is dropped (F-001 §3.4); a person never taps that fast.
    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, others[1]!).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Look here: /);
    await shot(page, 'vocab-question-check-ring');

    await page.waitForTimeout(TAP_GAP_MS);
    await option(page, answer).click();
    await expect(option(page, answer)).toHaveAccessibleName(/^Right answer: /);
    await expect(page.getByTestId('vocab-question-outcome')).toHaveText(/^Right\. /);
    const after = await log(page);
    expect(after.answers.map((a) => a.correct)).toEqual([false, false, true]);
    expect(after.firstTaps).toEqual([others[0]]);
    await expect.poll(async () => (await log(page)).advances, { timeout: 3_000 }).toBe(1);
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

  test('sound to picture with a voice: only the large speaker while asking, the word plays by itself', async ({ page }) => {
    await voicedSpeech(page);
    await open(page, { format: 'audio-to-image', mode: 'speed' });
    await expect(page.getByRole('button', { name: 'Play the word again' })).toBeVisible();
    await expect(page.getByTestId('vocab-question-word')).toHaveCount(0);
    await expect(page.getByText('No sound? Read it here.')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as E2eWindow).__spoken?.length ?? 0)).toBeGreaterThan(0);
    await shot(page, 'vocab-question-audio-asking');
  });

  test('sound to picture with no voice: the word shows as text with "No sound? Read it here." and the question still scores', async ({ page }) => {
    const answer = await open(page, { format: 'audio-to-image', mode: 'speed' });
    await expect(page.getByText('No sound? Read it here.')).toBeVisible();
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    await shot(page, 'vocab-question-audio-no-voice');
    await option(page, answer).click();
    expect((await log(page)).answers).toEqual([expect.objectContaining({ correct: true })]);
  });

  test('homonym chip and the session hint ring', async ({ page }) => {
    const answer = await open(page, { format: 'word-to-image', mode: 'speed', topicChip: true, ring: true });
    await expect(page.getByLabel('Topic: Food')).toBeVisible();
    await expect(option(page, answer)).toHaveAccessibleName(/^Look here: /);
  });

  test('320 wide: four pictures stack in one column, three pictures too, nothing past the edge', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, { format: 'word-to-image', mode: 'speed' });
    expect(await rows(page)).toBe(4);
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await shot(page, 'vocab-question-320-four');

    await open(page, { format: 'word-to-image', mode: 'speed', optionCount: 3 });
    expect(await optionIds(page)).toHaveLength(3);
    expect(await rows(page)).toBe(3);
    await expectNoHorizontalOverflow(page);

    await open(page, { format: 'image-to-word', mode: 'speed' });
    expect(await rows(page)).toBe(4);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'vocab-question-320-words');
  });
});
