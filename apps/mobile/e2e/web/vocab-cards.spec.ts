import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-VOC-003 C-5: the flashcards, the quick check and the chunk summary
 * (design/screens/vocab/cards.md). Words stays behind `flags.vocabTopicsEnabled`
 * (off until C-7), so the suite runs on the fixture bundle, which opens the topic
 * page through `window.__hrVocabE2E.openTopic(key)`; Learn is a real button there.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-cards
 *
 * Speech is the silent engine of ./fixtures (no Korean voice) unless a test
 * installs `voicedSpeech`. Taught Korean is matched through its romanization, so
 * this file holds no Hangul.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** More than the question view's 50 ms double-tap window between two deliberate taps. */
const TAP_GAP_MS = 120;
/** Words and marks a learner never reads here (D3, T3): no fraction, no percent, no "wrong". */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|premium|locked)\b|%|\d\s*\/\s*\d|\d+ of \d+/i;
/** Food's first chunk at 4 words (level 1 words in file order) and the next one. */
const CHUNK0 = ['vocab:sagwa-apple', 'vocab:uyu', 'vocab:ppang', 'vocab:bap'] as const;
const ROMANIZED: Record<string, string> = {
  'vocab:sagwa-apple': 'sagwa',
  'vocab:uyu': 'uyu',
  'vocab:ppang': 'ppang',
  'vocab:bap': 'bap',
  'vocab:gimchi': 'gimchi',
  'vocab:mul': 'mul',
  'vocab:tteok': 'tteok',
  'vocab:banana': 'banana',
};
const GLOSS: Record<string, string> = { 'vocab:sagwa-apple': 'apple', 'vocab:uyu': 'milk', 'vocab:ppang': 'bread', 'vocab:bap': 'cooked rice' };

interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}

type E2eWindow = Window & {
  __hrVocabE2E?: {
    openTopic(topicKey: string): void;
    collect(ids: readonly string[]): boolean;
    events(): TelemetryEvent[];
  };
  __spoken?: string[];
};

/** A new learner on Home, past the install guide. */
async function newLearner(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
}

async function openTopic(page: Page, key: string): Promise<void> {
  await hook(page);
  await page.evaluate((k) => (window as E2eWindow).__hrVocabE2E?.openTopic(k), key);
  await expect(page.getByTestId('vocab-topic')).toBeVisible();
}

async function collect(page: Page, ids: readonly string[]): Promise<void> {
  await hook(page);
  expect(await page.evaluate((list) => (window as E2eWindow).__hrVocabE2E?.collect(list) ?? false, ids)).toBe(true);
}

/** Opens Food's flashcards from the topic page's Learn button. */
async function learnFood(page: Page): Promise<void> {
  await openTopic(page, 'food');
  await page.getByTestId('vocab-activity-learn').click();
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
}

const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.events() ?? []);
const named = async (page: Page, name: string): Promise<TelemetryEvent[]> => (await events(page)).filter((e) => e.name === name);

const card = (page: Page) => page.getByTestId('vocab-card-flip');

/** The card on screen, by its romanization (the front's button name starts with it). */
async function expectFront(page: Page, id: string): Promise<void> {
  await expect(card(page)).toHaveAccessibleName(new RegExp(`^Korean: \\S+, ${ROMANIZED[id]}\\. Show meaning\\.$`));
  await expect(page.getByTestId('vocab-card-front')).toBeVisible();
}

async function flip(page: Page): Promise<void> {
  await card(page).click();
  await expect(page.getByTestId('vocab-card-back')).toBeVisible();
}

async function mark(page: Page, which: 'got-it' | 'again'): Promise<void> {
  await page.getByTestId(`vocab-card-${which}`).click();
}

/** Answers the quick check's question on screen, first with `missFirst` wrong taps (check mode lets the learner tap again). */
async function answerCheck(page: Page, missFirst: number): Promise<string> {
  const word = await page.getByTestId('vocab-question-word').innerText();
  const id = Object.keys(ROMANIZED).find((key) => word.split(/\s+/).includes(ROMANIZED[key]!));
  if (!id) throw new Error(`no known word in "${word}"`);
  const wrong = page.locator('[data-testid^="vocab-question-option-"]');
  const others = (await wrong.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).filter((t) => t !== `vocab-question-option-${id}`);
  for (const t of others.slice(0, missFirst)) {
    await page.getByTestId(t!).click();
    await page.waitForTimeout(TAP_GAP_MS);
  }
  await page.getByTestId(`vocab-question-option-${id}`).click();
  return id;
}

