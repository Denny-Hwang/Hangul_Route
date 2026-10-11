/**
 * WordArt prop glyphs (F-VOC-002 §3.6.1, §3.12): the objects the colour
 * swatches draw as stickers where no vocabulary word supplies one. They are
 * not vocabulary pictures; `vocab-keys.test.ts` checks every prop is used by
 * the colour generator (`generated/color.ts`). Drawn in PR W-1c; keys are
 * written without the `word:` prefix.
 *
 * Each reads by its shape as well as its colour (it has an ink outline), so a
 * swatch tells two colours apart under a colour-vision deficiency (W4).
 */
import { blob, circle, curve, groundShadow, leaf, line, path, poly, rect, star } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const HIGHLIGHT = { f: 'surface.paper', o: 0.55 } as const;

export const PROP_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // tangerine (orange swatch): a flattened round fruit, a green star calyx, a leaf on a short stem, peel dots
  'prop-tangerine': [
    groundShadow(50, 85, 28),
    line(50, 39, 51, 33, INK),
    leaf(51, 36, 69, 27, 5, { f: 'vocab.green', ...DETAIL }),
    blob(
      [
        [50, 39],
        [66, 37],
        [79, 45],
        [83, 60],
        [76, 74],
        [60, 81],
        [40, 81],
        [24, 74],
        [17, 60],
        [21, 45],
        [34, 37],
      ],
      { f: 'vocab.orange', ...INK },
    ),
    star(50, 40.5, 5, 2.2, 5, { f: 'vocab.green', ...DETAIL }, 1),
    leaf(28, 51, 33, 64, 3.5, HIGHLIGHT),
    circle(60, 55, 1.5, { f: 'brand.primary' }),
    circle(68, 64, 1.5, { f: 'brand.primary' }),
    circle(56, 70, 1.5, { f: 'brand.primary' }),
    circle(44, 61, 1.5, { f: 'brand.primary' }),
  ],

  // leaf (green swatch): one broad leaf on a short stem, a midrib and side veins
  'prop-leaf': [
    curve(
      [
        [23, 79],
        [18, 84],
        [15, 90],
      ],
      INK,
    ),
    leaf(23, 79, 80, 20, 16, { f: 'vocab.green', ...INK }),
    curve(
      [
        [25, 77],
        [50, 52],
        [74, 26],
      ],
      DETAIL,
    ),
    line(38, 63, 34, 50, DETAIL),
    line(38, 63, 51, 67, DETAIL),
    line(50, 51, 47, 38, DETAIL),
    line(50, 51, 63, 55, DETAIL),
    line(61, 39, 59, 30, DETAIL),
    line(61, 39, 70, 42, DETAIL),
    leaf(36, 52, 52, 36, 3, HIGHLIGHT),
  ],

  // grapes (purple swatch): a bunch narrowing to one grape, a stem and a leaf
  'prop-grapes': [
    curve(
      [
        [50, 32],
        [51, 26],
        [55, 20],
      ],
      INK,
    ),
    leaf(53, 27, 73, 21, 4.5, { f: 'vocab.green', ...DETAIL }),
    ...(
      [
        [27, 40],
        [42.5, 38],
        [57.5, 38],
        [73, 40],
        [35, 53],
        [50, 52],
        [65, 53],
        [42, 66],
        [58, 66],
        [50, 78],
      ] as const
    ).map(([x, y]) => circle(x, y, 8.5, { f: 'vocab.purple', ...INK })),
    circle(31, 37, 2.5, HIGHLIGHT),
    circle(54, 49, 2.5, HIGHLIGHT),
    circle(46, 63, 2.5, HIGHLIGHT),
  ],

  // crow (black swatch): a black bird in profile on a branch, tail fanned behind, a wing, a pointed beak.
  // A profile shows one eye, so the smile is the mouth line, turned up where the beak meets the head (brief §5).
  'prop-crow': [
    path('M 47 70 L 45.5 77 M 57 69 L 57 77', { s: 'text.primary', sw: 3 }),
    poly(
      [
        [34, 60],
        [17, 71],
        [18, 77],
        [24, 78],
        [40, 70],
      ],
      { f: 'vocab.black', ...INK },
      3,
    ),
    blob(
      [
        [30, 58],
        [40, 45],
        [58, 42],
        [70, 52],
        [66, 66],
        [52, 72],
        [36, 69],
      ],
      { f: 'vocab.black', ...INK },
    ),
    leaf(64, 54, 30, 63, 6.5, { f: 'vocab.black', s: 'vocab.gray', sw: 2 }),
    circle(64, 37, 15, { f: 'vocab.black', ...INK }),
    poly(
      [
        [75, 30],
        [91, 38.5],
        [75, 45],
      ],
      { f: 'vocab.orange', ...DETAIL },
      2,
    ),
    curve(
      [
        [76, 38.5],
        [81, 41],
        [85, 39],
      ],
      DETAIL,
    ),
    circle(67, 33, 5, { f: 'surface.paper', ...DETAIL }),
    circle(68.5, 33, 2.5, { f: 'text.primary' }),
    rect(24, 76, 60, 7, 3.5, { f: 'vocab.brown', ...INK }),
  ],
};
