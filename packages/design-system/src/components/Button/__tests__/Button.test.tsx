import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import type { ButtonProps } from '../types';

/**
 * Button's `accessibilityHint` (F-BILL-002 B-9), checked on the element tree built by calling the
 * component directly with react-native's hosts replaced by plain tags (as ChoiceCard.test.tsx does).
 * Native reads the prop as the hint; react-native-web drops it, so on the web the button is
 * described (`aria-describedby`) by a hidden copy whose `id` is that id (`id`, not the `nativeID`
 * react-native-web 0.19 warns is deprecated). A button without a
 * hint, or on native, renders no extra node and no `aria-describedby`.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
/** The effects of the last call, kept so a test can run them after handing the Pressable its node. */
const effects = vi.hoisted(() => [] as (() => void)[]);
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: platform }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useId = (): string => ':hint:';
  // Called outside a render here: the ref, effect and callback hooks are plain stand-ins.
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useEffect = (fn: () => void): void => {
    effects.push(fn);
  };
  const useCallback = <T,>(fn: T): T => fn;
  const hooks = { useId, useRef, useEffect, useCallback };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;

const HINT = 'Opens the billing page';

function pressable(props: Partial<ButtonProps>): El {
  return Button({ label: 'Open billing', onPress: () => undefined, ...props }) as El;
}

/** The Pressable's children (a render function of `{ pressed }`), flattened, nulls dropped. */
function body(el: El): El[] {
  const render = el.props.children as (s: { pressed: boolean }) => El;
  return React.Children.toArray(render({ pressed: false }).props.children as React.ReactNode) as El[];
}

const textOf = (el: El): string => React.Children.toArray(el.props.children as React.ReactNode).join('');

describe('Button accessibilityHint', () => {
  it('web with a hint: aria-describedby names a hidden Text carrying the hint; the name stays the label', () => {
    platform.OS = 'web';
    const el = pressable({ accessibilityHint: HINT });
    expect(el.type).toBe('Pressable');
    expect(el.props['aria-describedby']).toBe(':hint:');
    expect(el.props.accessibilityLabel).toBe('Open billing');
    expect(el.props.accessibilityHint).toBe(HINT);
    const hidden = body(el).filter((c) => c.props.id !== undefined);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.type).toBe('Text');
    expect(hidden[0]?.props.id).toBe(el.props['aria-describedby']);
    expect('nativeID' in (hidden[0]?.props ?? {})).toBe(false);
    expect(hidden[0]?.props.style).toEqual({ display: 'none' });
    expect(textOf(hidden[0] as El)).toBe(HINT);
    // The visible label is the only other text: the hint does not join the accessible name.
    expect(body(el).filter((c) => c.type === 'Text').map(textOf)).toEqual(['Open billing', HINT]);
  });

  it('web without a hint: no aria-describedby and no extra node', () => {
    platform.OS = 'web';
    const el = pressable({});
    expect('aria-describedby' in el.props).toBe(false);
    expect(el.props.accessibilityHint).toBeUndefined();
    expect(body(el).map((c) => c.type)).toEqual(['Text']);
  });

  it('native: the hint passes through as accessibilityHint, with no aria-describedby and no extra node', () => {
    for (const os of ['ios', 'android']) {
      platform.OS = os;
      for (const hint of [HINT, undefined]) {
        const el = pressable(hint === undefined ? {} : { accessibilityHint: hint });
        expect('aria-describedby' in el.props, os).toBe(false);
        expect(el.props.accessibilityHint, os).toBe(hint);
        expect(body(el).map((c) => c.type), os).toEqual(['Text']);
      }
    }
  });
});

describe('Button softDisabled (a waiting button that stays focusable)', () => {
  it('web: stays an enabled <button> in the tab order (aria-disabled is written to its node), announced disabled, a press does nothing', () => {
    platform.OS = 'web';
    const onPress = vi.fn();
    const el = pressable({ softDisabled: true, onPress, accessibilityHint: HINT });
    expect(el.props.disabled).toBe(false);
    expect(el.props.accessibilityState).toEqual({ disabled: true });
    expect(el.props.onPress).toBeUndefined();
    expect(el.props['aria-describedby']).toBe(':hint:');
  });

  it('native: plainly disabled (a screen reader still reaches a disabled view)', () => {
    platform.OS = 'ios';
    const el = pressable({ softDisabled: true });
    expect(el.props.disabled).toBe(true);
    expect(el.props.accessibilityState).toEqual({ disabled: true });
    platform.OS = 'web';
  });

  it('a hard disabled wins, and a plain button is enabled', () => {
    platform.OS = 'web';
    expect(pressable({ softDisabled: true, disabled: true }).props.disabled).toBe(true);
    expect(pressable({}).props.disabled).toBe(false);
    expect(pressable({}).props.accessibilityState).toEqual({ disabled: false });
  });

  it('forwards the node to a callback or object pressableRef', () => {
    const fn = vi.fn();
    ((pressable({ pressableRef: fn }) as unknown as { ref: (v: unknown) => void }).ref)('node');
    expect(fn).toHaveBeenCalledWith('node');
    const obj = { current: null as unknown };
    ((pressable({ pressableRef: obj as unknown as ButtonProps['pressableRef'] }) as unknown as { ref: (v: unknown) => void }).ref)('node2');
    expect(obj.current).toBe('node2');
  });
});

/**
 * The web half of softDisabled relies on react-native-web handing the Pressable's ref the host DOM node, which
 * exposes `setAttribute` and `removeAttribute` (react-native-web 0.19: the ref is the element itself). The effect
 * writes `aria-disabled` there because react-native-web would otherwise only draw it through `disabled`, which takes
 * the <button> out of the tab order. A host without those methods (a test renderer, a future react-native-web that
 * wraps the node) gets no attribute and no crash: the button still reads disabled through `accessibilityState`.
 */
describe('Button softDisabled on the web host node (react-native-web exposes setAttribute)', () => {
  const mount = (props: Partial<ButtonProps>, node: unknown): void => {
    effects.length = 0;
    const el = pressable(props) as unknown as { ref: (v: unknown) => void };
    el.ref(node);
    for (const run of effects) run();
  };
  const domNode = () => {
    const attrs = new Map<string, string>();
    return {
      attrs,
      setAttribute: vi.fn((k: string, v: string) => void attrs.set(k, v)),
      removeAttribute: vi.fn((k: string) => void attrs.delete(k)),
    };
  };

  it('writes aria-disabled="true" on the node while soft, and removes it once the button is ready', () => {
    platform.OS = 'web';
    const node = domNode();
    mount({ softDisabled: true }, node);
    expect(node.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
    expect(node.attrs.get('aria-disabled')).toBe('true');
    mount({ softDisabled: false }, node);
    expect(node.removeAttribute).toHaveBeenCalledWith('aria-disabled');
    expect(node.attrs.has('aria-disabled')).toBe(false);
  });

  it('a hard disabled button and a native button never touch the node', () => {
    const node = domNode();
    platform.OS = 'web';
    mount({ softDisabled: true, disabled: true }, node);
    platform.OS = 'ios';
    mount({ softDisabled: true }, node);
    platform.OS = 'web';
    expect(node.setAttribute).not.toHaveBeenCalled();
    expect(node.removeAttribute).not.toHaveBeenCalled();
  });

  it('a host node without setAttribute is left alone, without throwing', () => {
    platform.OS = 'web';
    expect(() => mount({ softDisabled: true }, {})).not.toThrow();
    expect(() => mount({ softDisabled: true }, null)).not.toThrow();
  });
});
