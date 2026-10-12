/**
 * WordArt travel glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `travel-bus`; batch W-6 draws the other eleven. Keys are written
 * without the `word:` prefix. Outlines are flat `pts(...)` lists (W7).
 */
import { blob, circle, groundShadow, line, path, poly, pts, rect, star } from '../builders';
import { placeGlyph } from '../place';
import type { WordArtGlyph, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const GLASS = { f: 'vocab.skyBlue', ...DETAIL } as const;

/** A wheel seen from the side: an ink tyre and a paper hub. */
const wheel = (x: number, y: number, r: number): WordArtShape[] => [circle(x, y, r, { f: 'text.primary', ...INK }), circle(x, y, r * 0.4, { f: 'surface.paper' })];

/** Window panes as one path of rounded-corner-free rectangles: [x, y, w, h] each. */
const panes = (list: readonly (readonly [number, number, number, number])[]): WordArtShape =>
  path(list.map(([x, y, w, h]) => `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`).join(' '), GLASS);

/** A small airliner in side view, nose to the right, `k` times the size of the one in travel-airplane. */
function plane(x: number, y: number, k: number): WordArtShape[] {
  const p = (...xy: number[]) => pts(...xy.map((v, i) => (i % 2 === 0 ? x + v * k : y + v * k)));
  return [
    poly(p(-30, -2, -36, -18, -28, -18, -18, -4), { f: 'brand.secondary', ...INK }, 2),
    blob(p(-34, 0, -24, -6, 20, -6, 32, -2, 34, 2, 28, 6, -24, 6), { f: 'vocab.white', ...INK }),
    poly(p(-6, 2, 8, 2, -6, 20, -14, 20), { f: 'brand.secondary', ...INK }, 2),
  ];
}

export const TRAVEL_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // bus (prototype): a green city bus, side view, door at the front
  'travel-bus': [
    groundShadow(50, 84, 36),
    rect(14, 24, 72, 52, 9, { f: 'vocab.green', ...INK }),
    rect(15.5, 54, 69, 6, 0, { f: 'surface.paper' }),
    rect(21, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(39, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(57, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(75, 32, 8, 30, 2, { f: 'vocab.skyBlue', ...DETAIL }),
    circle(81, 68, 2.5, { f: 'vocab.yellow', ...DETAIL }),
    circle(32, 76, 8, { f: 'text.primary', ...INK }),
    circle(32, 76, 3, { f: 'surface.paper' }),
    circle(66, 76, 8, { f: 'text.primary', ...INK }),
    circle(66, 76, 3, { f: 'surface.paper' }),
  ],

  // airplane: a white airliner in side view, blue tail and wing, a row of windows
  'travel-airplane': placeGlyph([
    poly(pts(22, 46, 14, 22, 24, 22, 36, 42), { f: 'brand.secondary', ...INK }, 3),
    blob(pts(14, 50, 24, 42, 70, 41, 84, 45, 88, 51, 82, 57, 24, 58), { f: 'vocab.white', ...INK }),
    path('M 79.5 45.5 Q 84 46.5 85.5 50 H 79.5 Z', { f: 'vocab.skyBlue', ...DETAIL }),
    ...[34, 43, 52, 61, 70].map((x) => circle(x, 48.5, 2.5, { f: 'vocab.skyBlue' })),
    poly(pts(44, 53, 60, 53, 42, 78, 32, 78), { f: 'brand.secondary', ...INK }, 3),
  ], { scale: 0.92, dx: 1, dy: 4 }),

  // train front, windows, headlight, on its rails
  'travel-train': [
    path('M 18 86 L 30 72 M 82 86 L 70 72', INK),
    rect(26, 18, 48, 58, 14, { f: 'brand.secondary', ...INK }),
    rect(32, 26, 36, 22, 5, GLASS),
    rect(26, 54, 48, 6, 0, { f: 'vocab.white' }),
    circle(37, 67, 4, { f: 'vocab.yellow', ...DETAIL }),
    circle(63, 67, 4, { f: 'vocab.yellow', ...DETAIL }),
    rect(44, 64, 12, 6, 2, { f: 'vocab.white', ...DETAIL }),
    line(14, 86, 86, 86, INK),
  ],

  // yellow car, roof sign as a blank rounded rectangle: a three-box sedan in side view
  'travel-taxi': [
    groundShadow(50, 80, 38),
    rect(42, 23, 18, 8, 3, { f: 'surface.paper', ...INK }),
    poly(pts(30, 49, 38, 32, 64, 32, 74, 49), { f: 'vocab.yellow', ...INK }, 4),
    poly(pts(37, 48, 42, 36, 49, 36, 49, 48), GLASS, 1.5),
    poly(pts(53, 48, 53, 36, 62, 36, 68, 48), GLASS, 1.5),
    rect(12, 47, 76, 22, 8, { f: 'vocab.yellow', ...INK }),
    line(12, 58, 88, 58, DETAIL),
    ...wheel(30, 70, 9),
    ...wheel(70, 70, 9),
  ],

  // train front in an arched tunnel
  'travel-subway': [
    path('M 12 84 V 46 A 38 38 0 0 1 88 46 V 84 Z', { f: 'vocab.gray', ...INK }),
    path('M 22 84 V 48 A 28 28 0 0 1 78 48 V 84 Z', { f: 'text.primary' }),
    rect(31, 32, 38, 52, 10, { f: 'vocab.green', ...INK }),
    rect(36, 38, 28, 18, 4, GLASS),
    circle(39, 70, 3.5, { f: 'vocab.yellow', ...DETAIL }),
    circle(61, 70, 3.5, { f: 'vocab.yellow', ...DETAIL }),
    line(12, 84, 88, 84, INK),
  ],

  // blue car, wheels: a rounded hatchback in side view
  'travel-car': [
    groundShadow(50, 79, 36),
    poly(pts(14, 66, 14, 54, 24, 47, 36, 31, 60, 29, 74, 44, 86, 50, 87, 66), { f: 'vocab.blue', ...INK }, 7),
    poly(pts(39, 44, 43, 34, 52, 33, 52, 44), GLASS, 2),
    poly(pts(56, 44, 56, 33, 62, 34, 70, 44), GLASS, 2),
    rect(80, 52, 6, 4, 2, { f: 'vocab.yellow', ...DETAIL }),
    ...wheel(31, 68, 9),
    ...wheel(69, 68, 9),
  ],

  // sailboat on a blue wave
  'travel-boat': [
    line(50, 12, 50, 62, INK),
    poly(pts(53, 15, 53, 58, 78, 58), { f: 'vocab.white', ...INK }, 2),
    poly(pts(47, 22, 47, 58, 28, 58), { f: 'vocab.orange', ...INK }, 2),
    poly(pts(18, 62, 82, 62, 72, 76, 28, 76), { f: 'vocab.brown', ...INK }, 3),
    path('M 12 78 Q 21 71 30 78 Q 39 85 48 78 Q 57 71 66 78 Q 75 85 88 76 V 88 H 12 Z', { f: 'vocab.skyBlue', ...INK }),
  ],

  // folded map, dotted route, pin
  'travel-map': [
    poly(pts(14, 26, 38, 18, 38, 78, 14, 86), { f: 'feedback.successLight', ...INK }, 2),
    poly(pts(38, 18, 62, 26, 62, 86, 38, 78), { f: 'brand.secondaryLight', ...INK }, 2),
    poly(pts(62, 26, 86, 18, 86, 78, 62, 86), { f: 'feedback.successLight', ...INK }, 2),
    path('M 22 70 L 26 66 M 30 61 L 34 57 M 38 53 L 43 51 M 48 50 L 53 49 M 58 47 L 62 49', { s: 'text.primary', sw: 3 }),
    path('M 68 56 C 64 48 58 44 58 36 A 10 10 0 0 1 78 36 C 78 44 72 48 68 56 Z', { f: 'vocab.red', ...INK }),
    circle(68, 36, 4, { f: 'surface.paper', ...DETAIL }),
  ],

  // blue booklet with a globe emblem (a meridian and the equator), no letters:
  // no ring over a bar, which would read as the syllable eu (a circle over a bar, C10)
  'travel-passport': [
    groundShadow(52, 87, 26),
    rect(31, 17, 44, 68, 5, { f: 'surface.paper', ...INK }),
    rect(26, 14, 44, 70, 5, { f: 'vocab.blue', ...INK }),
    circle(48, 47, 13, { f: 'hoya.fur', ...DETAIL }),
    path('M 48 34 A 6 13 0 0 1 48 60 A 6 13 0 0 1 48 34 M 35 47 H 61', DETAIL),
  ],

  // ticket with a notch and a dashed line: a stub on the right, a star on the face
  'travel-ticket': [
    path('M 12 30 H 88 V 42 A 8 8 0 0 0 88 58 V 70 H 12 V 58 A 8 8 0 0 0 12 42 Z', { f: 'brand.primaryLight', ...INK }),
    path('M 66 33 V 38 M 66 43 V 48 M 66 53 V 58 M 66 63 V 67', DETAIL),
    star(38, 50, 12, 5.5, 5, { f: 'vocab.yellow', ...DETAIL }, 1.5),
    rect(72, 42, 9, 16, 2, { f: 'brand.primary', ...DETAIL }),
  ],

  // terminal with a tower and a small plane
  'travel-airport': [
    groundShadow(46, 86, 38),
    rect(64, 34, 8, 52, 0, { f: 'surface.sunken', ...INK }),
    poly(pts(58, 22, 78, 22, 75, 34, 61, 34), GLASS, 2),
    rect(56, 18, 24, 5, 2, { f: 'surface.sunken', ...INK }),
    rect(10, 56, 56, 30, 4, { f: 'surface.sunken', ...INK }),
    panes([
      [16, 62, 10, 16],
      [30, 62, 10, 16],
      [44, 62, 10, 16],
    ]),
    path('M 10 56 Q 38 44 66 56', INK),
    ...plane(32, 30, 0.6),
  ],

  // tall building, awning, no bed
  'travel-hotel': [
    groundShadow(50, 87, 30),
    rect(27, 12, 46, 75, 3, { f: 'brand.primaryLight', ...INK }),
    panes([
      [33, 19, 9, 8],
      [45.5, 19, 9, 8],
      [58, 19, 9, 8],
      [33, 32, 9, 8],
      [45.5, 32, 9, 8],
      [58, 32, 9, 8],
      [33, 45, 9, 8],
      [45.5, 45, 9, 8],
      [58, 45, 9, 8],
    ]),
    path('M 31 62 H 69 L 72 70 Q 67.6 74 63.2 70 Q 58.8 74 54.4 70 Q 50 74 45.6 70 Q 41.2 74 36.8 70 Q 32.4 74 28 70 Z', { f: 'vocab.red', ...INK }),
    rect(42, 72, 16, 15, 2, { f: 'vocab.brown', ...DETAIL }),
  ],
};
