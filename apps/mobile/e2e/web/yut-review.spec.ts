import type { Page } from '@playwright/test';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { closeInstallGuide } from './text-fit';

/**
 * F-CURR-002 section 7.1 F10, row CM-39 (design/wireframes/minigame/yut-review.md, design/screens/minigame-variety/ D9
 * and board B): the Yut Review board over the Daily Review on the release build. With `game.yut-review` on, every round
 * that ends throws the sticks, a miss included, and the throw is read out once with its Korean name tagged Korean; the
 * band is 96 below 600 tall at 320 wide and 320 beside the item at 768; the result is the plain one; with reduced motion
 * the piece is placed at once; off, the plain review screen. As `daily-review.spec.ts`, the remote config is the stored
 * copy and the memory store is seeded with words due today; this browser has no Korean voice, so rounds are read rounds.
 */

interface Row {
  id: string;
  ko: string;
  stage: number;
}

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
const ON = { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 }, 'game.yut-review': { on: true, pct: 100 } };
const PIECE = colors.brand.primary.toLowerCase();

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

async function seed(page: Page, id: string, due: number, flags: Record<string, { on: boolean; pct: number }> = ON): Promise<void> {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const rows: Record<string, unknown> = {};
  for (const w of WORDS.slice(0, due)) {
    rows[w.id] = { sh: `stage${Math.max(1, w.stage)}`, st: { b: 1, d: today, c: 0, r: 0, n: 1, f: '2026-01-01', s: 1, at: '2026-01-02T09:00:00.000Z' } };
  }
  await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

const card = (page: Page) => page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ });

/** The ids of the round on screen: the right option and a wrong one. */
async function optionsOf(page: Page): Promise<{ right: string; wrong: string }> {
  const prompt = page.getByTestId('daily-review-prompt');
  await expect(prompt).toBeVisible();
  const ko = ((await prompt.innerText()).split('\n')[0] ?? '').trim();
  const word = byKo.get(ko);
  expect(word, `a seeded word: ${ko}`).toBeDefined();
  const wrong = await page
    .locator('[data-testid^="daily-review-option-"]')
    .evaluateAll((els, r) => els.map((e) => e.getAttribute('data-testid')).find((t) => t !== `daily-review-option-${r}`), word?.id);
  return { right: `daily-review-option-${word?.id}`, wrong: wrong as string };
}

/** Ends round `n` (from 1): right first time, or a miss first (amber) and then right. The dots move on, or the result opens. */
async function endRound(page: Page, n: number, how: 'right' | 'miss-then-right'): Promise<void> {
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', `Round ${n}`);
  const { right, wrong } = await optionsOf(page);
  if (how === 'miss-then-right') {
    await page.getByTestId(wrong).click();
    await expect(page.getByTestId('daily-review-miss')).toBeVisible();
  }
  await page.getByTestId(right).click();
  await expect
    .poll(async () => (await page.getByTestId('daily-review-result').count()) > 0 || (await page.getByTestId('daily-review-dots').getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) === `Round ${n + 1}`, { timeout: 5_000 })
    .toBe(true);
}

/** The learner's piece: the one circle in `brand.primary`. */
const pieceAt = (page: Page): Promise<string | null> =>
  page.evaluate((fill) => {
    const c = Array.from(document.querySelectorAll('[data-testid="yut-board"] circle')).find((el) => (el.getAttribute('fill') ?? '').toLowerCase() === fill);
    return c ? `${c.getAttribute('cx')},${c.getAttribute('cy')}` : null;
  }, PIECE);

const boardSide = (page: Page): Promise<number> => page.getByTestId('yut-board').evaluate((el) => Math.round(el.getBoundingClientRect().width));

/** No score, no "n of m", no percentage anywhere on the review screen. */
async function expectNoScore(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\d\s*%/);
  expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
  expect(text).not.toMatch(/\b\d+\s+(?:out\s+)?of\s+\d+\b/i);
}

