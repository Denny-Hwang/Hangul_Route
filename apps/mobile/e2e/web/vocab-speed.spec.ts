import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-VOC-004 S-5: the Speed Round, Relaxed (design/screens/vocab/speed-round.md, results.md).
 *
 * Words stays behind `flags.vocabTopicsEnabled` (off until F-VOC-003 C-7), so the suite runs in the
 * fixture bundle (`STORY_FIXTURES=1`, served from dist-e2e/), which offers Words with the flag off:
 * words are collected with `window.__hrVocabE2E.collect(ids)`, the topic page opens with
 * `openTopic(key)` and the learner taps **Speed round**; `openSpeed(key)` opens the start sheet where
 * the topic page would not offer it (too few words).
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-speed
 *
 * Speech is the silent engine of ./fixtures (no Korean voice). Sound is switched off before a round
 * (`device:audio`), so no sound question is built and every prompt is a word or a picture the test can
 * read: the answer is looked up in the topic's content file.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words and marks a learner never reads here (D3, S11, behaviour 16): no fraction, no percent, no "wrong". */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|streak|combo|lives|accuracy)\b|%|\d\s*\/\s*\d|\d+ of \d+/i;
/** More than the question view's 50 ms double-tap window. */
const TAP_GAP_MS = 120;
/** Food words in file order. Without sound each word is asked at most twice at Some reading (word to picture, picture to word). */
const FOOD_IDS = ['vocab:sagwa-apple', 'vocab:banana', 'vocab:uyu', 'vocab:ppang', 'vocab:bap', 'vocab:gimchi', 'vocab:gimbap', 'vocab:ramyeon'] as const;
const FOUR = FOOD_IDS.slice(0, 4);
const FIVE = FOOD_IDS.slice(0, 5);

interface ContentItem {
  id: string;
  ko: string;
  en: string;
}
const FOOD: readonly ContentItem[] = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'content', 'vocab', 'food.json'), 'utf8')) as { items: ContentItem[] }
).items;

interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}

type E2eWindow = Window & {
  __hrVocabE2E?: {
    openTopic(topicKey: string): void;
    openSpeed(topicKey: string): void;
    collect(ids: readonly string[]): boolean;
    events(): TelemetryEvent[];
  };
};

interface StoredProgress {
  vocab?: {
    items: Array<{ id: string; seen: number; right: number }>;
    topics: Array<{ topic: string; bestStars: number; sessions: number; bestCaught: number }>;
  };
}

interface StoredSettings {
  challengeMode?: boolean;
  clockScale?: number;
}

/** A new learner on Home, past the install guide, with sound off (no sound questions: every prompt can be read). */
async function newLearner(page: Page, { sound = false }: { sound?: boolean } = {}): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  if (!sound) await seedStored(page, 'device:audio', { muted: true });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  // The app shell's "ready offline" toast is not part of these screens; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
}

async function collect(page: Page, ids: readonly string[]): Promise<void> {
  await hook(page);
  expect(await page.evaluate((list) => (window as E2eWindow).__hrVocabE2E?.collect(list) ?? false, ids)).toBe(true);
}

async function openTopic(page: Page, key: string): Promise<void> {
  await hook(page);
  await page.evaluate((k) => (window as E2eWindow).__hrVocabE2E?.openTopic(k), key);
  await expect(page.getByTestId('vocab-topic')).toBeVisible();
}

async function openSpeed(page: Page, key: string): Promise<void> {
  await hook(page);
  await page.evaluate((k) => (window as E2eWindow).__hrVocabE2E?.openSpeed(k), key);
}

const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.events() ?? []);

async function expectNoShame(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SHAME);
}

async function expectFits(page: Page): Promise<void> {
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(controlsPastEdge)).toEqual([]);
}

