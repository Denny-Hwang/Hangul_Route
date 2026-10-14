import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-001 row G-4: Trace a Word (design/wireframes/minigame/trace-word.md,
 * design/screens/minigame-writing/trace-word.md). No lesson cell plays `trace-word` until the
 * Stage 7 cells ship, so this suite opens the game on the spec's Stage 7 words through the
 * `window.__hrTraceWordE2E` hook, which exists only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test trace-word
 *
 * The strokes are scripted over the placed ghost the hook returns (each letter in its zone of the
 * block). In the production build the suite is skipped.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const VIEWBOX = 200;

interface Point {
  x: number;
  y: number;
}
interface E2eRound {
  id: string;
  word: { ko: string; romanization: string; en: string };
  mode?: 'block' | 'letter';
}
type E2eWindow = Window & {
  __hrTraceWordE2E?: {
    open(params: { rounds: E2eRound[] }): void;
    blocks(word: string): Array<{ syllable: string; letters: Point[][][] }> | null;
    log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
  };
};

const HOYA: E2eRound = { id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } };
const IREUM: E2eRound = { id: 'ireum', word: { ko: '이름', romanization: 'ireum', en: 'name' }, mode: 'letter' };
const HAN: E2eRound = { id: 'han', word: { ko: '한', romanization: 'han', en: 'one' } };

const IDLE = 'Write each block. Start with the first letter.';
const LETTER_IDLE = 'Trace the letter in the bright box.';
const WORD_DONE = 'You wrote the whole word!';
const RETRY = 'Try again — start at the top!';

async function open(page: Page, rounds: E2eRound[]): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTraceWordE2E), undefined, { timeout: 30_000 });
  await page.evaluate((r) => (window as E2eWindow).__hrTraceWordE2E?.open({ rounds: r }), rounds);
  await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
  // The app shell's "ready offline" toast is not part of the game; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const blocksOf = async (page: Page, word: string): Promise<Point[][][][]> =>
  (await page.evaluate((w) => (window as E2eWindow).__hrTraceWordE2E!.blocks(w), word))!.map((b) => b.letters);

const log = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrTraceWordE2E!.log());

/** Draws strokes (200 viewBox) on the live canvas with the mouse, one finger stroke each. */
async function draw(page: Page, strokes: Point[][]): Promise<void> {
  const box = (await page.getByTestId('trace-word-canvas').boundingBox())!;
  const at = (p: Point): [number, number] => [box.x + (p.x * box.width) / VIEWBOX, box.y + (p.y * box.height) / VIEWBOX];
  for (const stroke of strokes) {
    await page.mouse.move(...at(stroke[0]!));
    await page.mouse.down();
    for (const p of stroke.slice(1)) await page.mouse.move(...at(p), { steps: 6 });
    await page.mouse.up();
  }
}

const hoya = (page: Page) => page.getByTestId('trace-word-hoya');
const done = (page: Page) => page.getByRole('button', { name: 'Done', exact: true });

