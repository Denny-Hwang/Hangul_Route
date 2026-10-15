import type { borderWidth, spacing, typography } from '@hangul-route/design-system/tokens';

/**
 * Where everything sits inside one Journey cell (design/components/Icon/theme-glyphs.md "Cell word",
 * wireframe design/wireframes/journey/grid.md). Pure numbers, no React, so the overlap rules are unit
 * tested at every layout class:
 *
 * - the corner band on top holds the start pin (top left), the placed-out check (top right) and the
 *   story count mark; the theme glyph starts under it, so no corner mark covers any part of a glyph
 *   (the leaf's tip points up-left, under the start pin, so it needs this); a cell with both the pin and
 *   the check gets a second band row for the count mark, under the check (`countMarkSlot`), and JourneyGrid
 *   gives every cell in that cell's grid row the same deeper band, so the row stays one height;
 * - the glyph box is as tall as the In your plan / Not open yet ring, so the ring is drawn around the
 *   glyph and never through the word under it;
 * - the theme word sits under the glyph box on one line (`typography.size.caption`, `leading.tight`);
 * - the cell is square where that fits (a 112 dp cell, 768 px) and grows taller than wide where it does not
 *   (54 dp at 320 px; the 76 dp cells of the 400 dp master pane on a wide window, where the glyph and ring
 *   are at their wide size);
 * - the smallest height reserves the thickest border a cell draws (`borderWidth.thick`, selected in two
 *   panes), so selecting a cell never pushes the word into its border or shifts the glyph into the band.
 *
 * The sizes come from the design tokens the caller passes (`journeyCellMetrics(tokens)`), so this file
 * stays free of React Native for the unit lane.
 */

export interface CellTokens {
  spacing: typeof spacing;
  borderWidth: typeof borderWidth;
  typography: typeof typography;
}

export interface CellMetrics {
  /** The start pin and the placed-out check (`spacing.lg`). */
  markSize: number;
  /** The story count mark: a 20 dp circle (F-STORY-005 §3.6). */
  countMark: number;
  /** How far each corner mark sits from the cell's inner edge (`spacing.xxs`). */
  inset: number;
  /**
   * The corner band: the tallest corner mark and its inset. Nothing but corner marks and the Next triangle draws in
   * it (a cell with the pin and the check adds a second row for the count mark, `journeyCellLayout`).
   */
  band: number;
  /**
   * A cell's theme glyph before `useMediaSize`: 20 dp (owner request 2026-10-14 put the theme word under it,
   * so it shrank from 24 to make room); 24 on regular, 28 on wide.
   */
  glyph: number;
  /**
   * The compact In your plan / Not open yet ring (40) before scaling: the design system's `ROUTE_RING_SIZE`
   * from the same tokens (the JourneyGrid render test checks they match).
   */
  ring: number;
  /** The cell border when not selected (`borderWidth.base`). */
  edge: number;
  /** The thickest border a cell draws (`border.focus` at `borderWidth.thick` when selected in two panes). */
  maxEdge: number;
  /** One line of the theme word. */
  wordLine: number;
  /** Under the word. */
  bottomPad: number;
}

export function journeyCellMetrics(t: CellTokens): CellMetrics {
  const countMark = t.spacing.lg + t.spacing.xs;
  return {
    markSize: t.spacing.lg,
    countMark,
    inset: t.spacing.xxs,
    band: t.spacing.xxs + countMark,
    glyph: t.spacing.lg + t.spacing.xs,
    ring: t.typography.size.title + t.spacing.md,
    edge: t.borderWidth.base,
    maxEdge: Math.max(t.borderWidth.base, t.borderWidth.thick),
    wordLine: t.typography.size.caption * t.typography.leading.tight,
    bottomPad: t.spacing.xxs,
  };
}

export interface CellLayout {
  /** Padding above the glyph box: the glyph itself starts at the bottom of the corner band. */
  padTop: number;
  padBottom: number;
  /** The glyph box: square, the ring's size; the glyph is centred in it. */
  glyphBox: number;
  /**
   * The smallest cell height (its border included) that holds the band, the glyph box and one line of the word,
   * with the thickest border (`maxEdge`) on both sides, so it holds whether or not the cell is selected.
   */
  minHeight: number;
}

/** The corner marks a cell draws: a cell with both has its count mark in a second row of the band. */
export interface CellCornerMarks {
  placedOut: boolean;
  isStart: boolean;
}

const NO_MARKS: CellCornerMarks = { placedOut: false, isStart: false };

/**
 * The top of the glyph (the bottom of the band it starts under). A cell with the start pin and the placed-out
 * check keeps its count mark under the check, so its band is a row deeper: the check's row, then the count's.
 */
function bandBottom(m: CellMetrics, marks: CellCornerMarks): number {
  return marks.placedOut && marks.isStart ? 3 * m.inset + m.markSize + m.countMark : m.band;
}

/**
 * The layout for a glyph of `glyph` dp inside a ring of `ring` dp (both after `useMediaSize`). Only a cell that
 * draws both corner marks (`marks`) grows, by the count mark's row; JourneyGrid passes those marks for every
 * cell in such a cell's row, so the whole row grows together and every other row keeps the same height.
 */
export function journeyCellLayout(m: CellMetrics, glyph: number, ring: number, marks: CellCornerMarks = NO_MARKS): CellLayout {
  const glyphBox = Math.max(glyph, ring);
  const padTop = Math.max(0, bandBottom(m, marks) - (glyphBox - glyph) / 2);
  const padBottom = m.bottomPad;
  return { padTop, padBottom, glyphBox, minHeight: 2 * m.maxEdge + padTop + glyphBox + m.wordLine + padBottom };
}

export type CountSlot = { top: number; right: number } | { top: number; left: number };

/**
 * Where the story count mark goes. Top right; when the placed-out check owns that corner, top left
 * (the start pin's corner). A cell can draw both corner marks: the pin comes from the fixed level-check
 * result and the check from live progress (the start cell's earlier quest was placed out and the learner
 * finished the rest). Then the count mark sits under the check, in the band's second row
 * (`journeyCellLayout` starts the glyph under it): the corner band has no room for a third mark beside
 * the pin and the check in a 54 dp cell, and its centre is the Next triangle's.
 * It never moves to the bottom: the theme word is there.
 */
export function countMarkSlot(m: Pick<CellMetrics, 'inset' | 'markSize'>, marks: CellCornerMarks): CountSlot {
  if (!marks.placedOut) return { top: m.inset, right: m.inset };
  if (!marks.isStart) return { top: m.inset, left: m.inset };
  return { top: 2 * m.inset + m.markSize, right: m.inset };
}
