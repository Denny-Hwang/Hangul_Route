import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, openLettersEpisode, passDiscover, seedStored } from './helpers';
import { Finger, VIEWBOX, canvasBox, lastInk, type Point } from './trace-fingers';
import { strokesForJamo } from '../../src/content/jamo-strokes';

/**
 * NB-3 on the single-letter Trace screen, the main place a learner draws ㅇ: the ㅇ guide is drawn
 * from a true circle (64 chords, no octagon), and a quick loop of ink is smoothed (quadratic curves,
 * closed with Z). On the release build at 320 px, a phone on its side, a tablet, and 320 px at the
 * Largest text size (150%), with a screenshot of each attached to the report. Trace a Word's ㅎ ring is
 * in `trace-word-round-loop.spec.ts`.
 *
 * Meet the Letters quest 2 traces ㅁ then ㅇ: the test traces ㅁ along its guide to reach ㅇ.
 */

const STROKE_CANVAS = '#trace-canvas';
/** jamo-strokes LOOP_SEGMENTS. */
const LOOP_SEGMENTS = 64;

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

/** Chords (L or Q) in each path of the canvas. */
const chordsPerPath = (page: Page): Promise<number[]> =>
  page.locator(`${STROKE_CANVAS} path`).evaluateAll((els) => els.map((el) => (el.getAttribute('d') ?? '').match(/[LQ]/g)?.length ?? 0));

for (const vp of [
  { name: 'phone 320', width: 320, height: 640, largest: false },
  { name: 'phone on its side', width: 740, height: 360, largest: false },
  { name: 'tablet 820', width: 820, height: 1180, largest: false },
  { name: 'phone 320, Largest text', width: 320, height: 720, largest: true },
]) {
  test.describe(`Round ㅇ on Trace, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('the ㅇ guide is drawn round, and a quick loop of ink has no corners', async ({ page }, info) => {
      await openTraceStroke(page, vp.largest);
      const box = await canvasBox(page, STROKE_CANVAS);
      const at = (p: Point): Point => ({ x: box.x + (p.x * box.width) / VIEWBOX, y: box.y + (p.y * box.height) / VIEWBOX });
      const finger = await Finger.on(page);

      // ㅁ first: trace its one stroke along the guide, then Done; the next letter is ㅇ.
      const mieum = strokesForJamo('jamo:mieum')![0]!;
      await finger.down([at(mieum[0]!)]);
      for (let i = 1; i < mieum.length; i++) {
        const [a, b] = [mieum[i - 1]!, mieum[i]!];
        for (let k = 1; k <= 10; k++) await finger.move([at({ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 })]);
      }
      await finger.up();
      await page.getByRole('button', { name: 'Done', exact: true }).click();

      await expect
        .poll(async () => (await chordsPerPath(page)).filter((n) => n >= LOOP_SEGMENTS).length, { timeout: 10_000, message: 'the ㅇ guide is drawn round' })
        .toBe(1);
      const before = (await chordsPerPath(page)).length;

      // A quick loop round ㅇ: only 12 finger samples, the way a fast finger reports them.
      const ieung = strokesForJamo('jamo:ieung')![0]!;
      const xs = ieung.map((p) => p.x);
      const ys = ieung.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = (Math.max(...xs) - Math.min(...xs)) / 2;
      const samples = Array.from({ length: 13 }, (_, i) => {
        const t = (2 * Math.PI * i) / 12;
        return at({ x: cx - r * Math.sin(t), y: cy - r * Math.cos(t) });
      });
      await finger.down([samples[0]!]);
      for (const p of samples.slice(1)) await finger.move([p]);
      await finger.up();

      await expect.poll(async () => (await chordsPerPath(page)).length, { message: 'the loop draws' }).toBe(before + 1);
      const d = (await page.locator(`${STROKE_CANVAS} path`).last().getAttribute('d')) ?? '';
      expect(d, 'the ink is smoothed and closes').toMatch(/ Q .* Z$/);
      const ink = await lastInk(page, STROKE_CANVAS);
      expect(ink.length).toBeGreaterThanOrEqual(10);
      const centre = at({ x: cx, y: cy });
      const radius = { x: (r * box.width) / VIEWBOX, y: (r * box.height) / VIEWBOX };
      for (const q of ink.slice(1)) {
        expect(Math.abs(Math.hypot((q.x - centre.x) / radius.x, (q.y - centre.y) / radius.y) - 1)).toBeLessThan(0.05);
      }

      await info.attach(`nb-3-round-ieung-${vp.width}x${vp.height}${vp.largest ? '-largest' : ''}.png`, {
        body: await page.locator(STROKE_CANVAS).screenshot(),
        contentType: 'image/png',
      });
    });
  });
}
