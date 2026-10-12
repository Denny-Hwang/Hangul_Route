import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors, spacing } from '../../../tokens';
import { cursorMarkerParts, markerBand, pipInk, pipParts, stageSegmentParts, startBand, startMarkerParts, type PipPart } from '../geometry';
import { Pip, PipParts, PipSvg } from '../Pip';
import { PipRow, PipRowBody } from '../PipRow';
import { StageSegments, StageSegmentsBody } from '../StageSegments';

/**
 * The element trees of PipRow and Pip (component-skill section 3.1), built by
 * calling the hook-free bodies directly: react-native and react-native-svg are
 * replaced by plain host tags, so the layout maths (margins, svg height,
 * marker offsets) and the ink mapping are checked without a renderer.
 */
vi.mock('react-native', () => ({ View: 'View', useWindowDimensions: () => ({ width: 400, height: 800 }) }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', G: 'G', Path: 'Path' }));
// A regular-class window: every media size is scaled by 1.5 (useMediaSize rounds base x mediaScale).
vi.mock('../../Layout/LayoutProvider', () => ({ useMediaSize: (base: number) => Math.round(base * 1.5) }));

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;
const kids = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];
const ACCENT = colors.stage.stage1;

describe('PipParts: geometry parts as svg', () => {
  it('resolves every ink through pipInk and passes the dash array of a later ring', () => {
    const parts = pipParts('later', 20);
    const g = PipParts({ parts, accent: ACCENT }) as El;
    expect(g.type).toBe('G');
    expect(g.props.transform).toBe('translate(0 0)');
    const [circle] = kids(g);
    const ring = parts[0] as Extract<PipPart, { kind: 'circle' }>;
    expect(circle!.type).toBe('Circle');
    expect(circle!.props).toMatchObject({
      r: ring.r,
      fill: 'none',
      stroke: colors.border.shape,
      strokeWidth: ring.strokeWidth,
      strokeDasharray: [...ring.dash!],
    });
  });

  it('fills a done disc with the accent, edges it in border.shape and draws the check in text.primary with round ends', () => {
    const [disc, check] = kids(PipParts({ parts: pipParts('done', 20), accent: ACCENT }) as El);
    expect(disc!.props).toMatchObject({ fill: ACCENT, stroke: colors.border.shape, strokeDasharray: undefined });
    expect(check!.type).toBe('Path');
    expect(check!.props).toMatchObject({ fill: 'none', stroke: colors.text.primary, strokeLinecap: 'round', strokeLinejoin: 'round' });
  });

  it('draws paths (the sparkle, the markers) with their ink and a round join, offset by offsetY', () => {
    const g = PipParts({ parts: startMarkerParts(20), accent: ACCENT, offsetY: 29 }) as El;
    expect(g.props.transform).toBe('translate(0 29)');
    const [pin, dot] = kids(g);
    expect(pin!.type).toBe('Path');
    expect(pin!.props).toMatchObject({ fill: pipInk('ink', ACCENT), strokeLinejoin: 'round' });
    expect(dot!.props).toMatchObject({ fill: colors.surface.paper });
  });
});

describe('PipSvg (the legend pip)', () => {
  it('is a size x size svg hidden from screen readers on native and web', () => {
    const el = PipSvg({ state: 'known', size: 24, accent: ACCENT, testID: 'pip' }) as El;
    expect(el.type).toBe('View');
    expect(el.props).toMatchObject({ testID: 'pip', importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
    const [svg] = kids(el);
    expect(svg!.props).toMatchObject({ width: 24, height: 24, viewBox: '0 0 24 24' });
    const [parts] = kids(svg!);
    expect(parts!.props).toMatchObject({ parts: pipParts('known', 24), accent: ACCENT });
  });
});

describe('PipRowBody', () => {
  const size = 20;

  it('is one wrapping row hidden from screen readers on native and web', () => {
    const row = PipRowBody({ groups: [[{ key: 'a', state: 'open' }]], size, accent: ACCENT, testID: 'row' }) as El;
    expect(row.type).toBe('View');
    expect(row.props).toMatchObject({ testID: 'row', importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
    expect(row.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs, rowGap: spacing.xs });
  });

  it('puts the group gap after the last pip of a group, never before a pip that may start a line', () => {
    const row = PipRowBody({
      groups: [
        [
          { key: 'a', state: 'done' },
          { key: 'b', state: 'done' },
        ],
        [{ key: 'c', state: 'new' }],
      ],
      size,
      accent: ACCENT,
    }) as El;
    const cells = kids(row);
    expect(cells.map((c) => (c.props.style as { marginRight: number; marginLeft?: number }).marginRight)).toEqual([0, spacing.md - spacing.xs, 0]);
    expect(cells.every((c) => (c.props.style as { marginLeft?: number }).marginLeft === undefined)).toBe(true);
  });

  it('reserves no marker band when no pip has a marker', () => {
    const [cell] = kids(PipRowBody({ groups: [[{ key: 'a', state: 'open' }]], size, accent: ACCENT }) as El);
    const [svg] = kids(cell!);
    expect(svg!.props).toMatchObject({ width: size, height: size, viewBox: `0 0 ${size} ${size}` });
    const [pip] = kids(svg!);
    expect(pip!.props).toMatchObject({ parts: pipParts('open', size), offsetY: 0 });
  });

  it('reserves both bands when a pip has the cursor and the start pin, and places each part in its band', () => {
    const row = PipRowBody({
      groups: [
        [
          { key: 'a', state: 'known' },
          { key: 'b', state: 'open', isCursor: true, isStart: true },
        ],
      ],
      size,
      accent: ACCENT,
    }) as El;
    const height = markerBand(size) + size + startBand(size);
    const [plain, marked] = kids(row).map((cell) => kids(cell)[0]!);
    for (const svg of [plain!, marked!]) expect(svg.props).toMatchObject({ height, viewBox: `0 0 ${size} ${height}` });
    // A pip without markers still sits below the reserved top band, so every pip lines up.
    expect(kids(plain!).map((p) => p.props.offsetY)).toEqual([markerBand(size)]);
    const [cursor, pip, start] = kids(marked!);
    expect(cursor!.props).toMatchObject({ parts: cursorMarkerParts(size) });
    expect(pip!.props).toMatchObject({ parts: pipParts('open', size), offsetY: markerBand(size) });
    expect(start!.props).toMatchObject({ parts: startMarkerParts(size), offsetY: markerBand(size) + size });
  });

  it('reserves only the start band for a start pin without the cursor', () => {
    const [cell] = kids(PipRowBody({ groups: [[{ key: 'a', state: 'open', isStart: true }]], size, accent: ACCENT }) as El);
    expect(kids(cell!)[0]!.props).toMatchObject({ height: size + startBand(size) });
  });
});

describe('PipRow and Pip: context to size through useMediaSize, and the default accent', () => {
  it('a cell row passes the scaled 24 dp size, the scaled gaps and border.shape as the accent to its body', () => {
    const groups = [[{ key: 'a', state: 'done' as const }]];
    const el = PipRow({ groups, context: 'cell', testID: 'row' }) as El;
    expect(el.type).toBe(PipRowBody);
    expect(el.props).toMatchObject({ groups, size: 36, accent: colors.border.shape, testID: 'row', gaps: { pip: 6, group: 18 } });
  });

  it('a stage row (the default) passes the scaled 20 dp size and keeps a caller accent', () => {
    const el = PipRow({ groups: [], accent: colors.stage.stage3 }) as El;
    expect(el.props).toMatchObject({ size: 30, accent: colors.stage.stage3 });
  });

  it('the legend pip passes the scaled size per context and border.shape as the default accent', () => {
    expect((Pip({ state: 'open' }) as El).props).toMatchObject({ state: 'open', size: 30, accent: colors.border.shape });
    expect((Pip({ state: 'done', context: 'cell', accent: colors.stage.stage2 }) as El).props).toMatchObject({ size: 36, accent: colors.stage.stage2 });
  });

  it('the body lays the row out with the gaps it is given', () => {
    const row = PipRowBody({
      groups: [[{ key: 'a', state: 'done' }], [{ key: 'b', state: 'new' }]],
      size: 30,
      accent: ACCENT,
      gaps: { pip: 6, group: 18 },
    }) as El;
    expect(row.props.style).toMatchObject({ columnGap: 6, rowGap: 6 });
    expect(kids(row).map((c) => (c.props.style as { marginRight: number }).marginRight)).toEqual([12, 0]);
  });
});

describe('StageSegmentsBody: one drawn segment per stage', () => {
  const segments = [
    { key: 'stage1', state: 'complete', here: false, accent: colors.stage.stage1 },
    { key: 'stage2', state: 'open', here: true, accent: colors.stage.stage2 },
    { key: 'stage3', state: 'later', here: false, accent: colors.stage.stage3 },
  ] as const;

  it('is one row hidden from screen readers on native and web, a segment per stage, in order', () => {
    const row = StageSegmentsBody({ segments, size: 20, gap: spacing.xs, testID: 'segs' }) as El;
    expect(row.type).toBe('View');
    expect(row.props).toMatchObject({ testID: 'segs', importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
    expect(row.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs });
    expect(kids(row).map((k) => k.key)).toEqual(['.$stage1', '.$stage2', '.$stage3']);
  });

  it('reserves the marker band in every segment and draws the cursor only over the stage the learner is on', () => {
    const row = StageSegmentsBody({ segments, size: 20, gap: spacing.xs }) as El;
    const band = markerBand(20);
    const svgs = kids(row).map((cell) => kids(cell)[0]!);
    for (const svg of svgs) expect(svg.props).toMatchObject({ width: 20, height: 20 + band });
    const parts = svgs.map((svg) => kids(svg));
    expect(parts[0]).toHaveLength(1);
    expect(parts[1]).toHaveLength(2);
    expect(parts[1]![0]!.props).toMatchObject({ parts: cursorMarkerParts(20), accent: colors.stage.stage2 });
    expect(parts[1]![1]!.props).toMatchObject({ parts: stageSegmentParts('open', 20), offsetY: band });
    expect(parts[0]![0]!.props).toMatchObject({ parts: stageSegmentParts('complete', 20), accent: colors.stage.stage1, offsetY: band });
  });

  it('rounds the svg height up to whole pixels at a scaled size', () => {
    const row = StageSegmentsBody({ segments, size: 30, gap: spacing.xs }) as El;
    const svg = kids(kids(row)[0]!)[0]!;
    expect(svg.props).toMatchObject({ height: Math.ceil(markerBand(30) + 30), viewBox: `0 0 30 ${Math.ceil(markerBand(30) + 30)}` });
  });

  it('the hook wrapper passes the scaled 20 dp stage size and the scaled pip gap', () => {
    const body = StageSegments({ segments }) as El;
    expect(body.type).toBe(StageSegmentsBody);
    expect(body.props).toMatchObject({ size: 30, gap: Math.round(spacing.xs * 1.5) });
  });
});
