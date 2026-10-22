import type { Page } from '@playwright/test';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';

/**
 * F-CURR-002 row CM-14 (sections 4.3, 4.5, 4.8, 7.7, 11.3, 12.2): the Daily Review from Today mission slot 3, Keep
 * going, the stars-only result, the end-early case, the review-first suggestion, the stop sheet, the flags off and
 * offline. The release build has no API, so the remote config is the stored copy (as `memory-shadow.spec.ts`), and the
 * learner's memory store is seeded with words met earlier and due today. This browser has no Korean voice (the
 * fixture's silent engine), so every round is a read round with the F-AUDIO-004 notice: deterministic.
 */

interface Row {
  id: string;
  ko: string;
  stage: number;
}

/** Taught words of this build (the review-item chunk): distinct spellings and meanings, so a round's prompt names one. */
function wordsOfBuild(): Row[] {
  const seenKo = new Set<string>();
  const seenEn = new Set<string>();
  const out: Row[] = [];
  for (const [id, ko, , en, , , meta] of REVIEW_ITEM_ROWS) {
    if (!id.startsWith('lex:') || en === '' || ko.includes(' ') || seenKo.has(ko) || seenEn.has(en)) continue;
    seenKo.add(ko);
    seenEn.add(en);
    out.push({ id, ko, stage: meta & 7 });
  }
  return out;
}

const WORDS = wordsOfBuild();
const byKo = new Map(WORDS.map((w) => [w.ko, w]));

async function onboard(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  return profiles?.[0]?.id ?? '';
}

const localDayIn = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

/** `due` words met a week ago and due today, at box 1 (asked at read, as this browser has no voice). */
async function seed(page: Page, id: string, due: number, flags: Record<string, { on: boolean; pct: number }> = { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 } }): Promise<string> {
  const today = await localDayIn(page);
  const rows: Record<string, unknown> = {};
  for (const w of WORDS.slice(0, due)) {
    rows[w.id] = { sh: `stage${Math.max(1, w.stage)}`, st: { b: 1, d: today, c: 0, r: 0, n: 1, f: '2026-01-01', s: 1, at: '2026-01-02T09:00:00.000Z' } };
  }
  await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  return today;
}

const card = (page: Page) => page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ });

/** Answers the round on screen: right, or wrong first (amber, Hoya shows the answer) and then right. */
async function answer(page: Page, how: 'right' | 'miss-then-right'): Promise<void> {
  const prompt = page.getByTestId('daily-review-prompt');
  await expect(prompt).toBeVisible();
  const ko = ((await prompt.innerText()).split('\n')[0] ?? '').trim();
  const word = byKo.get(ko);
  expect(word, `a seeded word: ${ko}`).toBeDefined();
  const right = page.getByTestId(`daily-review-option-${word?.id}`);
  if (how === 'miss-then-right') {
    const other = page.locator('[data-testid^="daily-review-option-"]').filter({ hasNot: page.locator(`[data-testid="daily-review-option-${word?.id}"]`) });
    const wrongs = await page.locator('[data-testid^="daily-review-option-"]').evaluateAll((els, rightId) => els.map((e) => e.getAttribute('data-testid')).filter((t) => t !== `daily-review-option-${rightId}`), word?.id);
    expect(other).toBeTruthy();
    await page.getByTestId(wrongs[0] as string).click();
    await expect(page.getByTestId('daily-review-miss')).toBeVisible();
  }
  await right.click();
  await expect(page.getByText(ko, { exact: true }).first()).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
}

