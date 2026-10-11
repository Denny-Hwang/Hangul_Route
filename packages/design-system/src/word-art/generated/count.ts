/**
 * Counts (F-VOC-002 §3.6.2): `word:count-0` .. `count-10` and `count-20`. A
 * ten-frame (2 rows of 5 cells) with `n` dots, filled left to right, top row
 * first; the first five dots `brand.primary`, the next five `brand.secondary`
 * (the ten-frame convention: 7 reads as five and two). 20 draws two frames,
 * 0 one empty frame. No numerals (W6).
 */
import { circle, rect } from '../builders';
import type { WordArtShape } from '../types';

/** The counts the Numbers topic teaches. */
export const COUNT_VALUES: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]);

/** Cell size: five cells span 70 units, the C2 subject size. */
const CELL = 14;
const FRAME_X = 50 - (5 * CELL) / 2;
/** Gap between the two frames of 20. */
const GAP = 6;
const DOT_R = 4.6;

function frame(top: number, dots: number): WordArtShape[] {
  const cells: WordArtShape[] = [];
  const filled: WordArtShape[] = [];
  for (let i = 0; i < 10; i++) {
    const [col, row] = [i % 5, Math.floor(i / 5)];
    const [x, y] = [FRAME_X + col * CELL, top + row * CELL];
    cells.push(rect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, 3, { s: 'border.strong', sw: 2 }));
    if (i < dots) filled.push(circle(x + CELL / 2, y + CELL / 2, DOT_R, { f: row === 0 ? 'brand.primary' : 'brand.secondary', s: 'text.primary', sw: 1.5 }));
  }
  return [rect(FRAME_X, top, 5 * CELL, 2 * CELL, 4, { f: 'surface.paper', s: 'text.primary', sw: 3 }), ...cells, ...filled];
}

/** The ten-frame glyph of `n` (one of COUNT_VALUES). */
export function count(n: number): WordArtShape[] {
  if (!COUNT_VALUES.includes(n)) throw new RangeError(`WordArt count must be one of ${COUNT_VALUES.join(', ')}: ${String(n)}`);
  if (n <= 10) return frame(50 - CELL, n);
  const top = 50 - (4 * CELL + GAP) / 2;
  return [...frame(top, 10), ...frame(top + 2 * CELL + GAP, n - 10)];
}

/** Every count glyph by key (`count-<n>`). */
export function countGlyphs(): Record<string, WordArtShape[]> {
  return Object.fromEntries(COUNT_VALUES.map((n) => [`count-${n}`, count(n)]));
}
