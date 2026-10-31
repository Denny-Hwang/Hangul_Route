import { describe, expect, it } from 'vitest';
import { createNativeRects, webHitAt, webRect } from '../host';

/**
 * How a board reads each platform (docs/specs/AMENDMENTS-TOUCH.md section 3.2 rules 1 and 2): the web walks the DOM from
 * the touched element to the board (a target's node is that target; any other control met first is never claimed) and
 * reads page rectangles; native reads window rectangles, keeping the last answer for the old architecture.
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

  it('a touch on a target or anything inside it is that target', () => {
    expect(webHitAt(target, nodes, board)).toEqual({ kind: 'target', id: 'A' });
    expect(webHitAt(label, nodes, board)).toEqual({ kind: 'target', id: 'A' });
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
  it('uses an answer that comes at once (the new architecture)', () => {
    const read = createNativeRects(() => 0);
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(1, 2, 3, 4) };
    expect(read(node, 'A')).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('an answer that comes later is kept and moved by the scroll since (the old architecture)', () => {
    let scrollY = 0;
    const pending: Array<() => void> = [];
    const read = createNativeRects(() => scrollY);
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => pending.push(() => cb(0, 500, 96, 96)) };
    expect(read(node, 'A')).toBeNull();
    pending.shift()!();
    scrollY = 120;
    expect(read(node, 'A')).toEqual({ x: 0, y: 380, width: 96, height: 96 });
  });

  it('a node that cannot measure reads as none until it has an answer', () => {
    expect(createNativeRects(() => 0)({}, 'A')).toBeNull();
  });
});
