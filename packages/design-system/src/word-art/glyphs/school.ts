/**
 * WordArt school glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `school-chair`; batch W-5 draws the other ten. Keys are written
 * without the `word:` prefix. Outlines are flat `pts(...)` lists (W7).
 */
import { arc, circle, curve, groundShadow, leaf, line, path, poly, pts, rect } from '../builders';
import type { Pt } from '../builders';
import { figure } from '../generated/figure';
import type { WordArtGlyph, WordArtPaint, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const CHALK = { s: 'surface.paper', sw: 3 } as const;

/**
 * A chalk sun: a ring and six short rays, one path. Chalk marks are little
 * pictures, never a lone circle or triangle, which could read as a letter (C10).
 */
const chalkSun = (cx: number, cy: number, r: number) =>
  path(
    `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} ` +
      [0, 60, 120, 180, 240, 300]
        .map((a) => {
          const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
          const f = (v: number) => Math.round(v * 10) / 10;
          return `M ${f(cx + c * (r + 3))} ${f(cy + s * (r + 3))} L ${f(cx + c * (r + 6))} ${f(cy + s * (r + 6))}`;
        })
        .join(' '),
    CHALK,
  );
/** Chalk hills: two peaks on a base line, closed. */
const chalkHills = (x: number, y: number, w: number) => poly(pts(x, y, x + w * 0.3, y - w * 0.45, x + w * 0.5, y - w * 0.2, x + w * 0.7, y - w * 0.5, x + w, y), CHALK, 1);

/** The pencil's axis: `u` along it from the tip (lower left) to the eraser, `v` across it. */
const pencil = (...uv: number[]): Pt[] => pts(...uv).map(([u, v]) => [20 + (u + v) * Math.SQRT1_2, 80 - (u - v) * Math.SQRT1_2]);

/** A line between two points. */
const seg = ([x1, y1]: Pt, [x2, y2]: Pt, paint: WordArtPaint): WordArtShape => line(x1, y1, x2, y2, paint);

/** The eraser block in three-quarter view: a point on its long side at `t` (0 front, 1 back) and height `h` (0 bottom, 1 top). */
const side = (t: number, h: number): Pt => [44 + 36 * t, 74 - 12 * t - 18 * h];
/** The same on the top face, at depth `d` (0 front edge, 1 back edge). */
const top = (t: number, d: number): Pt => [44 + 36 * t - 22 * d, 56 - 12 * t - 10 * d];

export const SCHOOL_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // chair (prototype): seen from the front and a little above
  'school-chair': [
    groundShadow(50, 87, 32),
    rect(32, 60, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(63, 60, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(34, 36, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(61, 36, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(27, 13, 46, 27, 8, { f: 'brand.secondary', ...INK }),
    rect(33, 18, 20, 4, 2, { f: 'surface.paper', o: 0.55 }),
    poly(
      [
        [25, 50],
        [75, 50],
        [82, 61],
        [18, 61],
      ],
      { f: 'brand.secondary', ...INK },
      3,
    ),
    rect(21, 61, 6, 25, 2, { f: 'vocab.gray', ...INK }),
    rect(73, 61, 6, 25, 2, { f: 'vocab.gray', ...INK }),
  ],

  // building, flag, door, no clock: a front with a centre tower
  'school-school': [
    groundShadow(50, 85, 38),
    rect(14, 46, 72, 38, 3, { f: 'brand.primaryLight', ...INK }),
    line(50, 22, 50, 10, INK),
    poly(pts(50, 10, 63, 13.5, 50, 17), { f: 'brand.primary', ...DETAIL }, 1),
    rect(38, 30, 24, 54, 3, { f: 'brand.primaryLight', ...INK }),
    poly(pts(34, 32, 50, 21, 66, 32), { f: 'brand.primary', ...INK }, 2),
    ...[20, 70].flatMap((x) => [rect(x - 0.5, 52, 11, 10, 2, { f: 'vocab.skyBlue', ...DETAIL }), rect(x - 0.5, 68, 11, 10, 2, { f: 'vocab.skyBlue', ...DETAIL })]),
    rect(44, 38, 12, 9, 2, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(43, 64, 14, 20, 2, { f: 'vocab.brown', ...DETAIL }),
  ],

  // adult figure beside a board, pointer
  'school-teacher': [
    rect(12, 22, 40, 32, 3, { f: 'vocab.green', ...INK }),
    chalkSun(23, 34, 3.5),
    chalkHills(30, 48, 17),
    line(26.5, 61, 26.5, 54, INK),
    line(37.5, 61, 37.5, 54, INK),
    groundShadow(68, 86, 18),
    line(51, 64, 40, 44, INK),
    ...figure({ height: 64, hair: 'short', clothes: 'vocab.purple', accessory: 'glasses', x: 68, ground: 86 }),
  ],

  // two figures holding hands
  'school-friend': [
    groundShadow(50, 86, 34),
    ...figure({ height: 62, hair: 'short', clothes: 'vocab.blue', x: 33, ground: 86 }),
    ...figure({ height: 62, hair: 'long', clothes: 'feedback.success', x: 67, ground: 86 }),
  ],

  // yellow pencil, pink eraser end, lying on the diagonal
  'school-pencil': [
    poly(pencil(0, 0, 18, -8, 18, 8), { f: 'feedback.nudgeLight', ...INK }, 1.5),
    poly(pencil(0, 0, 6, -2.7, 6, 2.7), { f: 'text.primary' }, 1),
    poly(pencil(18, -8, 66, -8, 66, 8, 18, 8), { f: 'vocab.yellow', ...INK }, 1),
    seg(...(pencil(18, 0, 66, 0) as [Pt, Pt]), DETAIL),
    poly(pencil(66, -8.5, 75, -8.5, 75, 8.5, 66, 8.5), { f: 'vocab.gray', ...INK }, 1),
    poly(pencil(75, -8, 86, -8, 86, 8, 75, 8), { f: 'vocab.pink', ...INK }, 4),
  ],

  // backpack, pocket, straps: front view with a top loop and a flap
  'school-bag': [
    groundShadow(50, 86, 30),
    arc(50, 25, 9, 180, 360, INK),
    rect(17, 36, 8, 30, 4, { f: 'brand.secondaryDark', ...INK }),
    rect(75, 36, 8, 30, 4, { f: 'brand.secondaryDark', ...INK }),
    rect(23, 24, 54, 62, 14, { f: 'brand.secondary', ...INK }),
    path('M 23 38 A 14 14 0 0 1 37 24 H 63 A 14 14 0 0 1 77 38 V 46 Q 50 54 23 46 Z', { f: 'brand.secondaryDark', ...INK }),
    rect(45.5, 45, 9, 8, 2, { f: 'hoya.fur', ...DETAIL }),
    rect(31, 60, 38, 20, 6, { f: 'brand.secondaryLight', ...DETAIL }),
    line(36, 66, 64, 66, DETAIL),
  ],

  // spiral notebook, plain cover with a blank label
  'school-notebook': [
    groundShadow(52, 87, 28),
    rect(29, 18, 50, 67, 4, { f: 'surface.paper', ...INK }),
    rect(24, 15, 50, 67, 4, { f: 'vocab.orange', ...INK }),
    rect(36, 30, 30, 14, 3, { f: 'surface.paper', ...DETAIL }),
    path([22, 31, 40, 49, 58, 67].map((y) => `M 19 ${y} A 5 4 0 0 1 29 ${y}`).join(' '), DETAIL),
  ],

  // pink block eraser, wrapper band, in three-quarter view
  'school-eraser': [
    groundShadow(54, 76, 32),
    poly([side(0, 1), side(1, 1), side(1, 0), side(0, 0)], { f: 'hoya.furPink', ...INK }, 1.5),
    poly([top(0, 0), top(1, 0), top(1, 1), top(0, 1)], { f: 'vocab.pink', ...INK }, 1.5),
    poly([top(0, 0), top(0, 1), [22, 64], side(0, 0)], { f: 'hoya.cheek', ...INK }, 1.5),
    poly([side(0.45, 0), side(0.45, 1), top(0.45, 1), top(0.85, 1), top(0.85, 0), side(0.85, 0)], { f: 'brand.secondary', ...INK }, 1),
    seg(side(0.45, 1), side(0.85, 1), DETAIL),
  ],

  // wooden desk, drawer
  'school-desk': [
    groundShadow(50, 86, 36),
    rect(19, 38, 7, 48, 2, { f: 'vocab.brown', ...INK }),
    rect(74, 38, 7, 48, 2, { f: 'vocab.brown', ...INK }),
    rect(22, 38, 56, 18, 2, { f: 'stage.stage2', ...INK }),
    rect(37, 41, 26, 12, 2, { f: 'feedback.nudgeLight', ...DETAIL }),
    circle(50, 47, 2.5, { f: 'text.primary' }),
    rect(12, 28, 76, 11, 3, { f: 'stage.stage2', ...INK }),
    curve(pts(20, 33.5, 40, 32, 60, 34.5, 80, 33), { s: 'hoya.furDark', sw: 2 }),
  ],

  // scissors, two handles: blades up, crossed at the screw
  'school-scissors': [
    leaf(39, 62, 61, 13, 5.5, { f: 'vocab.gray', ...INK }),
    leaf(61, 62, 39, 13, 5.5, { f: 'vocab.gray', ...INK }),
    circle(50, 37.5, 3, { f: 'text.primary' }),
    circle(36, 73, 11, { f: 'vocab.red', ...INK }),
    circle(64, 73, 11, { f: 'vocab.red', ...INK }),
    circle(36, 73, 5.5, { f: 'surface.paper', ...DETAIL }),
    circle(64, 73, 5.5, { f: 'surface.paper', ...DETAIL }),
  ],

  // green board, chalk marks as shapes, tray, on two legs
  'school-board': [
    groundShadow(50, 88, 34),
    line(24, 72, 20, 88, INK),
    line(76, 72, 80, 88, INK),
    rect(12, 18, 76, 52, 4, { f: 'vocab.brown', ...INK }),
    rect(17, 23, 66, 42, 2, { f: 'vocab.green', ...DETAIL }),
    chalkSun(32, 36, 5),
    chalkHills(46, 57, 30),
    rect(15, 68, 70, 6, 3, { f: 'vocab.brown', ...INK }),
    rect(26, 64, 13, 5, 2, { f: 'surface.paper', ...DETAIL }),
  ],
};
