/**
 * The mastery ring's geometry (F-CURR-002 section 4.4, row CM-20; wireframe `design/wireframes/journey/mastery-ring.md`
 * A to D, mock `design/screens/mastery-ring/`). Pure numbers, no React, so the arcs are unit tested at every layout
 * class. Only the mastery chunk's ring (`screens/mastery/MasteryRing.tsx`) draws from it.
 *
 * The track is drawn in the 3 dp border box the cell already reserves (`borderWidth.thick`), so the ring adds no width:
 * - the **keyline**: 1 dp of `border.shape` on the inner side (its centre 2.5 dp in from the outer edge);
 * - the **band**: 2 dp of the column's theme token outside it (its centre 1 dp in), on filled segments only;
 * - the **halo** (Ready to refresh) and the two-pane **focus outline**: 2 dp just outside the cell (centre 1 dp out), in
 *   the grid's `spacing.xs` gap.
 * Each outline is the cell's rounded rectangle (`radii.md`), started at the top centre and drawn clockwise. Three
 * segments of equal arc length with three gaps of `spacing.xs`; the first gap is centred on the top edge, where the
 * Next triangle sits. Level 3 closes the gaps into one ring.
 */

/** The halo's opacity over the theme token (wireframe Constants): decorative, the sparkle and the label carry it. */
export const GLOW_OPACITY = 0.4;

export interface Outline {
  /** An SVG path from the top centre, clockwise. */
  d: string;
  /** Its length. */
  length: number;
}

const f = (n: number): string => (Math.round(n * 1000) / 1000).toString();

/**
 * The outline of a `width` x `height` rounded rectangle (outer corner `radius`) inset by `inset` (negative: outside),
 * as drawn in an SVG whose origin is `origin` dp up and left of the rectangle.
 */
export function outlinePath(width: number, height: number, inset: number, radius: number, origin = 0): Outline {
  const r = Math.max(0, Math.min(radius - inset, (width - 2 * inset) / 2, (height - 2 * inset) / 2));
  const x0 = origin + inset;
  const y0 = origin + inset;
  const x1 = origin + width - inset;
  const y1 = origin + height - inset;
  const cx = origin + width / 2;
  const arc = (x: number, y: number): string => `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y)}`;
  const d = [
    `M${f(cx)} ${f(y0)}`,
    `H${f(x1 - r)}`,
    arc(x1, y0 + r),
    `V${f(y1 - r)}`,
    arc(x1 - r, y1),
    `H${f(x0 + r)}`,
    arc(x0, y1 - r),
    `V${f(y0 + r)}`,
    arc(x0 + r, y0),
    'Z',
  ].join(' ');
  const length = 2 * (x1 - x0 - 2 * r) + 2 * (y1 - y0 - 2 * r) + 2 * Math.PI * r;
  return { d, length };
}

export interface Segment {
  /** Where the segment starts along the outline, from the top centre. */
  start: number;
  /** Its arc length. */
  arc: number;
}

/** `count` segments of equal arc length with `gap` between them, the first gap centred on the start (the top centre). */
export function ringSegments(length: number, gap: number, count = 3): Segment[] {
  const arc = Math.max(0, (length - count * gap) / count);
  return Array.from({ length: count }, (_, i) => ({ start: gap / 2 + i * (arc + gap), arc }));
}

/** A segment as SVG dash props: one dash of its arc, a gap of the whole outline, offset to its start. */
export function segmentDash(segment: Segment, length: number): { strokeDasharray: string; strokeDashoffset: number } {
  return { strokeDasharray: `${f(segment.arc)} ${f(length)}`, strokeDashoffset: -segment.start };
}

export interface RingTokens {
  /** The cell's outer corner radius (`radii.md`). */
  radius: number;
  /** The segment gap (`spacing.xs`). */
  gap: number;
  /** The track (`borderWidth.thick`): the band and the keyline. */
  track: number;
  /** The keyline (`borderWidth.thin`). */
  keyline: number;
  /** The halo and the focus outline (`borderWidth.base`), drawn outside the cell. */
  outside: number;
}

export interface RingLayers {
  /** The SVG's margin round the cell, holding the halo and the focus outline. */
  margin: number;
  band: Outline & { width: number; segments: Segment[] };
  keyline: Outline & { width: number; segments: Segment[] };
  /** The halo and the focus outline share this outline. */
  outside: Outline & { width: number };
}

/** The ring's three outlines for a cell of `width` x `height` (its border box), in an SVG `margin` dp larger each side. */
export function ringLayers(width: number, height: number, t: RingTokens): RingLayers {
  const margin = t.outside;
  const bandWidth = t.track - t.keyline;
  const band = outlinePath(width, height, bandWidth / 2, t.radius, margin);
  const keyline = outlinePath(width, height, bandWidth + t.keyline / 2, t.radius, margin);
  const outside = outlinePath(width, height, -t.outside / 2, t.radius, margin);
  return {
    margin,
    band: { ...band, width: bandWidth, segments: ringSegments(band.length, t.gap) },
    keyline: { ...keyline, width: t.keyline, segments: ringSegments(keyline.length, t.gap) },
    outside: { ...outside, width: t.outside },
  };
}

/**
 * The 48 dp circle of the level-up banner (wireframe G, E): three equal arcs round a circle of `size`, with the same
 * gaps, started at the top. Returns the circle's radius at the band's centre and each segment's dash.
 */
export function circleRing(size: number, t: Pick<RingTokens, 'gap' | 'track'>): { r: number; length: number; segments: Segment[] } {
  const r = size / 2 - t.track / 2;
  const length = 2 * Math.PI * r;
  return { r, length, segments: ringSegments(length, t.gap) };
}
