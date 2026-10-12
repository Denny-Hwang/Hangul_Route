import { describe, expect, it } from 'vitest';
import geometrySource from '../geometry.ts?raw';
import ringSource from '../RouteRing.tsx?raw';
import nextSource from '../NextMarker.tsx?raw';
import legendSource from '../RouteLegend.tsx?raw';
import stickerSource from '../StickerIcon.tsx?raw';
import indexSource from '../index.ts?raw';
import { borderWidth, spacing, typography } from '../../../tokens';
import { LATER_DASHES, PIP_SIZE, cursorMarkerParts, markerBand, pipParts, type PipPart } from '../../PipRow/geometry';
import {
  NEXT_MARKER_BASE,
  NEXT_TIP_INSET,
  ROUTE_MARK_ORDER,
  ROUTE_RING_SIZE,
  ROUTE_RING_STROKE,
  TAG_MARK_SIZE,
  nextMarkerParts,
  nextMarkerTop,
  nextTipY,
  routeRingParts,
  tagMarkParts,
} from '../geometry';

/**
 * F-ENT-003 E3-5 (section 3.7, 3.14; design/components/RouteMarkers/spec.md, "Geometry" and
 * "Code (planned, E3-5)"): the Next triangle, the In your plan solid ring and the Not open yet
 * dotted ring are the PipRow shapes at Journey-cell and tag scale, so one shape means one thing.
 */

type Circle = Extract<PipPart, { kind: 'circle' }>;
type PathPart = Extract<PipPart, { kind: 'path' }>;

/** The vertices of an `M x y L x y L x y Z` triangle. */
const vertices = (d: string): Array<[number, number]> =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

/** GridCell in the web build at 320 x 568 (the spec's "Fit at every measured cell size" table). */
const COMPACT_CELL_320 = 54.4;

describe('constants: each derives from a token', () => {
  it('the ring is the cell initial plus spacing.md, its stroke borderWidth.thick', () => {
    expect(ROUTE_RING_SIZE).toBe(typography.size.title + spacing.md);
    expect(ROUTE_RING_SIZE).toBe(40);
    expect(ROUTE_RING_STROKE).toBe(borderWidth.thick);
  });

  it('the Next triangle is the pip cursor marker of spacing.xxl, its tip inset borderWidth.base + spacing.xxs', () => {
    expect(NEXT_MARKER_BASE).toBe(spacing.xxl);
    expect(NEXT_TIP_INSET).toBe(borderWidth.base + spacing.xxs);
    expect(TAG_MARK_SIZE).toBe(spacing.lg);
  });

  it('lists the marks in the label and legend order: Next, In your plan, Not open yet', () => {
    expect(ROUTE_MARK_ORDER).toEqual(['next', 'inPlan', 'notOpen']);
  });
});

describe('routeRingParts', () => {
  it('In your plan is one unbroken border.shape circle inside the box', () => {
    const [ring, ...rest] = routeRingParts('inPlan', 40, 3) as Circle[];
    expect(rest).toHaveLength(0);
    expect(ring).toMatchObject({ kind: 'circle', cx: 20, cy: 20, r: 18.5, fill: 'none', stroke: 'mark', strokeWidth: 3 });
    expect(ring!.dash).toBeUndefined();
  });

  it("Not open yet keeps the later pip's pattern exactly: 8 dashes, each 55 % of the period", () => {
    const ring = routeRingParts('notOpen', 40, 3)[0] as Circle;
    const later = pipParts('later', 20)[0] as Circle;
    const period = (2 * Math.PI * ring.r) / LATER_DASHES;
    expect(ring.dash![0]).toBeCloseTo(period * 0.55, 6);
    expect(ring.dash![1]).toBeCloseTo(period * 0.45, 6);
    // Same ratio as the shipped later pip, at any size.
    expect(ring.dash![0] / ring.dash![1]).toBeCloseTo(later.dash![0] / later.dash![1], 6);
    // The compact numbers of the spec: dash 7.99, gap 6.54.
    expect(ring.dash![0]).toBeCloseTo(7.99, 2);
    expect(ring.dash![1]).toBeCloseTo(6.54, 2);
  });

  it('scales with the layout class: 48 / 4 and 56 / 4 keep the stroke inside the box', () => {
    for (const [size, stroke] of [
      [48, 4],
      [56, 4],
    ] as const) {
      const ring = routeRingParts('notOpen', size, stroke)[0] as Circle;
      expect(ring.r + stroke / 2).toBeCloseTo(size / 2, 6);
    }
  });

  it('fits the inner box of the 54.4 dp compact cell with spacing.xxs to spare', () => {
    const inner = COMPACT_CELL_320 - 2 * borderWidth.base;
    expect(ROUTE_RING_SIZE + 2 * spacing.xxs).toBeLessThanOrEqual(inner);
  });
});

