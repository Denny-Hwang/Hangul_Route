import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors, spacing } from '../../../tokens';
import { cursorMarkerParts, markerBand, pipInk, pipParts, startBand, startMarkerParts, type PipPart } from '../geometry';
import { PipParts, PipSvg } from '../Pip';
import { PipRowBody } from '../PipRow';

/**
 * The element trees of PipRow and Pip (component-skill section 3.1), built by
 * calling the hook-free bodies directly: react-native and react-native-svg are
 * replaced by plain host tags, so the layout maths (margins, svg height,
 * marker offsets) and the ink mapping are checked without a renderer.
 */
vi.mock('react-native', () => ({ View: 'View', useWindowDimensions: () => ({ width: 400, height: 800 }) }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', G: 'G', Path: 'Path' }));

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

  it('fills a done disc with the accent and edges it in border.shape', () => {
    const [disc] = kids(PipParts({ parts: pipParts('done', 20), accent: ACCENT }) as El);
    expect(disc!.props).toMatchObject({ fill: ACCENT, stroke: colors.border.shape, strokeDasharray: undefined });
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
