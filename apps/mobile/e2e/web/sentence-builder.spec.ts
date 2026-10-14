import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-001 G-1: Sentence Builder (`order-it`) as a practice step and as the Stage 7 Check
 * (design/wireframes/minigame/sentence-builder.md, design/screens/minigame-sentence-builder/v1/).
 * No shipped lesson cell plays it until the Stage 3 cells land, so this suite opens the game on
 * the D-1 sample sentences through the `window.__hrSentenceE2E` hook, which exists only in the
 * fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test sentence-builder
 *
 * In the production build the suite is skipped. Speech is the silent engine of ./fixtures (no
 * Korean voice), so a built sentence moves on after the short no-sound pause.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words and marks a learner never reads here (anti-shame, F-CURR-001 §3.14). */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|incorrect)\b|%/i;
/** colors.feedback.nudge and colors.feedback.danger as the browser reports them. */
const NUDGE = 'rgb(242, 179, 61)';
const DANGER = 'rgb(200, 75, 61)';
/** touchTarget.min: every tile and button is at least this tall and wide. */
const TARGET_MIN = 64;

interface Answer {
  key: string;
  correct: boolean;
  itemId?: string;
}

interface Log {
  answers: Answer[];
  completes: number;
  backs: number;
}

type Set = 'practice' | 'check' | 'empty';
type OpenParams = { set: Set; mode: 'quest' | 'check'; romanization?: 'tap' };

type E2eWindow = Window & {
  __hrSentenceE2E?: { open(params: OpenParams): void; log(): Log };
};

async function open(page: Page, set: Set, mode: 'quest' | 'check', romanization?: 'tap'): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrSentenceE2E), undefined, { timeout: 10_000 });
  await page.evaluate((p) => (window as E2eWindow).__hrSentenceE2E?.open(p), { set, mode, ...(romanization ? { romanization } : {}) });
  if (set !== 'empty') await expect(page.getByRole('heading', { name: 'Build the sentence' })).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

/** What the quest run store scores: the first answer of each round (later ones are retries, logic/first-try.ts). */
function scored(answers: readonly Answer[]): Answer[] {
  const seen = new Set<string>();
  return answers.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrSentenceE2E!.log());
/** A tray tile by its accessible name ("Korean, romanization"). */
const tile = (page: Page, name: string) => page.getByTestId('sentence-builder-tray').getByRole('button', { name, exact: true });
const hint = (page: Page) => page.getByTestId('sentence-builder-hint');

/**
 * Taps a tile that is wrong for the next place, then waits on the flow's state, not on a timer:
 * the tile is marked tried, and its slide back is over (the flow takes no tap while it returns).
 */
async function missTile(page: Page, name: string): Promise<void> {
  await tile(page, name).click();
  await expect(tile(page, `${name}, tried`)).toBeVisible();
  await expect(page.getByTestId('sentence-builder-returning')).toHaveCount(0);
}

/** Taps a tile that is right for the next place, past the 50 ms touch window of the last tap. */
async function placeTile(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(120);
  await tile(page, name).click();
}

/** Every tray tile's Korean is one line: a tile never breaks inside its word (§3.14). */
async function expectWholeWords(page: Page): Promise<void> {
  const lines = await page
    .getByTestId('sentence-builder-tray')
    .locator('[lang="ko"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      }),
    );
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((n) => n === 1)).toBe(true);
}

async function expectBuilt(page: Page, romanization: string): Promise<void> {
  const done = page.getByTestId('sentence-builder-done');
  await expect(done).toBeVisible();
  await expect(done.getByText('You built the sentence!')).toBeVisible();
  await expect(done.getByText(romanization)).toBeVisible();
}

async function expectNoShame(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SHAME);
}

