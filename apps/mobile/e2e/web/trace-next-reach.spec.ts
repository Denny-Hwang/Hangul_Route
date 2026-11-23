import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, openLettersEpisode, passDiscover, seedStored } from './helpers';
import { Finger, VIEWBOX, canvasBox, type Point } from './trace-fingers';
import { strokesForJamo } from '../../src/content/jamo-strokes';
import { TRACE_IDLE_MS } from '../../src/logic/trace-evaluator';
import { visibleRatio } from './viewport';

/**
 * AMENDMENTS-TRACE-IDLE TI-3b, owner decision OD-TI7 (design: wireframes/minigame/families.md "Trace Stroke states",
 * decisions 1 and 4, open item 3; mock screens/minigame-writing/mock/trace-stroke-text200.html): while a pass with a
 * tip waits for Next, the controls under the canvas scroll, so Next stays on screen when large text makes them taller
 * than the room the canvas leaves; where they fit, nothing moves. On the release build, with a screenshot of each
 * attached to the report:
 *
 * - 320 x 568 and 320 x 480 at the Largest text size (the browser has no 200 % system text; the shorter window makes
 *   the same squeeze): Next on screen and focused, the canvas at its floor or more and not covered, room for the focus
 *   ring at the scroll edge. At 568 the whole tip shows too; at 480 Next and the whole tip cannot both fit, so Next wins
 *   and the tip scrolls (open item for the on-device check, §3.7).
 * - 740 x 360 (a phone on its side) at the standard size: the controls fit beside the canvas, so Next takes Done's
 *   place exactly and Show me and Clear stay in view (the prompt beside the canvas gives up its height first).
 *
 * Meet the Letters quest 2 traces ㅁ ㅇ ㅗ ㅜ in a shuffled order (as `trace-round-loop.spec.ts`): the test traces
 * each other letter along its guide until ㅇ is up, then draws ㅇ the other way round, a pass with the loop tip.
 */

const en = getMessages('en').learner.minigame.trace;
const STROKE_CANVAS = '#trace-canvas';
const CONTROLS = '[data-testid="trace-stroke-controls"]';
/** jamo-strokes LOOP_SEGMENTS: ㅇ's guide is the one path drawn with this many chords. */
const LOOP_SEGMENTS = 64;
/** The quest's other letters, by the romanization in the heading (ㅇ is told by its round guide). */
const OTHER_LETTERS: Record<string, string> = { m: 'jamo:mieum', o: 'jamo:o', u: 'jamo:u' };
/** TRACE_CANVAS_MIN. */
const CANVAS_FLOOR = 160;

