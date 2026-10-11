/**
 * Journey grid geometry (F-LAYOUT-001 §3.6, §3.7). Pure, and token-free on purpose
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
