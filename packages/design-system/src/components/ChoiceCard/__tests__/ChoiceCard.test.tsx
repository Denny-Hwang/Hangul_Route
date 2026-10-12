import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors, radii, spacing } from '../../../tokens';
import { ChoiceCard } from '../ChoiceCard';
import type { ChoiceCardProps } from '../types';

/**
 * The element tree of ChoiceCard (component-skill section 3.1), built by calling
 * the component directly with react-native's hosts replaced by plain tags, so
 * where the status mark sits in each layout and which mark a miss carries are
 * checked without a renderer. design/components/ChoiceCard/spec.md.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../KoreanText', () => ({ KoreanText: 'KoreanText' }));

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;

/** The card body inside the Pressable (its children are a render function of `{ pressed }`). */
function body(props: Partial<ChoiceCardProps>): El {
  const pressable = ChoiceCard({ state: 'idle', accessibilityLabel: 'apple', ...props }) as El;
  const render = pressable.props.children as (s: { pressed: boolean }) => El;
  return render({ pressed: false });
}

const kids = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];

/** Every element of a tree, depth first. */
function all(el: El): El[] {
  return [el, ...kids(el).filter((k) => React.isValidElement(k)).flatMap((k) => all(k))];
}

const icons = (el: El): El[] => all(el).filter((e) => e.type === 'Icon');

describe('ChoiceCard element tree (F-VOC-004 S-4b additions)', () => {
  it('row (the default): the mark is the last child of the row, so the row keeps room for it', () => {
    const card = body({ state: 'correct', label: 'apple' });
    const last = kids(card).at(-1);
    expect(last?.type).toBe('Icon');
    expect(last?.props.name).toBe('check');
  });

  it('tile: the mark sits on the top corner on a disc of the state fill, so the content keeps the whole width', () => {
    const art = React.createElement('View', { testID: 'art' });
    const card = body({ state: 'correct', art, layout: 'tile' });
    const corner = kids(card).at(-1);
    expect(corner?.type).toBe('View');
    expect(corner?.props.style).toEqual({
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      padding: spacing.xxs,
      borderRadius: radii.pill,
      backgroundColor: colors.feedback.successLight,
    });
    expect(icons(card)).toHaveLength(1);
    expect(icons(corner!)[0]?.props).toMatchObject({ name: 'check', color: colors.feedback.success, size: spacing.xl });
  });

  it('tile with no mark (waiting) draws no corner', () => {
    const card = body({ state: 'idle', art: React.createElement('View'), layout: 'tile' });
    expect(icons(card)).toHaveLength(0);
    expect(kids(card)).toHaveLength(1);
  });

  it('tile centres a Korean block; row keeps it at the start', () => {
    const korean = (card: El) => all(card).find((e) => kids(e).some((k) => k.type === 'KoreanText'));
    expect((korean(body({ ko: '사과', romanization: 'sagwa', layout: 'tile' }))?.props.style as Props).alignSelf).toBe('center');
    expect((korean(body({ ko: '사과', romanization: 'sagwa' }))?.props.style as Props).alignSelf).toBe('flex-start');
  });

  it('a miss carries the try-another mark by default and the dash with wrongMark="dash", in either layout', () => {
    expect(icons(body({ state: 'wrong', label: 'pear' }))[0]?.props.name).toBe('replay');
    expect(icons(body({ state: 'wrong', label: 'pear', wrongMark: 'dash' }))[0]?.props.name).toBe('dash');
    const tile = body({ state: 'wrong', art: React.createElement('View'), layout: 'tile', wrongMark: 'dash' });
    expect(icons(tile)[0]?.props).toMatchObject({ name: 'dash', color: colors.text.primary });
    expect((kids(tile).at(-1)?.props.style as Props).backgroundColor).toBe(colors.feedback.nudgeLight);
  });
});
