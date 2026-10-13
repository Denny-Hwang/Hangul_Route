import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { borderWidth, colors, spacing, typography } from '../../../tokens';
import { nextMarkerParts, nextMarkerTop, routeRingParts, tagMarkParts, NEXT_MARKER_BASE, NEXT_TIP_INSET, TAG_MARK_SIZE } from '../geometry';
import { markerBand } from '../../PipRow/geometry';
import { NextMarker } from '../NextMarker';
import { RouteLegend, TagMark } from '../RouteLegend';
import { RouteRing, RouteRingSvg } from '../RouteRing';

/**
 * The element trees of the route marks (component-skill section 3.1), built by calling the
 * components directly: react-native and react-native-svg are plain host tags, so the sizes,
 * the placement over the cell and the inks are checked without a renderer.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', useWindowDimensions: () => ({ width: 400, height: 800 }) }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', G: 'G', Path: 'Path' }));
// A regular-class window: useMediaSize rounds base x 1.2 (40 -> 48, 3 -> 4).
vi.mock('../../Layout/LayoutProvider', () => ({ useMediaSize: (base: number) => Math.round(base * 1.2) }));

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;
const kids = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];
/** Calls a function component (or returns a host element as is) until a host element is reached. */
const host = (el: El): El => (typeof el.type === 'function' ? host((el.type as (p: Props) => El)(el.props)) : el);
const hidden = (el: El): void => {
  expect(el.props).toMatchObject({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
};

describe('RouteRing', () => {
  it('scales the ring and its stroke with the layout class (48 / 4 on regular)', () => {
    const svgView = host(RouteRing({ kind: 'inPlan', testID: 'ring' }) as El);
    expect(svgView.props.style).toMatchObject({ width: 48, height: 48 });
    const svg = kids(svgView)[0]!;
    const circle = host(kids(svg)[0]!);
    const [c] = kids(circle);
    expect(c!.props).toMatchObject({ r: 22, strokeWidth: 4, stroke: colors.border.shape, fill: 'none' });
  });

  it('draws the dotted ring with its dash array, hidden from screen readers', () => {
    const view = RouteRingSvg({ kind: 'notOpen', size: 40, stroke: 3, testID: 'dotted' }) as El;
    hidden(view);
    expect(view.props.testID).toBe('dotted');
    const svg = kids(view)[0]!;
    expect(svg.props).toMatchObject({ width: 40, height: 40, viewBox: '0 0 40 40' });
    const [circle] = kids(host(kids(svg)[0]!));
    const ring = routeRingParts('notOpen', 40, 3)[0] as { dash: readonly [number, number] };
    expect(circle!.props.strokeDasharray).toEqual([...ring.dash]);
  });
});

describe('NextMarker', () => {
  it('centres the cursor triangle over the top edge, its tip NEXT_TIP_INSET inside the cell', () => {
    const view = NextMarker({ testID: 'next' }) as El;
    hidden(view);
    expect(view.props.testID).toBe('next');
    expect(view.props.pointerEvents).toBe('none');
    expect(view.props.style).toMatchObject({
      position: 'absolute',
      top: nextMarkerTop(),
      left: '50%',
      marginLeft: -NEXT_MARKER_BASE / 2,
      width: NEXT_MARKER_BASE,
      height: markerBand(NEXT_MARKER_BASE),
    });
    const svg = kids(view)[0]!;
    const [path] = kids(host(kids(svg)[0]!));
    expect(path!.props).toMatchObject({ d: (nextMarkerParts()[0] as { d: string }).d, fill: colors.text.primary });
  });

  it('takes another tip inset (the episode row, E3-6)', () => {
    const view = NextMarker({ tipInset: -spacing.xxs }) as El;
    expect((view.props.style as Props).top).toBeCloseTo(nextMarkerTop(-spacing.xxs), 6);
  });

  it("takes the marked box's border out of the offset, so the tip is measured from the outer edge", () => {
    // An absolute child is placed from inside its parent's border (Yoga and CSS alike).
    for (const edge of [borderWidth.base, borderWidth.thick]) {
      const view = NextMarker({ edge }) as El;
      expect((view.props.style as Props).top).toBeCloseTo(nextMarkerTop(NEXT_TIP_INSET, edge), 6);
      expect((view.props.style as Props).top).toBeCloseTo(nextMarkerTop() - edge, 6);
    }
  });
});

describe('TagMark', () => {
  it('draws each mark in a 16 dp box, hidden', () => {
    for (const kind of ['next', 'inPlan', 'notOpen'] as const) {
      const view = TagMark({ kind }) as El;
      hidden(view);
      const svg = kids(view)[0]!;
      expect(svg.props).toMatchObject({ width: TAG_MARK_SIZE, height: TAG_MARK_SIZE });
      const [part] = kids(host(kids(svg)[0]!));
      const geometry = tagMarkParts(kind)[0]!;
      expect(part!.type).toBe(geometry.kind === 'circle' ? 'Circle' : 'Path');
    }
  });
});

describe('RouteLegend', () => {
  it('draws nothing when the grid draws no mark', () => {
    expect(RouteLegend({ items: [] })).toBeNull();
  });

  it('lists the marks in the order Next, In your plan, Not open yet, each mark then its word, hidden from screen readers', () => {
    const view = RouteLegend({
      items: [
        { kind: 'notOpen', label: 'Not open yet' },
        { kind: 'next', label: 'Next' },
        { kind: 'inPlan', label: 'In your plan' },
      ],
      testID: 'legend',
    }) as El;
    hidden(view);
    expect(view.props.testID).toBe('legend');
    expect(view.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginBottom: spacing.md });
    const items = kids(view);
    expect(items.map((i) => i.key)).toEqual(['.$next', '.$inPlan', '.$notOpen']);
    for (const item of items) {
      expect(item.props.style).toMatchObject({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs });
      const [mark, word] = kids(item);
      expect((mark!.type as { name?: string }).name).toBe('TagMark');
      expect(word!.type).toBe('Text');
    }
    const words = items.map((i) => kids(kids(i)[1]!)[0]);
    expect(words).toEqual(['Next', 'In your plan', 'Not open yet']);
    const style = kids(items[0]!)[1]!.props.style as Props;
    expect(style).toMatchObject({ fontSize: typography.size.bodySm, fontWeight: typography.weight.semibold, color: colors.text.secondary });
  });
});

describe('StickerIcon (E3-D D3: corner glyphs over the ring)', () => {
  it('draws every part in surface.paper, filled and edged 1.5 grid units wider, then the glyph in its colour', async () => {
    const { StickerIcon, STICKER_EDGE_UNITS } = await import('../StickerIcon');
    const { iconGlyphs } = await import('../../Icon/glyphs');
    expect(STICKER_EDGE_UNITS).toBe(1.5);
    const svg = StickerIcon({ name: 'pin', size: 16, color: colors.brand.primary, testID: 'pin' }) as El;
    expect(svg.props).toMatchObject({ width: 16, height: 16, viewBox: '0 0 24 24', testID: 'pin' });
    const paths = kids(svg);
    const glyph = iconGlyphs.pin;
    expect(paths).toHaveLength(glyph.length * 2);
    const edges = paths.slice(0, glyph.length);
    const marks = paths.slice(glyph.length);
    // The pin's outline (a 2.2 stroke) and its solid dot (a fill, no stroke of its own).
    expect(edges[0]!.props).toMatchObject({ d: glyph[0]!.d, fill: colors.surface.paper, stroke: colors.surface.paper, strokeWidth: 2.2 + 3 });
    expect(edges[1]!.props).toMatchObject({ d: glyph[1]!.d, fill: colors.surface.paper, strokeWidth: 3 });
    expect(marks[0]!.props).toMatchObject({ d: glyph[0]!.d, stroke: colors.brand.primary, fill: 'none' });
    expect(marks[1]!.props).toMatchObject({ d: glyph[1]!.d, fill: colors.brand.primary });
  });

  it('defaults a stroke part without a width to 2', async () => {
    const { StickerIcon } = await import('../StickerIcon');
    const svg = StickerIcon({ name: 'plus', size: 16, color: colors.text.primary }) as El;
    // plus has two 2.6 strokes.
    expect(kids(svg)[0]!.props.strokeWidth).toBeCloseTo(2.6 + 3, 6);
    // speaker's two sound waves are strokes with no width of their own: 2, plus the edge.
    const speaker = StickerIcon({ name: 'speaker', size: 16, color: colors.text.primary }) as El;
    expect(kids(speaker)[1]!.props.strokeWidth).toBe(2 + 3);
  });
});
