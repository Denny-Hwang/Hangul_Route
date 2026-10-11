/**
 * Grown-up PIN keypad sizing — audit p1-L1. At 375×553 (iPhone SE with the
 * Safari toolbar) and 320×568 the fixed 80pt pad pushed Next 60–370px below
 * the fold. The pad now takes the height that is actually left once the title,
 * hint, dots and CTA are placed, in this order of preference:
 *
 *   1. the familiar 3 × 4 pad, keys shrinking from `maxKey` toward `minKey`;
 *   2. 4 × 3, then 6 × 2 (phone landscape) once 4 rows would break the floor;
 *   3. nothing fits: keys stay at the `minKey` touch floor in the shortest
 *      arrangement the width allows, and the screen scrolls.
 *
 * Pure so the arithmetic is tested without a renderer.
 */

/** Digits 1–9, 0 and delete. */
export const PIN_PAD_KEY_COUNT = 11;

const COLUMN_OPTIONS = [3, 4, 6] as const;

export interface PinPadLayoutInput {
  /** Width the pad may use. */
  width: number;
  /** Height left for the pad (see `pinPadBudget`). */
  height: number;
  /** Touch-target floor (CLAUDE.md §4: 64). */
  minKey: number;
  /** Comfortable key size when there is room. */
  maxKey: number;
  /** Gap between keys, both axes. */
  gap: number;
}

export interface PinPadLayout {
  columns: number;
  rows: number;
  keySize: number;
  /** False when the pad cannot fit at the floor and the screen has to scroll. */
  fits: boolean;
}

function span(available: number, count: number, gap: number): number {
  return Math.floor((available - (count - 1) * gap) / count);
}

export function pinPadLayout({ width, height, minKey, maxKey, gap }: PinPadLayoutInput): PinPadLayout {
  const options = COLUMN_OPTIONS.map((columns) => {
    const rows = Math.ceil(PIN_PAD_KEY_COUNT / columns);
    return { columns, rows, byWidth: span(width, columns, gap), byHeight: span(height, rows, gap) };
  });

  for (const o of options) {
    const keySize = Math.min(maxKey, o.byWidth, o.byHeight);
    if (keySize >= minKey) return { columns: o.columns, rows: o.rows, keySize, fits: true };
  }

  const widest = [...options].reverse().find((o) => o.byWidth >= minKey) ?? options[0]!;
  return { columns: widest.columns, rows: widest.rows, keySize: minKey, fits: false };
}

export interface PinKeyMaxInput {
  /** The phone key size (`touchTarget.child` on the PIN screen, `touchTarget.min` in the onboarding card). */
  base: number;
  /** From `useLayoutClass()`: 1 on a phone and on any short window. */
  mediaScale: number;
  /** Largest key on any window (`touchTarget.hero`). */
  ceiling: number;
}

/**
 * Largest key the pad may use (`maxKey` of `pinPadLayout`): the base size times
 * the media scale, capped at the ceiling and never below the base
 * (F-LAYOUT-001 §3.6 PIN row: keys scale by `mediaScale` up to `touchTarget.hero`).
 */
export function pinKeyMax({ base, mediaScale, ceiling }: PinKeyMaxInput): number {
  const scaled = Math.round(base * (Number.isFinite(mediaScale) ? mediaScale : 1));
  return Math.max(base, Math.min(ceiling, scaled));
}

export interface PinPadFirstWidthInput {
  windowWidth: number;
  /** The `Screen` content cap (`layout.maxWidth.reading`, F-LAYOUT-001 §3.6). */
  maxWidth: number;
  /** Padding between the window edge and the pad, both sides together. */
  sidePadding: number;
}

/** First-frame width for the pad until its box is measured: the capped column less its padding. */
export function pinPadFirstWidth({ windowWidth, maxWidth, sidePadding }: PinPadFirstWidthInput): number {
  return Math.max(0, Math.min(windowWidth, maxWidth) - sidePadding);
}

export interface PinPadBudgetInput {
  windowHeight: number;
  insetTop: number;
  insetBottom: number;
  /** Measured height of the title / subtitle / hint block. */
  header: number;
  /** Everything else that must stay on screen: padding, dots, gaps, CTA. */
  chrome: number;
}

export function pinPadBudget({ windowHeight, insetTop, insetBottom, header, chrome }: PinPadBudgetInput): number {
  return Math.max(0, windowHeight - insetTop - insetBottom - header - chrome);
}
