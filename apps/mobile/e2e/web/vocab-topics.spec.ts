import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-VOC-003 C-4: the Words picker, the topic page with its word wall, and the
 * Library's Words section (design/screens/vocab/topics.md, topic.md).
 *
 * Words stays behind `flags.vocabTopicsEnabled` (off until C-7), so:
 * - every build: with the flag off the Library has no Words tab (behaviour 1);
 * - the fixture bundle (`STORY_FIXTURES=1`, served from dist-e2e/): the picker
 *   and topic pages through `window.__hrVocabE2E.openTopics()` /
 *   `openTopic(key)`, words collected with `collect(ids)`;
 * - a build made with `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=1` (`E2E_VOCAB_TOPICS=1`):
 *   the Library's Words tab, end to end.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-topics
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const WORDS_BUILD = process.env.E2E_VOCAB_TOPICS === '1';
/** Words and marks a learner never reads here (D3): no fraction, no percent, no "wrong". */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|premium|locked)\b|%|\d\s*\/\s*\d|\d+ of \d+/i;
/**
 * The topics that are `ready` today, in topic order (V12): the other eight stay draft until V-7. A ready
 * topic is listed only once every one of its pictures is drawn (T8): Animals waits for its hand-drawn
 * glyphs (F-VOC-002), so the picker may hold fewer than these, never others and never out of order.
 */
const READY = ['food', 'animals', 'colors', 'numbers'] as const;
/** Ready topics whose every picture is drawn in this build (Food's glyphs and the generated colour and count families). */
const DRAWN = ['food', 'colors', 'numbers'] as const;

/** The listed topics are ready ones, in topic order, and include every topic known to be fully drawn. */
function expectReadyTopics(listed: readonly (string | null)[]): void {
  const keys = listed.map((id) => (id ?? '').replace('vocab-topic-tile-', ''));
  expect(keys).toEqual(READY.filter((key) => keys.includes(key)));
  for (const key of DRAWN) expect(keys).toContain(key);
}

interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}

type E2eWindow = Window & {
  __hrVocabE2E?: {
    openTopics(): void;
    openTopic(topicKey: string): void;
    collect(ids: readonly string[]): boolean;
    events(): TelemetryEvent[];
  };
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
  // The app shell's "ready offline" toast is not part of these screens; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
}

async function openTopics(page: Page): Promise<void> {
  await hook(page);
  await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.openTopics());
  await expect(page.getByTestId('vocab-topics')).toBeVisible();
}

async function openTopic(page: Page, key: string): Promise<void> {
  await hook(page);
  await page.evaluate((k) => (window as E2eWindow).__hrVocabE2E?.openTopic(k), key);
}

async function collect(page: Page, ids: readonly string[]): Promise<void> {
  await hook(page);
  expect(await page.evaluate((list) => (window as E2eWindow).__hrVocabE2E?.collect(list) ?? false, ids)).toBe(true);
}

const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.events() ?? []);

