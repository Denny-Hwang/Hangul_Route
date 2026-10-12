/**
 * WordArt animal glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `animal-cat`; batch W-3 draws `animal-bear` and `animal-elephant`
 * (colour-swatch objects) and W-4 the rest. Keys are written without the
 * `word:` prefix.
 */
import { blob, circle, curve, ellipse, face, line, poly, pts } from '../builders';
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
  // brown bear face, round ears (the brown swatch's object, §3.6.1)
  'animal-bear': [
    circle(27, 29, 10, { f: 'vocab.brown', ...INK }),
    circle(73, 29, 10, { f: 'vocab.brown', ...INK }),
    circle(27, 29, 5, { f: 'feedback.nudgeLight' }),
    circle(73, 29, 5, { f: 'feedback.nudgeLight' }),
    ellipse(50, 53, 30, 27, { f: 'vocab.brown', ...INK }),
    ellipse(50, 56, 12, 9, { f: 'feedback.nudgeLight', ...DETAIL }),
    ...face(50, 48, 1, { cheeks: true }),
    ellipse(50, 52, 4, 2.8, { f: 'text.primary' }),
  ],

  // gray face, trunk, ears (the gray swatch's object, §3.6.1)
  'animal-elephant': [
    blob(pts(34, 30, 22, 22, 13, 32, 13, 50, 20, 64, 34, 62), { f: 'vocab.gray', ...INK }),
    blob(pts(66, 30, 78, 22, 87, 32, 87, 50, 80, 64, 66, 62), { f: 'vocab.gray', ...INK }),
    blob(pts(31, 34, 23, 29, 18, 36, 18, 49, 23, 57, 31, 55), { f: 'hoya.cheek' }),
    blob(pts(69, 34, 77, 29, 82, 36, 82, 49, 77, 57, 69, 55), { f: 'hoya.cheek' }),
    ellipse(50, 42, 22, 20, { f: 'vocab.gray', ...INK }),
    blob(pts(42, 52, 58, 52, 57, 67, 61, 75, 67, 74, 70, 80, 62, 86, 52, 82, 45, 72, 43, 62), { f: 'vocab.gray', ...INK }),
    ellipse(50, 50, 10, 5, { f: 'vocab.gray' }),
    curve(pts(48, 64, 51, 65.5, 54, 64), DETAIL),
    curve(pts(48, 71, 51, 72.5, 54.5, 71), DETAIL),
    ...face(50, 39, 1, { cheeks: true }),
  ],
};
