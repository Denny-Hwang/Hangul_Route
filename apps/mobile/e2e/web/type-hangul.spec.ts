import type { Page } from '@playwright/test';
import { keysFor } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { keepSidewaysIfAsked } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-001 G-3: Type Hangul with the in-app two-set keyboard (OD-10;
 * design/wireframes/minigame/type-hangul.md, design/screens/minigame-writing/).
 * No shipped lesson cell plays `type-hangul` until Stages 6 and 7, so this suite opens
 * the game on fixture rounds through the `window.__hrTypeHangulE2E` hook, which exists
 * only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul
 *
 * In the production build the suite is skipped.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words a learner never reads here (anti-shame, CLAUDE.md §1). */
const SHAME = /\b(wrong|fail\w*|incorrect|missed|lost)\b/i;
/** The shifted letters and the key that types each with Shift (KS X 5002). */
const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' };
/** Two-key vowels and finals: `keysFor` gives the joined jamo, the keyboard types its two keys. */
const SPLIT: Record<string, string> = {
  'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ',
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
};

type FixtureRound = 'hoya' | 'bibimbap' | 'sentence';
interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & {
  __hrTypeHangulE2E?: { open(params: { rounds: FixtureRound[] }): void; log(): Log; events(): TelemetryEvent[] };
};

async function open(page: Page, rounds: FixtureRound[]): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTypeHangulE2E), undefined, { timeout: 10_000 });
  await page.evaluate((r) => (window as E2eWindow).__hrTypeHangulE2E?.open({ rounds: r }), rounds);
  await expect(page.getByTestId('type-hangul-field')).toBeVisible();
  // The app shell's "ready offline" toast is not part of the game; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const key = (page: Page, id: string) => page.getByTestId(`hangul-key-${id}`);
const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrTypeHangulE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrTypeHangulE2E!.events());
/** Taps the keys that type `text`, the way a learner would (Shift for a tense letter, two keys for a joined one). */
async function typeText(page: Page, text: string): Promise<void> {
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT[j] ?? j)])) {
    if (jamo === ' ') {
      await key(page, 'space').click();
    } else if (SHIFTED[jamo]) {
      await key(page, 'shift').click();
      await key(page, SHIFTED[jamo]).click();
    } else {
      await key(page, jamo).click();
    }
  }
}

async function box(page: Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  expect(b, `${testId} has a box`).not.toBeNull();
  return b!;
}

/** Every key's hit area: at least 64 x 64 at 320 and up, and inside the window. */
async function expectKeysInWindow(page: Page, width: number, height: number, cell: { w: number; h: number }): Promise<void> {
  const keys = page.locator('[data-testid^="hangul-key-"]');
  expect(await keys.count()).toBe(29);
  for (const b of await keys.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(b.width).toBeGreaterThanOrEqual(cell.w - 0.5);
    expect(b.height).toBeGreaterThanOrEqual(cell.h - 0.5);
    expect(b.left).toBeGreaterThanOrEqual(-0.5);
    expect(b.right).toBeLessThanOrEqual(width + 0.5);
    expect(b.bottom).toBeLessThanOrEqual(height + 0.5);
  }
}

/**
 * A window too short to pin the answer row and the keyboard (a small phone on its side) scrolls them
 * with the prompt: every key keeps the 64 height, sits inside the window's width, and scrolls fully
 * into view when it is needed (never cut off).
 */
async function expectKeysReachable(page: Page, width: number, height: number, cell: { w: number; h: number }): Promise<void> {
  const keys = page.locator('[data-testid^="hangul-key-"]');
  expect(await keys.count()).toBe(29);
  for (let i = 0; i < 29; i++) {
    const k = keys.nth(i);
    await k.scrollIntoViewIfNeeded();
    const b = await k.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(b.width).toBeGreaterThanOrEqual(cell.w - 0.5);
    expect(b.height).toBeGreaterThanOrEqual(cell.h - 0.5);
    expect(b.left).toBeGreaterThanOrEqual(-0.5);
    expect(b.right).toBeLessThanOrEqual(width + 0.5);
    expect(b.top).toBeGreaterThanOrEqual(-0.5);
    expect(b.bottom).toBeLessThanOrEqual(height + 0.5);
  }
}

