import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenHeaderSlotContext } from '../../ScreenHeader/slot';
import { Screen } from '../Screen';

/**
 * `Screen` draws its surface's route-aware header first in its content, with the screen's options
 * (AMENDMENTS-DISPLAY-NAV section 7.1); with no provider it draws nothing. The contexts are read
 * through a mocked `useContext`, so the component is called directly.
 */
const slot = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('react-native', () => ({ ScrollView: 'ScrollView', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaInsetsContext: { name: 'insets' } }));
vi.mock('../../Layout', () => ({ useLayoutClass: () => ({ width: 'compact' }) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { ScreenHeaderSlotContext: slotContext } = await import('../../ScreenHeader/slot');
  const useContext = (context: unknown): unknown => (context === slotContext ? slot.value : null);
  return { ...actual, useContext, default: { ...actual, useContext } };
});

type El = React.ReactElement<Record<string, unknown>>;

function all(node: React.ReactNode): El[] {
  if (!React.isValidElement(node)) return [];
  const el = node as El;
  const kids = typeof el.props.children === 'function' ? [] : React.Children.toArray(el.props.children as React.ReactNode);
  return [el, ...kids.flatMap(all)];
}

function Slot(): null {
  return null;
}

describe('Screen and its header slot', () => {
  it('with a provider: the slot comes first in the content and gets the screen\'s options', () => {
    slot.value = Slot;
    const options = { title: 'Food', displayHidden: true };
    const tree = all(Screen({ header: options, children: <span>body</span> }));
    const headerAt = tree.findIndex((e) => e.type === Slot);
    const bodyAt = tree.findIndex((e) => e.type === 'span');
    expect(headerAt).toBeGreaterThan(-1);
    expect(headerAt).toBeLessThan(bodyAt);
    expect(tree[headerAt]!.props.options).toBe(options);
  });

  it('a screen with no options hands the slot none (a root then draws no header)', () => {
    slot.value = Slot;
    const tree = all(Screen({ children: <span>body</span> }));
    expect(tree.find((e) => e.type === Slot)!.props.options).toBeUndefined();
  });

  it('without a provider nothing is drawn above the content', () => {
    slot.value = null;
    const tree = all(Screen({ header: { title: 'Food' }, children: <span>body</span> }));
    expect(tree.some((e) => e.type === Slot)).toBe(false);
  });

  it('the slot context starts empty', () => {
    expect((ScreenHeaderSlotContext as unknown as { _currentValue: unknown })._currentValue).toBeNull();
  });
});
