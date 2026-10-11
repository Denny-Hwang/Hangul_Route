/**
 * WordArt builders (F-VOC-002 §3.2, W2). Glyphs are written with these, not
 * with raw path strings: each returns plain shapes, rounds every coordinate to
 * one decimal and takes its paint last. Pure and deterministic.
 */
import { formatNumber as n, isWordArtPath } from './path';
import type { WordArtPaint, WordArtShape } from './types';

export type Pt = readonly [number, number];

/** Round to one decimal; `-0` becomes `0`. */
export function r1(v: number): number {
  return Math.round(v * 10) / 10 + 0;
}

const pt = ([x, y]: Pt): string => `${n(x)} ${n(y)}`;

export function circle(x: number, y: number, r: number, paint: WordArtPaint = {}): WordArtShape {
  return { t: 'circle', x: r1(x), y: r1(y), r: r1(r), ...paint };
}

export function ellipse(x: number, y: number, rx: number, ry: number, paint: WordArtPaint = {}): WordArtShape {
  return { t: 'ellipse', x: r1(x), y: r1(y), rx: r1(rx), ry: r1(ry), ...paint };
}

/** A rectangle; corner radius `r` (0 for square corners). */
export function rect(x: number, y: number, w: number, h: number, r: number, paint: WordArtPaint = {}): WordArtShape {
  const corner = r1(r);
  return { t: 'rect', x: r1(x), y: r1(y), w: r1(w), h: r1(h), ...(corner > 0 ? { r: corner } : {}), ...paint };
}

/** The escape hatch for a hand-written curve; throws when `d` is outside the §3.1 grammar. */
export function path(d: string, paint: WordArtPaint = {}): WordArtShape {
  if (!isWordArtPath(d)) throw new Error(`WordArt path outside the grammar (absolute M L H V C Q A Z, one decimal): ${d}`);
  return { t: 'path', d, ...paint };
}

export function line(x1: number, y1: number, x2: number, y2: number, paint: WordArtPaint = {}): WordArtShape {
  return path(`M ${pt([x1, y1])} L ${pt([x2, y2])}`, paint);
}

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * A closed polygon. With `round` > 0 each corner is cut `round` units along
 * both edges (at most half the edge) and joined by a quadratic whose control
 * point is the corner.
 */
export function poly(points: readonly Pt[], paint: WordArtPaint = {}, round = 0): WordArtShape {
  if (points.length < 3) throw new Error('poly needs at least three points');
  if (round <= 0) return path(`M ${points.map(pt).join(' L ')} Z`, paint);
  const count = points.length;
  const corner = (i: number): { cur: Pt; inPt: Pt; outPt: Pt } => {
    const prev = points[(i - 1 + count) % count]!;
    const cur = points[i]!;
    const next = points[(i + 1) % count]!;
    const cutIn = Math.min(round, dist(prev, cur) / 2);
    const cutOut = Math.min(round, dist(cur, next) / 2);
    return { cur, inPt: lerp(cur, prev, cutIn / dist(prev, cur)), outPt: lerp(cur, next, cutOut / dist(cur, next)) };
  };
  const corners = points.map((_, i) => corner(i));
  const start = corners[count - 1]!.outPt;
  const segments = corners.map(({ cur, inPt, outPt }) => `L ${pt(inPt)} Q ${pt(cur)} ${pt(outPt)}`);
  // the first corner is reached from the last corner's out point
  return path(`M ${pt(start)} ${segments.join(' ')} Z`, paint);
}

/** Cubic Bezier controls of the Catmull-Rom segment p1 -> p2 (tension 0.5). */
function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt): string {
  const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  return `C ${pt(c1)} ${pt(c2)} ${pt(p2)}`;
}

/** A smooth closed curve through every point (fruit, bread, clouds, bodies). */
export function blob(points: readonly Pt[], paint: WordArtPaint = {}): WordArtShape {
  if (points.length < 3) throw new Error('blob needs at least three points');
  const count = points.length;
  const at = (i: number): Pt => points[((i % count) + count) % count]!;
  const segments = points.map((_, i) => catmull(at(i - 1), at(i), at(i + 1), at(i + 2)));
  return path(`M ${pt(points[0]!)} ${segments.join(' ')} Z`, paint);
}

/** A smooth open curve through every point (smiles, stems, whiskers, noodles). */
export function curve(points: readonly Pt[], paint: WordArtPaint = {}): WordArtShape {
  if (points.length < 2) throw new Error('curve needs at least two points');
  const last = points.length - 1;
  const at = (i: number): Pt => points[Math.max(0, Math.min(last, i))]!;
  const segments = points.slice(1).map((_, i) => catmull(at(i - 1), at(i), at(i + 1), at(i + 2)));
  return path(`M ${pt(points[0]!)} ${segments.join(' ')}`, paint);
}

