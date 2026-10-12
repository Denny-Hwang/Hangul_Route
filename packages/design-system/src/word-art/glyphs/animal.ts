/**
 * WordArt animal glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `animal-cat`; batch W-3 draws `animal-bear` and `animal-elephant`
 * (colour-swatch objects) and W-4 the other eight. Keys are written without
 * the `word:` prefix. Outlines are flat `pts(...)` lists (W7).
 */
import { blob, circle, curve, ellipse, face, leaf, line, path, poly, pts, rect } from '../builders';
import type { Pt } from '../builders';
import type { WordArtGlyph, WordArtPaint, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

/** The mirror image of a point list across x = 50: the right ear or wing from the left one. */
const flip = (p: readonly Pt[]): Pt[] => p.map(([x, y]) => [100 - x, y]);
/** A left part and its mirror image, as two blobs. */
const pair = (left: readonly Pt[], paint: WordArtPaint): WordArtShape[] => [blob(left, paint), blob(flip(left), paint)];

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

  // tan puppy face, floppy ears, tongue out
  'animal-puppy': [
    ellipse(50, 50, 27, 25, { f: 'stage.stage2', ...INK }),
    ...pair(pts(32, 28, 22, 27, 14, 37, 13, 53, 19, 64, 27, 61, 31, 48, 34, 36), { f: 'vocab.brown', ...INK }),
    ellipse(50, 57, 13, 9.5, { f: 'feedback.nudgeLight', ...DETAIL }),
    blob(pts(45, 58, 55, 58, 55, 65, 50, 69, 45, 65), { f: 'hoya.cheek', ...DETAIL }),
    ...face(50, 46, 1, { cheeks: true }),
    ellipse(50, 51, 4.5, 3, { f: 'text.primary' }),
  ],

  // white face, long ears with pink inside, two front teeth
  'animal-rabbit': [
    ...pair(pts(39, 46, 32, 32, 31, 17, 36, 10, 42, 15, 45, 30, 45, 46), { f: 'vocab.white', ...INK }),
    ...pair(pts(39, 40, 35.5, 30, 35.5, 20, 38, 16, 41, 21, 42, 31, 42, 40), { f: 'hoya.cheek' }),
    ellipse(50, 62, 28, 22, { f: 'vocab.white', ...INK }),
    rect(46, 66, 8, 7, 1.5, { f: 'vocab.white', ...DETAIL }),
    ...face(50, 59, 1, { cheeks: true }),
    poly(pts(47, 61.5, 53, 61.5, 50, 64.5), { f: 'hoya.cheek', ...DETAIL }, 1),
  ],

  // small round blue bird on a branch, seen from the side: one eye, the mouth line turned up at the beak
  'animal-bird': [
    path('M 46 70 V 78 M 58 70 V 78', INK),
    poly(pts(32, 58, 13, 46, 14, 56, 30, 68), { f: 'vocab.blue', ...INK }, 3),
    blob(pts(50, 27, 66, 31, 74, 46, 70, 62, 56, 71, 40, 69, 30, 58, 30, 42, 37, 31), { f: 'vocab.blue', ...INK }),
    ellipse(56, 59, 13, 8.5, { f: 'vocab.skyBlue' }),
    leaf(58, 50, 32, 60, 7, { f: 'vocab.skyBlue', ...DETAIL }),
    poly(pts(72, 40, 84, 45, 72, 50), { f: 'hoya.fur', ...DETAIL }, 1.5),
    curve(pts(65, 47, 68.5, 49.5, 72.5, 48), DETAIL),
    circle(63, 40, 3, { f: 'text.primary' }),
    rect(14, 76, 72, 7, 3.5, { f: 'vocab.brown', ...INK }),
  ],

  // blue fish, tail, fin, bubbles: side view, facing left, one eye and an upturned mouth
  'animal-fish': [
    poly(pts(66, 50, 86, 34, 82, 50, 86, 66), { f: 'vocab.blue', ...INK }, 3),
    poly(pts(38, 36, 52, 22, 62, 38), { f: 'vocab.skyBlue', ...INK }, 3),
    blob(pts(18, 51, 30, 38, 50, 33, 66, 39, 73, 51, 66, 62, 50, 68, 30, 64), { f: 'vocab.blue', ...INK }),
    leaf(50, 60, 40, 72, 4.5, { f: 'vocab.skyBlue', ...DETAIL }),
    curve(pts(38, 40, 42, 51, 38, 62), DETAIL),
    curve(pts(20, 54, 24, 56.5, 28, 54.5), DETAIL),
    circle(29, 47, 3, { f: 'text.primary' }),
    circle(15, 32, 4.5, { f: 'surface.paper', ...DETAIL }),
    circle(21, 21, 3, { f: 'surface.paper', ...DETAIL }),
  ],

  // yellow duck on a blue wave: side view, facing right
  'animal-duck': [
    blob(pts(20, 48, 34, 55, 50, 53, 63, 49, 76, 57, 72, 70, 54, 76, 34, 74, 25, 64), { f: 'vocab.yellow', ...INK }),
    leaf(36, 60, 58, 61, 6, { f: 'vocab.yellow', ...DETAIL }),
    circle(64, 36, 13, { f: 'vocab.yellow', ...INK }),
    poly(pts(74, 35, 87, 37, 87, 42, 74, 43), { f: 'vocab.orange', ...DETAIL }, 2.5),
    curve(pts(66.5, 42, 70, 44, 73.5, 42.5), DETAIL),
    circle(68, 33, 2.8, { f: 'text.primary' }),
    circle(60, 41, 3, { f: 'hoya.cheek' }),
    path('M 13 72 Q 21 64 29 72 Q 37 80 45 72 Q 53 64 61 72 Q 69 80 77 72 Q 83 66 87 70 L 87 84 L 13 84 Z', { f: 'vocab.skyBlue', ...INK }),
  ],

  // orange fox face, pointed ears with dark tips, white cheeks
  'animal-fox': [
    ...[pts(21, 42, 23, 12, 46, 30), flip(pts(21, 42, 23, 12, 46, 30))].map((ear) => poly(ear, { f: 'vocab.orange', ...INK }, 3)),
    ...[pts(23.5, 23, 24, 14, 31.5, 20), flip(pts(23.5, 23, 24, 14, 31.5, 20))].map((tip) => poly(tip, { f: 'text.primary' }, 1.5)),
    poly(pts(14, 42, 32, 31, 50, 29, 68, 31, 86, 42, 74, 62, 50, 76, 26, 62), { f: 'vocab.orange', ...INK }, 8),
    blob(pts(50, 55, 60, 50, 80, 46, 70, 62, 56, 71, 50, 73, 44, 71, 30, 62, 20, 46, 40, 50), { f: 'vocab.white', ...DETAIL }),
    ...face(50, 49, 1),
    ellipse(50, 54, 4, 2.8, { f: 'text.primary' }),
  ],

  // brown monkey face, cream face patch, round ears, a tuft
  'animal-monkey': [
    poly(pts(43, 27, 50, 15, 56, 26), { f: 'vocab.brown', ...INK }, 2),
    ...[22, 78].map((x) => circle(x, 52, 9, { f: 'vocab.brown', ...INK })),
    ...[22, 78].map((x) => circle(x, 52, 4.5, { f: 'feedback.nudgeLight' })),
    circle(50, 51, 27, { f: 'vocab.brown', ...INK }),
    blob(pts(50, 41.8, 57.4, 34.4, 67.5, 38.1, 68.4, 49.2, 63.8, 55.6, 69.3, 63, 61, 71.2, 50, 73.1, 39, 71.2, 30.7, 63, 36.2, 55.6, 31.6, 49.2, 32.5, 38.1, 42.6, 34.4), { f: 'feedback.nudgeLight', ...DETAIL }),
    ...face(50, 50, 1.1, { cheeks: true }),
  ],

  // pink and purple wings, antennae, an ink body
  'animal-butterfly': [
    ...pair(pts(47, 45, 38, 28, 24, 20, 14, 26, 15, 42, 30, 51), { f: 'vocab.pink', ...INK }),
    ...pair(pts(47, 53, 33, 54, 21, 62, 22, 76, 33, 79, 45, 66), { f: 'vocab.purple', ...INK }),
    ...[26, 74].map((x) => circle(x, 35, 5.5, { f: 'surface.paper', ...DETAIL })),
    ...[32, 68].map((x) => circle(x, 67, 4, { f: 'vocab.pink', ...DETAIL })),
    path('M 47.5 30 Q 44 21 38 18 M 52.5 30 Q 56 21 62 18', DETAIL),
    ...[38, 62].map((x) => circle(x, 18, 3, { f: 'text.primary' })),
    ellipse(50, 54, 5, 21, { f: 'text.primary' }),
    circle(50, 32, 6.5, { f: 'text.primary' }),
  ],
};
