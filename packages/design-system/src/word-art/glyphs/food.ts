/**
 * WordArt food glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b drew the
 * sample `food-apple`; batch W-3 draws the other eight. Keys are written
 * without the `word:` prefix. Outlines are flat `pts(...)` lists (W7).
 */
import { blob, circle, curve, drop, ellipse, groundShadow, leaf, line, poly, pts, rect, star } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const HIGHLIGHT = { f: 'surface.paper', o: 0.55 } as const;

/** One rice-cake slice: a disc seen from above, its side showing below. */
const slice = (x: number, y: number) => [ellipse(x, y + 6, 15, 8, { f: 'surface.sunken', ...INK }), ellipse(x, y, 15, 8, { f: 'vocab.white', ...INK })];

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

  // curved yellow banana, brown tips: a crescent lying like a smile, the stem up on the right
  'food-banana': [
    groundShadow(52, 78, 28),
    poly(pts(80, 40, 83, 27, 89, 28, 88, 41), { f: 'vocab.brown', ...DETAIL }, 1.5),
    blob(pts(17, 42, 24, 58, 38, 70, 56, 73, 72, 66, 82, 53, 85, 39, 77, 46, 65, 54, 51, 57, 38, 54, 27, 48), { f: 'vocab.yellow', ...INK }),
    curve(pts(27, 54, 42, 64, 60, 65, 76, 56), DETAIL),
    circle(18.5, 43, 3, { f: 'vocab.brown' }),
    leaf(32, 60, 50, 68, 2.5, HIGHLIGHT),
  ],

  // carton, blue band, drop: a gable-top carton in three-quarter view
  'food-milk': [
    groundShadow(50, 89, 28),
    poly(pts(41, 25, 55, 18, 55, 13, 41, 20), { f: 'surface.sunken', ...DETAIL }, 1),
    poly(pts(43, 26, 57, 19, 74, 35, 60, 42), { f: 'surface.sunken', ...INK }, 1),
    poly(pts(60, 42, 74, 35, 74, 81, 60, 88), { f: 'surface.sunken', ...INK }, 1),
    poly(pts(26, 42, 43, 26, 60, 42), { f: 'vocab.white', ...INK }, 1),
    rect(26, 42, 34, 46, 1, { f: 'vocab.white', ...INK }),
    rect(26, 56, 34, 20, 0, { f: 'vocab.blue', ...DETAIL }),
    poly(pts(60, 56, 74, 49, 74, 69, 60, 76), { f: 'vocab.blue', ...DETAIL }),
    drop(43, 57, 73, 11, { f: 'vocab.white', ...DETAIL }),
  ],

  // golden loaf, three slashes
  'food-bread': [
    groundShadow(50, 80, 32),
    blob(pts(18, 70, 17, 54, 25, 39, 40, 31, 60, 31, 75, 39, 83, 54, 82, 70, 70, 76, 30, 76), { f: 'stage.stage2', ...INK }),
    leaf(29, 52, 39, 39, 3.5, { f: 'feedback.nudgeLight', ...DETAIL }),
    leaf(44, 50, 54, 37, 3.5, { f: 'feedback.nudgeLight', ...DETAIL }),
    leaf(59, 52, 69, 39, 3.5, { f: 'feedback.nudgeLight', ...DETAIL }),
    curve(pts(24, 66, 50, 70, 76, 66), { s: 'hoya.furDark', sw: 2 }),
  ],

  // bowl, wavy noodles, steam, chopsticks
  'food-ramyeon': [
    groundShadow(50, 87, 28),
    curve(pts(34, 35, 31, 29.5, 35, 24, 32, 18.5), { s: 'border.strong', sw: 3 }),
    curve(pts(47, 34, 44, 28.5, 48, 23, 45, 17.5), { s: 'border.strong', sw: 3 }),
    poly(pts(55, 47, 77, 19, 81, 22, 60, 49), { f: 'hoya.furDark', ...DETAIL }, 1),
    poly(pts(61, 49, 83, 25, 86, 29, 66, 51), { f: 'hoya.furDark', ...DETAIL }, 1),
    blob(pts(20, 52, 26, 42, 40, 37, 56, 37, 71, 41, 80, 52, 50, 56), { f: 'hoya.fur', ...INK }),
    curve(pts(28, 49, 32, 44, 36, 49, 40, 44, 44, 49, 48, 44, 52, 49), DETAIL),
    curve(pts(48, 49, 52, 44, 56, 49, 60, 44, 64, 49, 68, 44, 72, 49), DETAIL),
    poly(pts(17, 52, 83, 52, 76, 75, 62, 84, 38, 84, 24, 75), { f: 'vocab.red', ...INK }, 8),
    curve(pts(24, 62, 50, 66, 76, 62), { s: 'surface.paper', sw: 3 }),
  ],

  // glass with a blue drop, highlight
  'food-water': [
    groundShadow(50, 86, 24),
    poly(pts(28, 18, 72, 18, 66, 84, 34, 84), { f: 'surface.paper', ...INK }, 3),
    poly(pts(30.5, 40, 69.5, 40, 66, 84, 34, 84), { f: 'vocab.skyBlue', ...INK }, 3),
    drop(50, 46, 74, 18, { f: 'vocab.blue', ...DETAIL }),
    leaf(35, 24, 38, 76, 2.5, HIGHLIGHT),
  ],

  // pale oval egg, highlight
  'food-egg': [
    groundShadow(50, 86, 22),
    blob(pts(50, 18, 63, 23, 72, 40, 74, 58, 68, 75, 50, 84, 32, 75, 26, 58, 28, 40, 37, 23), { f: 'brand.primaryLight', ...INK }),
    leaf(36, 33, 33, 55, 4, HIGHLIGHT),
    circle(38, 62, 2.5, HIGHLIGHT),
  ],

  // red heart-shaped berry, green cap, seed dots
  'food-strawberry': [
    groundShadow(50, 88, 20),
    blob(pts(50, 33, 64, 29, 77, 37, 78, 52, 70, 68, 58, 80, 50, 85, 42, 80, 30, 68, 22, 52, 23, 37, 36, 29), { f: 'vocab.red', ...INK }),
    ...pts(37, 46, 50, 48, 63, 46, 31, 58, 44, 59, 56, 59, 69, 58, 38, 70, 50, 71, 62, 70, 50, 80).map(([x, y]) => ellipse(x, y, 1.6, 2.4, { f: 'hoya.fur' })),
    star(50, 33, 16, 6, 5, { f: 'vocab.green', ...DETAIL }, 1.5),
    line(50, 26, 53, 16, INK),
    leaf(29, 41, 33, 55, 2.5, HIGHLIGHT),
  ],

  // three white rice-cake slices on a small plate
  'food-tteok': [
    groundShadow(50, 78, 34),
    ellipse(50, 66, 36, 11, { f: 'brand.secondaryLight', ...INK }),
    ellipse(50, 64, 25, 6.5, DETAIL),
    ...slice(36, 54),
    ...slice(64, 54),
    ...slice(50, 38),
  ],
};
