import type { Page } from '@playwright/test';
import { keysFor } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { keepSidewaysIfAsked } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-001 G-5: Write Frame and My page (design/wireframes/minigame/write-frame.md,
 * design/screens/minigame-writing/write-frame.md). No shipped lesson cell plays `write-frame`
 * until Stage 7, so this suite opens the game on fixture rounds through the
 * `window.__hrWriteFrameE2E` hook, which exists only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test write-frame
 *
 * In the production build the suite is skipped. The name round uses the cast name 호야 only.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words a learner never reads here (anti-shame, CLAUDE.md §1); "no wrong way" is the one approved line. */
const SHAME = /\b(fail\w*|incorrect|missed|lost)\b/i;
const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ' };

type Fixture = 'food' | 'holiday' | 'place' | 'name';
interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & {
  __hrWriteFrameE2E?: { open(params: { rounds: Fixture[]; mode?: 'quest' | 'preview' }): void; log(): Log; events(): TelemetryEvent[] };
};

async function open(page: Page, rounds: Fixture[], mode: 'quest' | 'preview' = 'quest'): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrWriteFrameE2E), undefined, { timeout: 10_000 });
  await page.evaluate(([r, m]) => (window as E2eWindow).__hrWriteFrameE2E?.open({ rounds: r as Fixture[], mode: m as 'quest' | 'preview' }), [rounds, mode] as const);
  await expect(page.getByTestId('write-frame')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const key = (page: Page, id: string) => page.getByTestId(`hangul-key-${id}`);
const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrWriteFrameE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrWriteFrameE2E!.events());
async function typeText(page: Page, text: string): Promise<void> {
  for (const jamo of keysFor(text)) {
    if (SHIFTED[jamo]) {
      await key(page, 'shift').click();
      await key(page, SHIFTED[jamo]).click();
    } else {
      await key(page, jamo).click();
    }
  }
}
async function box(page: Page, testId: string) {
  const b = await page.getByTestId(testId).first().boundingBox();
  expect(b, `${testId} has a box`).not.toBeNull();
  return b!;
}

