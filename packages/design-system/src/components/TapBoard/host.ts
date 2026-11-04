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

export interface NativeRects {
  /** The cached rectangle (rule 1: the capture call is synchronous, `measureInWindow` is not on the old architecture). */
  read(node: unknown, id: string): TapRect | null;
  /** Measures again; the answer lands in the cache (at once on the new architecture, later on the old one). */
  remeasure(node: unknown, id: string): void;
}

/**
 * The native rectangles in window points: a cache each target fills on its layout, refreshed after its scroller's
 * scroll or momentum ends and after a `Screen` fit change (docs/specs/AMENDMENTS-TOUCH.md section 3.2 rule 1). A
 * target with no answer yet is measured at once and used if the answer comes synchronously.
 */
export function createNativeRects(): NativeRects {
  const kept = new Map<string, TapRect>();
  const remeasure = (node: unknown, id: string): void => {
    const measure = (node as MeasurableNode | null | undefined)?.measureInWindow;
    if (typeof measure !== 'function') return;
    measure.call(node, (x, y, width, height) => {
      kept.set(id, { x, y, width, height });
    });
  };
  return {
    read: (node, id) => {
      if (!kept.has(id)) remeasure(node, id);
      return kept.get(id) ?? null;
    },
    remeasure,
  };
}

/** The clock of every board and of the app lock: on the web `performance.now()`, the clock of DOM event stamps. */
export function tapNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  const web = (globalThis as { document?: unknown }).document !== undefined;
  return web && typeof perf?.now === 'function' ? perf.now() : Date.now();
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

/** `touch-action: pinch-zoom` is newer than `none` (older iOS Safari lacks it): assumption U1. */
export function supportsPinchZoom(): boolean {
  const css = (globalThis as { CSS?: { supports?: (property: string, value: string) => boolean } }).CSS;
  return typeof css?.supports === 'function' && css.supports('touch-action', 'pinch-zoom');
}

/** A click with no pointer type of its own counts as a finger when a touch went down this recently (ms). */
const RECENT_TOUCH_MS = 1000;

interface PointerDocument {
  addEventListener?: (type: string, listener: (event: { pointerType?: unknown }) => void, capture?: boolean) => void;
}

/** The last pointer that went down on each page, for a click that carries no `pointerType` (Safari's MouseEvent). */
const lastDown = new WeakMap<object, { finger: boolean; at: number }>();

function watchPointers(doc: object): void {
  if (lastDown.has(doc)) return;
  lastDown.set(doc, { finger: false, at: Number.NEGATIVE_INFINITY });
  (doc as PointerDocument).addEventListener?.(
    'pointerdown',
    (event) => {
      lastDown.set(doc, { finger: event.pointerType === 'touch' || event.pointerType === 'pen', at: tapNow() });
    },
    true,
  );
}

/**
 * Was this press a finger (or a pen)? The press guard (KT-2, AMENDMENTS-TOUCH section 4.4) drops a bounce, and a bounce
 * is a finger's: a mouse click, keyboard Enter or Space, and a screen reader's activate are deliberate and pass. Native:
 * every press is a finger. Web: the click's `pointerType` (an empty one is the keyboard); a click with none (Safari's
 * MouseEvent) is a finger when the last pointer down on the page, under a second ago, was a touch or a pen.
 */
export function pressIsTouch(event: unknown): boolean {
  const doc = pageDocument();
  if (doc === null) return true;
  watchPointers(doc);
  const type = (event as { nativeEvent?: { pointerType?: unknown } } | undefined)?.nativeEvent?.pointerType;
  if (typeof type === 'string') return type === 'touch' || type === 'pen';
  const last = lastDown.get(doc);
  return last !== undefined && last.finger && tapNow() - last.at < RECENT_TOUCH_MS;
}

function pageDocument(): object | null {
  const doc = (globalThis as { document?: unknown }).document;
  return doc === undefined || doc === null || typeof doc !== 'object' ? null : doc;
}

/**
 * Starts reading the page's pointer downs, so the first guarded click of a session that carries no `pointerType`
 * (Safari, the iOS 14 PWA) still knows its finger. Called when this module loads and when `TapLockProvider` mounts;
 * `pressIsTouch` calls it too, for a page whose document came later. Native: nothing to watch.
 */
export function watchPagePointers(): void {
  const doc = pageDocument();
  if (doc !== null) watchPointers(doc);
}

/**
 * A mouse's or trackpad's second click of a double click (`detail` over 1, web only). The press guard drops it, so a
 * double click on Continue or Next runs once (R8 with a mouse, a school Chromebook's trackpad). A single click, keyboard
 * Enter or Space (`detail` 0) and a screen reader's activate are never a repeat.
 */
export function pressIsRepeatClick(event: unknown): boolean {
  if (pageDocument() === null) return false;
  const detail = (event as { nativeEvent?: { detail?: unknown } } | undefined)?.nativeEvent?.detail;
  return typeof detail === 'number' && detail > 1;
}

watchPagePointers();
