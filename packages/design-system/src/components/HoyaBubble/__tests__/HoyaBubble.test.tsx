import { Children } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { spacing, touchTarget } from '../../../tokens';
import { HoyaBubble } from '../HoyaBubble';

/**
 * HoyaBubble's dismiss (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling the component
 * directly with react-native's hosts replaced by plain tags. react-native-web drops `hitSlop`, so the dismiss is at
 * least touchTarget.min each way itself, reaching into the bubble's padding; it is guarded and has no press delay.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../Hoya/Hoya', () => ({ Hoya: 'Hoya' }));
vi.mock('../../Heading/Heading', () => ({ Body: 'Body', Caption: 'Caption', Heading: 'Heading' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const useEffect = (): void => undefined;
  const hooks = { useRef, useCallback, useContext, useEffect };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;

function dismissOf(onDismiss?: () => void): El | undefined {
  const root = HoyaBubble({ message: 'Hi', onDismiss }) as El;
  return (Children.toArray(root.props.children as ReactNode) as El[]).find((c) => c.type === 'Pressable');
}

describe('HoyaBubble dismiss (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  afterEach(() => {
    app.clock = null;
    vi.useRealTimers();
  });

  it('has a hit area of at least touchTarget.min each way inside the bubble padding, no hitSlop and no press delay', () => {
    const el = dismissOf(() => undefined);
    expect(el).toBeDefined();
    const style = el?.props.style as Record<string, unknown>;
    expect(style.minWidth).toBe(touchTarget.min);
    expect(style.minHeight).toBe(touchTarget.min);
    expect(style.marginTop).toBe(-spacing.lg);
    expect(style.marginRight).toBe(-spacing.lg);
    expect(el?.props.hitSlop).toBeUndefined();
    expect(el?.props.delayPressIn).toBe(0);
  });

  it('no dismiss without a handler', () => {
    expect(dismissOf()).toBeUndefined();
  });

  it('a bounce closes once; a press during the app lock is dropped; a press that runs sets the lock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let until = 1_100;
    const lock = vi.fn((ms: number) => {
      until = Date.now() + ms;
    });
    app.clock = { until: () => until, lock };
    const onDismiss = vi.fn();
    const press = dismissOf(onDismiss)?.props.onPress as () => void;
    press();
    expect(onDismiss).not.toHaveBeenCalled();
    vi.setSystemTime(1_100);
    press();
    vi.setSystemTime(1_250);
    press();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith(TAP_LOCK_MS);
  });
});
