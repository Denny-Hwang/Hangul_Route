import { Children } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { spacing, touchTarget } from '../../../tokens';
import { HoyaBubble } from '../HoyaBubble';

/**
 * HoyaBubble's dismiss (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling the component
 * directly with the hosts replaced by plain tags. react-native-web drops `hitSlop`, so the dismiss is at least
 * touchTarget.min each way itself, reaching into the bubble's padding; it is a `GuardedPressable` that sets the lock.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../TapBoard/GuardedPressable', () => ({ GuardedPressable: 'GuardedPressable' }));
vi.mock('../../Hoya/Hoya', () => ({ Hoya: 'Hoya' }));
vi.mock('../../Heading/Heading', () => ({ Body: 'Body', Caption: 'Caption', Heading: 'Heading' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useEffect = (): void => undefined;
  return { ...actual, useEffect, default: { ...actual, useEffect } };
});

type El = ReactElement<Record<string, unknown>>;

function dismissOf(onDismiss?: () => void): El | undefined {
  const root = HoyaBubble({ message: 'Hi', onDismiss }) as El;
  return (Children.toArray(root.props.children as ReactNode) as El[]).find((c) => c.type === 'GuardedPressable');
}

describe('HoyaBubble dismiss (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  it('is a guarded press that sets the lock, at least touchTarget.min each way inside the bubble padding, no hitSlop', () => {
    const onDismiss = vi.fn();
    const el = dismissOf(onDismiss);
    expect(el).toBeDefined();
    expect(el?.props.onPress).toBe(onDismiss);
    expect(el?.props.setsLock).toBeUndefined();
    const style = el?.props.style as Record<string, unknown>;
    expect(style.minWidth).toBe(touchTarget.min);
    expect(style.minHeight).toBe(touchTarget.min);
    expect(style.marginTop).toBe(-spacing.lg);
    expect(style.marginRight).toBe(-spacing.lg);
    expect(el?.props.hitSlop).toBeUndefined();
  });

  it('no dismiss without a handler', () => {
    expect(dismissOf()).toBeUndefined();
  });
});
