/**
 * The spark meter's layout (F-VOC-004 §3.6, §3.9; design/components/SparkMeter/spec.md).
 *
 * Pure and React-free, so it is unit-tested here and counted by design-system
 * coverage (which skips `components/`). The meter only fills (CLAUDE.md §1):
 * a larger `value` never draws fewer sparks in any row, and nothing here can
 * empty or reset it.
 */

/** Slots per row (one row is one "round" of ten caught words). */
export const SPARK_DEFAULT_SLOTS = 10;
/** Rows before the meter reads as "full of sparks". */
export const SPARK_DEFAULT_MAX_ROWS = 3;
/** One newly lit spark: a single scale-and-fade (F-VOC-004 §3.8); instant under reduced motion. */
export const SPARK_FILL_MS = 300;

export interface SparkLayout {
  /** Sparks drawn: `min(value, slots x maxRows)`, never negative. */
  filled: number;
  /** Sparks in each visible row, in order; always at least one row. */
  rows: readonly number[];
  /** Slots per row actually used (at least 1). */
  slots: number;
  /** Every slot of every row is lit; extra sparks change nothing on screen. */
  full: boolean;
}

/** A whole count of at least `min`; anything not finite and positive reads as `min`. */
function wholeAtLeast(value: number, min: number): number {
  if (Number.isNaN(value)) return min;
  if (value === Number.POSITIVE_INFINITY) return value;
  return Math.max(min, Math.floor(value));
}

export function sparkLayout(
  value: number,
  slots: number = SPARK_DEFAULT_SLOTS,
  maxRows: number = SPARK_DEFAULT_MAX_ROWS,
): SparkLayout {
  const perRow = Number.isFinite(slots) ? wholeAtLeast(slots, 1) : 1;
  const rowCap = Number.isFinite(maxRows) ? wholeAtLeast(maxRows, 1) : 1;
  const capacity = perRow * rowCap;
  const sparks = wholeAtLeast(value, 0);
  const filled = Math.min(sparks, capacity);
  const shown = Math.max(1, Math.ceil(filled / perRow));
  const rows = Array.from({ length: shown }, (_, row) => Math.min(perRow, filled - row * perRow));
  return { filled, rows, slots: perRow, full: sparks >= capacity };
}
