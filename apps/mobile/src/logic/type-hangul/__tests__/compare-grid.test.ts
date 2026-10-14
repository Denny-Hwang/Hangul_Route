import { describe, expect, it } from 'vitest';
import { chunkRows, compareGrid } from '../compare-grid';

// spacing.xs 4, spacing.xxl 32, touchTarget.min 64 (the panel's sizes).
const GAP = 4;
const MIN = 32;
const MAX = 64;
const rowWidth = (n: number, cell: number): number => n * cell + (n - 1) * GAP;

describe('compareGrid: the block compare fits the panel (G-3 follow-up 1)', () => {
  it('a short word on a 320 px phone stays one line at the full cell', () => {
    expect(compareGrid(3, 288, GAP, MIN, MAX)).toEqual({ cell: 64, perRow: 3 });
  });

  it('24 blocks at 320 px (inner 288) are cut into lines that each fit the width', () => {
    const { cell, perRow } = compareGrid(24, 288, GAP, MIN, MAX);
    expect(cell).toBe(32);
    expect(perRow).toBe(8);
    expect(rowWidth(perRow, cell)).toBeLessThanOrEqual(288);
    const rows = chunkRows(Array.from({ length: 24 }, (_, i) => i), perRow);
    expect(rows).toHaveLength(3);
    expect(rows.flat()).toHaveLength(24);
    for (const row of rows) expect(rowWidth(row.length, cell)).toBeLessThanOrEqual(288);
  });

  it('9 blocks at 320 px no longer overflow (the reported case)', () => {
    const { cell, perRow } = compareGrid(9, 288, GAP, MIN, MAX);
    for (const row of chunkRows(Array.from({ length: 9 }), perRow)) expect(rowWidth(row.length, cell)).toBeLessThanOrEqual(288);
  });

  it('a wide panel keeps every block on one line', () => {
    const { cell, perRow } = compareGrid(12, 640, GAP, MIN, MAX);
    expect(perRow).toBe(12);
    expect(rowWidth(12, cell)).toBeLessThanOrEqual(640);
  });

  it('never fewer than one block a line, and no blocks gives no lines', () => {
    expect(compareGrid(5, 10, GAP, MIN, MAX).perRow).toBe(1);
    expect(compareGrid(0, 288, GAP, MIN, MAX).perRow).toBe(1);
    expect(chunkRows([], 8)).toEqual([]);
  });
});
