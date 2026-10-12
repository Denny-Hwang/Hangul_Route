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
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: platform }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useId = (): string => ':hint:';
  return { ...actual, default: { ...actual, useId }, useId };
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
