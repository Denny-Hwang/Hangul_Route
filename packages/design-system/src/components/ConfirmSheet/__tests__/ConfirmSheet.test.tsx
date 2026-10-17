import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { typeScale } from '../../../text-size';
import { borderWidth, colors, layout as tokensLayout, spacing, touchTarget } from '../../../tokens';
import { ConfirmSheet } from '../ConfirmSheet';
import { actionStyle, actionTextStyle, actionsStyle, backdropStyle, sheetStyle } from '../style';
import type { ConfirmSheetProps } from '../types';

/**
 * ConfirmSheet (design/components/ConfirmSheet/spec.md; AMENDMENTS-DISPLAY-NAV section 8), checked
 * on the element tree built by calling the component directly, as DisplaySheet.test.tsx does.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
const layout = vi.hoisted(() => ({ width: 'compact' as 'compact' | 'regular' }));
const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
const refs = vi.hoisted(() => ({ store: [] as { current: unknown }[], at: 0 }));
const safeArea = vi.hoisted(() => ({ insets: null as { top: number; right: number; bottom: number; left: number } | null }));
vi.mock('react-native', () => ({ Modal: 'Modal', Platform: platform, Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaInsetsContext: { name: 'insets' } }));
vi.mock('../../Heading', () => ({ Body: 'Body', Heading: 'Heading' }));
vi.mock('../../Layout', () => ({ useLayoutClass: () => ({ width: layout.width }) }));
vi.mock('../../TextSize', async () => {
  const { typeScale: scale } = await import('../../../text-size');
  return { useTypeScale: () => scale(1) };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const hooks = {
    useId: (): string => ':r2:',
    useContext: (): unknown => safeArea.insets,
    useEffect: (fn: () => void | (() => void)): void => {
      effects.push(fn);
    },
    useRef: (initial: unknown): { current: unknown } => {
      const at = refs.at++;
      refs.store[at] ??= { current: initial };
      return refs.store[at]!;
    },
  };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;

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

function props(over: Partial<ConfirmSheetProps> = {}): ConfirmSheetProps {
  return { visible: true, title: 'Leave this quest?', message: 'Stars from this try will not be saved.', cancelLabel: 'Keep playing', confirmLabel: 'Leave', onCancel: vi.fn(), onConfirm: vi.fn(), ...over };
}

function render(p: ConfirmSheetProps): El[] {
  effects.length = 0;
  refs.at = 0;
  refs.store = [];
  return all(ConfirmSheet(p));
}

describe('ConfirmSheet style (pure)', () => {
  it('a bottom sheet on a phone, a centred dialog of the reading width from the regular class', () => {
    expect(backdropStyle(false)).toMatchObject({ justifyContent: 'flex-end', backgroundColor: colors.surface.overlay });
    expect(backdropStyle(true)).toMatchObject({ justifyContent: 'center', alignItems: 'center' });
    expect(sheetStyle(false)).toMatchObject({ borderBottomLeftRadius: 0, backgroundColor: colors.surface.paper });
    expect(sheetStyle(true)).toMatchObject({ maxWidth: tokensLayout.maxWidth.reading });
    expect(actionsStyle(false)).toMatchObject({ flexDirection: 'column' });
    expect(actionsStyle(true)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });

  it('the safe choice is paper with the strong border, the confirm the primary fill; no red anywhere; both a touch target', () => {
    const cancel = actionStyle('cancel', false, { pressed: false });
    const confirm = actionStyle('confirm', false, { pressed: false });
    expect(cancel).toMatchObject({ backgroundColor: colors.surface.paper, borderColor: colors.border.strong, minHeight: touchTarget.min, width: '100%' });
    expect(confirm).toMatchObject({ backgroundColor: colors.brand.primary, minHeight: touchTarget.min });
    for (const style of [cancel, confirm, actionStyle('confirm', true, { pressed: true })]) {
      expect(JSON.stringify(style)).not.toContain(colors.feedback.danger);
    }
    expect(actionStyle('cancel', true, { pressed: false, focused: true })).toMatchObject({ borderWidth: borderWidth.thick, borderColor: colors.border.focus, flexGrow: 1 });
    expect(actionTextStyle('confirm', typeScale(1.5))).toMatchObject({ fontSize: 27, color: colors.text.onPrimary });
    expect(actionTextStyle('cancel', typeScale(1))).toMatchObject({ color: colors.text.primary });
  });
});

describe('ConfirmSheet', () => {
  it('an alertdialog named by its title and described by its message; cancel first, confirm second', () => {
    const tree = render(props());
    const sheet = byTestId(tree, 'confirm-sheet')!;
    expect(sheet.props.role).toBe('alertdialog');
    expect(sheet.props['aria-modal']).toBe(true);
    const title = tree.find((e) => e.props.nativeID === sheet.props['aria-labelledby'])!;
    expect(textOf(title)).toBe('Leave this quest?');
    const message = tree.find((e) => e.props.nativeID === sheet.props['aria-describedby'])!;
    expect(textOf(message)).toBe('Stars from this try will not be saved.');
    const buttons = tree.filter((e) => e.type === 'Pressable' && e.props.accessibilityRole === 'button' && e.props.testID !== 'confirm-sheet-backdrop');
    expect(buttons.map((b) => [b.props.testID, textOf(b)])).toEqual([
      ['confirm-sheet-cancel', 'Keep playing'],
      ['confirm-sheet-confirm', 'Leave'],
    ]);
  });

  it('no message: no description', () => {
    const sheet = byTestId(render(props({ message: undefined })), 'confirm-sheet')!;
    expect(sheet.props['aria-describedby']).toBeUndefined();
  });

  it('cancel, the backdrop and (on native) the system back cancel; confirm confirms', () => {
    platform.OS = 'android';
    const p = props();
    const tree = render(p);
    (byTestId(tree, 'confirm-sheet-cancel')!.props.onPress as () => void)();
    (byTestId(tree, 'confirm-sheet-backdrop')!.props.onPress as () => void)();
    (tree.find((e) => e.type === 'Modal')!.props.onRequestClose as () => void)();
    expect(p.onCancel).toHaveBeenCalledTimes(3);
    (byTestId(tree, 'confirm-sheet-confirm')!.props.onPress as () => void)();
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
    platform.OS = 'web';
  });

  it('the backdrop is hidden from assistive tech: Cancel is the one control with its name', () => {
    const backdrop = byTestId(render(props()), 'confirm-sheet-backdrop')!;
    expect(backdrop.props.accessibilityRole).toBeUndefined();
    expect(backdrop.props.accessibilityLabel).toBeUndefined();
    expect(backdrop.props.accessible).toBe(false);
    expect(backdrop.props['aria-hidden']).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('on the web one Escape press is one cancel: the Modal\'s keyup does not answer it again', () => {
    const p = props();
    const tree = render(p);
    (tree.find((e) => e.type === 'Modal')!.props.onRequestClose as () => void)();
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it('on the web: the safe choice takes focus, Escape cancels, and the opener gets focus back', () => {
    const log: string[] = [];
    const listeners = new Map<string, (event: { key?: string; repeat?: boolean; stopPropagation?: () => void }) => void>();
    const opener = { focus: () => log.push('opener') };
    vi.stubGlobal('document', {
      activeElement: opener,
      addEventListener: (type: string, fn: (event: { key?: string; repeat?: boolean; stopPropagation?: () => void }) => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    const p = props();
    const tree = render(p);
    const cancel = byTestId(tree, 'confirm-sheet-cancel')!;
    (cancel as unknown as { ref: (n: unknown) => void }).ref({ focus: () => log.push('cancel') });
    const cleanup = effects[0]!();
    expect(log).toEqual(['cancel']);
    listeners.get('keydown')!({ key: 'Enter' });
    expect(p.onCancel).not.toHaveBeenCalled();
    const stop = vi.fn();
    listeners.get('keydown')!({ key: 'Escape', stopPropagation: stop });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    // The page under the sheet does not hear it; a held key's repeats cancel nothing more.
    expect(stop).toHaveBeenCalledTimes(1);
    listeners.get('keydown')!({ key: 'Escape', repeat: true, stopPropagation: stop });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    (cleanup as () => void)();
    expect(log).toEqual(['cancel', 'opener']);
    expect(listeners.has('keydown')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('closed, or on native: no focus work', () => {
    vi.stubGlobal('document', { activeElement: null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(props({ visible: false }));
    expect(effects[0]!()).toBeUndefined();
    platform.OS = 'ios';
    render(props());
    expect(effects[0]!()).toBeUndefined();
    platform.OS = 'web';
    vi.unstubAllGlobals();
  });

  it('the bottom sheet clears the home indicator (the safe-area bottom inset); the centred dialog needs none', () => {
    expect(sheetStyle(false, 34)).toMatchObject({ paddingBottom: spacing.xl + 34 });
    expect(sheetStyle(true, 34)).toMatchObject({ paddingBottom: spacing.xl });
    safeArea.insets = { top: 47, right: 0, bottom: 34, left: 0 };
    expect((byTestId(render(props()), 'confirm-sheet')!.props.style as Record<string, unknown>).paddingBottom).toBe(spacing.xl + 34);
    layout.width = 'regular';
    expect((byTestId(render(props()), 'confirm-sheet')!.props.style as Record<string, unknown>).paddingBottom).toBe(spacing.xl);
    layout.width = 'compact';
    // No provider: no inset.
    safeArea.insets = null;
    expect((byTestId(render(props()), 'confirm-sheet')!.props.style as Record<string, unknown>).paddingBottom).toBe(spacing.xl);
  });

  it('the dialog from the regular class lays the buttons in one row', () => {
    layout.width = 'regular';
    const tree = render(props());
    const row = tree.find((e) => e.type === 'View' && (e.props.style as Record<string, unknown>)?.flexDirection === 'row')!;
    expect(row).toBeDefined();
    layout.width = 'compact';
  });
});
