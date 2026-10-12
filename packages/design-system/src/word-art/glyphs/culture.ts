/**
 * WordArt K-Culture glyphs (F-VOC-002 §3.9, briefs in §3.12), drawn in batch
 * W-6 under the heritage accuracy bar (C11). Keys are written without the
 * `word:` prefix. The other five K-Culture words reuse Heritage card art
 * (hanbok, seollal, chuseok, yutnori, gayageum; §3.11).
 */
import { circle, ellipse, groundShadow, leaf, line, path, poly, pts, rect } from '../builders';
import { formatNumber as n } from '../path';
import type { WordArtGlyph, WordArtShape, WordArtTone } from '../types';
import { hand, head, limb } from './pose';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const INK_FILL = { f: 'text.primary', ...INK } as const;

/**
 * A toy block in three-quarter view: the front face (x, y, w, h), the top face
 * and the right side face receding `d` units up and to the right.
 */
function block(x: number, y: number, w: number, h: number, d: number, f: WordArtTone): WordArtShape[] {
  return [
    poly(pts(x, y, x + d, y - d, x + w + d, y - d, x + w, y), { f, ...INK }, 1),
    poly(pts(x + w, y, x + w + d, y - d, x + w + d, y + h - d, x + w, y + h), { f, ...INK }, 1),
    rect(x, y, w, h, 1.5, { f, ...INK }),
  ];
}

/** An open folding fan pinned at the hand (hx, hy), spanning `a0`..`a1` degrees, with its ribs. */
function fan(hx: number, hy: number, r: number, a0: number, a1: number): WordArtShape[] {
  const at = (deg: number, rr = r): string => `${n(hx + rr * Math.cos((deg * Math.PI) / 180))} ${n(hy + rr * Math.sin((deg * Math.PI) / 180))}`;
  const ribs = [1, 2, 3].map((i) => a0 + ((a1 - a0) * i) / 4);
  return [
    path(`M ${hx} ${hy} L ${at(a0)} A ${r} ${r} 0 0 1 ${at(a1)} Z`, { f: 'vocab.pink', ...INK }),
    path(`M ${at(a0, r - 4)} A ${r - 4} ${r - 4} 0 0 1 ${at(a1, r - 4)}`, { s: 'surface.paper', sw: 3 }),
    path(ribs.map((a) => `M ${hx} ${hy} L ${at(a, r - 5)}`).join(' '), DETAIL),
  ];
}

/** A wedge of an ellipse (centre cx, cy; radii rx, ry) from 40 % of the radius to the rim, between two angles: one topping. */
function wedge(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, f: WordArtTone): WordArtShape {
  const p = (deg: number, t: number): string => `${n(cx + rx * t * Math.cos((deg * Math.PI) / 180))} ${n(cy + ry * t * Math.sin((deg * Math.PI) / 180))}`;
  const steps = [0, 1, 2, 3].map((i) => a0 + ((a1 - a0) * i) / 3);
  return path(`M ${p(a0, 0.4)} L ${steps.map((a) => p(a, 0.95)).join(' L ')} L ${p(a1, 0.4)} Z`, { f, ...DETAIL });
}

/** A rice-cake piece (garae-tteok, a short white cylinder) lying from a to b. */
const tteok = (a: readonly [number, number], b: readonly [number, number]): WordArtShape => limb(a, b, 7.5, { f: 'vocab.white', ...DETAIL });