test.describe('Sentence Builder (F-CURR-001 G-1)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('practice: the meaning card, a verb-last miss in amber, the built sentence, a particle round with its note, Skip', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await open(page, 'practice', 'quest');

    // A: the meaning in the UI language, Hear it, one empty place per word, the tiles in the tray.
    await expect(page.getByText('Tap the words in order.')).toBeVisible();
    await expect(page.getByText('Meaning', { exact: true })).toBeVisible();
    await expect(page.getByTestId('sentence-builder-gloss')).toHaveText('I eat rice.');
    await expect(page.getByRole('button', { name: 'Hear it' })).toBeVisible();
    await expect(page.getByText('1 / 3')).toBeVisible();
    // The next place says it is next (its focus outline is not the only cue).
    await expect(page.getByLabel('Place 1 of 2, empty, next', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Place 2 of 2, empty', { exact: true })).toBeVisible();
    await expect(page.getByTestId('sentence-builder-tray').getByRole('button')).toHaveCount(3);
    // The sentence's romanization is not shown before it is built (wireframe decision 4).
    await expect(page.getByText('babeul meogeoyo')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    await expectWholeWords(page);
    for (const box of await page.getByTestId('sentence-builder-tray').getByRole('button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
      expect(box.width).toBeGreaterThanOrEqual(TARGET_MIN);
      expect(box.height).toBeGreaterThanOrEqual(TARGET_MIN);
    }
    await shot(page, 'sentence-builder-320-start');

    // B: the verb first is a miss: it comes back marked tried (amber, never red), Hoya explains word order.
    await missTile(page, '먹어요, meogeoyo');
    await expect(hint(page)).toContainText('In Korean, the doing or describing word comes last.');
    const tried = tile(page, '먹어요, meogeoyo, tried');
    await expect(tried).toBeVisible();
    const border = await tried.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(border).toBe(NUDGE);
    expect(border).not.toBe(DANGER);
    expect((await log(page)).answers).toEqual([{ key: '0', correct: false, itemId: 'e2e-eat-rice' }]);
    await expectNoShame(page);
    await shot(page, 'sentence-builder-320-miss');

    // The right words in order: placed, announced by place, and the round finishes with the sentence.
    await placeTile(page, '밥을, babeul');
    await expect(page.getByLabel('Place 1 of 2: 밥을, babeul')).toBeVisible();
    await expect(page.getByTestId('sentence-builder-live')).toHaveText('Place 1 of 2: 밥을, babeul');
    await expect(page.getByTestId('sentence-builder-live')).toHaveAttribute('aria-live', 'polite');
    // Filling a place clears the tried marks, so the verb is plain again.
    await placeTile(page, '먹어요, meogeoyo');
    await expectBuilt(page, 'babeul meogeoyo');
    await shot(page, 'sentence-builder-320-built');
    // The missed round's answer stays the one recorded at its first miss.
    expect((await log(page)).answers).toHaveLength(1);

    // C: the particle round: the stem and its attached place, the two choices, the Discover note on a miss.
    await expect(page.getByText('Tap the piece that fits.')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('2 / 3')).toBeVisible();
    await expect(page.getByTestId('sentence-builder-stem')).toHaveText('책');
    await expect(page.getByLabel('Place 1 of 2, joins the word before it, empty')).toBeVisible();
    await missTile(page, '가, ga');
    await expect(hint(page)).toContainText('Look at how the word before it ends.');
    await expect(page.getByTestId('sentence-builder-note')).toContainText('after a final consonant');
    await shot(page, 'sentence-builder-320-particle-miss');
    await placeTile(page, '이, i');
    await expect(page.getByTestId('sentence-builder-live')).toHaveText('Place 1 of 2: 책이, chaegi');
    await expectBuilt(page, 'chaegi isseoyo');

    // A round built with no miss records one right answer; Skip ends the step without recording the rest.
    await expect(page.getByText('3 / 3')).toBeVisible({ timeout: 5_000 });
    await placeTile(page, '저는, jeoneun');
    await placeTile(page, '학교에, hakgyoe');
    await placeTile(page, '가요, gayo');
    await expectBuilt(page, 'jeoneun hakgyoe gayo');
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-eat-rice' },
      { key: '1', correct: false, itemId: 'e2e-book-i' },
      { key: '2', correct: true, itemId: 'e2e-school' },
    ]);
  });

  test('Skip ends the step once without recording a round, even pressed twice at once', async ({ page }) => {
    await open(page, 'practice', 'quest');
    // Two presses in one task, before React draws again: the flow completes the step once.
    await page.getByTestId('sentence-builder-skip').evaluate((el) => {
      (el as HTMLElement).click();
      (el as HTMLElement).click();
    });
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    expect(await log(page)).toEqual({ answers: [], completes: 1, backs: 0 });
  });

  test('Skip while a built sentence plays completes once (the pending advance adds nothing)', async ({ page }) => {
    await open(page, 'practice', 'quest');
    await placeTile(page, '밥을, babeul');
    await placeTile(page, '먹어요, meogeoyo');
    await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    // Past the no-sound pause (motion.duration.crawl) after which the built sentence would advance.
    await page.waitForTimeout(900);
    expect((await log(page)).completes).toBe(1);
  });

  test('reduced motion: a wrong tile is back at once and the next tap counts', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'practice', 'quest');
    await tile(page, '먹어요, meogeoyo').click();
    await expect(tile(page, '먹어요, meogeoyo, tried')).toBeVisible();
    // Settled well inside the animated slide-and-return (RETURN_MS, 520 ms).
    await expect(page.getByTestId('sentence-builder-returning')).toHaveCount(0, { timeout: 300 });
    await placeTile(page, '밥을, babeul');
    await expect(page.getByTestId('sentence-builder-live')).toHaveText('Place 1 of 2: 밥을, babeul');
  });

  test('reading practice (romanization on tap): tiles show no romanization line but keep it in their names; empty places match the tiles', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await open(page, 'practice', 'quest', 'tap');
    const tray = page.getByTestId('sentence-builder-tray');
    await expect(tile(page, '밥을, babeul')).toBeVisible();
    expect(await tray.innerText()).not.toMatch(/babeul|meogeoyo|mureul/);
    // An empty place is drawn like the widest tile as the tray shows it: no taller than a tile.
    const slot = await page.getByTestId('sentence-builder-slot').first().boundingBox();
    const tallest = Math.max(...(await tray.getByRole('button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))));
    expect(slot!.height).toBeLessThanOrEqual(tallest + 1);
    await expectWholeWords(page);
    await expectNoHorizontalOverflow(page);
  });

  test('no playable round: the empty line and a way back', async ({ page }) => {
    await open(page, 'empty', 'quest');
    await expect(page.getByText('Nothing to play here')).toBeVisible();
    await page.getByRole('button', { name: 'Back to quest' }).click();
    expect(await log(page)).toEqual({ answers: [], completes: 0, backs: 1 });
  });

  test('the Stage 7 Check: two dots and Quick check, no Skip; miss, miss, ring, right records one answer', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await open(page, 'check', 'check');
    await expect(page.getByText('Quick check')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await expect(page.getByText(/\d \/ \d/)).toHaveCount(0);
    await shot(page, 'sentence-builder-320-check');

    await missTile(page, '떡국을, tteokgugeul');
    await expect(hint(page)).toContainText('Not that one yet. Try another word.');
    await missTile(page, '좋아해요, joahaeyo');
    // The second miss on one place rings the right tile, and its name says it comes next.
    await expect(hint(page)).toContainText('This one comes next.');
    await expect(page.getByTestId('sentence-builder-ring')).toContainText('저는');
    await shot(page, 'sentence-builder-320-check-ring');
    await placeTile(page, '저는, jeoneun, comes next');
    await placeTile(page, '떡국을, tteokgugeul');
    await placeTile(page, '좋아해요, joahaeyo');
    await expectBuilt(page, 'jeoneun tteokgugeul joahaeyo');
    // The first miss is the round's answer; the second is a retry that never scores.
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-like-tteokguk' },
      { key: '0', correct: false, itemId: 'e2e-like-tteokguk' },
    ]);

    // Round 2 with no miss, then the Check ends.
    await expect(page.getByTestId('sentence-builder-gloss')).toHaveText('I drink milk.', { timeout: 5_000 });
    await placeTile(page, '우유를, uyureul');
    await placeTile(page, '마셔요, masyeoyo');
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect(scored((await log(page)).answers)).toEqual([
      { key: '0', correct: false, itemId: 'e2e-like-tteokguk' },
      { key: '1', correct: true, itemId: 'e2e-drink-milk' },
    ]);
    await expectNoShame(page);
  });

  test('tablet: stacked in the reading column, no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, 'practice', 'quest');
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    // One column: the meaning card, the line and the tray share the reading width (layout.maxWidth.reading).
    const card = await page.getByTestId('sentence-builder-meaning').boundingBox();
    expect(card!.width).toBeLessThanOrEqual(720);
    await shot(page, 'sentence-builder-1024');
  });
});
