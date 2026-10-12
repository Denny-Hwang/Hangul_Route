/**
 * WordArt science glyphs (F-VOC-002 §3.9, briefs in §3.12), drawn in batch
 * W-6. Keys are written without the `word:` prefix. Outlines are flat
 * `pts(...)` lists (W7).
 */
import { blob, circle, curve, face, groundShadow, leaf, line, path, poly, pts, rect, star } from '../builders';
import type { WordArtGlyph, WordArtShape, WordArtTone } from '../types';
import { limb } from './pose';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const HIGHLIGHT = { f: 'surface.paper', o: 0.55 } as const;

/** The six rainbow bands, outside in. */
const RAINBOW: readonly WordArtTone[] = ['vocab.red', 'vocab.orange', 'vocab.yellow', 'vocab.green', 'vocab.blue', 'vocab.purple'];

/** One rainbow band: the half ring between radius r and r - w over (cx, cy). */
const band = (cx: number, cy: number, r: number, w: number, f: WordArtTone): WordArtShape =>
  path(`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} L ${cx + r - w} ${cy} A ${r - w} ${r - w} 0 0 0 ${cx - r + w} ${cy} Z`, { f });

/** A small cloud of three puffs on a flat base, one outline (the inner outlines are covered). */
function cloud(x: number, y: number): WordArtShape[] {
  const parts = pts(x - 7, y - 2, x, y - 6, x + 7, y - 2);
  return [
    rect(x - 13, y - 3, 26, 9, 4.5, { f: 'surface.paper', ...INK }),
    ...parts.map(([px, py], i) => circle(px, py, i === 1 ? 7 : 5.5, { f: 'surface.paper', ...INK })),
    rect(x - 11.5, y - 1.5, 23, 6, 3, { f: 'surface.paper' }),
    ...parts.map(([px, py], i) => circle(px, py, i === 1 ? 5.5 : 4, { f: 'surface.paper' })),
  ];
}

