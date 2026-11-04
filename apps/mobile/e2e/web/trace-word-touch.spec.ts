import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Finger, VIEWBOX, canvasBox, expectFingerLine, paths, type Point } from './trace-fingers';

/**
 * AMENDMENTS-TOUCH KT-8 (6.8, KT-D9, R1) on Trace a Word: a trace stroke starts after 4 px (`spacing.xs`)
 * instead of the gesture handler's 15 px and follows one finger by pointer id (a resting palm or a second
 * touch adds nothing and cancels nothing; a palm that drifted first gives the stroke to the finger), and a
 * touch that never travelled 4 px leaves no ink and re-arms the idle check. Real touches through CDP, at
 * 320 px and on a tablet. Trace (one letter) is in `trace-touch.spec.ts`.
 *
 * The whole file needs the fixture bundle (the `__hrTraceWordE2E` hook); the fixture e2e run selects it
 * through its `trace-word` file filter:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test trace-word-touch
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

type E2eWindow = Window & {
  __hrTraceWordE2E?: {
    open(params: { rounds: Array<{ id: string; word: { ko: string; romanization: string; en: string } }> }): void;
    blocks(word: string): Array<{ syllable: string; letters: Point[][][] }> | null;
    log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
  };
};

const HOYA = { id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } };
const IDLE = 'Write each block. Start with the first letter.';

async function openTraceWord(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTraceWordE2E), undefined, { timeout: 30_000 });
  await page.evaluate((r) => (window as E2eWindow).__hrTraceWordE2E?.open({ rounds: [r] }), HOYA);
  await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const WORD_CANVAS = '[data-testid="trace-word-canvas"]';

for (const vp of [
  { name: 'phone 320', width: 320, height: 640 },
  { name: 'tablet 820', width: 820, height: 1180 },
]) {
  test.describe(`Trace a Word touch, ${vp.name}`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture build (STORY_FIXTURES=1, dist-e2e/)');
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('a dot and a 2 px graze leave no ink; a 6 px stroke (under the old 15 px start) draws', async ({ page }) => {
      await openTraceWord(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, WORD_CANVAS);
      const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const ghosts = await paths(page, WORD_CANVAS);

      await finger.dot(mid);
      await page.waitForTimeout(100);
      expect(await paths(page, WORD_CANVAS), 'a dot leaves no ink').toBe(ghosts);

      await finger.drag(mid, { x: mid.x + 2, y: mid.y }, 2);
      await page.waitForTimeout(100);
      expect(await paths(page, WORD_CANVAS), 'a 2 px graze leaves no ink').toBe(ghosts);
      await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();

      await finger.drag(mid, { x: mid.x + 6, y: mid.y + 6 }, 3);
      await expect.poll(() => paths(page, WORD_CANVAS), { message: 'a 6 px stroke draws' }).toBe(ghosts + 1);
      await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
    });

    test('a dot after the block is drawn does not stop the idle check', async ({ page }) => {
      await openTraceWord(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, WORD_CANVAS);
      const at = (p: Point): Point => ({ x: box.x + (p.x * box.width) / VIEWBOX, y: box.y + (p.y * box.height) / VIEWBOX });
      const [ho] = (await page.evaluate((w) => (window as E2eWindow).__hrTraceWordE2E!.blocks(w), '호야'))!.map((b) => b.letters);
      // Each stroke as a finger draws it: the scripted points with 12 moves between each pair.
      for (const stroke of ho!.flat()) {
        await finger.down([at(stroke[0]!)]);
        for (const [i, p] of stroke.slice(1).entries()) {
          const from = at(stroke[i]!);
          const to = at(p);
          for (let k = 1; k <= 12; k += 1) await finger.move([{ x: from.x + ((to.x - from.x) * k) / 12, y: from.y + ((to.y - from.y) * k) / 12 }]);
        }
        await finger.up();
      }
      const inked = await paths(page, WORD_CANVAS);
      // A stray tap in a corner before the check runs: no ink, and the block is still checked on its own.
      await finger.dot({ x: box.x + 12, y: box.y + 12 });
      await page.waitForTimeout(100);
      expect(await paths(page, WORD_CANVAS)).toBe(inked);
      await expect(page.getByRole('button', { name: 'Hear ho, done', exact: true })).toBeVisible({ timeout: 5_000 });
    });

    test('a resting palm first, then a finger: the finger draws and the palm adds nothing', async ({ page }) => {
      await openTraceWord(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, WORD_CANVAS);
      const ghosts = await paths(page, WORD_CANVAS);
      const palm = { id: 9, x: box.x + box.width * 0.9, y: box.y + box.height * 0.9 };
      const a = { id: 0, x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 };
      await finger.down([palm]);
      await finger.down([palm, a]);
      for (let i = 1; i <= 8; i += 1) await finger.move([palm, { id: 0, x: a.x + i * 6, y: a.y }]);
      // The finger lifts; the palm stays, then lifts.
      await finger.move([palm]);
      await finger.up();
      await expect.poll(() => paths(page, WORD_CANVAS)).toBe(ghosts + 1);
      await expectFingerLine(page, WORD_CANVAS, a, a.x + 48);
      await expect(page.getByText(IDLE)).toBeVisible();
    });

    test('a palm that drifts first, then a finger: the finger takes the stroke and the palm leaves no ink', async ({ page }) => {
      await openTraceWord(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, WORD_CANVAS);
      const ghosts = await paths(page, WORD_CANVAS);
      const palm = { id: 9, x: box.x + box.width * 0.9, y: box.y + box.height * 0.9 };
      const drifted = { id: 9, x: palm.x - 3, y: palm.y - 3 };
      const a = { id: 0, x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 };
      // The palm's contact patch drifts 4.24 px (past the 4 px start) before the finger moves.
      await finger.down([palm]);
      await finger.move([drifted]);
      await finger.down([drifted, a]);
      for (let i = 1; i <= 8; i += 1) await finger.move([drifted, { id: 0, x: a.x + i * 6, y: a.y }]);
      await finger.move([drifted]);
      await finger.up();
      await expect.poll(() => paths(page, WORD_CANVAS)).toBe(ghosts + 1);
      await expectFingerLine(page, WORD_CANVAS, a, a.x + 48);
    });

    test('a second touch mid-stroke neither cancels nor moves the stroke', async ({ page }) => {
      await openTraceWord(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, WORD_CANVAS);
      const ghosts = await paths(page, WORD_CANVAS);
      const a = { id: 0, x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 };
      await finger.down([a]);
      for (let i = 1; i <= 4; i += 1) await finger.move([{ id: 0, x: a.x + i * 6, y: a.y }]);
      // A palm lands on the far corner and drifts while the finger keeps drawing, then lifts first.
      const palm = { id: 1, x: box.x + box.width * 0.9, y: box.y + box.height * 0.9 };
      await finger.down([{ id: 0, x: a.x + 24, y: a.y }, palm]);
      for (let i = 5; i <= 8; i += 1) await finger.move([{ id: 0, x: a.x + i * 6, y: a.y }, { id: 1, x: palm.x - i * 6, y: palm.y - i * 6 }]);
      await finger.move([{ id: 0, x: a.x + 54, y: a.y }]);
      await finger.move([{ id: 0, x: a.x + 60, y: a.y }]);
      await finger.up();
      await expect.poll(() => paths(page, WORD_CANVAS)).toBe(ghosts + 1);
      await expectFingerLine(page, WORD_CANVAS, a, a.x + 60);
    });
  });
}
