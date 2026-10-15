import type { borderWidth, spacing, typography } from '@hangul-route/design-system/tokens';

/**
 * Where everything sits inside one Journey cell (design/components/Icon/theme-glyphs.md "Cell word",
 * wireframe design/wireframes/journey/grid.md). Pure numbers, no React, so the overlap rules are unit
 * tested at every layout class:
 *
 * - the corner band on top holds the start pin (top left), the placed-out check (top right) and the
 *   story count mark; the theme glyph starts under it, so no corner mark covers any part of a glyph
 *   (the leaf's tip points up-left, under the start pin, so it needs this);
 * - the glyph box is as tall as the In your plan / Not open yet ring, so the ring is drawn around the
 *   glyph and never through the word under it;
 * - the theme word sits under the glyph box on one line (`typography.size.caption`, `leading.tight`);
 * - the cell is square where that fits (768 px) and grows taller than wide where it does not (320 px).
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
  /** The corner band: the tallest corner mark and its inset. Nothing but corner marks and the Next triangle draws in it. */
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
  /** The cell border (`border.focus` at `borderWidth.thick` when selected in two panes). */
  edge: number;
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
  /** The smallest cell height (its border included) that holds the band, the glyph box and one line of the word. */
  minHeight: number;
}

/** The layout for a glyph of `glyph` dp inside a ring of `ring` dp (both after `useMediaSize`). */
export function journeyCellLayout(m: CellMetrics, glyph: number, ring: number): CellLayout {
  const glyphBox = Math.max(glyph, ring);
  const padTop = Math.max(0, m.band - (glyphBox - glyph) / 2);
  const padBottom = m.bottomPad;
  return { padTop, padBottom, glyphBox, minHeight: 2 * m.edge + padTop + glyphBox + m.wordLine + padBottom };
}

export type CountSlot = { top: number; right: number } | { top: number; left: number };

/**
 * Where the story count mark goes. Top right; when the placed-out check owns that corner, top left
 * (the start pin's corner: the start quest is never placed out, so a cell is placed out or the start).
 * It never moves to the bottom: the theme word is there. A cell marked both (no learner state makes one)
 * has no free corner, so it draws no count mark; the number stays in the cell's label.
 */
export function countMarkSlot(m: Pick<CellMetrics, 'inset'>, marks: { placedOut: boolean; isStart: boolean }): CountSlot | null {
  if (!marks.placedOut) return { top: m.inset, right: m.inset };
  if (!marks.isStart) return { top: m.inset, left: m.inset };
  return null;
}
