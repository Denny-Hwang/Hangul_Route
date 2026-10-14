import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-VOC-003 C-6: Words Match, F-QUEST-002's Pic-Word Match on a topic's collected words through the vocab
 * host (design/screens/vocab/match.md). Words stays behind `flags.vocabTopicsEnabled` (off until C-7), so the
 * suite runs on the fixture bundle and opens the topic page through `window.__hrVocabE2E.openTopic(key)`.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-match
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words and marks a learner never reads here (D3, T3): no fraction, no percent, no "wrong" (as vocab-cards.spec). */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|premium|locked)\b|%|\d\s*\/\s*\d|\d+ of \d+/i;
const WORDS = ['vocab:sagwa-apple', 'vocab:uyu', 'vocab:ppang', 'vocab:bap'] as const;

type E2eWindow = Window & {
  __hrVocabE2E?: { openTopic(topicKey: string): void; collect(ids: readonly string[]): boolean };
};

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
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
}

async function collect(page: Page, ids: readonly string[]): Promise<void> {
  expect(await page.evaluate((list) => (window as E2eWindow).__hrVocabE2E?.collect(list) ?? false, ids)).toBe(true);
}

async function openTopic(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => (window as E2eWindow).__hrVocabE2E?.openTopic(k), key);
  await expect(page.getByTestId('vocab-topic')).toBeVisible();
}

async function profileId(page: Page): Promise<string> {
  const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

interface StoredVocab {
  vocab?: { items: Array<{ id: string; seen: number; right: number }>; topics: Array<{ topic: string; sessions: number }> };
}

/** The pair ids on the board, from the picture tiles. */
async function boardPairs(page: Page): Promise<string[]> {
  const ids = await page.locator('[data-testid^="pic-word-picture-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
  return ids.map((id) => id.replace('pic-word-picture-', ''));
}

test.describe('Words Match (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Match is drawn from 3 collected words and opens a board of the collected words', async ({ page }) => {
    await newLearner(page);
    await collect(page, WORDS.slice(0, 2));
    await openTopic(page, 'food');
    // Below 3 collected words Match is not drawn (spec section 9 item 3).
    await expect(page.getByTestId('vocab-activity-match')).toHaveCount(0);
    await page.getByTestId('vocab-back').click();

    await collect(page, WORDS);
    await openTopic(page, 'food');
    await expect(page.getByTestId('vocab-activity-match')).toBeVisible();
    await page.getByTestId('vocab-activity-match').click();
    await expect(page.getByText('Match each picture')).toBeVisible();
    expect((await boardPairs(page)).sort()).toEqual([...WORDS].sort());
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await shot(page, 'vocab-match-board');
  });

  test('collected words that cannot share one board draw no Match (never a button that goes nowhere)', async ({ page }) => {
    await newLearner(page);
    // gureum against bi and haneul are excluded pairs: at most 2 of these 3 fit on a board.
    await collect(page, ['vocab:gureum', 'vocab:bi-rain', 'vocab:haneul']);
    await openTopic(page, 'nature');
    await expect(page.getByTestId('vocab-topic-count')).toHaveText('3 collected');
    await expect(page.getByTestId('vocab-activity-match')).toHaveCount(0);
  });

  test('the board shows no count or fraction beside its fill-only bar', async ({ page }) => {
    await newLearner(page);
    await collect(page, WORDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-match').click();
    const pairs = await boardPairs(page);
    await page.getByTestId(`pic-word-picture-${pairs[0]}`).click();
    await page.getByTestId(`pic-word-word-${pairs[0]}`).click();
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
  });

  test('Skip after one match writes that answer and one session, then the topic page', async ({ page }) => {
    await newLearner(page);
    await collect(page, WORDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-match').click();
    const pairs = await boardPairs(page);
    await page.getByTestId(`pic-word-picture-${pairs[0]}`).click();
    await page.getByTestId(`pic-word-word-${pairs[0]}`).click();
    await page.getByTestId('pic-word-skip').click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible({ timeout: 5000 });
    const id = await profileId(page);
    await expect
      .poll(async () => (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.topics.find((t) => t.topic === 'food')?.sessions ?? 0)
      .toBe(1);
    const items = (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.items ?? [];
    expect(items.find((i) => i.id === pairs[0])?.seen).toBe(1);
    expect(items.filter((i) => pairs.slice(1).includes(i.id)).every((i) => i.seen === 0)).toBe(true);
  });

  test('Back right after the last pair, before the board reports its end, still keeps the finished board', async ({ page }) => {
    await newLearner(page);
    await collect(page, WORDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-match').click();
    const pairs = await boardPairs(page);
    for (const pair of pairs) {
      await page.getByTestId(`pic-word-picture-${pair}`).click();
      await page.getByTestId(`pic-word-word-${pair}`).click();
    }
    // Inside the game's 700 ms pause before it reports the end.
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    const id = await profileId(page);
    await expect
      .poll(async () => (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.topics.find((t) => t.topic === 'food')?.sessions ?? 0)
      .toBe(1);
    const items = (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.items ?? [];
    for (const pair of pairs) expect(items.find((i) => i.id === pair)?.right).toBe(1);
  });

  test('a finished board writes each first answer and one session, then the topic page shows again', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await newLearner(page);
    await collect(page, WORDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-match').click();
    await expect(page.getByText('Match each picture')).toBeVisible();
    const pairs = await boardPairs(page);
    // One miss on the first pair (its picture, then another pair's word), then every pair right.
    await page.getByTestId(`pic-word-picture-${pairs[0]}`).click();
    await page.getByTestId(`pic-word-word-${pairs[1]}`).click();
    await page.waitForTimeout(700);
    // The first picture stays selected after a miss: its word completes the pair.
    await page.getByTestId(`pic-word-word-${pairs[0]}`).click();
    for (const id of pairs.slice(1)) {
      await page.getByTestId(`pic-word-picture-${id}`).click();
      await page.getByTestId(`pic-word-word-${id}`).click();
    }
    await expect(page.getByTestId('vocab-topic')).toBeVisible({ timeout: 5000 });

    const id = await profileId(page);
    await expect
      .poll(async () => (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.topics.find((t) => t.topic === 'food')?.sessions ?? 0)
      .toBe(1);
    const items = (await readStored<StoredVocab>(page, `progress:${id}`))?.vocab?.items ?? [];
    // Every pair was answered once (the first answer counts); only the first pair's was a miss.
    for (const pair of pairs) expect(items.find((i) => i.id === pair)?.seen).toBe(1);
    expect(items.find((i) => i.id === pairs[0])?.right).toBe(0);
    expect(items.filter((i) => pairs.slice(1).includes(i.id)).every((i) => i.right === 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Back mid-board goes to the topic page and writes nothing', async ({ page }) => {
    await newLearner(page);
    await collect(page, WORDS);
    await openTopic(page, 'food');
    await page.getByTestId('vocab-activity-match').click();
    const pairs = await boardPairs(page);
    await page.getByTestId(`pic-word-picture-${pairs[0]}`).click();
    await page.getByTestId(`pic-word-word-${pairs[0]}`).click();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    const id = await profileId(page);
    await page.waitForTimeout(500);
    const stored = await readStored<StoredVocab>(page, `progress:${id}`);
    expect(stored?.vocab?.topics ?? []).toEqual([]);
    expect((stored?.vocab?.items ?? []).every((i) => i.seen === 0)).toBe(true);
  });
});
