import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Finger, VIEWBOX, canvasBox, lastInk, type Point } from './trace-fingers';

/**
 * NB-3: the ㅇ circle (and ㅎ's) drew as an octagon. The guide loops are now sampled from a true
 * circle / ellipse (64 chords) and the learner's ink is smoothed through the finger's samples, so a
 * quick circle has no corners. Checked on Trace a Word with 호야 (ㅎ's loop and ㅇ), at 320 px and on
 * a tablet, with a screenshot of each for review.
 *
 * Needs the fixture bundle (the `__hrTraceWordE2E` hook); the fixture e2e run selects it through its
 * `trace-word` file filter:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test trace-word-round-loop
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const WORD_CANVAS = '[data-testid="trace-word-canvas"]';
const HOYA = { id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } };
/** jamo-strokes LOOP_SEGMENTS. */
const LOOP_SEGMENTS = 64;

type E2eWindow = Window & {
  __hrTraceWordE2E?: {
    open(params: { rounds: Array<{ id: string; word: { ko: string; romanization: string; en: string } }> }): void;
    blocks(word: string): Array<{ syllable: string; letters: Point[][][] }> | null;
  };
};

async function openHoya(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTraceWordE2E), undefined, { timeout: 30_000 });
  await page.evaluate((r) => (window as E2eWindow).__hrTraceWordE2E?.open({ rounds: [r] }), HOYA);
  await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

/** Path data segments (L or Q) in each path of the canvas. */
async function segmentsPerPath(page: Page): Promise<number[]> {
  return page.locator(`${WORD_CANVAS} path`).evaluateAll((els) => els.map((el) => (el.getAttribute('d') ?? '').match(/[LQ]/g)?.length ?? 0));
}

for (const vp of [
  { name: 'phone 320', width: 320, height: 640 },
  { name: 'tablet 820', width: 820, height: 1180 },
]) {
  test.describe(`Round loops on Trace a Word, ${vp.name}`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture build (STORY_FIXTURES=1, dist-e2e/)');
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('ㅎ and ㅇ guides are drawn round, and a quick circle of ink has no corners', async ({ page }, info) => {
      await openHoya(page);
      // The two loops (ㅎ's ring and ㅇ) are the only guides with a full loop's worth of chords.
      const loops = (await segmentsPerPath(page)).filter((n) => n >= LOOP_SEGMENTS);
      expect(loops, 'two round guide loops').toHaveLength(2);

      // A quick circle over ㅇ: only 12 finger samples, the way a fast finger reports them.
      const box = await canvasBox(page, WORD_CANVAS);
      const blocks = (await page.evaluate((w) => (window as E2eWindow).__hrTraceWordE2E!.blocks(w), '호야'))!;
      const ieung = blocks[1]!.letters[0]![0]!;
      const xs = ieung.map((p) => p.x);
      const ys = ieung.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = (Math.max(...xs) - Math.min(...xs)) / 2;
      const at = (p: Point): Point => ({ x: box.x + (p.x * box.width) / VIEWBOX, y: box.y + (p.y * box.height) / VIEWBOX });
      const samples = Array.from({ length: 13 }, (_, i) => {
        const t = (2 * Math.PI * i) / 12;
        return at({ x: cx - r * Math.sin(t), y: cy - r * Math.cos(t) });
      });
      const finger = await Finger.on(page);
      await finger.down([samples[0]!]);
      for (const p of samples.slice(1)) await finger.move([p]);
      await finger.up();

      await expect
        .poll(async () => (await page.locator(`${WORD_CANVAS} path`).last().getAttribute('d')) ?? '', { message: 'the ink is smoothed' })
        .toMatch(/ Q /);
      // Still every finger sample, from where it landed to where it lifted.
      const ink = await lastInk(page, WORD_CANVAS);
      expect(ink.length).toBeGreaterThanOrEqual(3);
      expect(Math.hypot(ink[0]!.x - samples[0]!.x, ink[0]!.y - samples[0]!.y)).toBeLessThan(2);

      await page.locator(WORD_CANVAS).screenshot({ path: info.outputPath(`nb-3-round-loops-${vp.width}.png`) });
    });
  });
}
