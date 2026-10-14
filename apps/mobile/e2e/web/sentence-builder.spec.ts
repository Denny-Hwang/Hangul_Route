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

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}

type E2eWindow = Window & {
  __hrSentenceE2E?: { open(params: { set: 'practice' | 'check'; mode: 'quest' | 'check' }): void; log(): Log };
};

async function open(page: Page, set: 'practice' | 'check', mode: 'quest' | 'check'): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrSentenceE2E), undefined, { timeout: 10_000 });
  await page.evaluate((p) => (window as E2eWindow).__hrSentenceE2E?.open(p), { set, mode });
  await expect(page.getByRole('heading', { name: 'Build the sentence' })).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrSentenceE2E!.log());
/** A tray tile by its accessible name ("Korean, romanization"). */
const tile = (page: Page, name: string) => page.getByTestId('sentence-builder-tray').getByRole('button', { name, exact: true });
const hint = (page: Page) => page.getByTestId('sentence-builder-hint');

/** Taps a tile and waits for a wrong one to slide back (the flow takes no tap while it returns). */
async function tapTile(page: Page, name: string): Promise<void> {
  await tile(page, name).click();
  await page.waitForTimeout(600);
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
    await expect(page.getByLabel('Place 1 of 2, empty')).toBeVisible();
    await expect(page.getByLabel('Place 2 of 2, empty')).toBeVisible();
    await expect(page.getByTestId('sentence-builder-tray').getByRole('button')).toHaveCount(3);
    // The sentence's romanization is not shown before it is built (wireframe decision 4).
    await expect(page.getByText('babeul meogeoyo')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(controlsPastEdge)).toEqual([]);
    for (const box of await page.getByTestId('sentence-builder-tray').getByRole('button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
      expect(box.width).toBeGreaterThanOrEqual(TARGET_MIN);
      expect(box.height).toBeGreaterThanOrEqual(TARGET_MIN);
    }
    await shot(page, 'sentence-builder-320-start');

    // B: the verb first is a miss: it comes back marked tried (amber, never red), Hoya explains word order.
    await tapTile(page, '먹어요, meogeoyo');
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
    await tapTile(page, '밥을, babeul');
    await expect(page.getByLabel('Place 1 of 2: 밥을, babeul')).toBeVisible();
    await tile(page, '먹어요, meogeoyo').click();
    await expectBuilt(page, 'babeul meogeoyo');
    await shot(page, 'sentence-builder-320-built');
    // The missed round's answer stays the one recorded at its first miss.
    expect((await log(page)).answers).toHaveLength(1);

    // C: the particle round: the stem and its attached place, the two choices, the Discover note on a miss.
    await expect(page.getByText('Tap the piece that fits.')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('2 / 3')).toBeVisible();
    await expect(page.getByTestId('sentence-builder-stem')).toHaveText('책');
    await expect(page.getByLabel('Place 1 of 2, joins the word before it, empty')).toBeVisible();
    await tapTile(page, '가, ga');
    await expect(hint(page)).toContainText('Look at how the word before it ends.');
    await expect(page.getByTestId('sentence-builder-note')).toContainText('after a final consonant');
    await shot(page, 'sentence-builder-320-particle-miss');
    await tile(page, '이, i').click();
    await expectBuilt(page, 'chaegi isseoyo');

    // A round built with no miss records one right answer; Skip ends the step without recording the rest.
    await expect(page.getByText('3 / 3')).toBeVisible({ timeout: 5_000 });
    await tile(page, '저는, jeoneun').click();
    await page.waitForTimeout(120);
    await tile(page, '학교에, hakgyoe').click();
    await page.waitForTimeout(120);
    await tile(page, '가요, gayo').click();
    await expectBuilt(page, 'jeoneun hakgyoe gayo');
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-eat-rice' },
      { key: '1', correct: false, itemId: 'e2e-book-i' },
      { key: '2', correct: true, itemId: 'e2e-school' },
    ]);
  });

  test('Skip ends the step at once without recording a round', async ({ page }) => {
    await open(page, 'practice', 'quest');
    await page.getByRole('button', { name: 'Skip' }).click();
    expect(await log(page)).toEqual({ answers: [], completes: 1 });
  });

  test('the Stage 7 Check: two dots and Quick check, no Skip; miss, miss, ring, right records one answer', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await open(page, 'check', 'check');
    await expect(page.getByText('Quick check')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await expect(page.getByText(/\d \/ \d/)).toHaveCount(0);
    await shot(page, 'sentence-builder-320-check');

    await tapTile(page, '떡국을, tteokgugeul');
    await expect(hint(page)).toContainText('Not that one yet. Try another word.');
    await tapTile(page, '좋아해요, joahaeyo');
    // The second miss on one place rings the right tile.
    await expect(hint(page)).toContainText('This one comes next.');
    await expect(page.getByTestId('sentence-builder-ring')).toContainText('저는');
    await shot(page, 'sentence-builder-320-check-ring');
    await tile(page, '저는, jeoneun').click();
    await page.waitForTimeout(120);
    await tile(page, '떡국을, tteokgugeul').click();
    await page.waitForTimeout(120);
    await tile(page, '좋아해요, joahaeyo').click();
    await expectBuilt(page, 'jeoneun tteokgugeul joahaeyo');
    expect((await log(page)).answers).toEqual([{ key: '0', correct: false, itemId: 'e2e-like-tteokguk' }]);

    // Round 2 with no miss, then the Check ends.
    await expect(page.getByTestId('sentence-builder-gloss')).toHaveText('I drink milk.', { timeout: 5_000 });
    await tile(page, '우유를, uyureul').click();
    await page.waitForTimeout(120);
    await tile(page, '마셔요, masyeoyo').click();
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
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
