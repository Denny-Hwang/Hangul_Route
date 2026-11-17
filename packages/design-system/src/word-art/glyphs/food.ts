/**
 * WordArt food glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b drew the
 * sample `food-apple`; batch W-3 draws the other eight. Keys are written
 * without the `word:` prefix. Outlines are flat `pts(...)` lists (W7).
 */
import { blob, circle, curve, drop, ellipse, groundShadow, leaf, line, path, poly, pts, rect, star } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const HIGHLIGHT = { f: 'surface.paper', o: 0.55 } as const;

/** One kimbap slice seen from the cut side: the seaweed ring, the rice, and three fillings (pickled radish, carrot, spinach). */
const kimbapSlice = (x: number, y: number, r: number) => [
  circle(x, y, r, { f: 'text.primary', ...INK }),
  circle(x, y, r * 0.74, { f: 'vocab.white' }),
  rect(x - r * 0.36, y - r * 0.4, r * 0.4, r * 0.44, 1, { f: 'vocab.yellow', ...DETAIL }),
  rect(x + r * 0.04, y - r * 0.3, r * 0.36, r * 0.4, 1, { f: 'vocab.orange', ...DETAIL }),
  circle(x - r * 0.02, y + r * 0.24, r * 0.22, { f: 'vocab.green', ...DETAIL }),
];

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

  // [PX-1] a whole pale egg, and beside it one cracked into a fried egg (white with a round yolk), so it is not only an oval
  'food-egg': [
    groundShadow(50, 85, 36),
    blob(pts(36, 16, 47, 21, 54, 35, 55, 50, 50, 63, 36, 69, 22, 63, 17, 50, 18, 35, 25, 21), { f: 'brand.primaryLight', ...INK }),
    leaf(25, 30, 23, 46, 3, HIGHLIGHT),
    blob(pts(38, 70, 46, 62, 58, 63, 66, 57, 78, 60, 86, 69, 84, 79, 72, 85, 58, 82, 46, 85, 37, 79), { f: 'vocab.white', ...INK }),
    circle(64, 71, 9, { f: 'vocab.yellow', ...INK }),
    leaf(59, 68, 63, 65, 1.6, HIGHLIGHT),
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

  // [PX-1] rice cake on a plate: a cut slab of layered rainbow rice cake (mujigae-tteok), its white, pink, yellow and
  // green layers showing on both cut sides
  'food-tteok': [
    groundShadow(50, 84, 36),
    ellipse(50, 70, 38, 12, { f: 'vocab.white', ...INK }),
    ellipse(50, 69, 28, 7.5, DETAIL),
    poly(pts(24, 34, 40, 24, 76, 30, 60, 40), { f: 'vocab.white', ...INK }, 1.5),
    ...(['vocab.white', 'vocab.pink', 'vocab.yellow', 'vocab.green'] as const).flatMap((f, i) => [
      poly(pts(24, 34 + i * 8, 60, 40 + i * 8, 60, 48 + i * 8, 24, 42 + i * 8), { f, ...DETAIL }),
      poly(pts(60, 40 + i * 8, 76, 30 + i * 8, 76, 38 + i * 8, 60, 48 + i * 8), { f, ...DETAIL }),
    ]),
    poly(pts(24, 34, 60, 40, 76, 30, 76, 62, 60, 72, 24, 66), INK, 1.5),
  ],

  // [PX-1] a tall rice bowl heaped with white rice: a high dome with grain ticks, steam
  'food-rice': [
    groundShadow(50, 87, 24),
    curve(pts(40, 25, 37, 20, 41, 15, 38, 10), { s: 'border.strong', sw: 3 }),
    curve(pts(58, 25, 55, 20, 59, 15, 56, 10), { s: 'border.strong', sw: 3 }),
    blob(pts(26, 52, 28, 38, 38, 28, 50, 25, 62, 28, 72, 38, 74, 52, 50, 57), { f: 'vocab.white', ...INK }),
    path('M 35 42 L 38 39 M 46 34 L 50 33 M 59 38 L 62 41 M 42 47 L 46 46 M 54 46 L 58 48 M 49 40 L 52 42', DETAIL),
    path('M 22 51 H 78 L 72 76 Q 70 81 64 81 H 36 Q 30 81 28 76 Z', { f: 'vocab.blue', ...INK }),
    path('M 24.5 60 H 75.5', { s: 'surface.paper', sw: 3 }),
    rect(38, 80, 24, 6, 2, { f: 'vocab.blue', ...INK }),
  ],

  // [PX-1] half a napa cabbage (pogi-kimchi) lying on a plate, stem end on the left: white ribs fan out
  // from the stem, the leaves are coated red with darker flecks, and green shows at the leaf tips
  'food-kimchi': [
    groundShadow(50, 86, 36),
    ellipse(50, 72, 38, 12, { f: 'vocab.white', ...INK }),
    blob(pts(48.9, 29.7, 53.7, 25.6, 60.5, 28.3, 66.3, 26.6, 70.4, 31.4, 75.7, 32.8, 76.6, 39, 81.5, 41.5, 80.1, 46.8, 83.3, 52, 78.5, 56, 77.9, 61, 72, 62.6, 67.6, 67.5, 54.9, 49.6), { f: 'vocab.green', ...INK }),
    blob(pts(18, 66, 17.6, 58.7, 23.8, 49.3, 31.8, 42, 35.6, 37.9, 40.2, 37.7, 44.1, 33.7, 48.9, 33.9, 53.4, 31.4, 58, 33.1, 62.2, 32.2, 65.6, 35.4, 70.1, 37.2, 71.1, 41.4, 74.8, 43.5, 73.9, 47.7, 75.6, 51.6, 72.4, 55, 71.6, 59.5, 67.5, 60.9, 64.6, 65, 60, 65.2, 56, 68.9, 51.2, 68.6, 44.7, 71, 33.5, 71.3, 22.8, 70.5), { f: 'vocab.red', ...INK }),
    leaf(19.4, 60.7, 47.3, 38.8, 3.4, { f: 'vocab.white', ...DETAIL }),
    leaf(22.9, 68.5, 57.5, 61.6, 3.4, { f: 'vocab.white', ...DETAIL }),
    leaf(21.3, 62.9, 55.5, 44.6, 3.4, { f: 'vocab.white', ...DETAIL }),
    leaf(22.5, 65.6, 59, 52.4, 3.4, { f: 'vocab.white', ...DETAIL }),
    blob(pts(14.9, 67.4, 14.8, 60.9, 20.7, 57.3, 25.9, 62.5, 26.3, 69.8, 19.7, 71.8), { f: 'vocab.white', ...INK }),
    ...pts(55.1, 37.2, 64.5, 41.5, 65.1, 55.4, 53.8, 49.1, 69.2, 49.8).map(([x, y]) => circle(x, y, 1.7, { f: 'brand.primaryDark' })),
    ...pts(31, 55, 38.6, 48.8, 37, 58, 47.5, 56.2, 37.4, 63, 47.6, 62.7).map(([x, y]) => circle(x, y, 1.5, { f: 'vocab.red' })),
  ],

  // [PX-1] cut kimbap: the roll behind, three slices in front showing the seaweed ring, the rice and the fillings
  'food-kimbap': [
    groundShadow(50, 86, 34),
    rect(14, 26, 62, 26, 13, { f: 'text.primary', ...INK }),
    line(26, 33, 58, 33, { s: 'border.strong', sw: 2 }),
    ...kimbapSlice(76, 39, 12),
    ...kimbapSlice(27, 67, 15),
    ...kimbapSlice(73, 67, 15),
    ...kimbapSlice(50, 71, 15),
  ],
};
