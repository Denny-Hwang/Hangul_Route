import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { expectNoClippedText, expectNoSidewaysScroll } from './text-fit';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-30: Cloze Pick (design/wireframes/minigame/cloze-pick.md, design/screens/minigame-variety/ board C)
 * and its fallback. No shipped cell plays `cloze-pick` until the re-authoring rows (CM-3A), so this suite opens a real
 * Cloze Pick step on fixture rounds through `window.__hrClozePickE2E`, which exists only in the fixture bundle:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test cloze-pick
 *
 * The file name puts it in the `sentence-builder` fixture run of web-app.yml (the lane of the sentence formats at the
 * produce rung of a `pat` item, section 4.3: Sentence Builder and Cloze Pick), so CI runs it on the fixture bundle.
 *
 * `game.cloze-pick` ships at built-in pct 0 (the row merges dark), so the game is switched on by a stored remote copy
 * (pct 100), as `daily-review.spec.ts` does; with it off every round renders its fallback, Listen & Pick in its text
 * prompt mode, which this suite answers to the end so turning the switch off is known to rescue the step.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words a learner never reads here (anti-shame, CLAUDE.md section 1). */
const SHAME = /\b(wrong|fail\w*|incorrect|missed|lost)\b/i;
/** The 48 dp floor of section 14 (the tiles are `touchTarget.min`, 64, tall). */
const TARGET_MIN = 48;

type Fixture = 'word' | 'particle' | 'value';
interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
  rendered: string | null;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & {
  __hrClozePickE2E?: { open(params: { rounds: Fixture[] }): void; log(): Log; events(): TelemetryEvent[] };
};

async function open(page: Page, rounds: Fixture[], game: boolean, textSize?: 'largest'): Promise<void> {
  await page.goto('/');
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.cloze-pick': { on: game, pct: 100 } } });
  if (textSize) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrClozePickE2E), undefined, { timeout: 10_000 });
  await page.evaluate((r) => (window as E2eWindow).__hrClozePickE2E?.open({ rounds: r }), rounds);
  await expect(page.getByText('Fill the gap')).toBeVisible();
  // The app shell's "ready offline" toast is not part of the game; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrClozePickE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrClozePickE2E!.events());
const tile = (page: Page, round: string, i: number) => page.getByTestId(`cloze-pick-tile-${round}:t${i}`);
const option = (page: Page, round: string, i: number) => page.getByTestId(`listen-pick-option-${round}:t${i}`);
/** A tap a beat after the last one, as a learner taps: the game keeps only the first touch in a 50 ms window. */
async function tap(page: Page, target: ReturnType<typeof tile>): Promise<void> {
  await page.waitForTimeout(120);
  await target.click();
}

