/**
 * Test-only measurements of a WordArt glyph (F-VOC-002 §3.5): extents for the
 * C1 range and C2 bounding-box checks, and the fill-tone count of C4. They live
 * under __tests__ so they are not shipped (and do not count towards W7).
 */
import { parsePath } from '../path';
import type { WordArtGlyph, WordArtShape } from '../types';

export type Point = readonly [number, number];

/**
 * Outline ink: the outline and detail colour, never counted as a fill tone
 * (§3.3). A small ink-filled detail (eyes from `face()`, pupils, wheels, a
 * nose) is part of the ink, not a fourth tone: otherwise every face would cost
 * a tone.
 */
export const INK = 'text.primary';

/** The ground-shadow tone (`groundShadow()`); below SHADOW_OPACITY it is the shadow, not a tone. */
export const SHADOW_TONE = 'hoya.furDark';

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

/** True for the ground shadow: the shadow tone below SHADOW_OPACITY. Any other faint fill is still a tone. */
export function isShadow(shape: WordArtShape): boolean {
  return shape.f === SHADOW_TONE && (shape.o ?? 1) < SHADOW_OPACITY;
}

/** Distinct fill tones, without the ink and without the ground shadow (C4, §3.3). */
export function fillTones(glyph: WordArtGlyph): string[] {
  const tones = new Set<string>();
  for (const s of glyph) if (s.f !== undefined && s.f !== INK && !isShadow(s)) tones.add(s.f);
  return [...tones];
}

/** C3: generated families may stroke dots at 1.5; a hand glyph uses 3 (outline) and 2 (detail) only. */
export const HAND_WIDTHS: readonly number[] = [2, 3];
export const GENERATED_WIDTHS: readonly number[] = [1.5, 2, 3];

/** C2: the subject covers 60-70 % of the width or height, with a 10 % tolerance, centred within 8 units. */
export const BBOX_MIN = 60 * 0.9;
export const BBOX_MAX = 70 * 1.1;
export const CENTRE_TOLERANCE = 8;

export interface GlyphCheckOptions {
  /** A generated family (`color`, `count`, `body`): 48 shapes, dots at 1.5, and the sticker halo (C3, C7). */
  generated?: boolean;
  /** Fill-tone allowance (C4); default 4. */
  maxTones?: number;
  /** C2 waiver. */
  bboxWaived?: boolean;
  /** The width of a paper halo stroke a generated glyph may draw behind a sticker or a ring. */
  haloWidth?: number;
}

/**
 * Every §3.5 rule a glyph's data can be tested for, as readable messages
 * (empty when the glyph passes). `glyphs.test.ts` runs the same rules one
 * `it` per rule on the registry; this runs them on generator output that is
 * not registered yet (the colour, count and body batches, W-3 and W-4).
 */
export function glyphViolations(glyph: WordArtGlyph, options: GlyphCheckOptions, isTone: (s: string) => boolean): string[] {
  const out: string[] = [];
  const widths = options.generated ? GENERATED_WIDTHS : HAND_WIDTHS;
  const maxShapes = options.generated ? 48 : 32;
  if (glyph.length === 0 || glyph.length > maxShapes) out.push(`C7: ${glyph.length} shapes (1..${maxShapes})`);
  for (const [i, s] of glyph.entries()) {
    if (s.f === undefined && s.s === undefined) out.push(`shape ${i} is not painted`);
    if (s.f !== undefined && !isTone(s.f)) out.push(`shape ${i} fill ${s.f} is not a word-art tone`);
    if (s.s !== undefined && !isTone(s.s)) out.push(`shape ${i} stroke ${s.s} is not a word-art tone`);
    if (s.t === 'path' && parsePath(s.d) === null) out.push(`shape ${i} path outside the grammar`);
    if (s.o !== undefined && (s.o < 0.1 || s.o > 1)) out.push(`shape ${i} opacity ${s.o}`);
    if (s.sw !== undefined) {
      const halo = options.generated === true && s.sw === options.haloWidth && s.s === 'surface.paper' && s.f === undefined;
      if (!halo && !widths.includes(s.sw)) out.push(`C3: shape ${i} stroke width ${s.sw}`);
      if (s.s === undefined) out.push(`shape ${i} has a width without a stroke`);
    }
  }
  const tones = fillTones(glyph).length;
  if (tones > (options.maxTones ?? 4)) out.push(`C4: ${tones} fill tones`);
  if (out.length > 0) return out;
  const box = glyphExtent(glyph);
  if (box.minX < -6 || box.minY < -6 || box.maxX > 106 || box.maxY > 106) out.push(`C1: extent ${JSON.stringify(box)}`);
  if (!options.bboxWaived) {
    const sub = subjectBox(glyph);
    const size = Math.max(sub.maxX - sub.minX, sub.maxY - sub.minY);
    if (size < BBOX_MIN || size > BBOX_MAX) out.push(`C2: subject size ${size.toFixed(1)}`);
    const [cx, cy] = [(sub.minX + sub.maxX) / 2, (sub.minY + sub.maxY) / 2];
    if (Math.abs(cx - 50) > CENTRE_TOLERANCE || Math.abs(cy - 50) > CENTRE_TOLERANCE) out.push(`C2: centre ${cx.toFixed(1)}, ${cy.toFixed(1)}`);
  }
  return out;
}