test.describe('Write Frame: my own sentence and My page (F-CURR-001 G-5)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568: any pick is right, the ending follows it, a near miss is checked against the pick, My page is not kept', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['food', 'place']);
    await expect(page.getByText('Make your own sentence')).toBeVisible();
    await expect(page.getByText('Pick a word. Any word works.')).toBeVisible();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('을/를');
    await expect(page.getByTestId('write-frame-card')).toHaveAttribute('aria-label', '저는, blank, 을 or 를, 좋아해요. I like blank.');
    for (const id of ['write-frame-word-0', 'write-frame-word-1']) {
      const b = await box(page, id);
      expect(b.height).toBeGreaterThanOrEqual(80 - 0.5);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, 'write-frame-320-pick');

    // 김밥 ends in a final: 을. Writing is checked against the pick.
    await page.getByTestId('write-frame-word-1').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('을');
    await expect(page.getByTestId('write-frame-change-word')).toBeVisible();
    // Change word goes back with the pick kept; 떡볶이 ends in a vowel: 를.
    await page.getByTestId('write-frame-change-word').click();
    await expect(page.getByTestId('write-frame-word-1')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('write-frame-word-0').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('를');
    await expect(page.getByTestId('write-frame-notice')).toHaveText('를 after 떡볶이');
    const done = await box(page, 'write-frame-done');
    expect(done.y + done.height).toBeLessThanOrEqual(568);
    await typeText(page, '떡보이');
    await shot(page, 'write-frame-320-type');
    expect((await log(page)).answers).toEqual([]);
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('Almost! Check the marked block.')).toBeVisible();
    await expect(page.getByTestId('type-hangul-compare')).toHaveAttribute('aria-label', /The word: 떡, 볶, 이\./);
    await expect(page.getByTestId('write-frame-change-word')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await shot(page, 'write-frame-320-near');
    await page.getByTestId('type-hangul-fix').click();
    for (let i = 0; i < 4; i += 1) await key(page, 'delete').click();
    await typeText(page, '볶이');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('You wrote a sentence!')).toBeVisible();
    await expect(page.getByText('저는 떡볶이를 좋아해요.')).toBeVisible();
    await expect(page.getByText('jeoneun tteokbokkireul joahaeyo')).toBeVisible();
    await expect(page.getByText('I like spicy rice cakes.')).toBeVisible();
    await shot(page, 'write-frame-320-sentence');
    expect((await log(page)).answers).toEqual([{ key: '0', correct: false, itemId: 'e2e-food' }]);

    // The next frame is pick-only; then My page lists both sentences and says it is not saved.
    await expect(page.getByText('2 / 2')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-1').click();
    await expect(page.getByText('오늘 공원에 가요.')).toBeVisible();
    await expect(page.getByTestId('write-frame-my-page')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('My page')).toBeVisible();
    await expect(page.getByTestId('write-frame-my-page-sheet').getByText('저는 떡볶이를 좋아해요.')).toBeVisible();
    await expect(page.getByTestId('write-frame-my-page-sheet').getByText('Today I go to the park.')).toBeVisible();
    await expect(page.getByText('This page is just for now. It is not saved.')).toBeVisible();
    // No share, save, print, export or copy control: Continue is the only button.
    await expect(page.getByTestId('write-frame-my-page').getByRole('button')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'write-frame-320-my-page');
    await page.getByTestId('write-frame-continue').click();
    await expect.poll(async () => (await log(page)).completes).toBe(1);
    // Test P-1: nothing written reaches telemetry, and the page is gone.
    const sent = await events(page);
    expect(sent.map((e) => e.name)).toContain('minigame.finished');
    expect(JSON.stringify(sent)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    await expect(page.getByTestId('write-frame-my-page')).toHaveCount(0);
  });

  test('two slots: the current slot is marked, the top row counts frames, one answer after the last slot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page, ['holiday']);
    await expect(page.getByText('1 / 1')).toBeVisible();
    await page.getByTestId('write-frame-word-1').click();
    await typeText(page, '추석');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    await expect(page.getByText('Pick a word. Any word works.')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('write-frame-slot-0')).toHaveText('추석');
    await shot(page, 'write-frame-375-two-slots');
    await page.getByTestId('write-frame-word-1').click();
    await typeText(page, '송편');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('추석에 송편을 먹었어요.')).toBeVisible();
    await expect(page.getByText('On Chuseok, I ate half-moon rice cakes.')).toBeVisible();
    expect((await log(page)).answers).toEqual([{ key: '0', correct: true, itemId: 'e2e-holiday' }]);
  });

  test('the name round: tiles and the keyboard edit one field, Done needs whole syllables, unscored, gone after Continue', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ['name']);
    await expect(page.getByRole('heading', { name: 'Write your name in Hangul' })).toBeVisible();
    await expect(page.getByText('There is no wrong way to write your name.')).toBeVisible();
    await expect(page.getByTestId('write-frame-done')).toBeDisabled();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('이에요/예요');
    await page.getByTestId('write-frame-tile-호').click();
    await page.getByTestId('write-frame-tile-야').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('예요');
    await expect(page.getByTestId('write-frame-done')).toBeEnabled();
    await expect(page.getByTestId('write-frame-tile-호')).toHaveAttribute('aria-label', '호, ho');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'write-frame-320-name-blocks');
    // The Keyboard tab keeps the field; a lone letter turns Done off and shows the helper line.
    await page.getByTestId('write-frame-tab-keyboard').click();
    await expect(page.getByTestId('write-frame-field')).toContainText('호야');
    // A final on the last block: the ending follows it on the frame line only (no shot, no finish with that name).
    await key(page, 'ㄴ').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('이에요');
    await key(page, 'delete').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('예요');
    // A lone letter after the cast name: the helper line and both endings.
    await key(page, 'ㅗ').click();
    await expect(page.getByText('Finish the last block.')).toBeVisible();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('이에요/예요');
    await expect(page.getByTestId('write-frame-done')).toBeDisabled();
    await shot(page, 'write-frame-320-name-keyboard');
    await key(page, 'delete').click();
    await expect(page.getByTestId('write-frame-field')).toContainText('호야');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('제 이름은 호야예요.')).toBeVisible();
    await expect(page.getByText('My name is Hoya.')).toBeVisible();
    await expect(page.getByTestId('write-frame-my-page')).toBeVisible({ timeout: 5_000 });
    await shot(page, 'write-frame-320-name-my-page');
    await page.getByTestId('write-frame-continue').click();
    await expect.poll(async () => (await log(page)).completes).toBe(1);
    expect((await log(page)).answers).toEqual([]);
    // Test P-1: the name is in no telemetry event, no storage key and nowhere on the page once the game is gone.
    expect(JSON.stringify(await events(page))).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    const stored = await page.evaluate(() => {
      const all: string[] = [];
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i += 1) {
          const k = store.key(i) ?? '';
          all.push(k, store.getItem(k) ?? '');
        }
      }
      return all.join('\n');
    });
    expect(stored).not.toContain('호야');
    expect(page.url()).not.toMatch(/%[EeDd]|호/);
    await expect(page.getByTestId('write-frame')).toHaveCount(0);
  });

  test('the grown-up preview opens the name round on the cast name', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page, ['food', 'name'], 'preview');
    await page.getByTestId('write-frame-word-1').click();
    await typeText(page, '김밥');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByTestId('write-frame-field')).toContainText('호야', { timeout: 5_000 });
    await expect(page.getByTestId('write-frame-done')).toBeEnabled();
  });

  test('768 x 1024: three-column bank, the reading column, Done and Skip under the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, ['food']);
    const a = await box(page, 'write-frame-word-0');
    const c = await box(page, 'write-frame-word-2');
    expect(Math.abs(a.y - c.y)).toBeLessThanOrEqual(1);
    await shot(page, 'write-frame-768-pick');
    await page.getByTestId('write-frame-word-3').click();
    await typeText(page, '비빔밥');
    await shot(page, 'write-frame-768-type');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('저는 비빔밥을 좋아해요.')).toBeVisible();
  });

  test('844 x 390 (a phone on its side): the answer row and Skip stay in view', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await open(page, ['food']);
    await keepSidewaysIfAsked(page);
    await page.getByTestId('write-frame-word-1').click();
    await expect(page.getByTestId('write-frame-skip')).toHaveCount(1);
    const field = await box(page, 'write-frame-field');
    expect(field.y).toBeGreaterThanOrEqual(0);
    expect(field.y + field.height).toBeLessThanOrEqual(390);
    await typeText(page, '김밥');
    await shot(page, 'write-frame-844x390');
  });
});
