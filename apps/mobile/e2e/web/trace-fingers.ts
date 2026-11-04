import type { CDPSession, Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Fingers on a trace canvas for the AMENDMENTS-TOUCH KT-8 e2e (`trace-touch`, `trace-word-touch`): real
 * touches through CDP `Input.dispatchTouchEvent` (the Pixel 5 profile has `hasTouch`), and the canvas's
 * ink read back from its SVG paths.
 */

/** The trace canvases' SVG viewBox. */
export const VIEWBOX = 200;

export interface Point {
  x: number;
  y: number;
}

export interface TouchPoint extends Point {
  id: number;
}

/**
 * Fingers on the screen, through the browser's touch input. Each event lists every finger still down
 * (by id); a finger left out of a move is lifted (CDP `Input.dispatchTouchEvent`).
 */
export class Finger {
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

export async function canvasBox(page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  return box!;
}

/** Every path drawn in the live canvas (ghost and ink); a stroke adds one. */
export const paths = (page: Page, selector: string): Promise<number> => page.locator(`${selector} path`).count();

/**
 * The finger's samples in the newest ink (the last path in the live canvas), in screen pixels. The ink
 * is smoothed (NB-3): a sample is an M or L end, or a Q's control point.
 */
export async function lastInk(page: Page, selector: string): Promise<Point[]> {
  const box = await canvasBox(page, selector);
  const d = (await page.locator(`${selector} path`).last().getAttribute('d')) ?? '';
  return (d.match(/[MLQ][^MLQ]*/g) ?? [])
    .map((part) => {
      const [x, y] = part.slice(1).trim().split(/[\s,]+/).map(Number);
      return { x: box.x + (x! * box.width) / VIEWBOX, y: box.y + (y! * box.height) / VIEWBOX };
    });
}

/** Every ink point lies on the finger's horizontal line, from where it landed to where it lifted. */
export async function expectFingerLine(page: Page, selector: string, from: Point, toX: number): Promise<void> {
  const points = await lastInk(page, selector);
  expect(points.length, 'ink points').toBeGreaterThan(2);
  expect(points[0]!.x, 'the stroke starts where the finger landed').toBeCloseTo(from.x, 0);
  expect(points[points.length - 1]!.x, 'the stroke ends where the finger lifted').toBeCloseTo(toX, 0);
  for (const p of points) expect(Math.abs(p.y - from.y), 'no point from the palm').toBeLessThan(1);
}
