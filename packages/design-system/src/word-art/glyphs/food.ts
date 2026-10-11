/**
 * WordArt food glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `food-apple`; batch W-3 draws the other eight. Keys are written
 * without the `word:` prefix.
 */
import { blob, curve, groundShadow, leaf } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;

export const FOOD_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // red apple, leaf, highlight
  'food-apple': [
    groundShadow(50, 87, 26),
    curve(
      [
        [50, 33],
        [51, 25],
        [55, 18],
      ],
      INK,
    ),
    leaf(53, 25, 72, 15, 5.5, { f: 'vocab.green', s: 'text.primary', sw: 2 }),
    blob(
      [
        [50, 33],
        [63, 27],
        [76, 34],
        [80, 52],
        [73, 73],
        [60, 84],
        [50, 81],
        [40, 84],
        [27, 73],
        [20, 52],
        [24, 34],
        [37, 27],
      ],
      { f: 'vocab.red', ...INK },
    ),
    leaf(31, 41, 29, 60, 3.5, { f: 'surface.paper', o: 0.55 }),
  ],
};
