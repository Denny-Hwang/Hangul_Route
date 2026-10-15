import { describe, expect, it } from 'vitest';
import { scaleMedia } from '@hangul-route/design-system/layout';
import { borderWidth, layout, spacing, typography } from '@hangul-route/design-system/tokens';
import { countMarkSlot, journeyCellLayout, journeyCellMetrics, type CountSlot } from '../journey-cell-layout';
import { journeyCellSize } from '../layout/pane-sizes';

const M = journeyCellMetrics({ spacing, borderWidth, typography });
const { band: CELL_CORNER_BAND, inset: CELL_CORNER_INSET, countMark: CELL_COUNT_MARK, edge: CELL_EDGE, markSize: CELL_MARK_SIZE } = M;
const { ring: CELL_RING, glyph: CELL_THEME_GLYPH, wordLine: CELL_WORD_LINE } = M;

/**
 * The Journey cell's geometry with the theme word (owner request 2026-10-14; design/components/Icon/
 * theme-glyphs.md "Cell word"). Every rect is in the cell's padding box (inside its border), where
 * absolute children are placed. Checked at 320 px (compact), 768 px (regular) and a wide window, where the
 * grid is always the 400 dp master pane of two (76 dp cells at the wide glyph and ring sizes), each
 * with the cell unselected (`borderWidth.base`) and selected in two panes (`borderWidth.thick`).
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** The widest count mark: "5+" at the caption size inside its padding. */
const COUNT_WIDE = CELL_COUNT_MARK + spacing.sm;
/** The Next triangle (`cursorMarkerParts`: 0.6 x 0.3 of its base), its tip `NEXT_TIP_INSET` below the cell's outer top edge. */
const NEXT_MARKER_BASE = spacing.xxl; // RouteMarkers/geometry.ts
const NEXT_TIP_INSET = borderWidth.base + spacing.xxs; // RouteMarkers NEXT_TIP_INSET, from the cell's outer top edge
const NEXT_W = NEXT_MARKER_BASE * 0.6;
const NEXT_H = NEXT_MARKER_BASE * 0.3;

/** The 320 px grid: 16 px gutters, four `spacing.xs` gaps. */
const CELL_320 = journeyCellSize(320 - 2 * spacing.lg, spacing.xs, layout.columns.journeyCellMax);

/** A wide window always shows two panes: the grid fills the 400 dp master pane (SplitPane adds no padding). */
const CELL_WIDE_MASTER = journeyCellSize(layout.pane.master, spacing.xs, layout.columns.journeyCellMax);

const SIZES = [
  { name: '320 px (compact)', width: CELL_320, scale: layout.mediaScale.compact },
  { name: '768 px (regular)', width: layout.columns.journeyCellMax, scale: layout.mediaScale.regular },
  { name: 'wide (two-pane master)', width: CELL_WIDE_MASTER, scale: layout.mediaScale.wide },
] as const;

const CASES = SIZES.flatMap((s) => [
  { ...s, edge: borderWidth.base },
  { ...s, name: `${s.name}, selected`, edge: borderWidth.thick },
]);

function cellRects(width: number, scale: number, edge: number = CELL_EDGE): Record<'glyph' | 'ring' | 'word' | 'pin' | 'check' | 'next', Rect> & { height: number; innerW: number; innerH: number } {
  const glyph = scaleMedia(CELL_THEME_GLYPH, scale);
  const ring = scaleMedia(CELL_RING, scale);
  const l = journeyCellLayout(M, glyph, ring);
  const height = Math.max(width, l.minHeight);
  const innerW = width - 2 * edge;
  const innerH = height - 2 * edge;
  // The column is centred between padTop and padBottom.
  const stack = l.glyphBox + CELL_WORD_LINE;
  const top = l.padTop + (innerH - l.padTop - l.padBottom - stack) / 2;
  const box: Rect = { x: (innerW - l.glyphBox) / 2, y: top, w: l.glyphBox, h: l.glyphBox };
  return {
    height,
    innerW,
    innerH,
    glyph: { x: (innerW - glyph) / 2, y: top + (l.glyphBox - glyph) / 2, w: glyph, h: glyph },
    ring: { ...box, w: ring, h: ring, x: (innerW - ring) / 2, y: top + (l.glyphBox - ring) / 2 },
    word: { x: 0, y: top + l.glyphBox, w: innerW, h: CELL_WORD_LINE },
    pin: { x: CELL_CORNER_INSET, y: CELL_CORNER_INSET, w: CELL_MARK_SIZE, h: CELL_MARK_SIZE },
    check: { x: innerW - CELL_CORNER_INSET - CELL_MARK_SIZE, y: CELL_CORNER_INSET, w: CELL_MARK_SIZE, h: CELL_MARK_SIZE },
    next: { x: (innerW - NEXT_W) / 2, y: NEXT_TIP_INSET - edge - NEXT_H, w: NEXT_W, h: NEXT_H },
  };
}

function countRect(slot: CountSlot, innerW: number): Rect {
  const x = 'right' in slot ? innerW - slot.right - COUNT_WIDE : slot.left;
  return { x, y: slot.top, w: COUNT_WIDE, h: CELL_COUNT_MARK };
}