/** The question on screen: its prompt names the answer (the word, or the picture's meaning). */
async function answerId(page: Page): Promise<string> {
  const question = page.getByTestId('vocab-question');
  await expect(question).toBeVisible();
  const word = question.getByTestId('vocab-question-word');
  const picture = question.getByTestId('vocab-question-picture');
  await expect(word.or(picture).first()).toBeVisible();
  if (await picture.count()) {
    const label = (await picture.getAttribute('aria-label')) ?? '';
    const item = FOOD.find((i) => i.en === label);
    if (!item) throw new Error(`no Food word means "${label}"`);
    return item.id;
  }
  const text = await word.innerText();
  // The longest word the prompt contains: 김밥 also contains 밥.
  const item = [...FOOD].sort((a, b) => b.ko.length - a.ko.length).find((i) => text.includes(i.ko));
  if (!item) throw new Error(`no Food word in "${text}"`);
  return item.id;
}

/** The option ids on screen. */
async function optionIds(page: Page): Promise<string[]> {
  const ids = await page
    .locator('[data-testid^="vocab-question-option-"]')
    .evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('vocab-question-option-', '')));
  return ids;
}

/** Taps the right option (or another one), then waits for the next question or the end of the round. */
async function answer(page: Page, right: boolean): Promise<{ id: string; right: boolean }> {
  const id = await answerId(page);
  const options = await optionIds(page);
  const tap = right ? id : options.find((o) => o !== id);
  if (!tap) throw new Error('no other option');
  await page.getByTestId(`vocab-question-option-${tap}`).click();
  await page.waitForTimeout(TAP_GAP_MS);
  return { id, right };
}

/** The questions of the round just started (`vocab.round.start`). */
async function roundLength(page: Page): Promise<number> {
  const start = (await events(page)).filter((e) => e.name === 'vocab.round.start').pop();
  const n = start?.payload?.questions;
  if (typeof n !== 'number') throw new Error('no vocab.round.start');
  return n;
}

async function sparks(page: Page): Promise<string | null> {
  return page.getByTestId('vocab-speed-sparks').getAttribute('aria-label');
}

