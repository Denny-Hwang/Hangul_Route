import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNativeRects, pressIsRepeatClick, pressIsTouch, stampedClock, watchPagePointers, supportsPinchZoom, tapNow, webHitAt, webRect } from '../host';

/**
 * How a board reads each platform (docs/specs/AMENDMENTS-TOUCH.md section 3.2 rules 1 and 2): the web walks the DOM from
 * the touched element to the board (any control other than a target met first is never claimed) and
 * reads page rectangles; native reads window rectangles from a cache, refreshed on demand.
 */

interface FakeEl {
  tagName: string;
  role?: string;
  parentElement: FakeEl | null;
  getAttribute(name: string): string | null;
}

function el(tagName: string, parentElement: FakeEl | null, role?: string): FakeEl {
  return { tagName, role, parentElement, getAttribute: (name) => (name === 'role' ? role ?? null : null) };
}

describe('webHitAt', () => {
  const board = el('DIV', null);
  const row = el('DIV', board);
  const target = el('DIV', row, 'button');
  const label = el('DIV', target);
  const speaker = el('DIV', row, 'button');
  const icon = el('SPAN', speaker);
  const link = el('A', row);
  const nodes = new Map<unknown, string>([[target, 'A']]);

  it('a touch on a target or anything inside it is left to the rectangles (the browser may have moved it there)', () => {
    expect(webHitAt(target, nodes, board)).toBeUndefined();
    expect(webHitAt(label, nodes, board)).toBeUndefined();
  });

  it('a touch on another control (by role or by tag) is a control', () => {
    expect(webHitAt(icon, nodes, board)).toEqual({ kind: 'control' });
    expect(webHitAt(link, nodes, board)).toEqual({ kind: 'control' });
    expect(webHitAt(el('input', row), nodes, board)).toEqual({ kind: 'control' });
  });

  it('a touch on plain layout leaves it to the rectangles', () => {
    expect(webHitAt(row, nodes, board)).toBeUndefined();
    expect(webHitAt(board, nodes, board)).toBeUndefined();
    expect(webHitAt(null, nodes, board)).toBeUndefined();
    expect(webHitAt(el('DIV', null), nodes, board)).toBeUndefined();
  });
});

describe('webRect', () => {
  it('turns the client rectangle into page pixels', () => {
    const node = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 96, height: 64 }) };
    expect(webRect(node, { x: 0, y: 300 })).toEqual({ x: 10, y: 320, width: 96, height: 64 });
  });

  it('a node with no rectangle reads as none', () => {
    expect(webRect({}, { x: 0, y: 0 })).toBeNull();
    expect(webRect(null, { x: 0, y: 0 })).toBeNull();
  });
});

describe('createNativeRects', () => {
  it('reads a synchronous answer at once (the new architecture) and keeps it', () => {
    const rects = createNativeRects();
    let calls = 0;
    const node = {
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
        calls += 1;
        cb(1, 2, 3, 4);
      },
    };
    expect(rects.read(node, 'A')).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(rects.read(node, 'A')).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(calls).toBe(1);
  });

  it('a later answer (the old architecture) fills the cache for the next touch; remeasure refreshes a stale one', () => {
    const rects = createNativeRects();
    const pending: Array<() => void> = [];
    let y = 500;
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => pending.push(() => cb(0, y, 96, 96)) };
    expect(rects.read(node, 'A')).toBeNull();
    pending.shift()!();
    expect(rects.read(node, 'A')).toEqual({ x: 0, y: 500, width: 96, height: 96 });
    // The screen scrolled 120: the cache is stale until the remeasure answers.
    y = 380;
    rects.remeasure(node, 'A');
    expect(rects.read(node, 'A')!.y).toBe(500);
    pending.shift()!();
    expect(rects.read(node, 'A')!.y).toBe(380);
  });

  it('a node that cannot measure reads as none', () => {
    const rects = createNativeRects();
    expect(rects.read({}, 'A')).toBeNull();
    rects.remeasure(null, 'A');
    expect(rects.read(null, 'A')).toBeNull();
  });
});

