import type { CDPSession, Page } from '@playwright/test';

/**
 * Real touches for the web e2e (docs/specs/AMENDMENTS-TOUCH.md section 11.2), through the DevTools protocol's
 * `Input.dispatchTouchEvent`: unlike Playwright's `tap()` (a touch with no movement), a finger here can go down, slide,
 * hold and lift, and two fingers can overlap, as a child's do. Points are CSS pixels in the viewport (the coordinates
 * of `boundingBox()`). Each event lists every finger still on the screen, as the protocol asks.
 */

export interface TouchPoint {
  x: number;
  y: number;
}

export interface Finger extends TouchPoint {
  id: number;
}

export class Touchscreen {
  private readonly down = new Map<number, TouchPoint>();

  private constructor(
    private readonly page: Page,
    private readonly cdp: CDPSession,
  ) {}

  static async of(page: Page): Promise<Touchscreen> {
    return new Touchscreen(page, await page.context().newCDPSession(page));
  }

  private points(): Array<{ x: number; y: number; id: number }> {
    return [...this.down.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
  }

  async start(finger: Finger): Promise<void> {
    this.down.set(finger.id, { x: finger.x, y: finger.y });
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.points() });
  }

  async move(finger: Finger): Promise<void> {
    this.down.set(finger.id, { x: finger.x, y: finger.y });
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.points() });
  }

  async end(id: number): Promise<void> {
    this.down.delete(id);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.points() });
  }

  /** One finger: down at `from`, slide by (dx, dy) in `steps` moves of `stepMs`, hold `holdMs`, lift. */
  async graze(from: TouchPoint, dx: number, dy: number, options: { steps?: number; stepMs?: number; holdMs?: number } = {}): Promise<void> {
    const { steps = 4, stepMs = 16, holdMs = 0 } = options;
    await this.start({ id: 1, ...from });
    for (let i = 1; i <= steps && (dx !== 0 || dy !== 0); i++) {
      await this.page.waitForTimeout(stepMs);
      await this.move({ id: 1, x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps });
    }
    if (holdMs > 0) await this.page.waitForTimeout(holdMs);
    await this.end(1);
  }

  /** A clean tap of `holdMs` at a point. */
  async tap(at: TouchPoint, holdMs = 40): Promise<void> {
    await this.graze(at, 0, 0, { holdMs });
  }
}

/** The centre of an element's box, or a point offset from its top-left corner. */
export async function pointIn(page: Page, testId: string, at?: { dx: number; dy: number }): Promise<TouchPoint> {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) throw new Error(`no box for ${testId}`);
  return at === undefined ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: box.x + at.dx, y: box.y + at.dy };
}
