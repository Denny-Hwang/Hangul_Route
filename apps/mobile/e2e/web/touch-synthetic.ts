import type { Page } from '@playwright/test';
import type { Finger, TouchPoint } from './touch';

/**
 * The same finger API as `Touchscreen` (touch.ts), for engines the DevTools protocol does not drive (WebKit): each call
 * dispatches a `TouchEvent` in the page, with the touch list a real one carries (every finger down on a start or move,
 * the fingers left on an end, the one that changed in `changedTouches`, the target fixed at the first touch point as a
 * real touch's is). These are untrusted events: they reach the page's listeners the way a finger's do, so they show the
 * engine runs our code the same (the board's rules, its hit tests, its timestamps), but they do not go through the
 * engine's own touch handling (scroll and zoom arbitration, `touch-action`, the click a tap sends). What those do is an
 * owner check on a real phone (docs/specs/AMENDMENTS-TOUCH.md section 10).
 */

type SyntheticWindow = Window & { __hrTouches?: Map<number, { target: Element; x: number; y: number }> };

export class SyntheticTouchscreen {
  constructor(private readonly page: Page) {}

  private dispatch(type: 'touchstart' | 'touchmove' | 'touchend', finger: Finger): Promise<void> {
    return this.page.evaluate(
      ({ type, id, x, y }) => {
        const w = window as SyntheticWindow;
        const touches = (w.__hrTouches ??= new Map());
        const old = touches.get(id);
        const target = old?.target ?? document.elementFromPoint(x, y) ?? document.body;
        touches.set(id, { target, x, y });
        type Rec = { target: Element; x: number; y: number };
        const legacy = document as Document & {
          createTouch?: (view: Window, target: EventTarget, id: number, pageX: number, pageY: number, screenX: number, screenY: number) => Touch;
          createTouchList?: (...touches: Touch[]) => TouchList;
        };
        // WebKit has no Touch constructor (an "illegal constructor"); its `createTouch` and `createTouchList` do the same.
        let modern = true;
        try {
          new Touch({ identifier: 0, target: document.body });
        } catch {
          modern = false;
        }
        const make = (touchId: number, t: Rec): Touch =>
          modern
            ? new Touch({ identifier: touchId, target: t.target, clientX: t.x, clientY: t.y, pageX: t.x + window.scrollX, pageY: t.y + window.scrollY, screenX: t.x, screenY: t.y })
            : legacy.createTouch!(window, t.target, touchId, t.x + window.scrollX, t.y + window.scrollY, t.x, t.y);
        const changed = make(id, touches.get(id)!);
        if (type === 'touchend') touches.delete(id);
        const live = [...touches.entries()].map(([touchId, t]) => make(touchId, t));
        // WebKit takes TouchList objects (from `createTouchList`) where the other engines take arrays.
        const list = (touchList: Touch[]): Touch[] | TouchList => (modern ? touchList : legacy.createTouchList!(...touchList));
        target.dispatchEvent(
          new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: list(live) as Touch[], targetTouches: list(live) as Touch[], changedTouches: list([changed]) as Touch[] }),
        );
      },
      { type, id: finger.id, x: finger.x, y: finger.y },
    );
  }

  start(finger: Finger): Promise<void> {
    return this.dispatch('touchstart', finger);
  }

  move(finger: Finger): Promise<void> {
    return this.dispatch('touchmove', finger);
  }

  /** Lifts one finger where it last was. */
  async end(id: number): Promise<void> {
    const at = await this.page.evaluate((i) => {
      const t = (window as SyntheticWindow).__hrTouches?.get(i);
      return t === undefined ? null : { x: t.x, y: t.y };
    }, id);
    if (at !== null) await this.dispatch('touchend', { id, ...at });
  }

  /** One finger: down at `from`, slide by (dx, dy) in `steps` moves of `stepMs`, hold `holdMs`, lift. */
  async graze(from: TouchPoint, dx: number, dy: number, options: { steps?: number; stepMs?: number; holdMs?: number } = {}): Promise<void> {
    const { steps = 4, stepMs = 16, holdMs = 0 } = options;
    await this.start({ id: 1, ...from });
    for (let i = 1; i <= steps && (dx !== 0 || dy !== 0); i += 1) {
      await this.page.waitForTimeout(stepMs);
      await this.move({ id: 1, x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps });
    }
    if (holdMs > 0) await this.page.waitForTimeout(holdMs);
    await this.end(1);
  }

  /** A clean tap of `holdMs` at a point. */
  tap(at: TouchPoint, holdMs = 40): Promise<void> {
    return this.graze(at, 0, 0, { holdMs });
  }
}