export const CULTURE_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // abstract blocks of a circle, a square and a bar: toy blocks in three of the
  // five traditional colours (obangsaek), alluding to the shapes Hangul is built
  // from; no letter is drawn, and every shape is a solid, not a stroke
  'culture-hangul': [
    groundShadow(50, 84, 36),
    ...block(14, 66, 62, 14, 8, 'vocab.yellow'),
    ...block(20, 38, 22, 22, 6, 'vocab.blue'),
    circle(63, 47, 12, { f: 'vocab.red', ...INK }),
    leaf(56, 44, 60, 38, 2.5, { f: 'surface.paper', o: 0.55 }),
  ],

  // tiled curved roof, wooden pillars, door: a giwa roof whose eaves lift at both
  // ends, a ridge, a timber frame with white walls, a lattice door on a stone base
  'culture-hanok': [
    groundShadow(50, 87, 38),
    rect(16, 76, 68, 10, 2, { f: 'vocab.gray', ...INK }),
    rect(22, 46, 56, 30, 0, { f: 'surface.paper', ...INK }),
    rect(40, 54, 20, 22, 1, { f: 'surface.paper', ...INK }),
    path('M 45 54 V 76 M 50 54 V 76 M 55 54 V 76 M 40 59.5 H 60 M 40 65 H 60 M 40 70.5 H 60', { s: 'vocab.brown', sw: 2 }),
    rect(21, 46, 6, 30, 1, { f: 'vocab.brown', ...INK }),
    rect(73, 46, 6, 30, 1, { f: 'vocab.brown', ...INK }),
    rect(18, 44, 64, 5, 1, { f: 'vocab.brown', ...INK }),
    path('M 12 38 Q 26 48 50 47 Q 74 48 88 38 Q 80 35 76 27 L 24 27 Q 20 35 12 38 Z', { f: 'vocab.gray', ...INK }),
    path('M 30 28 L 26 44 M 38 28 L 36 46 M 46 28 L 45 46.5 M 54 28 L 55 46.5 M 62 28 L 64 46 M 70 28 L 74 44', DETAIL),
    path('M 20 23 Q 50 28 80 23 L 79 28.5 Q 50 32 21 28.5 Z', INK_FILL),
  ],

  // stone bowl, colourful toppings, egg: dolsot bibimbap seen from a little
  // above, namul in wedges round a fried egg (spinach, carrot, bean sprouts)
  'culture-bibimbap': [
    groundShadow(50, 86, 34),
    path('M 14 50 Q 16 84 50 85 Q 84 84 86 50 Z', INK_FILL),
    leaf(22, 62, 30, 76, 2.5, { f: 'surface.paper', o: 0.55 }),
    ellipse(50, 48, 36, 17, INK_FILL),
    ellipse(50, 47.5, 31, 14, { f: 'surface.paper' }),
    ...(['vocab.green', 'vocab.orange', 'vocab.yellow', 'vocab.green', 'vocab.orange', 'vocab.yellow'] as const).map((f, k) => wedge(50, 47.5, 30, 13.5, k * 60 + 5, k * 60 + 55, f)),
    ellipse(50, 47, 12, 7, { f: 'surface.paper', ...DETAIL }),
    circle(51, 46.5, 4, { f: 'vocab.yellow', ...DETAIL }),
  ],

  // bowl, red-orange sauce, white rice-cake pieces, a little spring onion, steam
  'culture-tteokbokki': [
    path('M 38 30 Q 35 25 38 20 Q 41 15 38 10', { s: 'border.strong', sw: 3 }),
    path('M 56 30 Q 53 25 56 20 Q 59 15 56 10', { s: 'border.strong', sw: 3 }),
    path('M 12 54 Q 14 84 50 84 Q 86 84 88 54 Z', { f: 'surface.sunken', ...INK }),
    ellipse(50, 54, 38, 14, { f: 'surface.sunken', ...INK }),
    ellipse(50, 54, 32, 10.5, { f: 'stage.stage1', ...DETAIL }),
    tteok([28, 52], [42, 49]),
    tteok([46, 58], [60, 55]),
    tteok([54, 47], [68, 50]),
    tteok([30, 59], [40, 61]),
    tteok([64, 59], [74, 55]),
    ...pts(45, 50, 73, 52).map(([x, y]) => circle(x, y, 2.5, { f: 'vocab.green', ...DETAIL })),
  ],

  // two music notes and sound arcs: a pair of beamed eighth notes
  'culture-song': [
    path('M 35 72 V 30 M 65 64 V 22', INK),
    poly(pts(35, 28, 65, 20, 65, 29, 35, 37), INK_FILL, 1),
    ellipse(27, 72, 9.5, 7.5, { f: 'brand.primary', ...INK }),
    ellipse(57, 64, 9.5, 7.5, { f: 'brand.primary', ...INK }),
    path('M 74 40 A 9 9 0 0 1 74 56 M 79 34 A 15 15 0 0 1 79 62', { s: 'brand.secondary', sw: 3 }),
  ],

  // figure with raised arms and a fan: a fan in each hand, as in the fan dance
  'culture-dance': [
    groundShadow(50, 87, 18),
    limb([46, 68], [43, 84], 8, INK_FILL),
    limb([54, 68], [62, 80], 8, INK_FILL),
    limb([44, 54], [32, 36], 7, { f: 'brand.secondary', ...INK }),
    limb([56, 54], [68, 36], 7, { f: 'brand.secondary', ...INK }),
    ...fan(31, 34, 15, 190, 300),
    ...fan(69, 34, 15, 240, 350),
    hand([31, 34]),
    hand([69, 34]),
    poly(pts(42, 50, 58, 50, 63, 72, 37, 72), { f: 'brand.secondary', ...INK }, 4),
    ...head(50, 40, 9, 'text.secondary'),
  ],

  // TV screen with a play triangle
  'culture-drama': [
    path('M 50 22 L 38 11 M 50 22 L 62 11', INK),
    circle(38, 11, 2.5, INK_FILL),
    circle(62, 11, 2.5, INK_FILL),
    path('M 34 72 L 28 84 M 66 72 L 72 84', INK),
    rect(14, 22, 72, 52, 8, INK_FILL),
    rect(20, 28, 60, 40, 4, { f: 'brand.secondary', ...DETAIL }),
    poly(pts(43, 37, 61, 48, 43, 59), { f: 'surface.paper', ...DETAIL }, 2),
    line(14, 84, 86, 84, INK),
  ],
};
