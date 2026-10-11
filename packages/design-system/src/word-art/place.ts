/**
 * Placement of WordArt data (F-VOC-002 §3.1, §3.6): scale a glyph about the
 * origin, then move it. The path grammar has absolute commands only, so this
 * is plain arithmetic on the numbers. Stroke widths and opacity are kept, so
 * an outline stays 3 units at any size (C3). Pure.
 */
import { formatNumber as n, parsePath } from './path';
import { r1 } from './builders';
import type { WordArtGlyph, WordArtShape } from './types';

/** `x' = x * scale + dx`, `y' = y * scale + dy`. */
export interface Placement {
  dx: number;
  dy: number;
  scale: number;
}

function checkScale(scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError(`WordArt placement scale must be a positive number: ${String(scale)}`);
}

/** `d` moved and scaled; throws when `d` is outside the §3.1 grammar. */
export function placePath(d: string, { dx, dy, scale }: Placement): string {
  checkScale(scale);
  const cmds = parsePath(d);
  if (!cmds) throw new Error(`WordArt path outside the grammar: ${d}`);
  const x = (v: number): string => n(v * scale + dx);
  const y = (v: number): string => n(v * scale + dy);
  const len = (v: number): string => n(v * scale);
  return cmds
    .map(({ c, a }) => {
      switch (c) {
        case 'H':
          return `H ${x(a[0]!)}`;
        case 'V':
          return `V ${y(a[0]!)}`;
        case 'A':
          return `A ${len(a[0]!)} ${len(a[1]!)} ${n(a[2]!)} ${a[3]} ${a[4]} ${x(a[5]!)} ${y(a[6]!)}`;
        case 'Z':
          return 'Z';
        default:
          return [c, ...a.map((v, i) => (i % 2 === 0 ? x(v) : y(v)))].join(' ');
      }
    })
    .join(' ');
}

/** One shape moved and scaled, as a new object with the same paint. */
export function placeShape(shape: WordArtShape, placement: Placement): WordArtShape {
  const { dx, dy, scale } = placement;
  checkScale(scale);
  const X = (v: number): number => r1(v * scale + dx);
  const Y = (v: number): number => r1(v * scale + dy);
  const L = (v: number): number => r1(v * scale);
  switch (shape.t) {
    case 'circle':
      return { ...shape, x: X(shape.x), y: Y(shape.y), r: L(shape.r) };
    case 'ellipse':
      return { ...shape, x: X(shape.x), y: Y(shape.y), rx: L(shape.rx), ry: L(shape.ry) };
    case 'rect': {
      const { r, ...rest } = shape;
      const corner = r === undefined ? 0 : L(r);
      return { ...rest, x: X(shape.x), y: Y(shape.y), w: L(shape.w), h: L(shape.h), ...(corner > 0 ? { r: corner } : {}) };
    }
    case 'path':
      return { ...shape, d: placePath(shape.d, placement) };
  }
}

/** Every shape of `glyph` placed, in order; the source (often frozen registry data) is not touched. */
export function placeGlyph(glyph: WordArtGlyph, placement: Placement): WordArtShape[] {
  return glyph.map((shape) => placeShape(shape, placement));
}