describe('tapNow and supportsPinchZoom', () => {
  it('the web clock is performance.now(); without a document, the wall clock', () => {
    const g = globalThis as { document?: unknown };
    const had = 'document' in g;
    g.document = {};
    const perf = performance.now();
    expect(Math.abs(tapNow() - perf)).toBeLessThan(1000);
    delete g.document;
    expect(Math.abs(tapNow() - Date.now())).toBeLessThan(1000);
    if (had) g.document = {};
  });

  it('reads CSS.supports for touch-action: pinch-zoom', () => {
    const g = globalThis as { CSS?: unknown };
    g.CSS = { supports: (p: string, v: string) => p === 'touch-action' && v === 'pinch-zoom' };
    expect(supportsPinchZoom()).toBe(true);
    g.CSS = { supports: () => false };
    expect(supportsPinchZoom()).toBe(false);
    delete g.CSS;
    expect(supportsPinchZoom()).toBe(false);
  });
});

describe('stampedClock', () => {
  it('reads an event at its own stamp when it is on the clock, never later than now', () => {
    const at = stampedClock(() => 5000);
    expect(at(4200)).toBe(4200);
    expect(at(5001)).toBe(5000);
  });

  it('a missing stamp, or one on another clock, reads as now', () => {
    const at = stampedClock(() => 5000);
    expect(at(undefined)).toBe(5000);
    expect(at(Number.NaN)).toBe(5000);
    expect(at(1_793_473_374_936)).toBe(5000);
  });
});

describe('pressIsTouch (the press guard reads only a finger or a pen, KT-2)', () => {
  type Listener = (e: { pointerType?: string }) => void;
  function fakeDocument(): { listeners: Map<string, Listener>; addEventListener(type: string, fn: Listener, capture?: unknown): void } {
    const listeners = new Map<string, Listener>();
    return { listeners, addEventListener: (type, fn) => listeners.set(type, fn) };
  }
  const g = globalThis as { document?: unknown };
  afterEach(() => {
    delete g.document;
  });

  it('native (no document): every press is a finger', () => {
    expect(pressIsTouch(undefined)).toBe(true);
    expect(pressIsTouch({ nativeEvent: {} })).toBe(true);
  });

  it('web: the click\'s own pointerType decides; a keyboard click (empty type) and a mouse are not a finger', () => {
    g.document = fakeDocument();
    expect(pressIsTouch({ nativeEvent: { pointerType: 'touch' } })).toBe(true);
    expect(pressIsTouch({ nativeEvent: { pointerType: 'pen' } })).toBe(true);
    expect(pressIsTouch({ nativeEvent: { pointerType: 'mouse' } })).toBe(false);
    expect(pressIsTouch({ nativeEvent: { pointerType: '' } })).toBe(false);
  });

  it('web, a click with no pointerType (Safari): a finger when the last pointer down was a touch, within a second', () => {
    const doc = fakeDocument();
    g.document = doc;
    expect(pressIsTouch({ nativeEvent: {} })).toBe(false);
    doc.listeners.get('pointerdown')!({ pointerType: 'touch' });
    expect(pressIsTouch({ nativeEvent: {} })).toBe(true);
    expect(pressIsTouch(undefined)).toBe(true);
    doc.listeners.get('pointerdown')!({ pointerType: 'mouse' });
    expect(pressIsTouch({ nativeEvent: {} })).toBe(false);
  });

  it('web: a touch that went down more than a second before the click no longer counts', () => {
    const doc = fakeDocument();
    g.document = doc;
    let now = 10_000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    pressIsTouch(undefined);
    doc.listeners.get('pointerdown')!({ pointerType: 'pen' });
    now += 999;
    expect(pressIsTouch(undefined)).toBe(true);
    now += 2;
    expect(pressIsTouch(undefined)).toBe(false);
    clock.mockRestore();
  });

  it('web, Safari: a pointer down before the first guarded press of a session still counts once the page is watched', () => {
    const doc = fakeDocument();
    g.document = doc;
    watchPagePointers();
    doc.listeners.get('pointerdown')!({ pointerType: 'touch' });
    expect(pressIsTouch({ nativeEvent: {} })).toBe(true);
  });

  it('a mouse double click: only its second click is a repeat; keyboard (detail 0) and native never are', () => {
    g.document = fakeDocument();
    expect(pressIsRepeatClick({ nativeEvent: { pointerType: 'mouse', detail: 1 } })).toBe(false);
    expect(pressIsRepeatClick({ nativeEvent: { pointerType: 'mouse', detail: 2 } })).toBe(true);
    expect(pressIsRepeatClick({ nativeEvent: { detail: 3 } })).toBe(true);
    expect(pressIsRepeatClick({ nativeEvent: { pointerType: '', detail: 0 } })).toBe(false);
    expect(pressIsRepeatClick(undefined)).toBe(false);
    delete g.document;
    expect(pressIsRepeatClick({ nativeEvent: { detail: 2 } })).toBe(false);
  });
});
