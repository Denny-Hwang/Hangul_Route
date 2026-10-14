/**
 * The block compare after Done (design/wireframes/minigame/type-hangul.md "After Done"): the typed
 * row over the word's row, one column per block. Pure and token-free (the panel passes the sizes),
 * so the fit is tested without a renderer.
 *
 * Each cell takes the room it can (`max` at most, `min` at least); when even the smallest cell
 * cannot hold every block on one line (a 320 px phone with a long guess: MAX_TYPED allows 24), the
 * blocks are cut into chunks that fit the line, and the panel draws the typed row and the word row
 * per chunk, so each pair stays in one column and every block stays on screen (F-CURR-001 G-3
 * follow-up 1). The lines are filled evenly and the cell grows to what the fuller line allows.
 */
export interface CompareGrid {
  /** Side of one block cell. */
  cell: number;
  /** Blocks per line (at least 1). */
  perRow: number;
}

export function compareGrid(count: number, inner: number, gap: number, min: number, max: number): CompareGrid {
  const n = Math.max(count, 1);
  const room = Math.max(0, inner);
  const fit = (k: number): number => Math.floor((room - (k - 1) * gap) / k);
  const cell = Math.max(min, Math.min(max, fit(n)));
  const perRow = Math.max(1, Math.min(n, Math.floor((room + gap) / (cell + gap))));
  if (perRow >= n) return { cell, perRow };
  // Wrapping: spread the blocks evenly over the lines it takes (9 at 288 px: 5 + 4, not 8 + 1), so
  // each cell is as large as those lines allow instead of staying at the minimum.
  const even = Math.ceil(n / Math.ceil(n / perRow));
  return { cell: Math.max(min, Math.min(max, fit(even))), perRow: even };
}

/** `items` cut into lines of `perRow` (the last one may be shorter). */
export function chunkRows<T>(items: readonly T[], perRow: number): T[][] {
  const size = Math.max(1, Math.floor(perRow));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