describe('journeyCellLayout', () => {
  it('the 320 px cell is about 54 dp wide', () => {
    expect(CELL_320).toBe(54);
  });

  it.each(CASES)('$name: the glyph starts under the corner band and the word fits under the glyph box', ({ width, scale, edge }) => {
    const r = cellRects(width, scale, edge);
    expect(r.glyph.y).toBeGreaterThanOrEqual(CELL_CORNER_BAND);
    expect(r.word.y + r.word.h).toBeLessThanOrEqual(r.innerH);
    expect(r.word.y).toBeGreaterThanOrEqual(r.glyph.y + r.glyph.h);
  });

  it.each(CASES)('$name: no corner mark covers the glyph (the start pin clears the leaf tip)', ({ width, scale, edge }) => {
    const r = cellRects(width, scale, edge);
    expect(overlap(r.pin, r.glyph)).toBe(0);
    expect(overlap(r.check, r.glyph)).toBe(0);
    for (const marks of [
      { placedOut: false, isStart: false },
      { placedOut: false, isStart: true },
      { placedOut: true, isStart: false },
      { placedOut: true, isStart: true },
    ]) {
      const slot = countMarkSlot(M, marks);
      if (slot === null) continue;
      const count = countRect(slot, r.innerW);
      expect(overlap(count, r.glyph), JSON.stringify(marks)).toBe(0);
      expect(overlap(count, r.word), JSON.stringify(marks)).toBe(0);
      if (marks.isStart) expect(overlap(count, r.pin), JSON.stringify(marks)).toBe(0);
      if (marks.placedOut) expect(overlap(count, r.check), JSON.stringify(marks)).toBe(0);
    }
  });

  it.each(CASES)('$name: the corner marks and the Next triangle stay clear of the word', ({ width, scale, edge }) => {
    const r = cellRects(width, scale, edge);
    expect(overlap(r.pin, r.word)).toBe(0);
    expect(overlap(r.check, r.word)).toBe(0);
    expect(overlap(r.next, r.word)).toBe(0);
    expect(overlap(r.next, r.glyph)).toBe(0);
  });

  it.each(CASES)('$name: the ring goes round the glyph and ends above the word', ({ width, scale, edge }) => {
    const r = cellRects(width, scale, edge);
    expect(r.ring.x).toBeLessThanOrEqual(r.glyph.x);
    expect(r.ring.y).toBeLessThanOrEqual(r.glyph.y);
    expect(r.ring.x + r.ring.w).toBeGreaterThanOrEqual(r.glyph.x + r.glyph.w);
    expect(r.ring.y + r.ring.h).toBeLessThanOrEqual(r.word.y);
    expect(r.ring.x).toBeGreaterThanOrEqual(0);
    expect(r.ring.x + r.ring.w).toBeLessThanOrEqual(r.innerW);
  });

  it('is square on a portrait tablet (768 px) and taller than wide at 320 px and in the wide master pane', () => {
    expect(CELL_WIDE_MASTER).toBe(76);
    expect(cellRects(CELL_320, layout.mediaScale.compact).height).toBeGreaterThan(CELL_320);
    expect(cellRects(CELL_320, layout.mediaScale.compact).height).toBeLessThan(CELL_320 * 1.5);
    expect(cellRects(layout.columns.journeyCellMax, layout.mediaScale.regular).height).toBe(layout.columns.journeyCellMax);
    expect(cellRects(CELL_WIDE_MASTER, layout.mediaScale.wide).height).toBeGreaterThan(CELL_WIDE_MASTER);
    expect(cellRects(CELL_WIDE_MASTER, layout.mediaScale.wide).height).toBeLessThan(CELL_WIDE_MASTER * 1.3);
  });

  it('reserves the selected border in the smallest height, so selecting a cell never changes its size', () => {
    for (const { width, scale } of SIZES) {
      expect(cellRects(width, scale, borderWidth.thick).height).toBe(cellRects(width, scale, borderWidth.base).height);
    }
  });

  it('reads its sizes from the tokens: 16 dp marks, a 20 dp count mark, a 22 dp corner band, a 2 dp edge (3 when selected)', () => {
    expect(M).toMatchObject({ markSize: 16, countMark: 20, inset: 2, band: 22, glyph: 20, ring: 40, edge: 2, maxEdge: 3, bottomPad: 2 });
    expect(M.wordLine).toBeCloseTo(16.1, 5);
  });

  it('the glyph shrank to 20 dp on compact (24 regular, 28 wide); the ring keeps its 40 / 48 / 56', () => {
    expect([1, 1.2, 1.4].map((s) => scaleMedia(CELL_THEME_GLYPH, s))).toEqual([20, 24, 28]);
    expect([1, 1.2, 1.4].map((s) => scaleMedia(CELL_RING, s))).toEqual([40, 48, 56]);
  });

  it('a glyph bigger than its ring keeps the glyph box at the glyph and the pad at the band', () => {
    expect(journeyCellLayout(M, 40, 30)).toMatchObject({ glyphBox: 40, padTop: CELL_CORNER_BAND });
    expect(journeyCellLayout(M, 10, 80).padTop).toBe(0);
  });
});

describe('countMarkSlot', () => {
  it('top right, top left when the check owns top right, none when both corners are taken; never the bottom', () => {
    expect(countMarkSlot(M, { placedOut: false, isStart: false })).toEqual({ top: CELL_CORNER_INSET, right: CELL_CORNER_INSET });
    expect(countMarkSlot(M, { placedOut: false, isStart: true })).toEqual({ top: CELL_CORNER_INSET, right: CELL_CORNER_INSET });
    expect(countMarkSlot(M, { placedOut: true, isStart: false })).toEqual({ top: CELL_CORNER_INSET, left: CELL_CORNER_INSET });
    expect(countMarkSlot(M, { placedOut: true, isStart: true })).toBeNull();
  });
});