async function openTraceStroke(page: Page, largest: boolean): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Tia' });
  if (largest) await seedStored(page, 'device:settings', { uiLocale: 'en', textSize: 'largest', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  await page.goto('/');
  await expect(page.getByText('Hi, Tia!')).toBeVisible();
  await openLettersEpisode(page);
  await page.getByRole('button', { name: 'Start' }).nth(1).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByText('Trace Each Letter')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText(/^Trace the letter /)).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const chordsPerPath = (page: Page): Promise<number[]> =>
  page.locator(`${STROKE_CANVAS} path`).evaluateAll((els) => els.map((el) => (el.getAttribute('d') ?? '').match(/[LQ]/g)?.length ?? 0));

/** One stroke through viewBox points, walked in small moves. */
async function trace(finger: Finger, at: (p: Point) => Point, stroke: readonly Point[]): Promise<void> {
  await finger.down([at(stroke[0]!)]);
  for (let i = 1; i < stroke.length; i++) {
    const [a, b] = [stroke[i - 1]!, stroke[i]!];
    for (let k = 1; k <= 10; k++) await finger.move([at({ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 })]);
  }
  await finger.up();
}

for (const vp of [
  { name: 'phone 320 x 568, Largest text', width: 320, height: 568, largest: true, fits: false, wholeTip: true },
  { name: 'phone 320 x 480, Largest text', width: 320, height: 480, largest: true, fits: false, wholeTip: false },
  { name: 'phone on its side 740 x 360', width: 740, height: 360, largest: false, fits: true, wholeTip: true },
]) {
  test.describe(`Trace Stroke, a tip waits for Next, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Next is on screen and focused; the canvas is not covered; the controls scroll only when they do not fit', async ({ page }, info) => {
      await openTraceStroke(page, vp.largest);
      const finger = await Finger.on(page);
      const heading = page.getByRole('heading', { name: /^Trace the letter / }).first();
      const isIeung = async (): Promise<boolean> => (await chordsPerPath(page)).some((n) => n >= LOOP_SEGMENTS);
      for (let round = 0; round < 4 && !(await isIeung()); round++) {
        const box = await canvasBox(page, STROKE_CANVAS);
        const at = (p: Point): Point => ({ x: box.x + (p.x * box.width) / VIEWBOX, y: box.y + (p.y * box.height) / VIEWBOX });
        const name = (await heading.textContent()) ?? '';
        const jamoId = OTHER_LETTERS[name.replace(/^Trace the letter /, '').trim()];
        expect(jamoId, `a letter of the quest: ${name}`).toBeTruthy();
        for (const stroke of strokesForJamo(jamoId!)!) await trace(finger, at, stroke);
        await page.getByRole('button', { name: en.done.cta, exact: true }).click();
        await expect(heading, 'the traced letter passes and the next one is up').not.toHaveText(name, { timeout: 10_000 });
      }
      expect(await isIeung(), 'ㅇ is up').toBe(true);
      const done = (await page.getByRole('button', { name: en.done.cta, exact: true }).boundingBox())!;

      // ㅇ the other way round: it passes with the loop tip, which waits for Next.
      const box = await canvasBox(page, STROKE_CANVAS);
      const at = (p: Point): Point => ({ x: box.x + (p.x * box.width) / VIEWBOX, y: box.y + (p.y * box.height) / VIEWBOX });
      await trace(finger, at, [...strokesForJamo('jamo:ieung')![0]!].reverse());
      const next = page.getByRole('button', { name: en.next.cta, exact: true });
      await expect(next).toBeVisible({ timeout: TRACE_IDLE_MS + 2_000 });
      const tip = page.getByText(en.pass.loop, { exact: true });
      await expect(tip).toBeAttached();
      await expect(next).toBeFocused();

      // Next is wholly on screen (a part of a pixel may sit under the scroll edge).
      await expect.poll(() => visibleRatio(next), { message: 'Next is on screen' }).toBeGreaterThanOrEqual(0.99);
      // The canvas keeps at least its floor and the controls start below it (or beside it, on its side).
      const canvas = await canvasBox(page, STROKE_CANVAS);
      const controls = (await page.locator(CONTROLS).boundingBox())!;
      expect(canvas.height, 'the canvas keeps its floor').toBeGreaterThanOrEqual(CANVAS_FLOOR);
      if (vp.width < vp.height) expect(canvas.y + canvas.height, 'the controls do not cover the canvas').toBeLessThanOrEqual(controls.y + 1);
      // The scroll edge leaves room for Next's focus ring (it would clip a ring drawn outside the button).
      const nextBox = (await next.boundingBox())!;
      expect(nextBox.x - controls.x, 'room for the ring at the left').toBeGreaterThanOrEqual(3);
      expect(controls.y + controls.height - (nextBox.y + nextBox.height), 'room for the ring below').toBeGreaterThanOrEqual(3);
      if (vp.wholeTip) await expect.poll(() => visibleRatio(tip), { message: 'the whole tip is on screen' }).toBeGreaterThanOrEqual(0.99);
      if (vp.fits) {
        // Nothing needed to scroll: Next is exactly where Done was, and Show me and Clear are still in view.
        expect(Math.abs(nextBox.y - done.y), 'Next takes Done\'s place').toBeLessThanOrEqual(1);
        await expect.poll(() => visibleRatio(page.getByRole('button', { name: en.clear.cta, exact: true })), { message: 'Clear in view' }).toBeGreaterThanOrEqual(0.99);
        await expect.poll(() => visibleRatio(page.getByRole('button', { name: en.showMe.cta, exact: true })), { message: 'Show me in view' }).toBeGreaterThanOrEqual(0.99);
      }

      await info.attach(`ti-3b-next-${vp.width}x${vp.height}${vp.largest ? '-largest' : ''}.png`, { body: await page.screenshot(), contentType: 'image/png' });

      // Next moves on.
      await next.click();
      await expect(next).toBeHidden();
    });
  });
}
