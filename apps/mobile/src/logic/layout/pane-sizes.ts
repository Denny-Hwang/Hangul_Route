import type { LayoutClass } from '@hangul-route/design-system/layout';

/**
 * Journey grid and Library gallery geometry (F-LAYOUT-001 §3.6, §3.7). Pure, and token-free on purpose
 * (logic does not import the design system's values): the screen passes
 * `spacing.xs` and `layout.columns.journeyCellMax`, the unit test asserts the 64-point floor.
 */
export const JOURNEY_COLUMNS = 5;

/** Side of one Journey cell in a grid `gridWidth` wide: five columns, four `gap`s, at most `cellMax`. */
export function journeyCellSize(gridWidth: number, gap: number, cellMax: number): number {
  return Math.min(cellMax, Math.floor((gridWidth - (JOURNEY_COLUMNS - 1) * gap) / JOURNEY_COLUMNS));
}

/** The grid never grows wider than five capped cells and their gaps, so the column labels stay over their cells. */
export function journeyGridMaxWidth(gap: number, cellMax: number): number {
  return JOURNEY_COLUMNS * cellMax + (JOURNEY_COLUMNS - 1) * gap;
}

// ---------------------------------------------------------------------------
// Library card gallery (F-LAYOUT-001 §3.6, §3.7)
// ---------------------------------------------------------------------------

/**
 * Gallery columns for a layout class: its `cardColumns` (2 / 3 / 3), except that a short window
 * (a landscape phone, 844x390) keeps the phone's `shortColumns`, as the §3.6 table says.
 */
export function cardGalleryColumns(lc: Pick<LayoutClass, 'cardColumns' | 'short'>, shortColumns: number): number {
  return lc.short ? shortColumns : lc.cardColumns;
}

/** Width of one cell in a grid `gridWidth` wide with `columns` columns and `gap` between them; never negative. */
export function gridCellWidth(gridWidth: number, columns: number, gap: number): number {
  if (columns < 1) return 0;
  return Math.max(0, Math.floor((gridWidth - (columns - 1) * gap) / columns));
}

/**
 * The page content width of a one-pane screen: the window less two gutters, capped at `maxWidth`.
 * Insets are not known here (a landscape notch makes the real content a little narrower).
 */
export function contentWidth(windowWidth: number, gutter: number, maxWidth: number): number {
  const w = Number.isFinite(windowWidth) ? windowWidth : 0;
  return Math.max(0, Math.min(w - 2 * gutter, maxWidth));
}

/** Which multi-column gallery a width was measured for: the master pane, or the rows of a one-pane window. */
export type GalleryMode = 'pane' | 'row';

/**
 * The gallery grid width: the measured width (`onLayout`) when it was measured for the current
 * gallery, else `fallback` (the 400 master pane or the computed content width). The measurement
 * catches what the fallback cannot know: a classic scrollbar in the master pane, a landscape notch.
 */
export function galleryGridWidth(
  measured: { mode: GalleryMode; width: number } | null,
  mode: GalleryMode,
  fallback: number,
): number {
  return measured !== null && measured.mode === mode && Number.isFinite(measured.width) ? measured.width : fallback;
}

/** Card art in a gallery cell: the scaled size (`useMediaSize`), shrunk to fit the cell less its padding and border (`chrome`). */
export function cardThumbArtSize(scaled: number, cellWidth: number, chrome: number): number {
  return Math.max(0, Math.min(scaled, cellWidth - chrome));
}

/** Rows of `columns` items; the last row is padded with `null`, so every cell of a row-based grid keeps one width. */
export function gridRows<T>(items: readonly T[], columns: number): (T | null)[][] {
  if (columns < 1) return [];
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    const row: (T | null)[] = items.slice(i, i + columns);
    while (row.length < columns) row.push(null);
    rows.push(row);
  }
  return rows;
}