/** Every visible control of the step: at least 48 x 48 and inside the window's width. */
async function expectTargets(page: Page, width: number, testIdPrefix: string): Promise<void> {
  const boxes = await page.locator(`[data-testid^="${testIdPrefix}"]`).evaluateAll((els) => els.filter((el) => el.getAttribute('role') === 'button').map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  for (const b of boxes) {
    expect(b.height).toBeGreaterThanOrEqual(TARGET_MIN - 0.5);
    expect(b.width).toBeGreaterThanOrEqual(TARGET_MIN - 0.5);
    expect(b.left).toBeGreaterThanOrEqual(-0.5);
    expect(b.right).toBeLessThanOrEqual(width + 0.5);
  }
}

test.describe('Cloze Pick (F-CURR-002 row CM-30)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568: the sentence card and three tiles on the first screen, 48 dp targets, screen-reader labels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['word', 'particle'], true);
    expect((await log(page)).rendered).toBe('cloze-pick');
    const card = page.getByTestId('cloze-pick-sentence');
    await expect(card).toHaveAttribute('aria-label', 'Sentence: chaegeul blank. I read a book.');
    await expect(page.getByText('I read a book.')).toBeVisible();
    await expect(tile(page, 'e2e-cloze-word', 0)).toHaveAttribute('aria-label', '읽어요, ilgeoyo');
    // Tiles carry no gloss: it would answer a word gap.
    await expect(page.getByText('read', { exact: true })).toHaveCount(0);
    await expectTargets(page, 320, 'cloze-pick-tile-');
    const last = await tile(page, 'e2e-cloze-word', 2).boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(568);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cloze-pick-320-asking');
  });

  test('320 px at the largest text size (reading sizes x 1.5): the card, its gap and the tiles wrap, 48 dp targets, no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['value', 'word'], true, 'largest');
    expect((await log(page)).rendered).toBe('cloze-pick');
    await expect(page.getByTestId('cloze-pick-realia')).toBeVisible();
    await expectTargets(page, 320, 'cloze-pick-tile-');
    await expectNoSidewaysScroll(page, 'cloze-pick largest, value gap');
    await expectNoClippedText(page, 'cloze-pick largest, value gap');
    // The sentence card (with its gap) stays inside the window.
    const card = await page.getByTestId('cloze-pick-sentence').boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(-0.5);
    expect(card!.x + card!.width).toBeLessThanOrEqual(320.5);
    const gap = await page.getByTestId('cloze-pick-gap').boundingBox();
    expect(gap!.x + gap!.width).toBeLessThanOrEqual(card!.x + card!.width + 0.5);
    await shot(page, 'cloze-pick-320-largest');
  });

  test('a miss is amber with Hoya and never scored again; the right tile fills the gap; first tries score; telemetry has no Korean', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['word', 'particle'], true);
    await tap(page, tile(page, 'e2e-cloze-word', 1));
    await expect(page.getByText('Read the sentence again. Which one fits?')).toBeVisible();
    await expect(tile(page, 'e2e-cloze-word', 1)).toHaveAttribute('aria-label', 'Not this one: 먹어요, meogeoyo');
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await shot(page, 'cloze-pick-320-miss');
    await tap(page, tile(page, 'e2e-cloze-word', 2));
    await expect(page.getByText('This one fits here.')).toBeVisible();
    await expect(tile(page, 'e2e-cloze-word', 0)).toHaveAttribute('aria-label', 'Look here: 읽어요, ilgeoyo');
    await tap(page, tile(page, 'e2e-cloze-word', 0));
    await expect(page.getByTestId('cloze-pick-gap')).toContainText('읽어요');
    await expect(page.getByTestId('cloze-pick-sentence')).toHaveAttribute('aria-label', 'Sentence complete: chaegeul ilgeoyo. I read a book.');
    await expect(page.getByTestId('cloze-pick-hear-it')).toBeVisible();
    await shot(page, 'cloze-pick-320-found');
    // Round 2, a particle gap: its own instruction and Sentence Builder's particle line.
    await expect(page.getByText('Pick the piece that fits.')).toBeVisible({ timeout: 5_000 });
    await tap(page, tile(page, 'e2e-cloze-particle', 1));
    await expect(page.getByText('Look at how the word before it ends.')).toBeVisible();
    await tap(page, tile(page, 'e2e-cloze-particle', 0));
    await expect(page.getByText('mureul masyeoyo.')).toBeVisible();
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-cloze-word' },
      { key: '0', correct: false, itemId: 'e2e-cloze-word' },
      { key: '0', correct: true, itemId: 'e2e-cloze-word' },
      { key: '1', correct: false, itemId: 'e2e-cloze-particle' },
      { key: '1', correct: true, itemId: 'e2e-cloze-particle' },
    ]);
    const sent = await events(page);
    expect(sent.filter((e) => e.name === 'minigame.finished').map((e) => e.payload)).toEqual([{ kind: 'cloze-pick', questId: 'e2e-cloze-pick', stepIndex: 0 }]);
    expect(JSON.stringify(sent)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
  });

  test('reduced motion: the gap fills at once and the round still moves on', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['word'], true);
    await tap(page, tile(page, 'e2e-cloze-word', 0));
    await expect(page.getByTestId('cloze-pick-gap')).toContainText('읽어요');
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
  });

  test('a value gap reads its card: 320 and wide', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['value'], true);
    await expect(page.getByTestId('cloze-pick-realia')).toBeVisible();
    await expect(page.getByText('Read the menu, sign or ticket, then pick.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cloze-pick-320-value');
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('cloze-pick-realia')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cloze-pick-wide-value');
    await tap(page, tile(page, 'e2e-cloze-value', 0));
    await expect(page.getByText('It is three thousand won.')).toBeVisible();
  });

  test('wide: two columns of tiles beside the sentence', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, ['word'], true);
    await expectTargets(page, 1024, 'cloze-pick-tile-');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cloze-pick-wide-asking');
  });

  test('game.cloze-pick off: every round plays as Listen & Pick with a text prompt, to the end', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['word', 'value'], false);
    expect((await log(page)).rendered).toBe('listen-pick');
    await expect(page.getByTestId('listen-pick-text-prompt')).toHaveAttribute('aria-label', 'Sentence: chaegeul blank. I read a book.');
    await expect(page.getByTestId('listen-pick-speaker')).toHaveCount(0);
    await expect(page.getByText('Listen, then pick')).toHaveCount(0);
    await expectTargets(page, 320, 'listen-pick-option-');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cloze-pick-320-fallback');
    await tap(page, option(page, 'e2e-cloze-word', 1));
    await expect(page.getByText('Read the sentence again. Which one fits?')).toBeVisible();
    await tap(page, option(page, 'e2e-cloze-word', 0));
    // The value round keeps its card above the text prompt.
    await expect(page.getByTestId('cloze-pick-fallback-realia')).toBeVisible({ timeout: 5_000 });
    await tap(page, option(page, 'e2e-cloze-value', 0));
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-cloze-word' },
      { key: '0', correct: true, itemId: 'e2e-cloze-word' },
      { key: '1', correct: true, itemId: 'e2e-cloze-value' },
    ]);
    const sent = await events(page);
    expect(sent.filter((e) => e.name === 'minigame.finished').map((e) => e.payload)).toEqual([{ kind: 'listen-pick', questId: 'e2e-cloze-pick', stepIndex: 0 }]);
  });
});