test.describe('Type Hangul: the in-app two-set keyboard (F-CURR-001 G-3)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568: split keyboard of 64 cells, the answer row and the whole keyboard on the first screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['hoya']);
    await expect(page.getByText('Type this word')).toBeVisible();
    await expect(page.getByTestId('type-hangul-done')).toBeDisabled();
    await expectKeysInWindow(page, 320, 568, { w: 64, h: 64 });
    const done = await box(page, 'type-hangul-done');
    const field = await box(page, 'type-hangul-field');
    expect(field.y + field.height).toBeLessThanOrEqual(568);
    expect(done.y + done.height).toBeLessThanOrEqual(568);
    // Split order: the consonant half above the vowel half, Shift after ㅍ, Del after ㅣ, Space after ㅡ.
    const top = async (id: string) => (await box(page, `hangul-key-${id}`)).y;
    expect(await top('ㅛ')).toBeGreaterThan(await top('ㅋ'));
    expect(await top('shift')).toBe(await top('ㅍ'));
    expect(await top('delete')).toBe(await top('ㅣ'));
    expect(await top('space')).toBe(await top('ㅡ'));
    await expectNoHorizontalOverflow(page);
    await shot(page, 'type-hangul-320-empty');
  });

  test('keys compose blocks; a near miss shows the marked block and the word; Fix it keeps the text; the first try scores', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['hoya', 'bibimbap']);
    await typeText(page, '호');
    await key(page, 'ㅇ').click();
    // The open block is underlined while it is built (홍, then 호여: the final hands over to the next block).
    await expect(page.getByTestId('type-hangul-open-block')).toHaveText('홍');
    await key(page, 'ㅕ').click();
    await expect(page.getByTestId('type-hangul-field')).toContainText('호여');
    await shot(page, 'type-hangul-320-typing');
    // Nothing is scored while typing.
    expect((await log(page)).answers).toEqual([]);

    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('Almost! Check the marked block.')).toBeVisible();
    await expect(page.getByTestId('type-hangul-typed-marked')).toHaveCount(1);
    await expect(page.getByTestId('type-hangul-target-marked')).toHaveCount(1);
    await expect(page.getByTestId('type-hangul-compare')).toHaveAttribute('aria-label', /Block 2 is different\./);
    await expect(page.locator('[data-testid^="hangul-key-"]')).toHaveCount(0);
    expect((await log(page)).answers).toEqual([{ key: '0', correct: false, itemId: 'e2e-hoya' }]);
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await shot(page, 'type-hangul-320-near');

    await page.getByTestId('type-hangul-fix').click();
    await expect(page.getByTestId('type-hangul-field')).toContainText('호여');
    await key(page, 'delete').click();
    await expect(page.getByTestId('type-hangul-field')).toContainText('홍');
    await key(page, 'ㅑ').click();
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    await shot(page, 'type-hangul-320-pass');
    // A retry never scores again.
    expect((await log(page)).answers).toHaveLength(1);

    // Auto-advance to the picture round: the Korean is hidden, its romanization and gloss shown.
    await expect(page.getByText('2 / 2')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Type the word for the picture')).toBeVisible();
    await expect(page.getByText('bibimbap').first()).toBeVisible();
    await expect(page.getByText('비빔밥')).toHaveCount(0);
    await shot(page, 'type-hangul-320-picture');
    await typeText(page, '비빔밥');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: false, itemId: 'e2e-hoya' },
      { key: '1', correct: true, itemId: 'e2e-bibimbap' },
    ]);
    // Test P-1: nothing typed reaches telemetry. The host sends minigame.finished on complete, as the
    // quest host does, so the check reads real events (never a vacuous empty list).
    const sent = await events(page);
    expect(sent.map((e) => e.name)).toContain('minigame.finished');
    expect(JSON.stringify(sent)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
  });

  test('Shift is one-shot and shows the tense letters; Space and Del work; spacing never decides', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page, ['sentence']);
    await expect(key(page, 'ㄱ')).toHaveAttribute('aria-label', 'ㄱ, g or k');
    await key(page, 'shift').click();
    await expect(key(page, 'shift')).toHaveAttribute('aria-pressed', 'true');
    await expect(key(page, 'ㄱ')).toHaveAttribute('aria-label', 'ㄲ, kk or k');
    await expect(key(page, 'ㅁ')).toHaveAttribute('aria-label', 'ㅁ, m');
    await shot(page, 'type-hangul-375-shift');
    await key(page, 'ㄱ').click();
    await expect(page.getByTestId('type-hangul-field')).toContainText('ㄲ');
    await expect(key(page, 'shift')).toHaveAttribute('aria-pressed', 'false');
    await expect(key(page, 'ㄱ')).toHaveAttribute('aria-label', 'ㄱ, g or k');
    await key(page, 'delete').click();
    await expect(page.getByTestId('type-hangul-done')).toBeDisabled();
    await expectKeysInWindow(page, 375, 667, { w: 75, h: 64 });

    await typeText(page, '저는 호야예요');
    await key(page, 'space').click();
    await expect(page.getByTestId('type-hangul-field')).toContainText('저는 호야예요');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    expect((await log(page)).answers).toEqual([{ key: '0', correct: true, itemId: 'e2e-sentence' }]);
  });

  test('a far miss reads the compare block by block and never uses red', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['hoya']);
    await typeText(page, '하나');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('Here is how it is written. Try again.')).toBeVisible();
    await expect(page.getByTestId('type-hangul-compare')).toHaveAttribute(
      'aria-label',
      'You typed: 하, 나. The word: 호, 야. Block 1 is different. Block 2 is different.',
    );
    const colours = await page.getByTestId('type-hangul-result').evaluate((el) =>
      [...el.querySelectorAll('*')].flatMap((n) => [getComputedStyle(n).borderTopColor, getComputedStyle(n).backgroundColor]),
    );
    // feedback.danger (#C84B3D) is never on a learner's miss.
    expect(colours).not.toContain('rgb(200, 75, 61)');
    await shot(page, 'type-hangul-320-far');
  });

  test('320 x 568: a long wrong guess wraps the compare into lines, every marked block inside the window (G-3 follow-up 1)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['hoya']);
    // 14 blocks against the 2 of 호야: before the wrap, blocks past the ninth sat off the right edge.
    await typeText(page, '가나다라마바사아자차카타파하');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('Here is how it is written. Try again.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const side of ['typed', 'target'] as const) {
      const marked = page.getByTestId(`type-hangul-${side}-marked`);
      const count = await marked.count();
      expect(count, side).toBeGreaterThan(0);
      for (let i = 0; i < count; i += 1) {
        const block = marked.nth(i);
        await block.scrollIntoViewIfNeeded();
        const b = (await block.boundingBox())!;
        expect(b.x, `${side} ${i} left`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${side} ${i} right`).toBeLessThanOrEqual(320);
        expect(b.y, `${side} ${i} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `${side} ${i} bottom`).toBeLessThanOrEqual(568);
      }
    }
    // Typed and word lines pair up: each typed line has a word line of the same length under it.
    const typedRows = page.getByTestId('type-hangul-typed-row');
    const targetRows = page.getByTestId('type-hangul-target-row');
    expect(await typedRows.count()).toBeGreaterThan(1);
    await expect(targetRows).toHaveCount(await typedRows.count());
    await page.getByTestId('type-hangul-compare').scrollIntoViewIfNeeded();
    await shot(page, 'type-hangul-320-long-guess');
  });

  test('768 x 1024: the standard KS X 5002 rows in the reading column, Done and Skip under the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, ['hoya']);
    await expectKeysInWindow(page, 768, 1024, { w: 72, h: 77 });
    const row1 = ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'];
    const ys = await Promise.all(row1.map(async (id) => (await box(page, `hangul-key-${id}`)).y));
    expect(new Set(ys).size).toBe(1);
    const space = await box(page, 'hangul-key-space');
    const done = await box(page, 'type-hangul-done');
    expect(done.y).toBeGreaterThan(space.y + space.height - 1);
    expect(done.width).toBeGreaterThan(600);
    await typeText(page, '호야');
    await shot(page, 'type-hangul-768');
  });

  test('844 x 390 (a phone on its side): standard keyboard edge to edge, the answer row in view', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await open(page, ['hoya']);
    // The app asks a phone on its side to turn upright once; "Keep sideways" plays on (F-LAYOUT-001).
    await keepSidewaysIfAsked(page);
    await expectKeysInWindow(page, 844, 390, { w: 84, h: 64 });
    const field = await box(page, 'type-hangul-field');
    expect(field.y).toBeGreaterThanOrEqual(0);
    expect(field.y + field.height).toBeLessThanOrEqual(390);
    await typeText(page, '호야');
    await shot(page, 'type-hangul-844x390');
  });

  test('1024 x 600 (a laptop window under 640 tall): one Skip, Done beside the field, keys at the floor, all in view', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await open(page, ['hoya']);
    await expect(page.getByTestId('type-hangul-skip')).toHaveCount(1);
    await expectKeysInWindow(page, 1024, 600, { w: 64, h: 64 });
    const field = await box(page, 'type-hangul-field');
    const done = await box(page, 'type-hangul-done');
    // Done sits in the answer row, inside the window.
    expect(Math.abs(done.y + done.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(2);
    expect(done.y + done.height).toBeLessThanOrEqual(600);
    const skip = await box(page, 'type-hangul-skip');
    expect(skip.y + skip.height).toBeLessThanOrEqual(600);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'type-hangul-1024x600');
  });

  for (const [width, height, cell] of [
    [568, 320, 56],
    [592, 360, 59],
  ] as const) {
    test(`${width} x ${height} (a small phone on its side): standard keyboard that scrolls with the prompt, every key reachable, one Skip`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, ['hoya']);
      await keepSidewaysIfAsked(page);
      await expect(page.getByTestId('type-hangul-skip')).toHaveCount(1);
      // A short window keeps the standard rows (split is 392 tall and would be cut off).
      const top = async (id: string) => (await box(page, `hangul-key-${id}`)).y;
      expect(await top('ㅛ')).toBe(await top('ㅂ'));
      await expectKeysReachable(page, width, height, { w: cell, h: 64 });
      await typeText(page, '호야');
      await page.getByTestId('type-hangul-done').scrollIntoViewIfNeeded();
      const done = await box(page, 'type-hangul-done');
      expect(done.y + done.height).toBeLessThanOrEqual(height);
      await page.getByTestId('type-hangul-done').click();
      await expect(page.getByText('You typed it!')).toBeVisible();
      await shot(page, `type-hangul-${width}x${height}`);
    });
  }

  test('every key is a focusable button; Enter types the focused key', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page, ['hoya']);
    await key(page, 'ㅎ').focus();
    await page.keyboard.press('Enter');
    await key(page, 'ㅗ').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('type-hangul-field')).toContainText('호');
    await expect(key(page, 'ㅎ')).toHaveAttribute('role', 'button');
    await expect(key(page, 'delete')).toHaveAttribute('aria-label', 'Delete the last letter');
    await expect(key(page, 'space')).toHaveAttribute('aria-label', 'Space');
  });
});