export const SCIENCE_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // flame in three colours
  'science-fire': [
    blob(pts(50, 12, 58, 26, 70, 38, 76, 56, 70, 74, 50, 84, 30, 74, 24, 56, 30, 42, 38, 48, 40, 30), { f: 'vocab.red', ...INK }),
    blob(pts(50, 32, 58, 46, 64, 60, 60, 74, 50, 80, 40, 74, 36, 60, 42, 52), { f: 'vocab.orange', ...DETAIL }),
    blob(pts(50, 52, 56, 62, 56, 72, 50, 77, 44, 72, 44, 62), { f: 'vocab.yellow', ...DETAIL }),
  ],

  // light-blue ice cube, shine
  'science-ice': [
    groundShadow(50, 84, 30),
    poly(pts(22, 36, 36, 24, 78, 24, 64, 36), { f: 'brand.secondaryLight', ...INK }, 3),
    poly(pts(64, 36, 78, 24, 78, 68, 64, 80), { f: 'vocab.blue', ...INK }, 3),
    rect(22, 36, 42, 44, 4, { f: 'vocab.skyBlue', ...INK }),
    leaf(28, 44, 30, 70, 2.5, HIGHLIGHT),
    leaf(36, 42, 50, 42, 2, HIGHLIGHT),
    star(80, 16, 7, 2.5, 4, { f: 'surface.paper', ...DETAIL }, 1),
  ],

  // gray rounded stone, a pebble beside it
  'science-stone': [
    groundShadow(50, 82, 36),
    blob(pts(18, 74, 16, 58, 26, 40, 44, 32, 62, 34, 74, 46, 76, 64, 70, 78, 46, 82), { f: 'vocab.gray', ...INK }),
    blob(pts(72, 80, 74, 70, 82, 66, 88, 72, 86, 80), { f: 'vocab.gray', ...INK }),
    leaf(30, 48, 46, 40, 3, HIGHLIGHT),
    leaf(56, 62, 62, 52, 2, HIGHLIGHT),
  ],

  // horseshoe, red and blue ends, the field between the poles
  'science-magnet': [
    path('M 22 72 V 44 A 28 28 0 0 1 50 16 V 31 A 13 13 0 0 0 37 44 V 72 Z', { f: 'vocab.red', ...INK }),
    path('M 78 72 V 44 A 28 28 0 0 0 50 16 V 31 A 13 13 0 0 1 63 44 V 72 Z', { f: 'vocab.blue', ...INK }),
    rect(22, 62, 15, 10, 1, { f: 'vocab.gray', ...INK }),
    rect(63, 62, 15, 10, 1, { f: 'vocab.gray', ...INK }),
    path('M 33 77 Q 50 84 67 77 M 28 79 Q 50 90 72 79', DETAIL),
  ],

  // blue globe, green continents
  'science-earth': [
    circle(50, 50, 32, { f: 'vocab.blue', ...INK }),
    blob(pts(28, 32, 40, 24, 48, 30, 44, 42, 34, 48, 26, 42), { f: 'vocab.green', ...DETAIL }),
    blob(pts(56, 38, 70, 34, 78, 44, 74, 58, 64, 62, 58, 52), { f: 'vocab.green', ...DETAIL }),
    blob(pts(34, 60, 44, 58, 48, 68, 40, 76, 32, 70), { f: 'vocab.green', ...DETAIL }),
    leaf(26, 56, 30, 70, 2.5, HIGHLIGHT),
  ],

  // dark sky, stars, ringed planet
  'science-space': [
    circle(50, 50, 32, { f: 'brand.secondaryDark', ...INK }),
    path('M 13 52 A 37 10 0 0 1 87 52 L 79 52 A 29 6 0 0 0 21 52 Z', { f: 'feedback.nudgeLight', ...INK }),
    circle(50, 50, 14, { f: 'hoya.fur', ...INK }),
    path('M 13 52 A 37 10 0 0 0 87 52 L 79 52 A 29 6 0 0 1 21 52 Z', { f: 'feedback.nudgeLight', ...INK }),
    star(32, 30, 5, 2, 4, { f: 'surface.paper' }),
    star(70, 28, 4, 1.5, 4, { f: 'surface.paper' }),
    star(64, 72, 4.5, 1.8, 4, { f: 'surface.paper' }),
    circle(38, 70, 1.8, { f: 'surface.paper' }),
    circle(58, 22, 1.8, { f: 'surface.paper' }),
  ],

  // boxy robot, antenna, a smiling screen face
  'science-robot': [
    groundShadow(50, 86, 22),
    line(50, 22, 50, 15, INK),
    circle(50, 13, 3.5, { f: 'vocab.red', ...INK }),
    rect(24, 31, 6, 12, 2, { f: 'vocab.gray', ...INK }),
    rect(70, 31, 6, 12, 2, { f: 'vocab.gray', ...INK }),
    limb([33, 60], [24, 72], 7, { f: 'vocab.gray', ...INK }),
    limb([67, 60], [76, 72], 7, { f: 'vocab.gray', ...INK }),
    rect(38, 76, 9, 9, 2, { f: 'vocab.gray', ...INK }),
    rect(53, 76, 9, 9, 2, { f: 'vocab.gray', ...INK }),
    rect(32, 54, 36, 24, 5, { f: 'vocab.gray', ...INK }),
    circle(50, 66, 4.5, { f: 'vocab.red', ...DETAIL }),
    rect(29, 22, 42, 30, 7, { f: 'vocab.gray', ...INK }),
    rect(34, 27, 32, 20, 5, { f: 'vocab.skyBlue', ...DETAIL }),
    ...face(50, 35, 0.75),
  ],

  // seed with a green sprout, on a little mound of soil
  'science-seed': [
    path('M 16 80 Q 50 58 84 80 Z', { f: 'hoya.furDark', ...INK }),
    curve(pts(50, 70, 49, 58, 50, 44), { s: 'vocab.green', sw: 3 }),
    leaf(50, 47, 32, 36, 7, { f: 'vocab.green', ...INK }),
    leaf(50, 45, 68, 32, 7, { f: 'vocab.green', ...INK }),
    blob(pts(41, 72, 50, 66, 60, 70, 58, 76, 46, 77), { f: 'stage.stage2', ...INK }),
  ],

  // six arcs and two clouds (the six arc colours and the cloud white: allowance of 7, see the registry)
  'science-rainbow': [
    ...RAINBOW.map((f, i) => band(50, 64, 34 - 4 * i, 4, f)),
    path('M 16 64 A 34 34 0 0 1 84 64 M 40 64 A 10 10 0 0 1 60 64', INK),
    ...cloud(28, 66),
    ...cloud(72, 66),
  ],

  // ball and its long gray shadow, the sun behind
  'science-shadow': [
    path('M 40 72 Q 60 65 84 69 Q 85 77 64 78 Q 44 79 40 72 Z', { f: 'vocab.gray', ...INK }),
    circle(24, 28, 7, { f: 'vocab.yellow', ...INK }),
    path('M 24 15 V 17.5 M 37 28 H 34.5 M 11 28 H 13.5 M 33 19 L 31.5 20.5 M 15 19 L 16.5 20.5 M 15 37 L 16.5 35.5 M 33 37 L 31.5 35.5', { s: 'vocab.orange', sw: 3 }),
    circle(38, 58, 15, { f: 'brand.primary', ...INK }),
    leaf(30, 50, 36, 46, 2.5, HIGHLIGHT),
  ],

  // three swirls and a leaf
  'science-wind': [
    path('M 12 40 H 58 A 9 9 0 1 0 49 31', INK),
    path('M 20 54 H 70 A 9 9 0 1 1 61 63', INK),
    path('M 12 68 H 44 A 7 7 0 1 0 37 61', INK),
    leaf(66, 30, 86, 20, 6, { f: 'vocab.green', ...INK }),
    line(68, 29.5, 82, 22.5, DETAIL),
  ],

  // bulb, glow, rays
  'science-light': [
    circle(50, 40, 27, { f: 'feedback.nudgeLight' }),
    path('M 50 6 V 10 M 16 40 H 20 M 80 40 H 84 M 26 16 L 29 19 M 74 16 L 71 19 M 26 64 L 29 61 M 74 64 L 71 61', { s: 'vocab.orange', sw: 3 }),
    blob(pts(50, 18, 64, 24, 68, 38, 62, 52, 58, 62, 42, 62, 38, 52, 32, 38, 36, 24), { f: 'vocab.yellow', ...INK }),
    path('M 44 60 V 50 L 47 44 L 50 50 L 53 44 L 56 50 V 60', DETAIL),
    rect(41, 62, 18, 14, 3, { f: 'vocab.gray', ...INK }),
    path('M 41 67 H 59 M 41 71.5 H 59', DETAIL),
    rect(46, 76, 8, 5, 2, { f: 'text.primary' }),
    leaf(40, 30, 44, 24, 2, HIGHLIGHT),
  ],
};