test.describe('Speed Round, Relaxed (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('from the topic page to the results: no clock, sparks that only fill, stars and words caught (behaviours 1, 4, 5, 10, 16)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await newLearner(page);
    await collect(page, FIVE);
    await openTopic(page, 'food');

    // The topic page offers the Speed round once as many words as options are collected (4).
    const launch = page.getByTestId('vocab-activity-speed');
    await expect(launch).toBeVisible();
    await expect(launch).toHaveAccessibleName('Speed round');
    await launch.click();

    // A: Relaxed, its question count, the no-sound line, Start; the only Challenge affordance is the quiet
    // "Try Challenge" switch (behaviour 1, S8): no round type choice and no clock length.
    const sheet = page.getByTestId('vocab-speed-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('vocab-speed-topic')).toHaveText('Food');
    await expect(sheet.getByText('Speed round', { exact: true })).toBeVisible();
    await expect(page.getByTestId('vocab-speed-mode')).toContainText('Relaxed');
    await expect(page.getByTestId('vocab-speed-mode')).toContainText('10 words. No clock.');
    await expect(page.getByTestId('vocab-speed-no-sound')).toHaveText('No sound on this device. Pictures and words only.');
    await expect(page.getByTestId('vocab-speed-try-challenge')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radiogroup')).toHaveCount(0);
    await expect(page.getByTestId('vocab-speed-challenge')).toHaveCount(0);
    expect((await page.getByTestId('vocab-speed-start').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(80);
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-speed-sheet');

    await page.getByTestId('vocab-speed-start').click();
    await expect(page.getByTestId('vocab-speed-round')).toBeVisible();
    const start = (await events(page)).filter((e) => e.name === 'vocab.round.start');
    expect(start).toEqual([
      expect.objectContaining({
        payload: { topicKey: 'food', mode: 'relaxed', clockScale: null, optionCount: 4, level: 1, questions: 10, audio: false },
      }),
    ]);

    // B: no clock element at all, the meter and the dots, Hoya's start line, 4 options, no sound question.
    await expect(page.getByText(/\d:\d\d/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pause/i })).toHaveCount(0);
    await expect(page.getByTestId('vocab-speed-dots')).toBeAttached();
    expect(await sparks(page)).toBe('0 sparks');
    await expect(page.getByTestId('vocab-question-hoya')).toContainText('Ready when you are.');
    expect(await optionIds(page)).toHaveLength(4);
    await expect(page.getByTestId('vocab-question-speaker')).toHaveCount(0);
    await expectFits(page);
    await shot(page, 'vocab-speed-question');

    // Right first: one spark lights and Hoya cheers; the next question opens by itself.
    const first = await answer(page, true);
    await expect(page.getByTestId(`vocab-question-option-${first.id}`)).toHaveAccessibleName(/^Right/);
    expect(await sparks(page)).toBe('1 spark');
    await shot(page, 'vocab-speed-reveal-right');
    await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });

    // Then a gentle miss: the meter does not move, the right word is named, nothing counts misses.
    const second = await answer(page, false);
    await expect(page.getByTestId('vocab-question-hoya')).toContainText(new RegExp(FOOD.find((i) => i.id === second.id)?.en ?? 'x'));
    expect(await sparks(page)).toBe('1 spark');
    await expectNoShame(page);
    await shot(page, 'vocab-speed-reveal-miss');
    await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });

    // The rest right: the meter grows by one each time and never drops.
    const played = [first, second];
    for (let i = 2; i < 10; i += 1) {
      played.push(await answer(page, true));
      if (i < 9) {
        expect(await sparks(page)).toMatch(new RegExp(`^${i} sparks$`));
        await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });
      }
    }

    // H: the results replace the round. 9 of 10 right first try is 3 stars; the count is distinct words.
    const results = page.getByTestId('vocab-results');
    await expect(results).toBeVisible({ timeout: 5000 });
    const caught = new Set(played.filter((p) => p.right).map((p) => p.id)).size;
    await expect(page.getByTestId('vocab-results-caught')).toHaveText(`${caught} words caught`);
    await expect(page.getByTestId('vocab-results-stars')).toHaveAccessibleName(/3/);
    await expect(page.getByTestId('vocab-results-hoya')).toContainText('Wow, a bright round!');
    await expect(page.getByTestId('vocab-results-new-best')).toHaveCount(0);
    // Words to see again: the missed word as a tile with its Korean, romanization and meaning.
    await expect(page.getByText('Words to see again')).toBeVisible();
    const missed = FOOD.find((i) => i.id === second.id)!;
    await expect(page.getByTestId(`vocab-results-tile-${second.id}`)).toContainText(missed.ko);
    await expect(page.getByTestId(`vocab-results-tile-${second.id}`)).toContainText(missed.en);
    // Practice these waits for the flashcards (C-5); Play again is the primary meanwhile.
    await expect(page.getByTestId('vocab-results-practice')).toHaveCount(0);
    await expect(page.getByTestId('vocab-results-play-again')).toBeVisible();
    await expect(page.getByTestId('vocab-results-back')).toBeVisible();
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-speed-results');

    const done = (await events(page)).filter((e) => e.name === 'vocab.round.complete');
    expect(done).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          topicKey: 'food',
          mode: 'relaxed',
          endedBy: 'questions',
          answered: 10,
          firstTryCorrect: 9,
          hinted: 0,
          caught,
          stars: 3,
          pauses: 0,
          newBest: false,
        }),
      }),
    ]);

    // Every answer was written, and one session with the stars (F-VOC-005).
    await expect
      .poll(async () => (await readStored<StoredProgress>(page, `progress:${profileId}`))?.vocab?.topics.find((t) => t.topic === 'food'))
      .toMatchObject({ topic: 'food', sessions: 1, bestStars: 3, bestCaught: 0 });
    const stored = await readStored<StoredProgress>(page, `progress:${profileId}`);
    expect(stored?.vocab?.items.reduce((n, item) => n + item.seen, 0)).toBe(10);

    // Back to topic.
    await page.getByTestId('vocab-results-back').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a round with no first-try catch still earns a star, with Hoya thinking (behaviour 10); Play again opens the sheet', async ({ page }) => {
    await newLearner(page);
    await collect(page, FOUR);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-speed').click();
    // 4 words without sound: each asked twice, so the sheet says 8, not the level's 10.
    await expect(page.getByTestId('vocab-speed-mode')).toContainText('8 words. No clock.');
    await page.getByTestId('vocab-speed-start').click();
    const n = await roundLength(page);
    expect(n).toBe(8);
    for (let i = 0; i < n; i += 1) {
      await answer(page, false);
      if (i < n - 1) {
        expect(await sparks(page)).toBe('0 sparks');
        await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });
      }
    }
    await expect(page.getByTestId('vocab-results')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('vocab-results-caught')).toHaveText('0 words caught');
    await expect(page.getByTestId('vocab-results-stars')).toHaveAccessibleName(/1/);
    await expect(page.getByTestId('vocab-results-hoya')).toContainText('Good try! You collected a star!');
    await expectNoShame(page);
    await page.getByTestId('vocab-results-play-again').click();
    await expect(page.getByTestId('vocab-speed-sheet')).toBeVisible();
  });

  test('Stop keeps the answers given and shows no results; Keep playing goes on (behaviour 15)', async ({ page }) => {
    const profileId = await newLearner(page);
    await collect(page, FOUR);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-speed').click();
    await page.getByTestId('vocab-speed-start').click();
    await answer(page, true);
    await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });

    await page.getByTestId('vocab-speed-round').getByTestId('vocab-back').click();
    const stop = page.getByTestId('vocab-speed-stop');
    await expect(stop).toBeVisible();
    await expect(stop).toContainText('Stop for now?');
    await expect(stop).toContainText('The words you answered stay saved.');
    await shot(page, 'vocab-speed-stop');
    await page.getByTestId('vocab-speed-keep').click();
    await expect(stop).toHaveCount(0);
    await expect(page.getByTestId('vocab-speed-round')).toBeVisible();

    await page.getByTestId('vocab-speed-round').getByTestId('vocab-back').click();
    await page.getByTestId('vocab-speed-stop-confirm').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    await expect(page.getByTestId('vocab-results')).toHaveCount(0);
    expect((await events(page)).filter((e) => e.name === 'vocab.round.complete')).toEqual([]);
    await expect
      .poll(async () => (await readStored<StoredProgress>(page, `progress:${profileId}`))?.vocab?.items.reduce((n, item) => n + item.seen, 0))
      .toBe(1);
    const stored = await readStored<StoredProgress>(page, `progress:${profileId}`);
    expect(stored?.vocab?.topics.find((t) => t.topic === 'food')).toBeUndefined();
  });

  test('too few words: learn first, never a dead end (section 3.1)', async ({ page }) => {
    await newLearner(page);
    await collect(page, FOUR.slice(0, 2));
    await openTopic(page, 'food');
    await openSpeed(page, 'food');
    await expect(page.getByTestId('vocab-speed-learn-first')).toBeVisible();
    await expect(page.getByText('Learn a few more words first')).toBeVisible();
    await expect(page.getByTestId('vocab-speed-start')).toHaveCount(0);
    await expectFits(page);
    await shot(page, 'vocab-speed-learn-first');
    await page.getByTestId('vocab-speed-back-to-topic').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
  });

  test('an unknown topic goes to "Topic not found"', async ({ page }) => {
    await newLearner(page);
    await openSpeed(page, 'nope');
    await expect(page.getByTestId('vocab-topic-not-found')).toBeVisible();
  });

  test('the Pictures-first level: 8 questions of 3 pictures each (behaviour 2), at 320 x 568 and offline', async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const profileId = await newLearner(page);
    const profiles = await readStored<Array<Record<string, unknown>>>(page, 'profiles');
    await seedStored(page, 'profiles', (profiles ?? []).map((p) => (p.id === profileId ? { ...p, ageGroup: '5-7' } : p)));
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await collect(page, FOOD_IDS);
    await openTopic(page, 'food');
    await context.setOffline(true);
    await page.getByTestId('vocab-activity-speed').click();
    await expect(page.getByTestId('vocab-speed-mode')).toContainText('8 words. No clock.');
    await expectFits(page);
    await page.getByTestId('vocab-speed-start').click();
    for (let i = 0; i < 8; i += 1) {
      expect(await optionIds(page)).toHaveLength(3);
      // Pictures first never asks to read: every prompt is the word with pictures to pick.
      await expect(page.getByTestId('vocab-question-picture')).toHaveCount(0);
      if (i === 0) {
        await expectFits(page);
        await shot(page, 'vocab-speed-question-320');
      }
      await answer(page, true);
      if (i < 7) await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });
    }
    await expect(page.getByTestId('vocab-results')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('vocab-results-caught')).toHaveText('8 words caught');
    await expect(page.getByTestId('vocab-results-see-again')).toHaveCount(0);
    await expectFits(page);
    await shot(page, 'vocab-speed-results-320');
    await context.setOffline(false);
  });
});

