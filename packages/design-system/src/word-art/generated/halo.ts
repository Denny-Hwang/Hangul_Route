/**
 * The paper halo of the generated families (F-VOC-002 §3.6): shapes drawn
 * again behind themselves with a wide `surface.paper` stroke and no fill, so a
 * sticker or a highlight ring stands off whatever it sits on, even when the
 * two share a colour (a red apple on the red swatch).
 */
import { formatNumber as n } from '../path';
import type { WordArtShape, WordArtTone } from '../types';

/** The halo tone. */
export const HALO_TONE: WordArtTone = 'surface.paper';

/** The halo stroke width: 2 units of paper show outside a 3-unit ink outline. */
export const HALO_WIDTH = 7;

/** The geometry of `shape` with the halo paint only (no fill, no opacity). */
export function haloOf(shape: WordArtShape): WordArtShape {
  const { f: _f, s: _s, sw: _sw, o: _o, ...geometry } = shape;
  return { ...geometry, s: HALO_TONE, sw: HALO_WIDTH };
}

const ellipseD = (cx: number, cy: number, rx: number, ry: number): string =>
  `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`;

/** The outline of one shape as path data in the §3.1 grammar (absolute commands only). */
export function outlineD(shape: WordArtShape): string {
  switch (shape.t) {
    case 'circle':
      return ellipseD(shape.x, shape.y, shape.r, shape.r);
    case 'ellipse':
      return ellipseD(shape.x, shape.y, shape.rx, shape.ry);
    case 'rect': {
      const { x, y, w, h } = shape;
      const r = Math.min(shape.r ?? 0, w / 2, h / 2);
      if (r <= 0) return `M ${n(x)} ${n(y)} H ${n(x + w)} V ${n(y + h)} H ${n(x)} Z`;
      const arc = (ex: number, ey: number): string => `A ${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}`;
      return [
        `M ${n(x + r)} ${n(y)} H ${n(x + w - r)}`,
        arc(x + w, y + r),
        `V ${n(y + h - r)}`,
        arc(x + w - r, y + h),
        `H ${n(x + r)}`,
        arc(x, y + h - r),
        `V ${n(y + r)}`,
        arc(x + r, y),
        'Z',
      ].join(' ');
    }
    case 'path':
      return shape.d;
  }
}

/**
 * One halo behind every shape of `shapes`, as a single compound path: the
 * stroke of a compound path is the stroke of each sub-path, so it paints the
 * same as one halo per shape, but costs one shape whatever the object (C7).
 * Undefined when there is nothing to halo.
 */
export function haloPath(shapes: readonly WordArtShape[]): WordArtShape | undefined {
  if (shapes.length === 0) return undefined;
  return { t: 'path', d: shapes.map(outlineD).join(' '), s: HALO_TONE, sw: HALO_WIDTH };
}
