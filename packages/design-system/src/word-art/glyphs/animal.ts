/**
 * WordArt animal glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `animal-cat`; batch W-3 draws `animal-bear` and `animal-elephant`
 * (colour-swatch objects) and W-4 the rest. Keys are written without the
 * `word:` prefix.
 */
import { ellipse, face, line, poly } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

export const ANIMAL_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // orange cat face, ears, whiskers
  'animal-cat': [
    poly(
      [
        [23, 46],
        [25, 17],
        [46, 33],
      ],
      { f: 'vocab.orange', ...INK },
      3,
    ),
    poly(
      [
        [77, 46],
        [75, 17],
        [54, 33],
      ],
      { f: 'vocab.orange', ...INK },
      3,
    ),
    poly(
      [
        [29, 37],
        [30, 25],
        [39, 32],
      ],
      { f: 'hoya.cheek' },
      2,
    ),
    poly(
      [
        [71, 37],
        [70, 25],
        [61, 32],
      ],
      { f: 'hoya.cheek' },
      2,
    ),
    ellipse(50, 54, 31, 24, { f: 'vocab.orange', ...INK }),
    ellipse(50, 55, 10, 6.5, { f: 'surface.paper', ...DETAIL }),
    ...face(50, 47, 1, { cheeks: true }),
    poly(
      [
        [47.5, 49.5],
        [52.5, 49.5],
        [50, 52],
      ],
      { f: 'text.primary' },
      1,
    ),
    line(33, 58, 15, 54, DETAIL),
    line(33, 63, 15, 66, DETAIL),
    line(67, 58, 85, 54, DETAIL),
    line(67, 63, 85, 66, DETAIL),
  ],
};
