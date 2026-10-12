import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors, radii, spacing } from '../../../tokens';
import { TagMark } from '../RouteLegend';
import { RouteTag } from '../RouteTag';

/** The tag chip's element tree (component-skill section 3.1), built by calling the component directly. */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', useWindowDimensions: () => ({ width: 400, height: 800 }) }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', G: 'G', Path: 'Path' }));

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;
const kids = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];

describe('RouteTag (F-ENT-003 E3-6, RouteMarkers D6)', () => {
  it('Next: a brand.primaryLight pill with the word only, hidden from screen readers', () => {
    const chip = RouteTag({ kind: 'next', label: 'Next', testID: 'tag' }) as El;
    expect(chip.props).toMatchObject({ testID: 'tag', importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
    expect(chip.props.style).toMatchObject({
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      gap: spacing.xs,
      backgroundColor: colors.brand.primaryLight,
    });
    const children = kids(chip);
    expect(children).toHaveLength(1);
    expect(children[0]!.props).toMatchObject({ tone: 'primary', weight: 'semibold', children: 'Next' });
  });

  it('In your plan: a surface.sunken pill with the 16 dp solid ring before the word', () => {
    const chip = RouteTag({ kind: 'inPlan', label: 'In your plan' }) as El;
    expect(chip.props.style).toMatchObject({ backgroundColor: colors.surface.sunken });
    const [mark, word] = kids(chip);
    expect(mark!.type).toBe(TagMark);
    expect(mark!.props).toMatchObject({ kind: 'inPlan' });
    expect(word!.props).toMatchObject({ children: 'In your plan' });
  });
});
