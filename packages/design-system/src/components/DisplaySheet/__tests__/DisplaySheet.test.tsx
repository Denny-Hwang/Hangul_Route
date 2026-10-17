import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TextSizeStep } from '../../../text-size';
import { DisplaySheet } from '../DisplaySheet';
import { segmentGlyphSize, showLanguageRow, textSizeOptions } from '../model';
import type { DisplaySheetProps } from '../types';

/**
 * The Display (Aa) sheet (owner items 6 and 7; design/components/DisplaySheet/spec.md), checked
 * on the element tree built by calling the component directly with react-native's hosts and the
 * design-system parts replaced by plain tags (as Button.test.tsx does). Local function components
 * (the radio rows) are expanded by calling them.
 */
const platform = vi.hoisted(() => ({ OS: 'ios' }));
const layout = vi.hoisted(() => ({ width: 'compact' as 'compact' | 'regular' }));
const textSize = vi.hoisted(() => ({ factor: 1 }));
const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock('react-native', () => ({ Modal: 'Modal', Platform: platform, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' }));
vi.mock('../../Button', () => ({ Button: 'Button' }));
vi.mock('../../Heading', () => ({ Body: 'Body', Heading: 'Heading' }));
vi.mock('../../Spacer', () => ({ Spacer: 'Spacer' }));
vi.mock('../../Layout', () => ({ useLayoutClass: () => ({ width: layout.width }) }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(textSize.factor) };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const hooks = {
    useId: (): string => ':r1:',
    useEffect: (fn: () => void | (() => void)): void => {
      effects.push(fn);
    },
  };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;

/** Calls local function components so the whole tree is plain tags. */
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

const LABELS: Record<TextSizeStep, string> = { standard: 'Standard', large: 'Large', larger: 'Larger', largest: 'Largest' };

function props(over: Partial<DisplaySheetProps> = {}): DisplaySheetProps {
  return {
    visible: true,
    title: 'Display',
    language: {
      label: 'Language on this device',
      options: [
        { value: 'en', label: 'English', lang: 'en' },
        { value: 'es', label: 'Español', lang: 'es' },
        { value: 'ko', label: '한국어', lang: 'ko' },
      ],
      selected: 'en',
      onSelect: vi.fn(),
    },
    textSize: { label: 'Text size', options: textSizeOptions(LABELS), selected: 'standard', onSelect: vi.fn(), sample: 'Words look like this.', glyph: 'Aa' },
    note: 'Every page on this device uses these.',
    doneLabel: 'Done',
    closeLabel: 'Close',
    onClose: vi.fn(),
    ...over,
  };
}

function render(p: DisplaySheetProps): El[] {
  effects.length = 0;
  return all(expand(DisplaySheet(p)));
}

/** A radio segment's inner content (its children are a plain node here, not a render function). */
const segments = (tree: El[], group: string): El[] => tree.filter((e) => e.props.role === 'radio' && String(e.props.testID).startsWith(`display-sheet-${group}-`));

describe('DisplaySheet model', () => {
  it('four text size options in step order, labelled by the caller', () => {
    expect(textSizeOptions(LABELS).map((o) => [o.value, o.label])).toEqual([
      ['standard', 'Standard'],
      ['large', 'Large'],
      ['larger', 'Larger'],
      ['largest', 'Largest'],
    ]);
  });

  it('each segment draws its Aa at its own step', () => {
    expect([segmentGlyphSize('standard'), segmentGlyphSize('large'), segmentGlyphSize('larger'), segmentGlyphSize('largest')]).toEqual([18, 21, 23, 27]);
  });

  it('the Language row shows only with two or more languages', () => {
    expect(showLanguageRow(null)).toBe(false);
    expect(showLanguageRow(undefined)).toBe(false);
    expect(showLanguageRow([{ value: 'en', label: 'English' }])).toBe(false);
    expect(showLanguageRow([{ value: 'en', label: 'English' }, { value: 'ko', label: '한국어' }])).toBe(true);
  });
});

describe('DisplaySheet element tree', () => {
  it('a modal dialog named by its title, with two radio groups, the sample, the note and Done', () => {
    const tree = render(props());
    expect(tree[0]?.type).toBe('Modal');
    expect(tree[0]?.props.visible).toBe(true);
    const dialog = byTestId(tree, 'display-sheet') as El;
    expect(dialog.props.role).toBe('dialog');
    expect(dialog.props['aria-modal']).toBe(true);
    const titleBox = tree.find((e) => e.props.nativeID === dialog.props['aria-labelledby']) as El;
    expect(textOf(titleBox)).toBe('Display');
    const groups = tree.filter((e) => e.props.role === 'radiogroup');
    expect(groups.map((g) => g.props['aria-label'])).toEqual(['Language on this device', 'Text size']);
    expect(textOf(byTestId(tree, 'display-sheet-sample') as El)).toBe('Words look like this.');
    expect(tree.some((e) => e.type === 'Body' && textOf(e) === 'Every page on this device uses these.')).toBe(true);
    expect(byTestId(tree, 'display-sheet-done')?.props.label).toBe('Done');
  });

  it('language options are radios named by their endonym, each in its own lang, the current one checked', () => {
    const p = props();
    const tree = render(p);
    const radios = segments(tree, 'language');
    expect(radios.map((r) => [r.props.accessibilityLabel, r.props.lang, r.props['aria-checked']])).toEqual([
      ['English', 'en', true],
      ['Español', 'es', false],
      ['한국어', 'ko', false],
    ]);
    (radios[2]?.props.onPress as () => void)();
    expect(p.language?.onSelect).toHaveBeenCalledWith('ko');
  });

  it('text size: four radios, the chosen one checked, each with an Aa hidden from assistive tech', () => {
    const p = props({ textSize: { ...props().textSize, selected: 'larger' } });
    const tree = render(p);
    const radios = segments(tree, 'text-size');
    expect(radios.map((r) => [r.props.accessibilityLabel, r.props['aria-checked']])).toEqual([
      ['Standard', false],
      ['Large', false],
      ['Larger', true],
      ['Largest', false],
    ]);
    const glyphs = tree.filter((e) => e.type === 'Text' && textOf(e) === 'Aa');
    expect(glyphs).toHaveLength(4);
    expect(glyphs.every((g) => g.props['aria-hidden'] === true)).toBe(true);
    expect(glyphs.map((g) => (g.props.style as { fontSize: number }).fontSize)).toEqual([18, 21, 23, 27]);
    (radios[3]?.props.onPress as () => void)();
    expect(p.textSize.onSelect).toHaveBeenCalledWith('largest');
  });

  it('every segment is at least a touch target and the labels grow with the chosen size', () => {
    textSize.factor = 1.5;
    const tree = render(props());
    const radio = segments(tree, 'text-size')[0] as El;
    const style = (radio.props.style as (s: { pressed: boolean }) => { minHeight: number; minWidth: number; flexBasis: unknown })({ pressed: false });
    expect(style.minHeight).toBe(64);
    expect(style.minWidth).toBe(64);
    // On a phone the four steps sit two per row, so they fit 320 wide at Largest; languages size to their endonym.
    expect(style.flexBasis).toBe('45%');
    const lang = segments(tree, 'language')[0] as El;
    expect((lang.props.style as (s: { pressed: boolean }) => { flexBasis: unknown })({ pressed: true }).flexBasis).toBe('auto');
    const label = tree.find((e) => e.type === 'Text' && textOf(e) === 'Standard') as El;
    expect((label.props.style as { fontSize: number }).fontSize).toBe(24);
    textSize.factor = 1;
  });

  it('no Language row with one language or none, and no confirm step until another language is chosen', () => {
    const one = render(props({ language: { ...props().language!, options: [{ value: 'en', label: 'English' }] } }));
    expect(one.filter((e) => e.props.role === 'radiogroup')).toHaveLength(1);
    expect(render(props({ language: null })).filter((e) => e.props.role === 'radiogroup')).toHaveLength(1);
    expect(byTestId(render(props()), 'display-sheet-language-confirm')).toBeUndefined();
  });

  it('another language: the confirm step in that language replaces the radios; Use and Back reach the caller', () => {
    const onUse = vi.fn();
    const onBack = vi.fn();
    const tree = render(
      props({
        language: {
          ...props().language!,
          confirm: { question: '¿Usar Español en este dispositivo?', use: 'Usar Español', back: 'Volver a English', lang: 'es', onUse, onBack },
        },
      }),
    );
    const step = byTestId(tree, 'display-sheet-language-confirm') as El;
    expect(step.props.lang).toBe('es');
    expect(step.props.accessibilityLanguage).toBe('es');
    expect(segments(tree, 'language')).toHaveLength(0);
    expect(tree.some((e) => e.type === 'Body' && textOf(e) === '¿Usar Español en este dispositivo?')).toBe(true);
    const use = byTestId(tree, 'display-sheet-language-use') as El;
    const back = byTestId(tree, 'display-sheet-language-back') as El;
    expect([use.props.label, back.props.label]).toEqual(['Usar Español', 'Volver a English']);
    (use.props.onPress as () => void)();
    (back.props.onPress as () => void)();
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    // The Text size row stays usable under it.
    expect(segments(tree, 'text-size')).toHaveLength(4);
  });

  it('extra rows (All lessons romanization) come above Language', () => {
    const tree = render(props({ children: <Body2 /> }));
    const order = tree.map((e) => (e.type === 'Extra' ? 'extra' : e.props.role === 'radiogroup' ? String(e.props['aria-label']) : null)).filter(Boolean);
    expect(order).toEqual(['extra', 'Language on this device', 'Text size']);
  });

  it('the scrim and Done close it; a phone gets the handle, a regular window a centred dialog', () => {
    const p = props();
    const tree = render(p);
    (byTestId(tree, 'display-sheet-scrim')?.props.onPress as () => void)();
    (byTestId(tree, 'display-sheet-done')?.props.onPress as () => void)();
    expect(p.onClose).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, 'display-sheet-scrim')?.props.accessibilityLabel).toBe('Close');
    expect(tree.some((e) => e.props['aria-hidden'] === true && e.type === 'View')).toBe(true);
    layout.width = 'regular';
    const wide = render(props());
    expect((byTestId(wide, 'display-sheet')?.props.style as { maxWidth?: number }).maxWidth).toBe(512);
    // The dialog has room for the four steps in one row of equal columns.
    const step = segments(wide, 'text-size')[0] as El;
    expect((step.props.style as (s: { pressed: boolean; focused: boolean }) => { flexBasis: unknown; borderWidth: number })({ pressed: false, focused: true })).toMatchObject({ flexBasis: 0, borderWidth: 3 });
    expect(wide.some((e) => e.props['aria-hidden'] === true && e.type === 'View')).toBe(false);
    layout.width = 'compact';
  });

  it('on the web, Escape closes it while it is open; native adds no listener', () => {
    const added: string[] = [];
    let handler: ((e: { key?: string }) => void) | null = null;
    vi.stubGlobal('document', {
      addEventListener: (type: string, fn: (e: { key?: string }) => void) => {
        added.push(type);
        handler = fn;
      },
      removeEventListener: (type: string) => added.push(`-${type}`),
    });
    try {
      platform.OS = 'web';
      const p = props();
      render(p);
      const cleanup = effects.map((fn) => fn()).find((c) => typeof c === 'function');
      expect(added).toEqual(['keydown']);
      handler!({ key: 'Enter' });
      handler!({ key: 'Escape' });
      expect(p.onClose).toHaveBeenCalledTimes(1);
      (cleanup as () => void)();
      expect(added).toEqual(['keydown', '-keydown']);
      added.length = 0;
      render(props({ visible: false }));
      effects.forEach((fn) => fn());
      platform.OS = 'ios';
      render(props());
      effects.forEach((fn) => fn());
      expect(added).toEqual([]);
    } finally {
      platform.OS = 'ios';
      vi.unstubAllGlobals();
    }
  });
});

function Body2(): React.ReactElement {
  return React.createElement('Extra');
}
