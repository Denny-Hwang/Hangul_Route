import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { GuardedPressable } from '../GuardedPressable';

/**
 * `GuardedPressable` (AMENDMENTS-TOUCH 6.9, row KT-9): the learner non-game Pressable, checked on the element tree built
 * by calling its render directly with react-native's hosts replaced by plain tags and the hooks as plain stand-ins.
 */
vi.mock('react-native', () => ({ Pressable: 'Pressable' }));
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const hooks = { useRef, useCallback, useContext };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;
type Render = (props: Record<string, unknown>, ref: unknown) => El;
const render = (GuardedPressable as unknown as { render: Render }).render;

describe('GuardedPressable (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  afterEach(() => {
    app.clock = null;
    vi.useRealTimers();
  });

  it('is a Pressable with no press delay that passes its props and ref through, without setsLock', () => {
    const ref = { current: null };
    const el = render({ testID: 't', accessibilityRole: 'button', setsLock: false, onPress: () => undefined }, ref);
    expect(el.type).toBe('Pressable');
    expect(el.props.delayPressIn).toBe(0);
    expect(el.props.unstable_pressDelay).toBe(0);
    expect(el.props.testID).toBe('t');
    expect(el.props.accessibilityRole).toBe('button');
    expect('setsLock' in el.props).toBe(false);
    expect((el as unknown as { ref: unknown }).ref ?? el.props.ref).toBe(ref);
  });

  it('with no handler it has none, so a tap on it sets no lock', () => {
    expect(render({}, null).props.onPress).toBeUndefined();
    expect(render({ onPress: null }, null).props.onPress).toBeUndefined();
  });

  it('a bounce within TAP_LOCK_MS runs once; a press during the app lock is dropped; a press that runs sets the lock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let until = 1_100;
    const lock = vi.fn((ms: number) => {
      until = Date.now() + ms;
    });
    app.clock = { until: () => until, lock };
    const onPress = vi.fn();
    const press = render({ onPress }, null).props.onPress as () => void;
    press();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(1_100);
    press();
    vi.setSystemTime(1_250);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith(TAP_LOCK_MS);
    vi.setSystemTime(1_100 + TAP_LOCK_MS);
    press();
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('setsLock false: waits for the app lock and drops its own bounce, but never sets the lock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    const lock = vi.fn();
    app.clock = { until: () => 2_250, lock };
    const onPress = vi.fn();
    const press = render({ onPress, setsLock: false }, null).props.onPress as () => void;
    press();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(2_250);
    press();
    vi.setSystemTime(2_300);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).not.toHaveBeenCalled();
  });
});
