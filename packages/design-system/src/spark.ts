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

/** Slots per row or rows before full, as used: a whole number of at least 1 (not finite reads as 1). */
export function sparkCount(input: number): number {
  return Number.isFinite(input) ? wholeAtLeast(input, 1) : 1;
}

export function sparkLayout(
  value: number,
  slots: number = SPARK_DEFAULT_SLOTS,
  maxRows: number = SPARK_DEFAULT_MAX_ROWS,
): SparkLayout {
  const perRow = sparkCount(slots);
  const rowCap = sparkCount(maxRows);
  const capacity = perRow * rowCap;
  const sparks = wholeAtLeast(value, 0);
  const filled = Math.min(sparks, capacity);
  const shown = Math.max(1, Math.ceil(filled / perRow));
  const rows = Array.from({ length: shown }, (_, row) => Math.min(perRow, filled - row * perRow));
  return { filled, rows, slots: perRow, full: sparks >= capacity };
}

/**
 * Whether the slot at `index` (counted across rows) lit up in this change of
 * value: it was empty at `previousFilled` and is lit at `filled`. Only these
 * slots play the fill; the first spark of a new row counts like any other.
 */
export function isNewlyLit(index: number, previousFilled: number, filled: number): boolean {
  return index >= previousFilled && index < filled;
}

export interface SparkEntrance {
  /** The progress (0 hidden, 1 shown) the spark is first drawn with, before any frame is painted. */
  from: 0 | 1;
  /** Whether to run the one 300 ms scale-and-fade from `from` to 1. */
  play: boolean;
}

/**
 * How a lit spark first appears. Decided synchronously before the first
 * frame, so a spark is never drawn full and then hidden: a newly lit spark
 * starts hidden and fades in, unless motion is reduced, when it is simply
 * there (no blink, WCAG 2.3.1 and F-VOC-004 §3.8). A spark already lit when
 * the meter appears is drawn as it is.
 */
export function sparkEntrance(newlyLit: boolean, reducedMotion: boolean): SparkEntrance {
  const play = newlyLit && !reducedMotion;
  return { from: play ? 0 : 1, play };
}
