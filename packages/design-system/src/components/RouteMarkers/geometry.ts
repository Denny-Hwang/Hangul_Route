import { borderWidth, spacing, typography } from '../../tokens';
import { LATER_DASHES, PIP_SIZE, cursorMarkerParts, markerBand, pipParts, type PipPart } from '../PipRow/geometry';

/**
 * Route marks geometry (F-ENT-003 section 3.7, 3.14; design/components/RouteMarkers/spec.md).
 * Pure data, no React. The three learner marks reuse the PipRow shapes so one shape means one
 * thing everywhere: **Next** is the pip row's cursor triangle, **In your plan** a solid ring,
 * **Not open yet** a dotted ring with the `later` pip's pattern. Every mark is a shape plus a
 * word (the word is in the legend, a chip or the label), never colour alone, and none is a lock.
 */

/** The three marks. */
export type RouteMarkKind = 'next' | 'inPlan' | 'notOpen';
/** The two rings drawn around a cell's art. */
export type RouteRingKind = Exclude<RouteMarkKind, 'next'>;

/** The order of the words in a cell label and of the legend items. */
export const ROUTE_MARK_ORDER: readonly RouteMarkKind[] = ['next', 'inPlan', 'notOpen'];

/** The ring on a compact Journey cell: the cell initial plus `spacing.md` (40); scaled with `useMediaSize`. */
export const ROUTE_RING_SIZE = typography.size.title + spacing.md;
/** The ring stroke (3, then 4 on regular and wide through `useMediaSize`): lighter than the initial it surrounds. */
export const ROUTE_RING_STROKE = borderWidth.thick;
/** The Next triangle is `cursorMarkerParts(NEXT_MARKER_BASE)`: 19.2 x 9.6 drawn, every layout class. */
export const NEXT_MARKER_BASE = spacing.xxl;
/** The Next tip sits this far below the cell's outer top edge (`borderWidth.base + spacing.xxs`). */
export const NEXT_TIP_INSET = borderWidth.base + spacing.xxs;
/** The legend and chip marks (`spacing.lg`). */
export const TAG_MARK_SIZE = spacing.lg;

const round = (n: number): number => Math.round(n * 100) / 100;

/** A ring of `size` with a `stroke` kept inside the box; the dotted one keeps the `later` pip's 8 dashes at 55 / 45. */
export function routeRingParts(kind: RouteRingKind, size: number, stroke: number): PipPart[] {
  const r = size / 2 - stroke / 2;
  const ring: Extract<PipPart, { kind: 'circle' }> = { kind: 'circle', cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'mark', strokeWidth: stroke };
  if (kind === 'inPlan') return [ring];
  const period = (2 * Math.PI * r) / LATER_DASHES;
  return [{ ...ring, dash: [period * 0.55, period * 0.45] }];
}

/** The Next triangle in its band (`NEXT_MARKER_BASE` wide, `markerBand(NEXT_MARKER_BASE)` high). */
export function nextMarkerParts(): PipPart[] {
  return cursorMarkerParts(NEXT_MARKER_BASE);
}

/** The y of the triangle's tip inside its band (the same formula as `cursorMarkerParts`). */
export function nextTipY(): number {
  return round(markerBand(NEXT_MARKER_BASE) - NEXT_MARKER_BASE * 0.12);
}

/**
 * The band's `top` inside the marked box, so the tip lands `tipInset` below the box's OUTER top edge
 * (a cell); a negative inset puts the tip above it (the episode row's number disc, E3-6). An absolute
 * child is placed from inside its parent's border (Yoga and CSS alike), so a bordered box passes its
 * border width as `edge` (a Journey cell: 2, or 3 when selected in two panes).
 */
export function nextMarkerTop(tipInset: number = NEXT_TIP_INSET, edge: number = 0): number {
  return tipInset - nextTipY() - edge;
}

/** The stage pip's cursor triangle (`cursorMarkerParts(PIP_SIZE.stage)`, 12 x 6) centred in a `size` box. */
function nextTagPath(size: number): string {
  const half = PIP_SIZE.stage * 0.3;
  const height = PIP_SIZE.stage * 0.3;
  const c = size / 2;
  const top = (size - height) / 2;
  return `M${round(c - half)} ${round(top)} L${round(c + half)} ${round(top)} L${round(c)} ${round(top + height)} Z`;
}

/** A 16 dp mark for the legend and the chips: the open and later pips, or the Next triangle centred in the box. */
export function tagMarkParts(kind: RouteMarkKind, size: number = TAG_MARK_SIZE): PipPart[] {
  switch (kind) {
    case 'next':
      return [{ kind: 'path', d: nextTagPath(size), fill: 'ink' }];
    case 'inPlan':
      return pipParts('open', size);
    case 'notOpen':
      return pipParts('later', size);
  }
}
