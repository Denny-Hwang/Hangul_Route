import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, openLettersEpisode, passDiscover } from './helpers';
import { expectReachable } from './viewport';

/**
 * AMENDMENTS-TOUCH KT-8 (6.8, KT-D9, R1): a trace stroke starts after 4 px (`spacing.xs`) instead of the
 * gesture handler's 15 px and follows one finger by pointer id (a resting palm or a second touch adds
 * nothing and cancels nothing), and a touch that never travelled 4 px leaves no ink and re-arms the
 * idle check. Real touches through CDP `Input.dispatchTouchEvent` (the Pixel 5 profile has
 * `hasTouch`), at 320 px and on a tablet.
 *
 * Trace a Word opens through the fixture hook (`window.__hrTraceWordE2E`, fixture bundle only):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test trace-touch
 *
 * Trace (one letter) is reached through Meet the Letters, quest 2, as in `layout.spec.ts`.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const VIEWBOX = 200;

interface Point {
  x: number;
  y: number;
}
type E2eWindow = Window & {
  __hrTraceWordE2E?: {
    open(params: { rounds: Array<{ id: string; word: { ko: string; romanization: string; en: string } }> }): void;
    blocks(word: string): Array<{ syllable: string; letters: Point[][][] }> | null;
    log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
  };
};

const HOYA = { id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } };
const IDLE = 'Write each block. Start with the first letter.';

interface TouchPoint extends Point {
  id: number;
}

/**
 * Fingers on the screen, through the browser's touch input. Each event lists every finger still down
 * (by id); a finger left out of a move is lifted (CDP `Input.dispatchTouchEvent`).
 */
class Finger {
  private constructor(private readonly cdp: CDPSession) {}

  static async on(page: Page): Promise<Finger> {
    return new Finger(await page.context().newCDPSession(page));
  }

  async down(points: Array<Point | TouchPoint>): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points.map((p, i) => ({ id: i, ...p })) });
  }

  async move(points: Array<Point | TouchPoint>): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map((p, i) => ({ id: i, ...p })) });
  }

  async up(): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** Down at `from`, through `steps` moves to `to`, up. */
  async drag(from: Point, to: Point, steps = 8): Promise<void> {
    await this.down([from]);
    for (let i = 1; i <= steps; i += 1) {
      await this.move([{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
    }
    await this.up();
  }

  /** A tap that never travels. */
  async dot(at: Point): Promise<void> {
    await this.down([at]);
    await this.up();
  }
}

async function canvasBox(page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  return box!;
}

/** Every path drawn in the live canvas (ghost and ink); a stroke adds one. */
const paths = (page: Page, selector: string): Promise<number> => page.locator(`${selector} path`).count();

/** The points of the newest ink (the last path in the live canvas), in screen pixels. */
async function lastInk(page: Page, selector: string): Promise<Point[]> {
  const box = await canvasBox(page, selector);
  const d = (await page.locator(`${selector} path`).last().getAttribute('d')) ?? '';
  return d
    .split(/[ML]/)
    .filter((part) => part.trim() !== '')
    .map((part) => {
      const [x, y] = part.trim().split(/\s+/).map(Number);
      return { x: box.x + (x! * box.width) / VIEWBOX, y: box.y + (y! * box.height) / VIEWBOX };
    });
}

/** Every ink point lies on the finger's horizontal line, from where it landed to where it lifted. */
async function expectFingerLine(page: Page, selector: string, from: Point, toX: number): Promise<void> {
  const points = await lastInk(page, selector);
  expect(points.length, 'ink points').toBeGreaterThan(2);
  expect(points[0]!.x, 'the stroke starts where the finger landed').toBeCloseTo(from.x, 0);
  expect(points[points.length - 1]!.x, 'the stroke ends where the finger lifted').toBeCloseTo(toX, 0);
  for (const p of points) expect(Math.abs(p.y - from.y), 'no point from the palm').toBeLessThan(1);
}

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

const STROKE_CANVAS = '#trace-canvas';

async function openTraceStroke(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  const start = page.getByRole('button', { name: "Let's start" });
  await expectReachable(page, start);
  await start.click();
  await completeChildForm(page, { name: 'Tia' });
  await page.goto('/');
  await expect(page.getByText('Hi, Tia!')).toBeVisible();
  // Journey → Meet the Letters → quest 2 → skip to its Trace game (as layout.spec.ts).
  await openLettersEpisode(page);
  await page.getByRole('button', { name: 'Start' }).nth(1).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByText('Trace Each Letter')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText(/^Trace the letter /)).toBeVisible();
}

for (const vp of [
  { name: 'phone 320', width: 320, height: 640 },
  { name: 'tablet 820', width: 820, height: 1180 },
]) {
  test.describe(`Trace touch, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('a dot leaves no ink, a 6 px stroke draws, and a dot after a stroke still lets the idle check score it', async ({ page }) => {
      await openTraceStroke(page);
      const finger = await Finger.on(page);
      const box = await canvasBox(page, STROKE_CANVAS);
      const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const ghosts = await paths(page, STROKE_CANVAS);
      const border = (): Promise<string> => page.locator(STROKE_CANVAS).evaluate((el) => getComputedStyle(el).borderTopColor);
      const live = await border();

      await finger.dot(mid);
      await page.waitForTimeout(100);
      expect(await paths(page, STROKE_CANVAS), 'a dot leaves no ink').toBe(ghosts);
      await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();

      await finger.drag({ x: box.x + box.width * 0.2, y: mid.y }, { x: box.x + box.width * 0.2 + 6, y: mid.y + 6 }, 3);
      await expect.poll(() => paths(page, STROKE_CANVAS), { message: 'a 6 px stroke draws' }).toBe(ghosts + 1);

      // A stray tap right after: no ink, and the drawing is still scored without Done.
      await finger.dot({ x: box.x + box.width * 0.8, y: box.y + box.height * 0.8 });
      await page.waitForTimeout(100);
      expect(await paths(page, STROKE_CANVAS)).toBe(ghosts + 1);
      await expect.poll(border, { timeout: 5_000, message: 'the idle check scored the drawing' }).not.toBe(live);
    });
  });
}