/** Distinct left edges of the elements matching the test id prefix: one per column. */
async function columns(page: Page, prefix: string): Promise<number> {
  const lefts = await page
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  return new Set(lefts).size;
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

test.describe('Words with the flag off (every build but the Words build)', () => {
  test.skip(WORDS_BUILD, 'the Words build turns the flag on');

  test('the Library has no Words tab and no Words copy (behaviour 1)', async ({ page }) => {
    await newLearner(page);
    await page.getByText('Library', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Words' })).toHaveCount(0);
    await expect(page.getByText('Pick a topic. Meet a few words at a time.')).toHaveCount(0);
    await expect(page.getByTestId('library-words')).toHaveCount(0);
  });
});

test.describe('Words picker and topic page (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('the picker lists the ready topics in order, each a button with a plain count; a tap opens the topic and is counted', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await openTopics(page);

    await expect(page.getByRole('heading', { name: 'Words' })).toBeVisible();
    await expect(page.getByText('Pick a topic you like.')).toBeVisible();
    const tiles = page.locator('[data-testid^="vocab-topic-tile-"]');
    expectReadyTopics(await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid'))));
    for (const [key, title] of [
      ['food', 'Food'],
      ['colors', 'Colors'],
      ['numbers', 'Numbers'],
    ] as const) {
      await expect(page.getByTestId(`vocab-topic-tile-${key}`)).toHaveAccessibleName(`${title}. 0 words collected.`);
    }
    // A draft topic never reaches a learner (V12).
    await expect(page.getByTestId('vocab-topic-tile-body')).toHaveCount(0);
    // Korean title with its romanization; the count in words; the bar is hidden from screen readers.
    const food = page.getByTestId('vocab-topic-tile-food');
    await expect(food).toContainText('음식');
    await expect(food).toContainText('eumsik');
    await expect(food).toContainText('0 collected');
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    // 2 columns on a 393 dp phone (§3.3).
    expect(await columns(page, 'vocab-topic-tile-')).toBe(2);
    for (const box of await tiles.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(80);
    }
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-topics-picker');

    await food.click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    await expect(page.getByTestId('vocab-topic-title')).toHaveText('Food');
    expect((await events(page)).filter((e) => e.name === 'vocab.topic_opened')).toEqual([
      expect.objectContaining({ name: 'vocab.topic_opened', payload: { topicKey: 'food', source: 'library' } }),
    ]);
    // Back returns to the picker (it stays mounted under the topic page, so the topic page's own Back).
    await page.getByTestId('vocab-topic').getByTestId('vocab-back').click();
    await expect(page.getByTestId('vocab-topics')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the topic page: count, Hoya, the wall with collected words and silhouettes, and nothing that goes nowhere', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await collect(page, ['vocab:sagwa-apple', 'vocab:uyu', 'vocab:gimchi']);
    await openTopics(page);
    await expect(page.getByTestId('vocab-topic-tile-food')).toHaveAccessibleName('Food. 3 words collected.');
    await expect(page.getByTestId('vocab-topic-tile-food')).toContainText('3 collected');
    await page.getByTestId('vocab-topic-tile-food').click();

    await expect(page.getByTestId('vocab-topic-title')).toHaveText('Food');
    await expect(page.getByLabel('Korean: 음식, eumsik, Food')).toBeVisible();
    await expect(page.getByTestId('vocab-topic-count')).toHaveText('3 collected');
    await expect(page.getByTestId('vocab-topic-hoya')).toContainText("Hungry? Let's name some tasty things together.");

    // Every word, in file order: collected words with their picture and Korean, the rest as silhouettes.
    const wall = page.locator('[data-testid^="vocab-wall-"]');
    await expect(wall).toHaveCount(12);
    expect((await wall.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid'))))?.slice(0, 4)).toEqual([
      'vocab-wall-vocab:sagwa-apple',
      'vocab-wall-vocab:banana',
      'vocab-wall-vocab:uyu',
      'vocab-wall-vocab:ppang',
    ]);
    await expect(page.getByLabel('Korean: 사과, sagwa, apple')).toBeVisible();
    await expect(page.getByLabel('Korean: 우유, uyu, milk')).toBeVisible();
    await expect(page.getByLabel('Korean: 김치, gimchi, kimchi')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Not collected yet' })).toHaveCount(9);
    // A word not collected yet shows no Korean (no spoilers).
    await expect(page.getByTestId('vocab-wall-vocab:banana')).not.toContainText('바나나');
    await expect(page.getByTestId('vocab-wall-vocab:banana')).not.toContainText('banana');
    // The meter is hidden from screen readers; the count is text, never "3 of 12".
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    // C-4 ships no activity screen yet: no activity button and no tile button that would go nowhere.
    await expect(page.getByTestId('vocab-topic-activities')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Korean: / })).toHaveCount(0);

    // 2 wall columns on a 393 dp phone: every word and its romanization stay whole.
    expect(await columns(page, 'vocab-wall-')).toBe(2);
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-topic-food');
    expect(errors).toEqual([]);
  });

  test('Hoya says the topic line once per topic per session', async ({ page }) => {
    await newLearner(page);
    await openTopic(page, 'numbers');
    await expect(page.getByTestId('vocab-topic-hoya')).toContainText("Let's count together, one by one.");
    await page.getByTestId('vocab-back').click();
    await openTopic(page, 'numbers');
    await expect(page.getByTestId('vocab-topic-title')).toHaveText('Numbers');
    await expect(page.getByTestId('vocab-topic-hoya')).toHaveCount(0);
    await page.getByTestId('vocab-back').click();
    await openTopic(page, 'colors');
    await expect(page.getByTestId('vocab-topic-hoya')).toBeVisible();
  });

  test('an unknown or draft topic is "Topic not found" with a way back (T8)', async ({ page }) => {
    await newLearner(page);
    for (const key of ['nope', 'body']) {
      await openTopic(page, key);
      await expect(page.getByTestId('vocab-topic-not-found')).toBeVisible();
      await expect(page.getByText('Topic not found')).toBeVisible();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByTestId('vocab-topic-not-found')).toHaveCount(0);
      await expect(page.getByText('Hi, Dami!')).toBeVisible();
    }
  });

  test('reading practice hides the romanization on the tiles and the wall; the header reveals it on a tap', async ({ page }) => {
    await newLearner(page);
    const id = await profileId(page);
    await seedStored(page, `settings:${id}`, { romanizationMode: 'tap' });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await collect(page, ['vocab:ppalgansaek']);
    await openTopics(page);
    await expect(page.getByTestId('vocab-topic-tile-colors')).toContainText('색');
    await expect(page.getByTestId('vocab-topic-tile-colors')).not.toContainText('saek');
    await page.getByTestId('vocab-topic-tile-colors').click();

    await expect(page.getByTestId('vocab-topic-ko')).not.toContainText('saek');
    await expect(page.getByTestId('vocab-wall-vocab:ppalgansaek')).toContainText('빨간색');
    await expect(page.getByTestId('vocab-wall-vocab:ppalgansaek')).not.toContainText('ppalgansaek');
    // The meaning is never hidden: the screen reader name still carries the gloss.
    await expect(page.getByLabel('Korean: 빨간색, ppalgansaek, red')).toBeVisible();
    await page.getByRole('button', { name: 'Show sound' }).click();
    await expect(page.getByTestId('vocab-topic-ko')).toContainText('saek');
    await expect(page.getByRole('button', { name: 'Show sound' })).toHaveCount(0);
  });

  test('320 x 568: one picker column, two wall columns, nothing clipped or off the side', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await newLearner(page);
    await collect(page, ['vocab:geomeunsaek', 'vocab:juhwangsaek', 'vocab:haneulsaek']);
    await openTopics(page);
    expect(await columns(page, 'vocab-topic-tile-')).toBe(1);
    await expectFits(page);
    await shot(page, 'vocab-topics-320');

    await page.getByTestId('vocab-topic-tile-colors').click();
    await expect(page.getByTestId('vocab-topic-count')).toHaveText('3 collected');
    expect(await columns(page, 'vocab-wall-')).toBe(2);
    // The widest launch word keeps its romanization on one line inside its tile.
    const tile = page.getByTestId('vocab-wall-vocab:geomeunsaek');
    const roman = tile.getByText('geomeunsaek', { exact: true });
    const [tileBox, romanBox] = await Promise.all([tile.boundingBox(), roman.boundingBox()]);
    expect(romanBox!.height).toBeLessThan(30);
    expect(romanBox!.x).toBeGreaterThanOrEqual(tileBox!.x);
    expect(romanBox!.x + romanBox!.width).toBeLessThanOrEqual(tileBox!.x + tileBox!.width);
    await expectFits(page);
    await shot(page, 'vocab-topic-colors-320');
    await tile.scrollIntoViewIfNeeded();
    await shot(page, 'vocab-topic-colors-320-wall');
  });

  test('a tablet window: three picker columns and four wall columns', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await newLearner(page);
    await collect(page, ['vocab:hana', 'vocab:dul', 'vocab:set', 'vocab:net', 'vocab:daseot']);
    await openTopics(page);
    expect(await columns(page, 'vocab-topic-tile-')).toBe(3);
    await shot(page, 'vocab-topics-tablet');
    await page.getByTestId('vocab-topic-tile-numbers').click();
    expect(await columns(page, 'vocab-wall-')).toBe(4);
    await expectFits(page);
    await shot(page, 'vocab-topic-numbers-tablet');
  });
});

test.describe('the Library Words tab (a build with EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=1)', () => {
  test.skip(!WORDS_BUILD, 'needs a build made with EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=1, then E2E_VOCAB_TOPICS=1');

  test('Words is a Library tab with a line, the words collected and the topic grid; a tile opens the topic', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await page.getByText('Library', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    const tab = page.getByRole('tab', { name: 'Words' });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    const section = page.getByTestId('library-words');
    await expect(section).toContainText('Pick a topic. Meet a few words at a time.');
    await expect(page.getByTestId('library-words-count')).toHaveText('0 collected');
    expectReadyTopics(
      await page.locator('[data-testid^="vocab-topic-tile-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid'))),
    );
    await expectNoShame(page);
    await expectFits(page);
    await shot(page, 'vocab-library-words');

    await page.getByTestId('vocab-topic-tile-numbers').click();
    await expect(page.getByTestId('vocab-topic-title')).toHaveText('Numbers');
    await page.getByTestId('vocab-back').click();
    await expect(page.getByTestId('library-words')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