for (const vp of [
  { name: 'phone 320', width: 320, height: 568 },
  { name: 'tablet 768', width: 768, height: 1024 },
]) {
  test.describe(`Trace a Word, ${vp.name}`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture build (STORY_FIXTURES=1, dist-e2e/)');
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('traces 호야 block by block over the placed ghost and scores the word once', async ({ page }) => {
      await open(page, [HOYA]);
      await expect(page.getByRole('heading', { name: 'Trace the word hoya, Hoya' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Hear ho', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Hear ya', exact: true })).toBeVisible();
      await expect(page.getByTestId('trace-word-canvas')).toHaveAttribute('aria-label', 'Draw ho, block 1 of 2, with your finger');
      await expect(hoya(page)).toHaveText(IDLE);
      for (const name of ['Done', 'Skip', 'Show me', 'Clear']) {
        await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
      }
      await expectNoHorizontalOverflow(page);
      const canvas = (await page.getByTestId('trace-word-canvas').boundingBox())!;
      expect(canvas.width, 'canvas floor').toBeGreaterThanOrEqual(160);
      if (vp.width >= 768) {
        // A tablet shows both blocks: the live one and the one to come, each at least 240.
        await expect(page.getByTestId('trace-word-canvas-waiting')).toBeVisible();
        expect(canvas.width).toBeGreaterThanOrEqual(240);
      } else {
        await expect(page.getByTestId('trace-word-canvas-waiting')).toHaveCount(0);
      }
      await shot(page, `trace-word-${vp.width}-idle`);

      const [ho, ya] = await blocksOf(page, '호야');
      await draw(page, ho!.flat());
      await done(page).click();
      await expect(page.getByRole('button', { name: 'Hear ho, done', exact: true })).toBeVisible();
      await shot(page, `trace-word-${vp.width}-block1`);
      await expect(page.getByTestId('trace-word-canvas')).toHaveAttribute('aria-label', 'Draw ya, block 2 of 2, with your finger');
      await expect(hoya(page)).toHaveText(IDLE);
      if (vp.width >= 768) await expect(page.getByTestId('trace-word-canvas-done')).toBeVisible();

      await draw(page, ya!.flat());
      await done(page).click();
      await expect(hoya(page)).toHaveText(WORD_DONE);
      await shot(page, `trace-word-${vp.width}-word-done`);
      await expect.poll(async () => (await log(page)).answers).toEqual([{ key: '0', correct: true }]);
      await expect.poll(async () => (await log(page)).completed).toBe(1);
    });
  });
}

test.describe('Trace a Word, phone 320: gate, retry, letter mode, Skip', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture build (STORY_FIXTURES=1, dist-e2e/)');
  test.use({ viewport: { width: 320, height: 568 } });

  test('a pause with only the first letter drawn never scores the block', async ({ page }) => {
    await open(page, [HOYA]);
    const [ho] = await blocksOf(page, '호야');
    await draw(page, ho![0]!);
    await page.waitForTimeout(2500);
    await expect(hoya(page)).toHaveText(IDLE);
    await expect(done(page)).toBeEnabled();
    expect((await log(page)).answers).toEqual([]);
    // With ㅗ drawn too, the idle timer scores it.
    await draw(page, ho![1]!);
    await expect(page.getByRole('button', { name: 'Hear ho, done', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('a block that does not pass gets the amber retry and stays current; the word then scores as a miss', async ({ page }) => {
    await open(page, [HAN]);
    await draw(page, [[{ x: 20, y: 180 }, { x: 60, y: 180 }]]);
    await done(page).click();
    await expect(hoya(page)).toHaveText(RETRY);
    await shot(page, 'trace-word-320-retry');
    await expect(hoya(page)).toHaveText(IDLE, { timeout: 5_000 });
    const [han] = await blocksOf(page, '한');
    await draw(page, han!.flat());
    await done(page).click();
    await expect(hoya(page)).toHaveText(WORD_DONE);
    await expect.poll(async () => (await log(page)).answers).toEqual([{ key: '0', correct: false }]);
  });

  test('letter mode traces each letter in its lit zone, block after block', async ({ page }) => {
    await open(page, [IREUM]);
    await expect(hoya(page)).toHaveText(LETTER_IDLE);
    await shot(page, 'trace-word-320-letter');
    const blocks = await blocksOf(page, '이름');
    for (const [bi, letters] of blocks.entries()) {
      for (const [li, letter] of letters.entries()) {
        await draw(page, letter);
        await done(page).click();
        const last = bi === blocks.length - 1 && li === letters.length - 1;
        if (last) await expect(hoya(page)).toHaveText(WORD_DONE);
        else await expect(hoya(page)).toHaveText(LETTER_IDLE, { timeout: 5_000 });
      }
    }
    await expect.poll(async () => (await log(page)).answers).toEqual([{ key: '0', correct: true }]);
  });

  test('Skip ends the step', async ({ page }) => {
    await open(page, [HOYA, HAN]);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect.poll(async () => (await log(page)).completed).toBe(1);
    expect((await log(page)).answers).toEqual([]);
  });
});
