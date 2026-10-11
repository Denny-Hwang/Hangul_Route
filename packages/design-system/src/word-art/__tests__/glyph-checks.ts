/**
 * Test-only measurements of a WordArt glyph (F-VOC-002 §3.5): extents for the
 * C1 range and C2 bounding-box checks, and the fill-tone count of C4. They live
 * under __tests__ so they are not shipped (and do not count towards W7).
 */
import { parsePath } from '../path';
import type { WordArtGlyph, WordArtShape } from '../types';

export type Point = readonly [number, number];

/** Outline ink: the default outline and detail colour, never counted as a fill tone (§3.3). */
export const INK = 'text.primary';

/** Opacity below this is a shadow, not the subject: left out of the bbox and the tone count. */
export const SHADOW_OPACITY = 0.5;

/** Points on the elliptical arc from (x0, y0) given the svg arc arguments (SVG 1.1 F.6.5), sampled. */
export function arcPoints(x0: number, y0: number, args: readonly number[], samples = 24): Point[] {
  let [rx, ry] = [Math.abs(args[0]!), Math.abs(args[1]!)];
  const phi = (args[2]! * Math.PI) / 180;
  const [large, sweep, x1, y1] = [args[3]!, args[4]!, args[5]!, args[6]!];
  if (rx === 0 || ry === 0 || (x0 === x1 && y0 === y1)) return [[x1, y1]];
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * yp) / ry;
  const cyp = (-coef * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number): number => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (sweep === 0 && dt > 0) dt -= 2 * Math.PI;
  if (sweep === 1 && dt < 0) dt += 2 * Math.PI;
  const out: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = t0 + (dt * i) / samples;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
  return out;
}

/** Points that bound a path: every end and control point, and sampled arcs (an upper bound, §3.5 C2). */
export function pathPoints(d: string): Point[] {
  const cmds = parsePath(d);
  if (!cmds) throw new Error(`path outside the grammar: ${d}`);
  const out: Point[] = [];
  let [x, y] = [0, 0];
  let [sx, sy] = [0, 0];
  for (const { c, a } of cmds) {
    switch (c) {
      case 'M':
        [x, y] = [a[0]!, a[1]!];
        [sx, sy] = [x, y];
        out.push([x, y]);
        break;
      case 'L':
        [x, y] = [a[0]!, a[1]!];
        out.push([x, y]);
        break;
      case 'H':
        x = a[0]!;
        out.push([x, y]);
        break;
      case 'V':
        y = a[0]!;
        out.push([x, y]);
        break;
      case 'C':
      case 'Q':
        for (let i = 0; i < a.length; i += 2) out.push([a[i]!, a[i + 1]!]);
        [x, y] = [a[a.length - 2]!, a[a.length - 1]!];
        break;
      case 'A':
        out.push(...arcPoints(x, y, a));
        [x, y] = [a[5]!, a[6]!];
        break;
      case 'Z':
        [x, y] = [sx, sy];
        break;
    }
  }
  return out;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Geometric extent of one shape (no stroke). */
export function shapeBox(shape: WordArtShape): Box {
  switch (shape.t) {
    case 'circle':
      return { minX: shape.x - shape.r, minY: shape.y - shape.r, maxX: shape.x + shape.r, maxY: shape.y + shape.r };
    case 'ellipse':
      return { minX: shape.x - shape.rx, minY: shape.y - shape.ry, maxX: shape.x + shape.rx, maxY: shape.y + shape.ry };
    case 'rect':
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
    case 'path': {
      const pts = pathPoints(shape.d);
      return {
        minX: Math.min(...pts.map((p) => p[0])),
        minY: Math.min(...pts.map((p) => p[1])),
        maxX: Math.max(...pts.map((p) => p[0])),
        maxY: Math.max(...pts.map((p) => p[1])),
      };
    }
  }
}

function union(boxes: readonly Box[]): Box {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

/** Extent of every shape, shadows included (C1). */
export function glyphExtent(glyph: WordArtGlyph): Box {
  return union(glyph.map(shapeBox));
}

/** Extent of the subject: shadows (opacity under 0.5) left out (C2). */
export function subjectBox(glyph: WordArtGlyph): Box {
  return union(glyph.filter((s) => (s.o ?? 1) >= SHADOW_OPACITY).map(shapeBox));
}

/** Distinct fill tones, without the ink and without shadows (C4, §3.3). */
export function fillTones(glyph: WordArtGlyph): string[] {
  const tones = new Set<string>();
  for (const s of glyph) if (s.f !== undefined && s.f !== INK && (s.o ?? 1) >= SHADOW_OPACITY) tones.add(s.f);
  return [...tones];
}