test.describe('Speed Round, reduced motion (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('with reduced motion a whole Relaxed round plays to the results with no error (section 5)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await collect(page, FIVE);
    await openSpeed(page, 'food');
    await page.getByTestId('vocab-speed-start').click();
    const n = await roundLength(page);
    for (let i = 0; i < n; i += 1) {
      await answer(page, true);
      if (i < n - 1) await expect(page.getByTestId('vocab-question-hoya')).toHaveCount(0, { timeout: 3000 });
    }
    await expect(page.getByTestId('vocab-results')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('vocab-results-stars')).toHaveAccessibleName(/3/);
    await expectNoShame(page);
    expect(errors).toEqual([]);
  });
});

/** Hides the page (the PWA sent to the background) or shows it again: what `visibilitychange` reports. */
async function setVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}

const toggled = async (page: Page): Promise<TelemetryEvent[]> => (await events(page)).filter((e) => e.name === 'vocab.challenge_toggled');

test.describe('Speed Round, Challenge (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Try Challenge opts in, the scale is chosen, the clock counts down, stops in a pause and comes back (behaviours 7, 8)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await newLearner(page);
    await collect(page, FOOD_IDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-speed').click();

    // A1 -> A2: the switch is the explicit opt-in; it stores the setting and picks Challenge for this round.
    await expect(page.getByTestId('vocab-speed-try-challenge')).toContainText('Adds a 60-second clock. You can turn it off any time.');
    await page.getByTestId('vocab-speed-try-challenge').click();
    await expect(page.getByTestId('vocab-speed-try-challenge')).toHaveCount(0);
    const modes = page.getByRole('radiogroup', { name: 'Round type' });
    await expect(modes.getByRole('radio', { name: 'Challenge' })).toHaveAttribute('aria-checked', 'true');
    await expect(modes.getByRole('radio', { name: 'Relaxed' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('vocab-speed-mode')).toHaveText('One clock: 60 seconds for the whole round.');
    await expect(page.getByText('The clock stops while you read the answer.')).toBeVisible();
    await expect.poll(() => readStored<StoredSettings>(page, `settings:${profileId}`)).toMatchObject({ challengeMode: true });
    await expect.poll(() => toggled(page)).toEqual([expect.objectContaining({ payload: { on: true, source: 'start_sheet', clockScale: 1 } })]);

    const scales = page.getByRole('radiogroup', { name: 'Clock length' });
    await expect(scales.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
    await scales.getByRole('radio', { name: 'A bit longer' }).click();
    await expect(scales.getByRole('radio', { name: 'A bit longer' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('vocab-speed-mode')).toHaveText('One clock: 90 seconds for the whole round.');
    await expect.poll(() => readStored<StoredSettings>(page, `settings:${profileId}`)).toMatchObject({ challengeMode: true, clockScale: 1.5 });
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-speed-sheet-challenge');

    await page.getByTestId('vocab-speed-start').click();
    const start = (await events(page)).filter((e) => e.name === 'vocab.round.start').pop();
    expect(start?.payload).toMatchObject({ mode: 'challenge', clockScale: 1.5 });

    // G: the digits (one element, read on focus, never live), Pause, the meter and the bar; no dots, no hints.
    const clock = page.getByTestId('vocab-speed-clock');
    await expect(clock).toHaveAccessibleName(/^Time left: (90|89|88) seconds$/);
    await expect(clock).not.toHaveAttribute('aria-live', /.+/);
    expect(await clock.evaluate((el) => el.closest('[aria-live]')?.getAttribute('aria-live') ?? null)).toBeNull();
    await expect(page.getByTestId('vocab-speed-dots')).toHaveCount(0);
    await expect(page.getByTestId('vocab-speed-clock-bar')).toBeAttached();
    const pause = page.getByRole('button', { name: 'Pause' });
    expect((await pause.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
    await expectFits(page);
    await shot(page, 'vocab-speed-challenge-question');

    // The clock runs while a question is on screen.
    await expect.poll(async () => clock.innerText(), { timeout: 5000 }).not.toBe('1:30');
    await answer(page, true);
    expect(await sparks(page)).toBe('1 spark');

    // Pause: the question is replaced (not dimmed) and the time stands still.
    await pause.click();
    await expect(page.getByTestId('vocab-speed-paused')).toBeVisible();
    await expect(page.getByTestId('vocab-question')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    const frozen = await clock.innerText();
    await expectFits(page);
    await shot(page, 'vocab-speed-paused');
    await page.waitForTimeout(2200);
    expect(await clock.innerText()).toBe(frozen);

    // Resume: the same time left (the 250 ms ticks start again at once, so at most a second less) and the question.
    await page.getByTestId('vocab-speed-resume').click();
    await expect(page.getByTestId('vocab-question')).toBeVisible();
    const seconds = (digits: string): number => {
      const [m = '0', sec = '0'] = digits.split(':');
      return Number(m) * 60 + Number(sec);
    };
    expect(seconds(frozen) - seconds(await clock.innerText())).toBeGreaterThanOrEqual(0);
    expect(seconds(frozen) - seconds(await clock.innerText())).toBeLessThanOrEqual(1);

    // The app going to the background pauses the round; coming back shows the paused panel until Resume.
    await setVisible(page, false);
    await expect(page.getByTestId('vocab-speed-paused')).toBeVisible();
    await setVisible(page, true);
    await expect(page.getByTestId('vocab-speed-paused')).toBeVisible();
    await page.getByTestId('vocab-speed-resume').click();
    await expect(page.getByTestId('vocab-question')).toBeVisible();

    // Stop from the round: no results, the answer given stays written.
    await page.getByTestId('vocab-speed-round').getByTestId('vocab-back').click();
    await page.getByTestId('vocab-speed-stop-confirm').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    await expect(page.getByTestId('vocab-results')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the clock ends the round: the question on screen is dropped, a calm time-up line, then the results (behaviours 6, 11)', async ({ page }) => {
    await page.clock.install();
    const profileId = await newLearner(page);
    await seedStored(page, `settings:${profileId}`, { romanizationMode: 'always', challengeMode: true });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await collect(page, FOOD_IDS);
    await openSpeed(page, 'food');

    // Opted in: the round type choice, Relaxed selected (never preselected), then Challenge chosen.
    const modes = page.getByRole('radiogroup', { name: 'Round type' });
    await expect(modes.getByRole('radio', { name: 'Relaxed' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('vocab-speed-try-challenge')).toHaveCount(0);
    await modes.getByRole('radio', { name: 'Challenge' }).click();
    await page.getByTestId('vocab-speed-start').click();
    await expect(page.getByTestId('vocab-speed-clock')).toBeVisible();

    const first = await answer(page, true);
    await page.clock.runFor(1200);
    const second = await answer(page, true);
    await page.clock.runFor(1200);
    await expect(page.getByTestId('vocab-question')).toBeVisible();

    // Let the whole minute run out on the third question, unanswered, a second at a time (the time-up beat is 1 s).
    const timeUp = page.getByTestId('vocab-speed-time-up');
    for (let s = 0; s < 70 && (await timeUp.count()) === 0; s += 1) await page.clock.runFor(1000);
    await expect(timeUp).toHaveText("That's the time! Nice work.");
    await expect(page.getByTestId('vocab-speed-few-seconds')).toHaveCount(0);
    // The round is over and saved: no Back (nothing to stop) and no Pause during the beat.
    await expect(page.getByTestId('vocab-speed-round').getByTestId('vocab-back')).toHaveCount(0);
    await expect(page.getByTestId('vocab-speed-pause')).toHaveCount(0);
    await shot(page, 'vocab-speed-time-up');
    await page.clock.runFor(1200);

    await expect(page.getByTestId('vocab-results')).toBeVisible();
    await expect(page.getByText("Time's up. Here is what you caught.")).toBeVisible();
    await expect(page.getByTestId('vocab-results-caught')).toHaveText(first.id === second.id ? '1 word caught' : '2 words caught');
    await expect(page.getByTestId('vocab-results-new-best')).toHaveText('New best!');
    await expect(page.getByTestId('vocab-results-see-again')).toHaveCount(0);
    await expectNoShame(page);
    await shot(page, 'vocab-speed-results-challenge');

    const complete = (await events(page)).filter((e) => e.name === 'vocab.round.complete');
    expect(complete).toEqual([expect.objectContaining({ payload: expect.objectContaining({ mode: 'challenge', endedBy: 'clock', answered: 2, newBest: true }) })]);
    // Only the two answers were written: the dropped question is neither a miss nor a seen word.
    const stored = await readStored<StoredProgress>(page, `progress:${profileId}`);
    const seen = (stored?.vocab?.items ?? []).reduce((n, i) => n + i.seen, 0);
    expect(seen).toBe(2);
    const best = first.id === second.id ? 1 : 2;
    expect(stored?.vocab?.topics.find((t) => t.topic === 'food')?.bestCaught).toBe(best);

    // Play again keeps Challenge; one word caught is not above the best, so no "New best!" (behaviour 11).
    await page.getByTestId('vocab-results-play-again').click();
    await expect(page.getByRole('radiogroup', { name: 'Round type' }).getByRole('radio', { name: 'Challenge' })).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('vocab-speed-start').click();
    await answer(page, true);
    for (let s = 0; s < 70 && (await timeUp.count()) === 0; s += 1) await page.clock.runFor(1000);
    await page.clock.runFor(1200);
    await expect(page.getByTestId('vocab-results')).toBeVisible();
    await expect(page.getByTestId('vocab-results-caught')).toHaveText('1 word caught');
    await expect(page.getByTestId('vocab-results-new-best')).toHaveCount(0);
    await expectNoShame(page);
  });

  test('the Profile switch turns Challenge on and off and sets the clock length; the sheet follows', async ({ page }) => {
    const profileId = await newLearner(page);
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    const card = page.getByTestId('profile-challenge');
    await card.scrollIntoViewIfNeeded();
    const toggle = page.getByRole('switch', { name: /^Challenge\./ });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('profile-challenge-scale')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radiogroup', { name: 'Clock length' }).getByRole('radio', { name: 'Twice as long' }).click();
    await expect.poll(() => readStored<StoredSettings>(page, `settings:${profileId}`)).toMatchObject({ challengeMode: true, clockScale: 2 });
    await expect.poll(async () => (await toggled(page)).map((e) => e.payload)).toEqual([
      { on: true, source: 'profile', clockScale: 1 },
      { on: true, source: 'profile', clockScale: 2 },
    ]);
    await expectFits(page);
    await shot(page, 'vocab-speed-profile-challenge');

    // Off again: the sheet is back to Relaxed with the quiet switch.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => readStored<StoredSettings>(page, `settings:${profileId}`)).toMatchObject({ challengeMode: false, clockScale: 2 });
    await collect(page, FOUR);
    await openSpeed(page, 'food');
    await expect(page.getByTestId('vocab-speed-try-challenge')).toBeVisible();
    // The quiet switch names the clock an opt-in would give: the stored twice-as-long scale.
    await expect(page.getByTestId('vocab-speed-try-challenge')).toContainText('Adds a 120-second clock.');
    await expect(page.getByRole('radiogroup')).toHaveCount(0);
  });
});