/** A pointed oval from tip (x1, y1) to tip (x2, y2), `halfWidth` at the middle (leaves, petals, wings). */
export function leaf(x1: number, y1: number, x2: number, y2: number, halfWidth: number, paint: WordArtPaint = {}): WordArtShape {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len];
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const off = 2 * halfWidth; // a quadratic reaches half its control offset at t = 0.5
  return path(`M ${pt([x1, y1])} Q ${pt([mx - nx * off, my - ny * off])} ${pt([x2, y2])} Q ${pt([mx + nx * off, my + ny * off])} ${pt([x1, y1])} Z`, paint);
}

const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** An open circular arc from angle `a0` to `a1` in degrees (0 = right, clockwise on screen). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, paint: WordArtPaint = {}): WordArtShape {
  const span = a1 - a0;
  if (Math.abs(span) >= 360) throw new Error('arc spans a full turn: use circle');
  const large = Math.abs(span) > 180 ? 1 : 0;
  const sweep = span > 0 ? 1 : 0;
  const start = pt(polar(cx, cy, r, a0));
  const end = pt(polar(cx, cy, r, a1));
  // an svg arc whose ends coincide after rounding draws nothing: the stroke would vanish silently
  if (start === end) throw new Error(`arc from ${a0} to ${a1} degrees has no length after rounding: use circle, or a longer arc`);
  return path(`M ${start} A ${n(r)} ${n(r)} 0 ${large} ${sweep} ${end}`, paint);
}

/** A water drop: tip at (cx, top), round bottom of the given width ending at `bottom`. */
export function drop(cx: number, top: number, bottom: number, width: number, paint: WordArtPaint = {}): WordArtShape {
  const rr = width / 2;
  const cy = bottom - rr;
  const shoulder = top + (cy - top) * 0.4;
  return path(
    `M ${pt([cx, top])} C ${pt([cx + rr * 0.2, shoulder])} ${pt([cx + rr, cy - rr * 0.6])} ${pt([cx + rr, cy])} ` +
      `A ${n(rr)} ${n(rr)} 0 0 1 ${pt([cx - rr, cy])} C ${pt([cx - rr, cy - rr * 0.6])} ${pt([cx - rr * 0.2, shoulder])} ${pt([cx, top])} Z`,
    paint,
  );
}

/** A star of `points` tips, the first straight up; `round` rounds its corners like `poly`. */
export function star(cx: number, cy: number, outerR: number, innerR: number, points: number, paint: WordArtPaint = {}, round = 0): WordArtShape {
  if (points < 3) throw new Error('star needs at least three points');
  const verts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) verts.push(polar(cx, cy, i % 2 === 0 ? outerR : innerR, -90 + (180 / points) * i));
  return poly(verts, paint, round);
}

/** The flat shadow under a standing object: `hoya.furDark` at opacity 0.18 (§3.2). */
export function groundShadow(cx = 50, y = 88, rx = 30): WordArtShape {
  return ellipse(cx, y, rx, rx * 0.15, { f: 'hoya.furDark', o: 0.18 });
}

export interface FaceOptions {
  /** Two `hoya.cheek` blush dots under the eyes. */
  cheeks?: boolean;
}

/**
 * Two ink eyes and a smile centred on (x, y), sized by `scale` (1 = a face
 * about 36 units wide). There is no frown or neutral option: every face
 * smiles (heritage-card-art.md §3, F-VOC-002 C5). The detail stroke stays 2 at
 * any scale (C3).
 */
export function face(x: number, y: number, scale: number, options: FaceOptions = {}): WordArtShape[] {
  const s = scale;
  const shapes: WordArtShape[] = [
    circle(x - 9 * s, y, 3 * s, { f: 'text.primary' }),
    circle(x + 9 * s, y, 3 * s, { f: 'text.primary' }),
    // from lower right to lower left through the bottom: a smile
    arc(x, y + 3 * s, 6 * s, 30, 150, { s: 'text.primary', sw: 2 }),
  ];
  if (options.cheeks) shapes.push(circle(x - 15 * s, y + 6 * s, 3.5 * s, { f: 'hoya.cheek' }), circle(x + 15 * s, y + 6 * s, 3.5 * s, { f: 'hoya.cheek' }));
  return shapes;
}