async function playRounds(page: Page, n: number, firstMiss = false): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', `Round ${i + 1}`);
    await answer(page, firstMiss && i === 0 ? 'miss-then-right' : 'right');
  }
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [label, size] of [
    ['320', { width: 320, height: 720 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.screenshot({ path: test.info().outputPath(`${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 393, height: 851 });
}

/** No score, no share and no timer on a review screen (section 4.5, lint `review-copy`). */
async function expectNoScore(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\d\s*%/);
  expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
  expect(text).not.toMatch(/\b\d+\s+(?:out\s+)?of\s+\d+\b/i);
}

test('Daily Review from slot 3: 10 read rounds, a miss in amber, then stars and what got stronger; Keep going ends early; the card collects', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  expect(WORDS.length).toBeGreaterThanOrEqual(40);
  const id = await onboard(page);
  const today = await seed(page, id, 12);

  // Slot 3, after the normal day's cards: no count, plain time.
  await expect(card(page)).toBeVisible();
  const order = await page.getByTestId('home-missions').locator(':scope > *').allInnerTexts();
  expect(order.findIndex((t) => t.startsWith('Daily Review'))).toBe(order.length - 1);
  await expect(page.getByTestId('home-review-ready')).toHaveCount(0);
  await card(page).click();

  // Round 1: [x] "Stop the review", the dots name the position only; the sound notice shows (no device voice).
  await expect(page.getByRole('button', { name: 'Stop the review' })).toBeVisible();
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
  await expect(page.getByTestId('daily-review-dot')).toHaveCount(10);
  await expectNoScore(page);
  await shots(page, 'daily-review-round');
  // A miss: the tapped option is amber with its mark, Hoya shows the right answer; never red.
  const prompt = page.getByTestId('daily-review-prompt');
  const ko = ((await prompt.innerText()).split('\n')[0] ?? '').trim();
  const rightId = byKo.get(ko)?.id;
  const wrongId = await page
    .locator('[data-testid^="daily-review-option-"]')
    .evaluateAll((els, r) => els.map((e) => e.getAttribute('data-testid')).find((t) => t !== `daily-review-option-${r}`), rightId);
  await page.getByTestId(wrongId as string).click();
  await expect(page.getByTestId('daily-review-miss')).toBeVisible();
  await expect(page.getByTestId('daily-review-dot-filled')).toHaveCount(1);
  await shots(page, 'daily-review-miss');
  await page.getByTestId(`daily-review-option-${rightId}`).click();
  await playRounds2(page, 9, 2);

  // The result: one word, stars in words, how many got stronger; Back home first, Keep going offered (2 are still due).
  await expect(page.getByTestId('daily-review-result')).toBeVisible();
  await expect(page.getByTestId('daily-review-headline')).toHaveText(/^(Wonderful!|Great work!|Good try!)$/);
  await expect(page.getByTestId('daily-review-stars')).toHaveAttribute('aria-label', /^[123] stars?$/);
  await expect(page.getByTestId('daily-review-stronger')).toBeVisible();
  await expect(page.getByTestId('daily-review-offer')).toBeVisible();
  await expect(page.getByText('Want a few more?').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible();
  await expectNoScore(page);
  await shots(page, 'daily-review-result');

  // One plain daily entry on the local day; the answers are in the learner's store (box up for the 9 right first tries).
  const progress = await readStored<{ reviews: Array<{ kind: string; scope: string; itemIds: string[]; resultStars: number }> }>(page, `progress:${id}`);
  const daily = progress?.reviews.filter((r) => r.kind === 'daily') ?? [];
  expect(daily).toHaveLength(1);
  expect(daily[0]).toMatchObject({ scope: today, resultStars: 3 });
  expect(daily[0]?.itemIds).toHaveLength(10);
  await expect
    .poll(async () => Object.values((await readStored<{ rows: Record<string, { st: { n: number; b: number } }> }>(page, `memory:${id}`))?.rows ?? {}).filter((r) => r.st.n >= 2).length, { timeout: 10_000 })
    .toBe(10);

  // Keep going: the 2 left, then it ends early with "All refreshed today" and no further offer.
  await page.getByTestId('daily-review-keep-going').click();
  await expect(page.getByTestId('daily-review-dot')).toHaveCount(2);
  await playRounds2(page, 2, 1);
  await expect(page.getByTestId('daily-review-result')).toBeVisible();
  await expect(page.getByTestId('daily-review-all-refreshed')).toHaveText('All refreshed today');
  await expect(page.getByTestId('daily-review-offer')).toHaveCount(0);
  await shots(page, 'keep-going-result');
  const after = await readStored<{ reviews: Array<{ kind: string; scope: string }> }>(page, `progress:${id}`);
  expect(after?.reviews.filter((r) => r.kind === 'daily' && r.scope === today)).toHaveLength(2);

  // Back home: the card is collected and stays tappable; it opens the done-today page.
  await page.getByTestId('daily-review-back-home').click();
  await expect(page.getByRole('button', { name: /^Daily Review\. About 3 minutes\. Collected\./ })).toBeVisible();
  await page.getByRole('button', { name: /^Daily Review\. About 3 minutes\. Collected\./ }).click();
  await expect(page.getByTestId('daily-review-done-today')).toBeVisible();
  await expect(page.getByText('Daily Review done today')).toBeVisible();
  await expect(page.getByText('All refreshed today')).toBeVisible();
  await shots(page, 'keep-going-done-today');
  expect(errors).toEqual([]);
});

/** Plays `n` rounds whose dots start at round `from`. */
async function playRounds2(page: Page, n: number, from: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', `Round ${from + i}`);
    await answer(page, 'right');
  }
}

test('ends early with 4 due: 4 rounds, the stars of what was answered, no Keep going offer', async ({ page }) => {
  const id = await onboard(page);
  await seed(page, id, 4);
  await card(page).click();
  await expect(page.getByTestId('daily-review-dot')).toHaveCount(4);
  await playRounds(page, 4);
  await expect(page.getByTestId('daily-review-stars')).toHaveAttribute('aria-label', '3 stars');
  await expect(page.getByTestId('daily-review-stronger')).toHaveText('4 got stronger');
  await expect(page.getByTestId('daily-review-offer')).toHaveCount(0);
});

test('Stop for now: the sheet keeps the round; Stop goes home, keeps the answer and writes no entry', async ({ page }) => {
  const id = await onboard(page);
  await seed(page, id, 5);
  await card(page).click();
  await answer(page, 'right');
  await page.getByRole('button', { name: 'Stop the review' }).click();
  await expect(page.getByText('Stop for now?')).toBeVisible();
  await expect(page.getByText('What you answered still counts.')).toBeVisible();
  await shots(page, 'daily-review-stop');
  await page.getByRole('button', { name: 'Back to it' }).click();
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 2');
  await page.getByRole('button', { name: 'Stop the review' }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await expect(card(page)).toBeVisible();
  await expect.poll(async () => Object.values((await readStored<{ rows: Record<string, { st: { n: number } }> }>(page, `memory:${id}`))?.rows ?? {}).filter((r) => r.st.n >= 2).length, { timeout: 10_000 }).toBe(1);
  expect(((await readStored<{ reviews: Array<{ kind: string }> }>(page, `progress:${id}`))?.reviews ?? []).filter((r) => r.kind === 'daily')).toHaveLength(0);
});

test('review first: with more than 30 due the Daily Review leads with one positive line; the new lesson is still offered', async ({ page }) => {
  const id = await onboard(page);
  await seed(page, id, 35);
  await expect(page.getByTestId('home-review-ready')).toHaveText('35 items are ready to refresh');
  const order = await page.getByTestId('home-missions').locator(':scope > *').allInnerTexts();
  expect(order[0]?.startsWith('Daily Review')).toBe(true);
  expect(order).toHaveLength(3);
  await shots(page, 'daily-review-review-first');
});

test('flags: dailyReview off keeps today\'s slot 3; memoryRecord off with dailyReview on shows no card either', async ({ page }) => {
  const id = await onboard(page);
  await seed(page, id, 12, { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: false, pct: 100 } });
  await expect(page.getByTestId('home-missions')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  expect(await page.getByTestId('home-missions').locator(':scope > *').count()).toBe(3);
  await seed(page, id, 12, { memoryRecord: { on: false, pct: 100 }, dailyReview: { on: true, pct: 100 } });
  await expect(page.getByTestId('home-missions')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test('offline: after one online visit the Daily Review plays with the network gone', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return !!reg?.active && !!navigator.serviceWorker.controller;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
  await seed(page, id, 6);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await card(page).click();
  await playRounds(page, 6);
  await expect(page.getByTestId('daily-review-result')).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
