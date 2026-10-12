/**
 * WordArt nature glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `nature-cloud` (also the sky-blue swatch object, §3.6.1); batch W-3
 * draws `nature-flower` and W-5 the other seven. Keys are written without
 * the `word:` prefix.
 */
import { blob, circle, curve, drop, face, groundShadow, leaf, path, poly, pts, rect, star } from '../builders';
import type { Pt } from '../builders';
import type { WordArtGlyph, WordArtPaint, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

/** A six-armed snowflake outline: three bars of half-width `w` and half-length `len` crossing at (cx, cy). */
function flake(cx: number, cy: number, len: number, w: number): Pt[] {
  const out: Pt[] = [];
  const p = (r: number, deg: number): Pt => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const tip = (Math.atan(w / len) * 180) / Math.PI;
  for (let k = 0; k < 6; k++) {
    const a = k * 60 - 90;
    out.push(p(Math.hypot(len, w), a - tip), p(Math.hypot(len, w), a + tip), p(2 * w, a + 30));
  }
  return out;
}

/**
 * One outline around overlapping puffs: each puff is drawn outlined, then
 * again 1.5 smaller without a stroke on top, which hides the inner outlines.
 */
function puffs(parts: readonly (readonly [number, number, number])[], base: readonly [number, number, number, number], paint: WordArtPaint): WordArtShape[] {
  const [bx, by, bw, bh] = base;
  const outlined = [rect(bx, by, bw, bh, bh / 2, { ...paint, ...INK }), ...parts.map(([x, y, r]) => circle(x, y, r, { ...paint, ...INK }))];
  const fills = [rect(bx + 1.5, by + 1.5, bw - 3, bh - 3, bh / 2 - 1.5, paint), ...parts.map(([x, y, r]) => circle(x, y, r - 1.5, paint))];
  return [...outlined, ...fills];
}

/** The river's centre line and width, top (far) to bottom (near). */
const RIVER: readonly (readonly [number, number, number])[] = [
  [17, 62, 8],
  [32, 48, 13],
  [48, 58, 18],
  [65, 42, 25],
  [83, 46, 34],
];

/** The river band, `extra` units wider on each side (the bank strip is the band at `extra` 10). */
function river(extra: number, paint: WordArtPaint): WordArtShape {
  const left = RIVER.map(([y, c, w]): Pt => [c - w / 2 - extra, y]);
  const right = RIVER.map(([y, c, w]): Pt => [c + w / 2 + extra, y]).reverse();
  return blob([...left, ...right], paint);
}

export const NATURE_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // cloud (prototype)
  'nature-cloud': [
    ...puffs(
      [
        [33, 55, 14],
        [50, 44, 19],
        [68, 52, 15],
      ],
      [18, 52, 66, 20],
      { f: 'surface.paper' },
    ),
    curve(
      [
        [56, 64],
        [63, 66],
        [70, 63],
      ],
      { s: 'brand.secondaryLight', sw: 3 },
    ),
  ],
  // pink flower on a stem (the pink swatch's object, §3.6.1): five petals round a yellow centre, two leaves
  'nature-flower': [
    groundShadow(50, 86, 16),
    rect(47.5, 44, 5, 42, 2.5, { f: 'vocab.green', ...INK }),
    leaf(50, 76, 30, 62, 6, { f: 'vocab.green', ...INK }),
    leaf(50, 70, 70, 56, 6, { f: 'vocab.green', ...INK }),
    ...[0, 72, 144, 216, 288].map((a) => circle(50 + 13 * Math.sin((a * Math.PI) / 180), 35 - 13 * Math.cos((a * Math.PI) / 180), 10, { f: 'vocab.pink', ...INK })),
    circle(50, 35, 8, { f: 'hoya.fur', ...INK }),
  ],

  // sky-blue field, two clouds, no sun: a dome of sky over a low green line of hills
  'nature-sky': [
    path('M 14 74 V 52 A 36 36 0 0 1 86 52 V 74 Q 86 80 80 80 H 20 Q 14 80 14 74 Z', { f: 'vocab.skyBlue', ...INK }),
    ...puffs(
      [
        [32, 42, 7],
        [40, 38, 8],
      ],
      [24, 40, 26, 9],
      { f: 'surface.paper' },
    ),
    ...puffs(
      [
        [58, 56, 7],
        [67, 52, 8],
      ],
      [50, 55, 28, 9],
      { f: 'surface.paper' },
    ),
    path('M 14 70 Q 30 62 46 70 Q 64 61 86 69 V 74 Q 86 80 80 80 H 20 Q 14 80 14 74 Z', { f: 'stage.stage3', ...INK }),
  ],

  // yellow sun, rays, smile
  'nature-sun': [
    star(50, 50, 37, 27, 12, { f: 'vocab.orange', ...INK }, 2),
    circle(50, 50, 24, { f: 'vocab.yellow', ...INK }),
    ...face(50, 48, 1, { cheeks: true }),
  ],

  // yellow star, smile, sparkles
  'nature-star': [
    star(50, 54, 33, 15, 5, { f: 'vocab.yellow', ...INK }, 3),
    ...face(50, 57, 0.75),
    star(22, 26, 7, 2.5, 4, { f: 'brand.secondaryLight', ...DETAIL }, 1),
    star(80, 22, 6, 2, 4, { f: 'brand.secondaryLight', ...DETAIL }, 1),
    star(80, 76, 6, 2, 4, { f: 'brand.secondaryLight', ...DETAIL }, 1),
  ],

  // green round crown, brown trunk
  'nature-tree': [
    groundShadow(50, 87, 22),
    poly(pts(43, 87, 46, 56, 54, 56, 57, 87), { f: 'vocab.brown', ...INK }, 2),
    blob(pts(50, 13, 66, 16, 78, 29, 80, 45, 72, 59, 56, 65, 44, 65, 28, 59, 20, 45, 22, 29, 34, 16), { f: 'vocab.green', ...INK }),
    ...pts(36, 32, 60, 28, 66, 48, 42, 52).map(([x, y]) => circle(x, y, 5, { f: 'stage.stage3' })),
  ],

  // gray-blue cloud, drops, small umbrella
  'nature-rain': [
    ...puffs(
      [
        [34, 32, 11],
        [50, 25, 15],
        [66, 31, 12],
      ],
      [20, 30, 62, 16],
      { f: 'vocab.gray' },
    ),
    drop(28, 52, 66, 9, { f: 'vocab.blue', ...DETAIL }),
    drop(46, 56, 70, 9, { f: 'vocab.blue', ...DETAIL }),
    drop(34, 72, 86, 9, { f: 'vocab.blue', ...DETAIL }),
    path('M 72 72 V 82 A 3.5 3.5 0 0 1 65 82', INK),
    path('M 56 72 A 16 16 0 0 1 88 72 Q 80 67.5 72 72 Q 64 67.5 56 72 Z', { f: 'vocab.red', ...INK }),
  ],

  // snowflake and falling dots: a white six-armed flake, pale blue dots round it
  'nature-snow': [
    poly(flake(50, 50, 33, 5), { f: 'vocab.white', ...INK }, 1.5),
    path(
      [0, 60, 120, 180, 240, 300]
        .map((a) => {
          const at = (r: number, d: number): string => `${Math.round((50 + r * Math.cos(((a - 90 + d) * Math.PI) / 180)) * 10) / 10} ${Math.round((50 + r * Math.sin(((a - 90 + d) * Math.PI) / 180)) * 10) / 10}`;
          return `M ${at(28, -20)} L ${at(18, 0)} L ${at(28, 20)}`;
        })
        .join(' '),
      DETAIL,
    ),
    circle(50, 50, 6, { f: 'brand.secondaryLight', ...DETAIL }),
    ...pts(20, 24, 82, 30, 18, 72, 80, 78).map(([x, y]) => circle(x, y, 4, { f: 'brand.secondaryLight', ...DETAIL })),
  ],

  // blue winding stream, green banks: the stream bends towards the viewer, widening, between two strips of bank
  'nature-river': [
    river(10, { f: 'stage.stage3', ...INK }),
    river(0, { f: 'vocab.skyBlue', ...INK }),
    curve(pts(38, 74, 42, 72, 46, 74, 50, 72), { s: 'surface.paper', sw: 2 }),
    curve(pts(55, 47, 58, 45, 61, 47), { s: 'surface.paper', sw: 2 }),
    circle(30, 30, 6, { f: 'vocab.green', ...DETAIL }),
    circle(74, 70, 7, { f: 'vocab.green', ...DETAIL }),
  ],
};
