import type { TapHit, TapRect } from '../../tap-model';

/**
 * How a board reads the screen on each platform (docs/specs/AMENDMENTS-TOUCH.md section 3.2 rule 1): the targets'
 * rectangles in the space of the touches' `pageX` and `pageY`, and, on the web, what the DOM has under the finger. Kept
 * apart from `TapBoard.tsx` so each piece is tested on plain objects.
 */

/** Roles and tags of a control a board must never claim, even within the gap reach (rule 2). */
const CONTROL_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'slider', 'textbox', 'combobox', 'spinbutton']);
const CONTROL_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

interface DomLike {
  parentElement?: DomLike | null;
  tagName?: string;
  getAttribute?: (name: string) => string | null;
}

function isControl(el: DomLike): boolean {
  if (el.tagName !== undefined && CONTROL_TAGS.has(el.tagName.toUpperCase())) return true;
  const role = el.getAttribute?.('role');
  return role !== null && role !== undefined && CONTROL_ROLES.has(role);
}

/**
 * The web hit test, for rule 2 only: walk up from the touched element to the board. Another control met first (a
 * speaker or a hint button inside the board, or inside a card) is a control, never claimed. A target's own node, or
 * plain layout, leaves the touch to the rectangles: the browser may already have moved a touch in a gap onto a nearby
 * element (its own touch adjustment), and rule 1 decides by the rectangles, not by that guess.
 */
export function webHitAt(eventTarget: unknown, nodes: ReadonlyMap<unknown, string>, board: unknown): TapHit | undefined {
  let el = (eventTarget ?? null) as DomLike | null;
  while (el !== null && el !== board) {
    if (nodes.has(el)) return undefined;
    if (isControl(el)) return { kind: 'control' };
    el = el.parentElement ?? null;
  }
  return undefined;
}

interface ClientRectNode {
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
}

/** The web rectangle in page pixels (react-native-web's touches carry `pageX` and `pageY`). */
export function webRect(node: unknown, scroll: { x: number; y: number }): TapRect | null {
  const read = (node as ClientRectNode | null)?.getBoundingClientRect;
  if (typeof read !== 'function') return null;
  const r = read.call(node);
  return { x: r.left + scroll.x, y: r.top + scroll.y, width: r.width, height: r.height };
}

interface MeasurableNode {
  measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
}

/**
 * The native rectangle in window points. `measureInWindow` answers at once on the new architecture and later on the
 * old one, so each answer is kept with the screen's scroll offset at that moment, and a touch that comes before the
 * next answer reads the kept rectangle moved by how far the screen has scrolled since.
 */
export function createNativeRects(scrollY: () => number): (node: unknown, id: string) => TapRect | null {
  const kept = new Map<string, { rect: TapRect; scrollY: number }>();
  return (node, id) => {
    const measure = (node as MeasurableNode | null)?.measureInWindow;
    let fresh: TapRect | null = null;
    if (typeof measure === 'function') {
      measure.call(node, (x, y, width, height) => {
        const rect = { x, y, width, height };
        kept.set(id, { rect, scrollY: scrollY() });
        fresh = rect;
      });
    }
    if (fresh !== null) return fresh;
    const last = kept.get(id);
    if (last === undefined) return null;
    return { ...last.rect, y: last.rect.y - (scrollY() - last.scrollY) };
  };
}

/** An event time stamp further than this from now is on another clock (or junk): use now instead. */
const SAME_CLOCK_MS = 60_000;

/**
 * The web reads an event's time from its `timeStamp` (the clock of `performance.now()`), so the time between a release
 * and the browser's click is the time between the two inputs, not between two busy moments of the page that handled
 * them. A stamp that is missing, or not on that clock, reads as now.
 */
export function stampedClock(now: () => number): (stamp: unknown) => number {
  return (stamp) => {
    const at = now();
    return typeof stamp === 'number' && Number.isFinite(stamp) && Math.abs(at - stamp) < SAME_CLOCK_MS ? Math.min(stamp, at) : at;
  };
}
