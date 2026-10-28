import { isValidElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors } from '../../../tokens';
import { ShapeOriginArt, hasShapeOriginArt } from '../ShapeOriginArt';

/** Match Shape's origin pictures (row CM-33) as svg trees: a named image at the 200 x 160 box, in token colours only. */
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', Ellipse: 'Ellipse', Line: 'Line', Path: 'Path', Polygon: 'Polygon', Rect: 'Rect' }));

type Node = ReactElement<Record<string, unknown> & { children?: unknown }>;
const TOKEN_COLOURS: ReadonlySet<string> = new Set<string>(
  Object.values(colors).flatMap((group): unknown[] => (typeof group === 'object' ? Object.values(group) : [])).filter((v): v is string => typeof v === 'string'),
);

describe('ShapeOriginArt (row CM-33)', () => {
  it('draws a registered picture as a named image, height from its box', () => {
    const tree = ShapeOriginArt({ refId: 'prop:shape-origin-nieun', width: 200, accessibilityLabel: 'The tongue touches the upper gum.', testID: 'art' }) as Node;
    expect(isValidElement(tree)).toBe(true);
    expect(tree.type).toBe('Svg');
    expect(tree.props).toMatchObject({ width: 200, height: 160, viewBox: '0 0 200 160', accessibilityRole: 'image', accessibilityLabel: 'The tongue touches the upper gum.', 'aria-label': 'The tongue touches the upper gum.', testID: 'art' });
    const kids = (tree.props.children as Node[]).filter(Boolean);
    expect(kids.length).toBe(5);
    for (const kid of kids) {
      for (const key of ['fill', 'stroke'] as const) {
        const value = kid.props[key];
        if (typeof value === 'string' && value !== 'none') expect(TOKEN_COLOURS.has(value), value).toBe(true);
      }
    }
  });

  it('draws nothing for an unknown picture, so the round shows its line alone', () => {
    expect(ShapeOriginArt({ refId: 'prop:shape-origin-nope', width: 200, accessibilityLabel: 'x' })).toBeNull();
    expect(hasShapeOriginArt('prop:shape-origin-a')).toBe(true);
    expect(hasShapeOriginArt('prop:shape-origin-nope')).toBe(false);
  });
});
