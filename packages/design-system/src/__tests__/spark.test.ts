import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPARK_DEFAULT_MAX_ROWS, SPARK_DEFAULT_SLOTS, SPARK_FILL_MS, sparkLayout } from '../spark';
import { impureImports } from './impure-imports';

describe('sparkLayout (F-VOC-004 §3.9: a meter that only fills)', () => {
  it('defaults to 10 slots per row and 3 rows, and lights one spark in 300 ms', () => {
    expect(SPARK_DEFAULT_SLOTS).toBe(10);
    expect(SPARK_DEFAULT_MAX_ROWS).toBe(3);
    expect(SPARK_FILL_MS).toBe(300);
    expect(sparkLayout(3)).toEqual(sparkLayout(3, 10, 3));
  });

  it('shows one empty row before the first spark', () => {
    expect(sparkLayout(0)).toEqual({ filled: 0, rows: [0], slots: 10, full: false });
  });

  it('fills the first row, then starts the next one', () => {
    expect(sparkLayout(1)).toEqual({ filled: 1, rows: [1], slots: 10, full: false });
    expect(sparkLayout(9).rows).toEqual([9]);
    expect(sparkLayout(10)).toEqual({ filled: 10, rows: [10], slots: 10, full: false });
    expect(sparkLayout(11)).toEqual({ filled: 11, rows: [10, 1], slots: 10, full: false });
    expect(sparkLayout(20).rows).toEqual([10, 10]);
    expect(sparkLayout(21).rows).toEqual([10, 10, 1]);
    expect(sparkLayout(29)).toEqual({ filled: 29, rows: [10, 10, 9], slots: 10, full: false });
  });

  it('caps at maxRows full rows and then reads as full of sparks', () => {
    expect(sparkLayout(30)).toEqual({ filled: 30, rows: [10, 10, 10], slots: 10, full: true });
    expect(sparkLayout(31)).toEqual(sparkLayout(30));
    expect(sparkLayout(1000)).toEqual(sparkLayout(30));
    expect(sparkLayout(Number.POSITIVE_INFINITY)).toEqual(sparkLayout(30));
  });

  it('honours custom slots and rows', () => {
    expect(sparkLayout(7, 4, 2)).toEqual({ filled: 7, rows: [4, 3], slots: 4, full: false });
    expect(sparkLayout(8, 4, 2)).toEqual({ filled: 8, rows: [4, 4], slots: 4, full: true });
    expect(sparkLayout(5, 5, 1)).toEqual({ filled: 5, rows: [5], slots: 5, full: true });
  });

  it('is never negative and reads bad input as the whole number at or below it', () => {
    for (const bad of [-1, -0.5, -100, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(sparkLayout(bad)).toEqual({ filled: 0, rows: [0], slots: 10, full: false });
    }
    expect(sparkLayout(2.9).filled).toBe(2);
    expect(sparkLayout(10.5).rows).toEqual([10]);
  });

  it('reads slots and rows below 1 (or not finite) as 1, and fractional ones as whole', () => {
    expect(sparkLayout(3, 0, 0)).toEqual({ filled: 1, rows: [1], slots: 1, full: true });
    expect(sparkLayout(0, -4, 3)).toEqual({ filled: 0, rows: [0], slots: 1, full: false });
    expect(sparkLayout(2, Number.NaN, Number.NaN)).toEqual({ filled: 1, rows: [1], slots: 1, full: true });
    expect(sparkLayout(5, 2.7, 3.9)).toEqual({ filled: 5, rows: [2, 2, 1], slots: 2, full: false });
  });

  it('only ever fills: a larger value never has fewer sparks in any row', () => {
    for (const [slots, maxRows] of [[10, 3], [4, 2], [1, 1], [3, 5]] as const) {
      let previous = sparkLayout(0, slots, maxRows);
      for (let value = 1; value <= slots * maxRows + 5; value += 1) {
        const next = sparkLayout(value, slots, maxRows);
        expect(next.filled).toBeGreaterThanOrEqual(previous.filled);
        expect(next.rows.length).toBeGreaterThanOrEqual(previous.rows.length);
        previous.rows.forEach((count, row) => expect(next.rows[row]).toBeGreaterThanOrEqual(count));
        if (previous.full) expect(next.full).toBe(true);
        // Every row holds between 0 and `slots` sparks, and the rows add up to `filled`.
        for (const count of next.rows) {
          expect(count).toBeGreaterThanOrEqual(0);
          expect(count).toBeLessThanOrEqual(next.slots);
        }
        expect(next.rows.reduce((a, b) => a + b, 0)).toBe(next.filled);
        expect(next.rows.length).toBeLessThanOrEqual(maxRows);
        previous = next;
      }
    }
  });

  it('is pure: loads without React or react-native', () => {
    const source = readFileSync(new URL('../spark.ts', import.meta.url), 'utf8');
    expect(impureImports(source)).toEqual([]);
  });
});
