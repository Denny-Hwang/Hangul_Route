/**
 * WordArt sport glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `sport-soccer`; batch W-6 draws the other eleven. Keys are written
 * without the `word:` prefix. The people in motion are drawn from the parts in
 * `pose.ts` (limbs, a head, hands); the jump rope uses the standing `figure()`.
 */
import { circle, curve, ellipse, face, groundShadow, leaf, line, path, poly, pts } from '../builders';
import { figure } from '../generated/figure';
import { formatNumber as n } from '../path';
import type { WordArtGlyph, WordArtShape } from '../types';
import { hand, head, limb } from './pose';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

const at = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/**
 * A table-tennis paddle: a round wooden blade with the rubber face set in
 * from its edge, and a short handle that flares towards its end. The handle
 * points along `deg` (0 = straight down, positive = to the right).
 */
function paddle(cx: number, cy: number, deg: number, r: number, handle: number): WordArtShape[] {
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.sin(a), Math.cos(a)];
  const p = (along: number, across: number): string => `${n(cx + ux * along + uy * across)} ${n(cy + uy * along - ux * across)}`;
  const [s0, s1, w0, w1] = [r - 4, r + handle, 4.5, 5.75];
  return [
    path(`M ${p(s0, -w0)} L ${p(s1 - 3, -w1)} Q ${p(s1, -w1)} ${p(s1, 0)} Q ${p(s1, w1)} ${p(s1 - 3, w1)} L ${p(s0, w0)} Z`, { f: 'vocab.brown', ...INK }),
    circle(cx, cy, r, { f: 'vocab.brown', ...INK }),
    circle(Math.round((cx - ux * 1.5) * 10) / 10, Math.round((cy - uy * 1.5) * 10) / 10, r - 3.5, { f: 'vocab.red' }),
  ];
}

/** A football: an ink pentagon in the middle, seams out to five ink patches on the rim. */
function football(cx: number, cy: number, r: number): WordArtShape[] {
  const angles = [0, 1, 2, 3, 4].map((k) => -90 + 72 * k);
  const centre = r / 3;
  const patches = angles.map((a) => {
    const [x0, y0] = at(cx, cy, r, a - 14);
    const [x1, y1] = at(cx, cy, r, a + 14);
    const [xi, yi] = at(cx, cy, r * 0.72, a);
    return path(`M ${n(x0)} ${n(y0)} A ${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y1)} L ${n(xi)} ${n(yi)} Z`, { f: 'text.primary', ...DETAIL });
  });
  const seams = angles.map((a) => {
    const [x0, y0] = at(cx, cy, centre, a);
    const [x1, y1] = at(cx, cy, r * 0.72, a);
    return line(x0, y0, x1, y1, DETAIL);
  });
  return [
    circle(cx, cy, r, { f: 'surface.paper', ...INK }),
    ...seams,
    ...patches,
    poly(
      angles.map((a) => at(cx, cy, centre, a)),
      { f: 'text.primary', ...DETAIL },
      1,
    ),
    circle(cx, cy, r, INK),
  ];
}

const INK_FILL = { f: 'text.primary', ...INK } as const;

/** A ball outline drawn last, so the panels and seams inside never cover its edge. */
const rim = (cx: number, cy: number, r: number): WordArtShape => circle(cx, cy, r, INK);

/**
 * Volleyball panels: three swirling sectors, each side a curve from the centre
 * out to the rim (sampled as short lines), and a parallel seam in each sector.
 */
function volleyball(cx: number, cy: number, r: number): WordArtShape[] {
  const tones = ['vocab.yellow', 'brand.secondary', 'surface.paper'] as const;
  /** The swirl at angle `deg` from radius `t0` (fraction of r) out to the rim, as points. */
  const swirl = (deg: number, t0 = 0): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const t = t0 + ((1 - t0) * i) / 6;
      out.push(at(cx, cy, r * t, deg + 70 * (1 - t)));
    }
    return out;
  };
  const xy = ([x, y]: [number, number]): string => `${n(x)} ${n(y)}`;
  const sectors = tones.map((tone, k) => {
    const a = -90 + 120 * k;
    const out = swirl(a).slice(1).map(xy);
    const back = swirl(a + 120).reverse().slice(1).map(xy);
    return path(`M ${n(cx)} ${n(cy)} L ${out.join(' L ')} A ${r} ${r} 0 0 1 ${xy(swirl(a + 120)[6]!)} L ${back.join(' L ')} Z`, { f: tone });
  });
  const seams = [0, 1, 2].flatMap((k) => [swirl(-90 + 120 * k), swirl(-30 + 120 * k, 0.4)]).map((p) => curve(p, DETAIL));
  return [...sectors, ...seams, rim(cx, cy, r)];
}

