import { Children, isValidElement, createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { borderWidth, colors, radii, spacing } from '../../../tokens';
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
/** The platform's reduced-motion setting, read through `usePressLook` (AMENDMENTS-TOUCH section 4.3). */
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../TapBoard', async () => {
  const { pressLook } = await import('../../../press-look');
  return { TapTarget: 'TapTarget', usePressLook: () => pressLook(motion.reduced) };
});
vi.mock('../../KoreanText', () => ({ KoreanText: 'KoreanText' }));
/** The chosen text size step's factor, read through `useTypeScale` (owner items 6 and 7). */
const textSize = vi.hoisted(() => ({ factor: 1 }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(textSize.factor) };
});

type Props = Record<string, unknown>;
type El = ReactElement<Props>;

/** The card body inside the TapTarget (its children are a render function of `{ pressed }`). */
function body(props: Partial<ChoiceCardProps>, pressed = false): El {
  const target = ChoiceCard({ state: 'idle', accessibilityLabel: 'apple', ...props }) as El;
  const render = target.props.children as (s: { pressed: boolean }) => El;
  return render({ pressed });
}

const kids = (el: El): El[] => Children.toArray(el.props.children as ReactNode) as El[];

/** Every element of a tree, depth first. */
function all(el: El): El[] {
  return [el, ...kids(el).filter((k) => isValidElement(k)).flatMap((k) => all(k))];
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
    const art = createElement('View', { testID: 'art' });
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
    const card = body({ state: 'idle', art: createElement('View'), layout: 'tile' });
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
    const tile = body({ state: 'wrong', art: createElement('View'), layout: 'tile', wrongMark: 'dash' });
    expect(icons(tile)[0]?.props).toMatchObject({ name: 'dash', color: colors.text.primary });
    expect((kids(tile).at(-1)?.props.style as Props).backgroundColor).toBe(colors.feedback.nudgeLight);
  });
});

describe('ChoiceCard label follows the chosen text size (owner items 6 and 7)', () => {
  it('draws the body size at the step, with the line height from the scaled size', () => {
    const labelStyle = (): { fontSize: number; lineHeight: number } => {
      const text = all(body({ state: 'idle', label: 'apple' })).find((e) => e.type === 'Text') as El;
      return text.props.style as { fontSize: number; lineHeight: number };
    };
    textSize.factor = 1;
    expect(labelStyle().fontSize).toBe(18);
    textSize.factor = 1.3;
    expect(labelStyle().fontSize).toBe(23);
    expect(labelStyle().lineHeight).toBeCloseTo(23 * 1.35);
    textSize.factor = 1;
  });
});

describe('ChoiceCard takes a touch through TapTarget (AMENDMENTS-TOUCH 4.4, row KT-2)', () => {
  const target = (props: Partial<ChoiceCardProps>): El => ChoiceCard({ state: 'idle', accessibilityLabel: 'apple', ...props }) as El;

  it('is one TapTarget with the caller\'s label, testID and ref, stretched across its row, with no web-dead hitSlop', () => {
    const ref = (): void => undefined;
    const el = target({ testID: 'card-1', pressableRef: ref });
    expect(el.type).toBe('TapTarget');
    expect(el.props.accessibilityLabel).toBe('apple');
    expect(el.props.testID).toBe('card-1');
    expect(el.props.pressableRef).toBe(ref);
    expect(el.props.style).toEqual({ alignSelf: 'stretch' });
    expect('hitSlop' in el.props).toBe(false);
  });

  it('idle and hint commit the caller\'s onPress; answered and disabled cards are inactive, with today\'s accessible state', () => {
    const presses: string[] = [];
    const onPress = (): void => {
      presses.push('x');
    };
    for (const state of ['idle', 'hint'] as const) {
      const el = target({ state, onPress });
      expect(el.props.inactive).toBe(false);
      expect(el.props.accessibilityState).toEqual({ disabled: false, selected: false });
      (el.props.onCommit as () => void)();
    }
    expect(presses).toEqual(['x', 'x']);
    expect(target({ state: 'correct', onPress }).props).toMatchObject({ inactive: true, accessibilityState: { disabled: false, selected: true } });
    expect(target({ state: 'wrong', onPress }).props).toMatchObject({ inactive: true, accessibilityState: { disabled: false, selected: true } });
    expect(target({ state: 'disabled', onPress }).props).toMatchObject({ inactive: true, accessibilityState: { disabled: true, selected: false } });
    // A card with no handler commits nothing (and does not throw).
    (target({ state: 'idle' }).props.onCommit as () => void)();
    expect(presses).toHaveLength(2);
    // TapTarget never disables an answered card's Pressable, so it keeps its focus (Story Order moves focus to one).
    expect('disabled' in target({ state: 'disabled' }).props).toBe(false);
  });

  it('pressed: a thick border.shape outline and a 0.97 shrink on the drawn box, never the focus-blue hint ring', () => {
    motion.reduced = false;
    for (const state of ['idle', 'hint'] as const) {
      const style = body({ state, label: 'apple' }, true).props.style as Props;
      expect(style.borderColor).toBe(colors.border.shape);
      expect(style.borderColor).not.toBe(colors.border.focus);
      expect(style.borderWidth).toBe(borderWidth.thick);
      expect(style.transform).toEqual([{ scale: 0.97 }]);
    }
  });

  it('pressed: the thicker outline comes off the padding, so the card keeps its size (no layout shift); hint is already thick', () => {
    const rest = body({ state: 'idle', label: 'apple' }).props.style as Props;
    const down = body({ state: 'idle', label: 'apple' }, true).props.style as Props;
    expect((down.paddingVertical as number) + (down.borderWidth as number)).toBe((rest.paddingVertical as number) + (rest.borderWidth as number));
    expect((down.paddingHorizontal as number) + (down.borderWidth as number)).toBe((rest.paddingHorizontal as number) + (rest.borderWidth as number));
    expect(body({ state: 'hint', label: 'apple' }, true).props.style).toMatchObject({ paddingVertical: spacing.md, paddingHorizontal: spacing.lg });
  });

  it('pressed under reduced motion: the outline alone, no shrink', () => {
    motion.reduced = true;
    const style = body({ state: 'idle', label: 'apple' }, true).props.style as Props;
    expect(style.borderColor).toBe(colors.border.shape);
    expect(style.borderWidth).toBe(borderWidth.thick);
    expect(style.transform).toBeUndefined();
    motion.reduced = false;
  });

  it('not pressed: the state\'s own border and no shrink (hint keeps its thick focus ring)', () => {
    const idle = body({ state: 'idle', label: 'apple' }).props.style as Props;
    expect(idle).toMatchObject({ borderColor: colors.border.subtle, borderWidth: borderWidth.base });
    expect(idle.transform).toBeUndefined();
    expect(body({ state: 'hint', label: 'apple' }).props.style).toMatchObject({ borderColor: colors.border.focus, borderWidth: borderWidth.thick });
  });

  it('an inactive card never paints the press look, whatever it is handed', () => {
    for (const state of ['correct', 'wrong', 'disabled'] as const) {
      const style = body({ state, label: 'apple' }, true).props.style as Props;
      expect(style.borderColor).not.toBe(colors.border.shape);
      expect(style.transform).toBeUndefined();
    }
  });
});
