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

/**
 * F-A11Y-001 §3.3 (row AF-1; design/components/AnswerFeedback/spec.md, "HoyaBubble live"): a game that says its result
 * through the answer announcer passes `live={false}` on its result bubble, so the result is not read twice. Every other
 * caller keeps today's polite region.
 */
describe('HoyaBubble live (F-A11Y-001 AF-1)', () => {
  it('is a polite live region by default', () => {
    const root = HoyaBubble({ message: 'Hi' }) as El;
    expect(root.props.accessibilityLiveRegion).toBe('polite');
  });

  it('live={false}: drawn the same, but no live region', () => {
    const live = HoyaBubble({ message: 'Hi', tone: 'thinking' }) as El;
    const quiet = HoyaBubble({ message: 'Hi', tone: 'thinking', live: false }) as El;
    expect(quiet.props.accessibilityLiveRegion).toBe('none');
    expect(quiet.props.style).toEqual(live.props.style);
    expect(JSON.stringify(quiet.props)).not.toContain('assertive');
  });
});
