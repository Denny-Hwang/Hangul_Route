import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { typeScale } from '../../../text-size';
import { borderWidth, colors, radii, spacing, touchTarget } from '../../../tokens';
import { DisplayControl, ScreenHeader } from '../ScreenHeader';
import { displayControlStyle, headerStyle, leadingIcon, leadingStyle, leadingTestId, leadingTextStyle, steadyFocusBorder, titleInline, titleTextStyle } from '../style';
import type { ScreenHeaderProps } from '../types';

/**
 * ScreenHeader (design/components/ScreenHeader/spec.md; AMENDMENTS-DISPLAY-NAV section 7.1),
 * checked on the element tree built by calling the component directly with react-native's hosts
 * replaced by plain tags (as DisplaySheet.test.tsx does).
 */
const layout = vi.hoisted(() => ({ width: 'compact' as 'compact' | 'regular' | 'wide' }));
const textSize = vi.hoisted(() => ({ factor: 1 }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../Layout', () => ({ useLayoutClass: () => ({ width: layout.width }) }));
vi.mock('../../TextSize', async () => {
  const { typeScale: scale } = await import('../../../text-size');
  return { useTypeScale: () => scale(textSize.factor) };
});

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;

/** Calls local function components (the Display control) so the whole tree is plain tags. */
function expand(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!React.isValidElement(node)) return node;
  const el = node as El;
  if (typeof el.type === 'function') return expand((el.type as (p: Props) => React.ReactNode)(el.props));
  const children = el.props.children;
  if (children === undefined || typeof children === 'function') return el;
  return React.cloneElement(el, undefined, ...React.Children.toArray(children as React.ReactNode).map(expand));
}

function all(node: React.ReactNode): El[] {
  if (!React.isValidElement(node)) return [];
  const el = node as El;
  const kids = typeof el.props.children === 'function' ? [] : React.Children.toArray(el.props.children as React.ReactNode);
  return [el, ...kids.flatMap(all)];
}

const byTestId = (tree: El[], id: string): El | undefined => tree.find((e) => e.props.testID === id);
const textOf = (el: El): string =>
  React.Children.toArray(el.props.children as React.ReactNode)
    .map((c) => (typeof c === 'string' ? c : React.isValidElement(c) ? textOf(c as El) : ''))
    .join('');

function render(over: Partial<ScreenHeaderProps> = {}): { root: El; tree: El[] } {
  const root = expand(
    ScreenHeader({ leading: 'back', leadingLabel: 'Back', onLeading: vi.fn(), displayLabel: 'Aa', displayA11y: 'Aa, Display: language and text size', onDisplay: vi.fn(), ...over }),
  ) as El;
  return { root, tree: all(root) };
}

/** The controls row: the header's first child. */
const rowOf = (root: El): El => React.Children.toArray(root.props.children as React.ReactNode)[0] as El;
const rowChildren = (root: El): El[] => React.Children.toArray(rowOf(root).props.children as React.ReactNode) as El[];

describe('ScreenHeader style (pure)', () => {
  it('Back draws the left arrow, Close the close glyph, a root nothing', () => {
    expect(leadingIcon('back')).toBe('arrow-left');
    expect(leadingIcon('close')).toBe('close');
    expect(leadingIcon('none')).toBeNull();
    expect(leadingTestId('back')).toBe('screen-header-back');
    expect(leadingTestId('close')).toBe('screen-header-close');
  });

  it('the title sits under the controls on a phone and in the row from the regular class, unless a middle part holds it', () => {
    expect(titleInline('compact', false)).toBe(false);
    expect(titleInline('regular', false)).toBe(true);
    expect(titleInline('wide', false)).toBe(true);
    expect(titleInline('wide', true)).toBe(false);
    // A screen may keep a short name in the row at every width (a tab root, the PIN screen); a middle part still wins.
    expect(titleInline('compact', false, true)).toBe(true);
    expect(titleInline('compact', true, true)).toBe(false);
  });

  it('a title in the row needs no gap under the header; otherwise a small one', () => {
    expect(headerStyle(true)).toMatchObject({ marginBottom: 0 });
    expect(headerStyle(false)).toMatchObject({ marginBottom: spacing.xs });
  });

  it('the leading control is a touch target both ways, pulled into the gutter, with a focus ring that never moves the row', () => {
    const idle = leadingStyle({ pressed: false });
    const focused = leadingStyle({ pressed: false, focused: true });
    expect(idle).toMatchObject({ minHeight: touchTarget.min, minWidth: touchTarget.min, marginLeft: -spacing.xs, borderRadius: radii.pill, borderColor: 'transparent', backgroundColor: 'transparent' });
    expect(focused).toMatchObject({ borderColor: colors.border.focus, borderWidth: idle.borderWidth });
    expect(leadingStyle({ pressed: true })).toMatchObject({ backgroundColor: colors.surface.sunken });
  });

  it('the Display control is a paper pill whose border thickens and recolours on focus', () => {
    expect(displayControlStyle({ pressed: false })).toMatchObject({ minHeight: touchTarget.min, minWidth: touchTarget.min, borderRadius: radii.pill, borderWidth: borderWidth.base, borderColor: colors.border.strong, backgroundColor: colors.surface.paper });
    expect(displayControlStyle({ pressed: false, focused: true })).toMatchObject({ borderWidth: borderWidth.thick, borderColor: colors.border.focus });
  });

  // A control that grew on focus at the row's wrap edge jumps to the next line between a press and its release, and the
  // tap does nothing (the All lessons header at the Pixel 5 width on CI's fonts; browse.spec.ts pins the real tap).
  it('focus thickens a border inside the same box: border plus padding is the same across and down', () => {
    const box = (s: { borderWidth?: unknown; paddingHorizontal?: unknown; paddingVertical?: unknown }) => ({
      across: 2 * (Number(s.borderWidth) + Number(s.paddingHorizontal)),
      down: 2 * (Number(s.borderWidth) + Number(s.paddingVertical)),
    });
    for (const pad of [spacing.md, spacing.lg]) {
      expect(steadyFocusBorder(false, pad)).toEqual({ borderWidth: borderWidth.base, paddingHorizontal: pad, paddingVertical: borderWidth.thick - borderWidth.base });
      expect(steadyFocusBorder(true, pad)).toMatchObject({ borderWidth: borderWidth.thick, paddingVertical: 0 });
      expect(box(steadyFocusBorder(true, pad))).toEqual(box(steadyFocusBorder(false, pad)));
    }
    expect(box(displayControlStyle({ pressed: false, focused: true }))).toEqual(box(displayControlStyle({ pressed: false })));
    expect(box(displayControlStyle({ pressed: false }))).toEqual({ across: 2 * (borderWidth.base + spacing.md), down: 2 * borderWidth.thick });
    // The leading control's ring never changes width at all.
    expect(leadingStyle({ pressed: false, focused: true })).toMatchObject({ borderWidth: leadingStyle({ pressed: false }).borderWidth });
  });

  it('text follows the chosen size: Back is body x f, the title takes the heading half rule', () => {
    const largest = typeScale(1.5);
    expect(leadingTextStyle(largest)).toMatchObject({ fontSize: 27 });
    expect(titleTextStyle(largest, 'title', false)).toMatchObject({ fontSize: 35 });
    expect(titleTextStyle(largest, 'prompt', false)).toMatchObject({ fontSize: 33 });
    expect(titleTextStyle(typeScale(1), 'title', true)).toMatchObject({ fontSize: 28, flex: 1, minWidth: 0 });
    expect(titleTextStyle(typeScale(1), 'title', false)).not.toHaveProperty('flex');
  });
});

describe('ScreenHeader', () => {
  it('back: the first control is Back, named by its visible word, and it runs onLeading', () => {
    const onLeading = vi.fn();
    const { root, tree } = render({ onLeading });
    const first = rowChildren(root)[0]!;
    expect(first.props.testID).toBe('screen-header-back');
    expect(first.props.accessibilityRole).toBe('button');
    expect(first.props.accessibilityLabel).toBe('Back');
    expect(textOf(first)).toBe('Back');
    expect(tree.find((e) => e.type === 'Icon')?.props.name).toBe('arrow-left');
    (first.props.onPress as () => void)();
    expect(onLeading).toHaveBeenCalledTimes(1);
  });

  it('close: the close glyph and the word Close', () => {
    const { tree } = render({ leading: 'close', leadingLabel: 'Close' });
    const close = byTestId(tree, 'screen-header-close')!;
    expect(close.props.accessibilityLabel).toBe('Close');
    expect(tree.find((e) => e.type === 'Icon')?.props.name).toBe('close');
  });

  it('none: no leading control at all (a root)', () => {
    const { tree } = render({ leading: 'none', leadingLabel: undefined });
    expect(byTestId(tree, 'screen-header-back')).toBeUndefined();
    expect(byTestId(tree, 'screen-header-close')).toBeUndefined();
    expect(tree.filter((e) => e.type === 'Icon')).toEqual([]);
  });

  it('on a phone the title is an h1 under the controls row; from the regular class it sits in the row', () => {
    layout.width = 'compact';
    const phone = render({ title: 'Food' });
    const phoneTitle = byTestId(phone.tree, 'screen-header-title')!;
    expect(phoneTitle.props.accessibilityRole).toBe('header');
    expect(phoneTitle.props['aria-level']).toBe(1);
    expect(textOf(phoneTitle)).toBe('Food');
    expect(rowChildren(phone.root).some((c) => c.props.testID === 'screen-header-title')).toBe(false);
    layout.width = 'regular';
    const wide = render({ title: 'Food' });
    expect(rowChildren(wide.root).some((c) => c.props.testID === 'screen-header-title')).toBe(true);
    layout.width = 'compact';
  });

  it('a short name kept in the row stays there on a phone', () => {
    layout.width = 'compact';
    const { root } = render({ title: 'Library', titleInline: true, leading: 'none' });
    expect(rowChildren(root).some((c) => c.props.testID === 'screen-header-title')).toBe(true);
  });

  it('a screen that budgets its height hears the header block\'s height', () => {
    const onHeight = vi.fn();
    const { root } = render({ onHeight });
    (root.props.onLayout as (e: { nativeEvent: { layout: { height: number } } }) => void)({ nativeEvent: { layout: { height: 72 } } });
    expect(onHeight).toHaveBeenCalledWith(72);
    expect(render({}).root.props.onLayout).toBeUndefined();
  });

  it('a Korean content title carries its language', () => {
    const { tree } = render({ title: '추석', titleLang: 'ko', titleSize: 'prompt' });
    expect(byTestId(tree, 'screen-header-title')!.props.lang).toBe('ko');
  });

  it('a middle part (a quest\'s step dots) holds the row; the title then goes under it', () => {
    layout.width = 'wide';
    const { root } = render({ leading: 'close', leadingLabel: 'Close', middle: <span>dots</span>, title: 'Which letter?' });
    const kids = rowChildren(root);
    expect(kids.map((k) => k.props.testID ?? k.type)).toEqual(['screen-header-close', 'View', 'View']);
    expect(all(kids[1]!).some((e) => e.type === 'span')).toBe(true);
    const under = React.Children.toArray(root.props.children as React.ReactNode)[1] as El;
    expect(under.props.testID).toBe('screen-header-title');
    layout.width = 'compact';
  });

  it('the Display control sits at the top right, named so its name begins with its visible sign; one more control after it', () => {
    const onDisplay = vi.fn();
    const { root, tree } = render({ onDisplay, trailing: <span>Profile</span> });
    const kids = rowChildren(root);
    const trailing = kids[kids.length - 1]!;
    const trail = React.Children.toArray(trailing.props.children as React.ReactNode) as El[];
    expect(trail[0]!.props.testID).toBe('screen-header-display');
    expect(trail[1]!.type).toBe('span');
    const display = byTestId(tree, 'screen-header-display')!;
    expect(String(display.props.accessibilityLabel).startsWith(textOf(display))).toBe(true);
    expect(display.props['aria-haspopup']).toBe('dialog');
    (display.props.onPress as () => void)();
    expect(onDisplay).toHaveBeenCalledTimes(1);
  });

  it('the Display control hides while a session clock runs, and without its labels', () => {
    expect(byTestId(render({ displayHidden: true }).tree, 'screen-header-display')).toBeUndefined();
    expect(byTestId(render({ onDisplay: undefined }).tree, 'screen-header-display')).toBeUndefined();
  });
});

describe('DisplayControl', () => {
  it('draws its sign hidden from assistive tech and opens a dialog', () => {
    const onPress = vi.fn();
    const tree = all(expand(DisplayControl({ label: 'Aa', a11y: 'Aa, Display: language and text size', onPress })) as El);
    expect(tree[0]!.props.testID).toBe('display-button');
    const sign = tree.find((e) => e.type === 'Text')!;
    expect(sign.props['aria-hidden']).toBe(true);
    expect(textOf(sign)).toBe('Aa');
  });
});