/** A bicycle wheel: an ink tyre, a paper rim, four spokes and the hub. */
const bikeWheel = (x: number, y: number): WordArtShape[] => [
  circle(x, y, 16, INK_FILL),
  circle(x, y, 12, { f: 'surface.paper', ...DETAIL }),
  path(`M ${x - 12} ${y} H ${x + 12} M ${x} ${y - 12} V ${y + 12}`, DETAIL),
];

export const SPORT_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // football (prototype)
  'sport-soccer': [groundShadow(50, 84, 24), ...football(50, 49, 31)],

  // white ball, red stitches
  'sport-baseball': [
    groundShadow(50, 84, 24),
    circle(50, 49, 31, { f: 'surface.paper', ...INK }),
    curve(pts(30, 26, 38, 49, 30, 72), { s: 'vocab.red', sw: 2 }),
    curve(pts(70, 26, 62, 49, 70, 72), { s: 'vocab.red', sw: 2 }),
    path('M 30 32 L 36 30 M 33 40 L 39 39 M 34 49 L 40 49 M 33 58 L 39 59 M 30 66 L 36 68 M 70 32 L 64 30 M 67 40 L 61 39 M 66 49 L 60 49 M 67 58 L 61 59 M 70 66 L 64 68', { s: 'vocab.red', sw: 2 }),
    rim(50, 49, 31),
  ],

  // orange ball, black lines
  'sport-basketball': [
    groundShadow(50, 84, 24),
    circle(50, 49, 31, { f: 'vocab.orange', ...INK }),
    path('M 50 18 V 80 M 19 49 H 81 M 28 27 Q 43 49 28 71 M 72 27 Q 57 49 72 71', INK),
    rim(50, 49, 31),
  ],

  // white ball, blue and yellow panels
  'sport-volleyball': [groundShadow(50, 84, 24), ...volleyball(50, 49, 31)],

  // two paddles crossed at the handles, red rubber in a wooden rim, and the white ball above
  // (W-6 review: one paddle on a long handle read as a magnifying glass)
  'sport-tabletennis': [groundShadow(50, 86, 26), ...paddle(68, 44, -28, 17, 24), ...paddle(32, 44, 28, 17, 24), circle(50, 25, 7, { f: 'surface.paper', ...INK })],

  // swimmer's head, goggles, waves: a swim cap, one arm over the water
  'sport-swimming': [
    limb([58, 56], [76, 28], 9, { f: 'surface.paper', ...INK }),
    hand([77, 26], 5),
    circle(42, 48, 18, { f: 'surface.paper', ...INK }),
    path('M 23.5 46 A 18.5 18.5 0 0 1 60.5 46 Q 42 40 23.5 46 Z', { f: 'vocab.red', ...INK }),
    circle(35, 50, 5.5, { f: 'vocab.skyBlue', ...DETAIL }),
    circle(49, 50, 5.5, { f: 'vocab.skyBlue', ...DETAIL }),
    ...face(42, 50, 0.78),
    path('M 24 50 H 29.5 M 40.5 50 H 43.5 M 54.5 50 H 60', DETAIL),
    path('M 12 62 Q 20 56 28 62 Q 36 68 44 62 Q 52 56 60 62 Q 68 68 76 62 Q 82 58 88 61 V 82 Q 88 86 84 86 H 16 Q 12 86 12 82 Z', { f: 'vocab.skyBlue', ...INK }),
    path('M 22 74 Q 28 70 34 74 M 56 76 Q 62 72 68 76', { s: 'surface.paper', sw: 2 }),
  ],

  // figure in a white uniform (dobok), black belt, a high side kick (the foot at head height), barefoot
  'sport-taekwondo': [
    groundShadow(42, 87, 18),
    limb([44, 60], [40, 84], 10, { f: 'vocab.white', ...INK }),
    limb([50, 58], [78, 31], 10, { f: 'vocab.white', ...INK }),
    ellipse(81, 28, 5, 4, { f: 'surface.paper', ...INK }),
    ellipse(39, 86, 5.5, 3, { f: 'surface.paper', ...INK }),
    limb([38, 40], [30, 52], 8, { f: 'vocab.white', ...INK }),
    poly(pts(37, 36, 55, 36, 55, 61, 39, 61), { f: 'vocab.white', ...INK }, 4),
    path('M 41 36 L 46 48 L 51 36', DETAIL),
    poly(pts(38, 55, 56, 55, 56, 60, 38, 60), INK_FILL, 1),
    path('M 47 60 L 44 68 M 48 60 L 51 68', INK),
    limb([54, 39], [59, 32], 8, { f: 'vocab.white', ...INK }),
    hand([60, 30], 4),
    hand([29, 54], 4),
    ...head(45, 24, 10, 'text.secondary'),
  ],

  // figure running, shoes: leaning forward in mid-stride, motion lines behind
  'sport-running': [
    groundShadow(48, 87, 22),
    path('M 14 40 H 24 M 10 50 H 22 M 14 60 H 24', DETAIL),
    limb([46, 58], [36, 70], 9, INK_FILL),
    limb([36, 70], [26, 74], 9, INK_FILL),
    ellipse(24, 76, 6, 3.5, { f: 'vocab.red', ...INK }),
    limb([50, 40], [41, 47], 7, { f: 'brand.secondary', ...INK }),
    limb([41, 47], [37, 56], 7, { f: 'brand.secondary', ...INK }),
    hand([37, 57]),
    limb([48, 58], [55, 37], 15, { f: 'brand.secondary', ...INK }),
    limb([50, 58], [62, 68], 9, INK_FILL),
    limb([62, 68], [58, 82], 9, INK_FILL),
    ellipse(62, 84, 7, 3.5, { f: 'vocab.red', ...INK }),
    limb([56, 41], [65, 48], 7, { f: 'brand.secondary', ...INK }),
    limb([65, 48], [72, 40], 7, { f: 'brand.secondary', ...INK }),
    hand([73, 39]),
    ...head(60, 25, 10, 'text.primary'),
  ],

  // figure mid-jump, rope arc: the rope passes under the lifted feet
  'sport-jumprope': [
    ellipse(50, 88, 14, 2.5, { f: 'hoya.furDark', o: 0.18 }),
    path('M 34 55 A 16 38 0 0 1 66 55', { s: 'vocab.red', sw: 2 }),
    ...figure({ height: 58, hair: 'long', clothes: 'vocab.purple', ground: 76 }),
    path('M 34 55 A 16 30 0 0 0 66 55', { s: 'vocab.red', sw: 3 }),
  ],

  // bicycle, side view
  'sport-bicycle': [
    ...bikeWheel(29, 64),
    ...bikeWheel(71, 64),
    limb([29, 64], [48, 64], 4.5, { f: 'vocab.red', ...DETAIL }),
    limb([29, 64], [42, 40], 4.5, { f: 'vocab.red', ...DETAIL }),
    limb([48, 64], [42, 40], 4.5, { f: 'vocab.red', ...DETAIL }),
    limb([42, 40], [64, 40], 4.5, { f: 'vocab.red', ...DETAIL }),
    limb([48, 64], [64, 40], 4.5, { f: 'vocab.red', ...DETAIL }),
    limb([64, 40], [71, 64], 4.5, { f: 'vocab.red', ...DETAIL }),
    path('M 64 40 L 62 30 L 70 29', INK),
    ellipse(40, 35, 8, 3.5, INK_FILL),
    line(41, 38, 42, 40, INK),
    circle(48, 64, 4, { f: 'surface.paper', ...DETAIL }),
    line(48, 64, 54, 70, INK),
  ],

  // skier, skis, poles: crouched, going down a snowy slope to the right
  'sport-skiing': [
    path('M 12 70 Q 46 72 88 86 H 12 Z', { f: 'brand.secondaryLight', ...INK }),
    line(70, 50, 76, 76, DETAIL),
    limb([18, 64], [86, 80], 4, { f: 'vocab.red', ...DETAIL }),
    limb([46, 54], [60, 62], 9, INK_FILL),
    limb([60, 62], [52, 72], 9, INK_FILL),
    limb([44, 54], [56, 36], 15, { f: 'vocab.blue', ...INK }),
    limb([56, 40], [68, 50], 7, { f: 'vocab.blue', ...INK }),
    hand([69, 51]),
    line(62, 50, 52, 74, DETAIL),
    ...head(60, 26, 9.5, 'vocab.red'),
  ],

  // striped rubber playground ball
  'sport-ball': [
    groundShadow(50, 84, 24),
    circle(50, 49, 31, { f: 'vocab.red', ...INK }),
    path('M 19.4 43 Q 50 52 80.6 43 L 80.9 53 Q 50 62 19.1 53 Z', { f: 'surface.paper', ...DETAIL }),
    path('M 21.8 62 Q 50 71 78.2 62 L 74.5 69 Q 50 77 25.5 69 Z', { f: 'vocab.blue', ...DETAIL }),
    leaf(32, 28, 44, 22, 3, { f: 'surface.paper', o: 0.55 }),
    rim(50, 49, 31),
  ],
};