describe('the Next triangle', () => {
  it('on a cell is cursorMarkerParts(spacing.xxl): 19.2 x 9.6, in text.primary', () => {
    expect(nextMarkerParts()).toEqual(cursorMarkerParts(NEXT_MARKER_BASE));
    const [part] = nextMarkerParts() as PathPart[];
    expect(part!.fill).toBe('ink');
    const pts = vertices(part!.d);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(19.2, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(9.6, 6);
  });

  it('its tip is the lowest vertex of the band', () => {
    const ys = vertices((nextMarkerParts()[0] as PathPart).d).map(([, y]) => y);
    expect(nextTipY()).toBeCloseTo(Math.max(...ys), 2);
    expect(nextTipY()).toBeLessThan(markerBand(NEXT_MARKER_BASE));
  });

  it('puts the tip NEXT_TIP_INSET below the top edge, and the top stays inside spacing.sm above the cell', () => {
    const top = nextMarkerTop();
    expect(top + nextTipY()).toBeCloseTo(NEXT_TIP_INSET, 6);
    const ys = vertices((nextMarkerParts()[0] as PathPart).d).map(([, y]) => y);
    const drawnTop = top + Math.min(...ys);
    expect(drawnTop).toBeLessThan(0);
    expect(-drawnTop).toBeLessThanOrEqual(spacing.sm);
    expect(-drawnTop).toBeCloseTo(5.6, 2);
  });

  it('a negative inset puts the tip above the edge (the episode row disc, E3-6)', () => {
    expect(nextMarkerTop(-spacing.xxs) + nextTipY()).toBeCloseTo(-spacing.xxs, 6);
  });
});

describe('tagMarkParts: the 16 dp marks of the legend and the chips', () => {
  it('In your plan and Not open yet are the open and later pips at 16', () => {
    expect(tagMarkParts('inPlan')).toEqual(pipParts('open', TAG_MARK_SIZE));
    expect(tagMarkParts('notOpen')).toEqual(pipParts('later', TAG_MARK_SIZE));
    // The gap the spec measures at tag size.
    expect((tagMarkParts('notOpen')[0] as Circle).dash![1]).toBeCloseTo(2.47, 2);
  });

  it('Next is the stage-pip cursor triangle centred in the same box', () => {
    const [part] = tagMarkParts('next') as PathPart[];
    expect(part!.fill).toBe('ink');
    expect(vertices(part!.d)).toEqual([
      [2, 5],
      [14, 5],
      [8, 11],
    ]);
    const cursor = vertices((cursorMarkerParts(PIP_SIZE.stage)[0] as PathPart).d);
    const width = (pts: Array<[number, number]>): number => Math.max(...pts.map(([x]) => x)) - Math.min(...pts.map(([x]) => x));
    expect(width(vertices(part!.d))).toBeCloseTo(width(cursor), 6);
  });
});

describe('rules (source scan)', () => {
  it('uses tokens only: no colour literal', () => {
    for (const source of [geometrySource, ringSource, nextSource, legendSource, stickerSource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
    }
  });

  it('draws every mark: no typed arrow, dingbat, emoji or lock in any source', () => {
    for (const source of [geometrySource, ringSource, nextSource, legendSource, stickerSource, indexSource]) {
      // Anything outside printable ASCII would be a typed glyph.
      expect(source).not.toMatch(/[^\x09\x0A\x0D\x20-\x7E]/);
      expect(source).not.toMatch(/name="lock"/);
    }
  });

  it('hides every mark from screen readers on native and web (the labels carry the words)', () => {
    for (const source of [ringSource, nextSource, legendSource]) {
      expect(source).toMatch(/importantForAccessibility="no-hide-descendants"/);
      expect(source).toMatch(/accessibilityElementsHidden/);
      expect(source).toMatch(/aria-hidden/);
    }
  });
});