/** At this size: nothing scrolls sideways, every button is at least `touchTarget.min`, and a shot. */
async function shot(page: Page, name: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), { message: `${name}: no sideways scroll` }).toBe(true);
  const offenders = await page.evaluate((min) => {
    const width = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll('[role="button"], button'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ name: el.getAttribute('aria-label') ?? (el as HTMLElement).innerText.slice(0, 30), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .filter(({ r }) => r.right > width + 1 || r.height < min - 0.5 || r.width < min - 0.5)
      .map(({ name, r }) => `${name}: ${Math.round(r.width)} x ${Math.round(r.height)}`);
  }, touchTarget.min);
  expect(offenders, `${name}: buttons`).toEqual([]);
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test('Yut Review on: every round that ends throws (a miss too), read out once; 96 at 320 x 568, 320 beside the item at 768; the result is the plain one', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await seed(page, id, 4);
  await card(page).click();
  // 320 x 568 once the review is open (Home at that size offers the install guide over the cards).
  await page.setViewportSize({ width: 320, height: 568 });

  // Board idle: the band over the plain round, the piece at the start, the tray its label alone; no score anywhere.
  await expect(page.getByTestId('yut-review-skin')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Yut board' })).toBeVisible();
  await expect.poll(() => boardSide(page)).toBe(touchTarget.hero);
  await expect(page.getByTestId('yut-tray')).toHaveText('Home');
  const start = await pieceAt(page);
  expect(start).toBe('110,110');
  await expectNoScore(page);

  // Round 1 ends on a miss then right: it still throws. The throw is named in Korean with romanization, read once.
  await endRound(page, 1, 'miss-then-right');
  await expect(page.getByTestId('yut-throw-leg').first()).toBeVisible();
  await expect.poll(() => pieceAt(page), { timeout: 5_000 }).not.toBe(start);
  const live = page.getByTestId('yut-live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toHaveText(/^Throw: (도|개|걸|윷|모), (do|gae|geol|yut|mo)\. Your piece moved [1-5] stations?\./);
  await expect(live.locator('[lang="ko"]').first()).toHaveText(/^(도|개|걸|윷|모)$/);
  expect(await live.textContent()).not.toMatch(/\bof\b/);
  // Below 600 tall: no sticks art, the name says the throw.
  await expect(page.getByTestId('yut-sticks')).toHaveCount(0);
  await expectNoScore(page);
  await shot(page, 'yut-review-320', { width: 320, height: 568 });

  // Round 2 right first time: it throws too (a new move, read out again).
  const firstMove = await live.textContent();
  const before = await pieceAt(page);
  await endRound(page, 2, 'right');
  await expect.poll(async () => (await pieceAt(page)) !== before || (await live.textContent()) !== firstMove, { timeout: 5_000 }).toBe(true);

  // At 768 x 1024: two panes, the board at 320 beside the item, the sticks drawn under it.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect.poll(() => boardSide(page)).toBe(5 * touchTarget.min);
  const [band, round] = await Promise.all([page.getByTestId('yut-band').boundingBox(), page.getByTestId('daily-review-round').boundingBox()]);
  expect(band && round && band.x + band.width <= round.x).toBe(true);
  await expect(page.getByTestId('yut-sticks')).toBeVisible();
  await shot(page, 'yut-review-768', { width: 768, height: 1024 });
  await shot(page, 'yut-review-wide', { width: 1280, height: 900 });

  // The rest, then the plain result: stars and what got stronger, no board and no lap count.
  await page.setViewportSize({ width: 393, height: 851 });
  await endRound(page, 3, 'right');
  await endRound(page, 4, 'right');
  await expect(page.getByTestId('daily-review-result')).toBeVisible();
  await expect(page.getByTestId('daily-review-stars')).toHaveAttribute('aria-label', '2 stars');
  await expect(page.getByTestId('yut-review-skin')).toHaveCount(0);
  await expect(page.getByTestId('yut-board')).toHaveCount(0);
  await expectNoScore(page);
  // The answers were recorded exactly as on the plain screen: one daily entry with the stars of the first tries.
  const progress = await readStored<{ reviews: Array<{ kind: string; resultStars: number }> }>(page, `progress:${id}`);
  expect(progress?.reviews.filter((r) => r.kind === 'daily').map((r) => r.resultStars)).toEqual([2]);
  expect(errors).toEqual([]);
});

test('reduced motion: no walk; the piece is placed at its station as the next round opens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const id = await onboard(page);
  await seed(page, id, 3);
  await card(page).click();
  await endRound(page, 1, 'right');
  await expect(page.getByTestId('yut-throw-leg').first()).toBeVisible();
  const placed = await pieceAt(page);
  expect(placed).not.toBe('110,110');
  // Nothing moves after it is placed (with motion the piece would still be walking).
  await page.waitForTimeout(1_500);
  expect(await pieceAt(page)).toBe(placed);
  await expect(page.getByTestId('yut-live')).toHaveText(/^Throw: /);
});

test('game.yut-review off: the plain review screen, the same rounds and result', async ({ page }) => {
  const id = await onboard(page);
  await seed(page, id, 3, { ...ON, 'game.yut-review': { on: false, pct: 100 } });
  await card(page).click();
  await expect(page.getByTestId('daily-review-round')).toBeVisible();
  await expect(page.getByTestId('yut-review-skin')).toHaveCount(0);
  await expect(page.getByTestId('yut-board')).toHaveCount(0);
  for (let n = 1; n <= 3; n += 1) await endRound(page, n, 'right');
  await expect(page.getByTestId('daily-review-stars')).toHaveAttribute('aria-label', '3 stars');
});

test('largest text (150 %) at 320 x 640: the throw wraps under the board, the tray stays inside the band, nothing scrolls sideways', async ({ page }) => {
  const id = await onboard(page);
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await seed(page, id, 3);
  await closeInstallGuide(page);
  await card(page).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByTestId('yut-review-skin')).toBeVisible();
  await endRound(page, 1, 'miss-then-right');
  await expect(page.getByTestId('yut-throw-leg').first()).toBeVisible();
  const [band, board, panel, tray] = await Promise.all(['yut-band', 'yut-board', 'yut-throw', 'yut-tray'].map((t) => page.getByTestId(t).boundingBox()));
  expect(band && board && panel && tray).toBeTruthy();
  // Stacked: the throw starts under the board, and the tray ends inside the band.
  expect(panel!.y).toBeGreaterThanOrEqual(board!.y + board!.height - 1);
  expect(tray!.x + tray!.width).toBeLessThanOrEqual(band!.x + band!.width + 1);
  await expectNoScore(page);
  await shot(page, 'yut-review-largest-320x640', { width: 320, height: 640 });
});