async function expectNoShame(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SHAME);
}

async function expectFits(page: Page): Promise<void> {
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(controlsPastEdge)).toEqual([]);
}

async function profileId(page: Page): Promise<string> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

interface StoredVocab {
  vocab?: { items: Array<{ id: string; seen: number; box: number }>; topics: Array<{ topic: string; sessions: number }> };
}

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

const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...((window as E2eWindow).__spoken ?? [])]);

/**
 * The whole first chunk: Show me again on the first card, Got it on the other three, the first card again
 * (Show me again a second time does not bring it back a third time), the quick check with one miss, the summary.
 */
async function playFirstChunk(page: Page, opts: { shots?: boolean } = {}): Promise<void> {
  await expectFront(page, CHUNK0[0]);
  if (opts.shots) await shot(page, 'vocab-cards-front');
  await flip(page);
  await expect(page.getByTestId('vocab-card-gloss')).toHaveText(GLOSS[CHUNK0[0]]!);
  if (opts.shots) await shot(page, 'vocab-cards-back');
  await mark(page, 'again');
  for (const id of CHUNK0.slice(1)) {
    await expectFront(page, id);
    await flip(page);
    await expect(page.getByTestId('vocab-card-gloss')).toHaveText(GLOSS[id]!);
    await mark(page, 'got-it');
  }
  // The Show-me-again card comes back once, at the end.
  await expectFront(page, CHUNK0[0]);
  await flip(page);
  await mark(page, 'again');

  await expect(page.getByTestId('vocab-cards-check')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick check' })).toBeVisible();
  // The Show-me-again word is asked first.
  expect(await answerCheck(page, 1)).toBe(CHUNK0[0]);
  if (opts.shots) await shot(page, 'vocab-cards-check');
  await expect(page.getByTestId('vocab-question-word')).not.toContainText(ROMANIZED[CHUNK0[0]]!, { timeout: 3000 });
  await answerCheck(page, 0);
  await expect(page.getByTestId('vocab-cards-summary')).toBeVisible({ timeout: 3000 });
}

test.describe('Words flashcards (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Learn: flip four cards, got it and show me again, the quick check, then "4 new words collected"', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await learnFood(page);

    expect(await named(page, 'vocab.cards.start')).toEqual([
      expect.objectContaining({ payload: { topicKey: 'food', chunk: 0, chunks: 3, words: 4, level: expect.any(Number) } }),
    ]);
    // The dots are hidden from screen readers; nothing reads "n of m".
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expectNoShame(page);
    await expectFits(page);

    await playFirstChunk(page, { shots: true });

    await expect(page.getByTestId('vocab-cards-summary-line')).toContainText('4 new words collected');
    await expect(page.getByTestId('vocab-cards-next')).toHaveText('Next words');
    await expect(page.getByTestId('vocab-cards-topic')).toBeVisible();
    // Speed round: the Speed Round is in the build (F-VOC-004 S-5) and 4 words are collected.
    await expect(page.getByTestId('vocab-cards-speed')).toBeVisible();
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-cards-summary');

    expect(await named(page, 'vocab.cards.complete')).toEqual([
      expect.objectContaining({
        payload: { topicKey: 'food', chunk: 0, words: 4, gotIt: 3, again: 1, heard: 0, newlyCollected: 4, checkFirstTry: 1, checkQuestions: 2 },
      }),
    ]);
    // Written as it happened: four words collected, the first one asked to see again, and one cards session.
    const id = await profileId(page);
    await expect
      .poll(async () => ((await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.items ?? []).map((i) => i.id).sort())
      .toEqual([...CHUNK0].sort());
    const stored = await readStored<StoredVocab>(page, `progress:${id}`);
    expect(stored?.vocab?.topics).toEqual([expect.objectContaining({ topic: 'food', sessions: 1 })]);

    // Next words opens the next chunk.
    await page.getByTestId('vocab-cards-next').click();
    await expectFront(page, 'vocab:gimchi');
    expect((await named(page, 'vocab.cards.start')).map((e) => e.payload?.chunk)).toEqual([0, 1]);
    expect(errors).toEqual([]);
  });

  test('the same flow offline (airplane mode)', async ({ page, context }: { page: Page; context: BrowserContext }) => {
    await newLearner(page);
    await context.setOffline(true);
    await learnFood(page);
    await playFirstChunk(page);
    await expect(page.getByTestId('vocab-cards-summary-line')).toContainText('4 new words collected');
    await context.setOffline(false);
  });

  test('the card names carry the word, the back its meaning, and the new face is said after a flip', async ({ page }) => {
    await newLearner(page);
    await learnFood(page);
    await expect(card(page)).toHaveAccessibleName(/^Korean: \S+, sagwa\. Show meaning\.$/);
    await expect(card(page)).toBeFocused();
    await card(page).click();
    await expect(card(page)).toHaveAccessibleName(/^Korean: \S+, sagwa, apple\. Show word\.$/);
    await expect(page.getByTestId('vocab-card-said')).toHaveText(/^Meaning: apple\. Korean: \S+, sagwa\.$/);
    await card(page).click();
    await expect(page.getByTestId('vocab-card-front')).toBeVisible();
    await expect(page.getByTestId('vocab-card-said')).toHaveText(/^Back to the word\. Korean: \S+, sagwa\.$/);
    // Got it is only on the back.
    await expect(page.getByTestId('vocab-card-got-it')).toHaveCount(0);
    // Each control is a large target: the card, the speaker and the marks >= 80, the switch >= 64.
    for (const id of ['vocab-card-flip', 'vocab-card-speaker']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(80);
    }
    expect((await page.getByTestId('vocab-cards-reading-practice').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
    await flip(page);
    for (const id of ['vocab-card-got-it', 'vocab-card-again']) {
      expect((await page.getByTestId(id).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(80);
    }
  });

  test('reduced motion: the card turns over at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await newLearner(page);
    await learnFood(page);
    await card(page).click();
    await expect(page.getByTestId('vocab-card-back')).toBeVisible({ timeout: 100 });
  });

  test('leaving mid-chunk asks first; Stop keeps the words already turned (behaviour 9)', async ({ page }) => {
    await newLearner(page);
    await learnFood(page);
    await flip(page);
    await mark(page, 'got-it');
    await flip(page);
    await page.getByTestId('vocab-cards').getByTestId('vocab-back').click();
    await expect(page.getByText('Keep going or stop for now?')).toBeVisible();
    await shot(page, 'vocab-cards-leave');
    await page.getByTestId('vocab-cards-keep').click();
    await expect(page.getByTestId('vocab-cards-leave')).toHaveCount(0);
    await expect(page.getByTestId('vocab-card-back')).toBeVisible();

    await page.getByTestId('vocab-cards').getByTestId('vocab-back').click();
    await page.getByTestId('vocab-cards-stop').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    await expect(page.getByTestId('vocab-topic-count')).toHaveText('2 collected');
    expect(await named(page, 'vocab.cards.complete')).toEqual([]);
  });

  test('reading practice: the switch hides the romanization behind Show sound, per card, and is the profile setting', async ({ page }) => {
    await newLearner(page);
    await learnFood(page);
    const toggle = page.getByTestId('vocab-cards-reading-practice');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('vocab-card-front')).toContainText('sagwa');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toContainText('On');
    await expect(page.getByTestId('vocab-card-front')).not.toContainText('sagwa');
    await expect(card(page)).toHaveAccessibleName(/^Korean: \S+\. Show meaning\.$/);
    await shot(page, 'vocab-cards-reading-practice');
    await page.getByTestId('vocab-card-reveal').click();
    await expect(page.getByTestId('vocab-card-front')).toContainText('sagwa');
    // The gloss on the back is never hidden.
    await flip(page);
    await expect(page.getByTestId('vocab-card-gloss')).toHaveText('apple');
    await mark(page, 'got-it');
    // The reveal lasts for that card only.
    await expect(page.getByTestId('vocab-card-front')).not.toContainText('uyu');
    await expect(page.getByTestId('vocab-card-reveal')).toBeVisible();
    // The same setting as the Profile screen, kept for the profile (behaviour 7).
    const id = await profileId(page);
    await expect.poll(async () => (await readStored<{ romanizationMode?: string }>(page, `settings:${id}`))?.romanizationMode).toBe('tap');
    // ...and it survives restarting the app.
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await learnFood(page);
    await expect(page.getByTestId('vocab-cards-reading-practice')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('vocab-card-reveal')).toBeVisible();
  });

  test('no Korean voice: the Korean and its romanization stay, with one calm line (behaviour 8)', async ({ page }) => {
    await newLearner(page);
    await learnFood(page);
    await expect(page.getByTestId('vocab-card-front')).toContainText('sagwa');
    await expect(page.getByTestId('vocab-card-no-sound')).toHaveText('No sound? You can read it here.');
    await shot(page, 'vocab-cards-no-voice');
    await flip(page);
    await mark(page, 'got-it');
    await expectFront(page, 'vocab:uyu');
  });

  test('a voice plays each new front once, the speaker replays it; sound off offers Turn sound on', async ({ page }) => {
    await voicedSpeech(page);
    await newLearner(page);
    await learnFood(page);
    await expect.poll(async () => (await spoken(page)).length).toBe(1);
    await expect(page.getByTestId('vocab-card-no-sound')).toHaveCount(0);
    await page.getByTestId('vocab-card-speaker').click();
    await expect.poll(async () => (await spoken(page)).length).toBe(2);
    await flip(page);
    await mark(page, 'got-it');
    await expect.poll(async () => (await spoken(page)).length).toBe(3);
    await page.waitForTimeout(300);
    expect((await spoken(page)).length).toBe(3);

    await seedStored(page, 'device:audio', { muted: true });
    await learnFood(page);
    const speaker = page.getByTestId('vocab-card-speaker');
    await expect(speaker).toHaveAccessibleName('Play sound, sound is off');
    await expect(page.getByTestId('vocab-card-no-sound')).toBeVisible();
    await speaker.click();
    const turnOn = page.getByTestId('vocab-card-sound').getByRole('button', { name: 'Turn sound on' });
    await expect(turnOn).toBeVisible();
    const before = (await spoken(page)).length;
    await turnOn.click();
    await expect.poll(async () => (await spoken(page)).length).toBe(before + 1);
  });

  test('a collected wall tile opens its card on the back; a chunk already collected ends with Review these (behaviour 12)', async ({ page }) => {
    await newLearner(page);
    await collect(page, CHUNK0);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-wall-vocab:uyu').click();
    await expect(page.getByTestId('vocab-card-back')).toBeVisible();
    await expect(page.getByTestId('vocab-card-gloss')).toHaveText('milk');
    await mark(page, 'got-it');
    for (const id of ['vocab:sagwa-apple', 'vocab:ppang', 'vocab:bap']) {
      await expectFront(page, id);
      await flip(page);
      await mark(page, 'got-it');
    }
    await expect(page.getByTestId('vocab-cards-check')).toBeVisible();
    await answerCheck(page, 0);
    await expect(page.getByTestId('vocab-question-word')).toBeVisible();
    await page.waitForTimeout(900);
    await answerCheck(page, 0);
    await expect(page.getByTestId('vocab-cards-summary')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('vocab-cards-summary-line')).toContainText('0 new words collected');
    await expect(page.getByTestId('vocab-cards-next')).toHaveText('Review these');
    expect((await named(page, 'vocab.cards.complete'))[0]?.payload).toEqual(expect.objectContaining({ newlyCollected: 0, words: 4 }));
    await page.getByTestId('vocab-cards-topic').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
  });

  test('320 x 568: the card, the stacked marks and the summary fit with nothing past the edge', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await newLearner(page);
    await learnFood(page);
    await expectFits(page);
    await flip(page);
    // The marks stay on screen (the sticky footer), stacked with Got it on top.
    const got = await page.getByTestId('vocab-card-got-it').boundingBox();
    const again = await page.getByTestId('vocab-card-again').boundingBox();
    expect(got && again).toBeTruthy();
    expect(got!.y + got!.height).toBeLessThanOrEqual(568);
    expect(again!.y + again!.height).toBeLessThanOrEqual(568);
    expect(got!.y).toBeLessThan(again!.y);
    // Screen readers and Tab meet them in the drawn order: Got it, then Show me again.
    const order = await page
      .getByTestId('vocab-card-marks')
      .locator('[data-testid="vocab-card-got-it"], [data-testid="vocab-card-again"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(order).toEqual(['vocab-card-got-it', 'vocab-card-again']);
    await expectFits(page);
    await shot(page, 'vocab-cards-back-320');
  });

  test('landscape 568 x 320: the card and the marks fit with nothing past the edge', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await newLearner(page);
    await learnFood(page);
    await expectFits(page);
    await flip(page);
    await expect(page.getByTestId('vocab-card-got-it')).toBeInViewport();
    await expect(page.getByTestId('vocab-card-again')).toBeInViewport();
    await expectFits(page);
  });
});

test.describe('Words flashcards with the flag off (the release build, dist/)', () => {
  test.skip(FIXTURE_BUILD || process.env.E2E_VOCAB_TOPICS === '1', 'the fixture bundle and the Words build offer Words');

  test('no Words entry, so no way into the flashcards', async ({ page }) => {
    await newLearner(page);
    await page.getByText('Library', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Words' })).toHaveCount(0);
    await expect(page.getByTestId('vocab-cards')).toHaveCount(0);
  });
});
