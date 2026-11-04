import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { Card } from '../Card';

/**
 * Card's optional `accessibilityHint` (F-STORY-004 PR 4.8f: a Home card that is no longer open
 * gives the ask as its hint, as a closed Library tile does), checked on the element tree built by
 * calling the component directly with react-native's hosts replaced by plain tags.
 */
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
/** The app-level tap lock the press guard reads and sets (AMENDMENTS-TOUCH KT-D5); null: no provider. */
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  // Called outside a render here: the guard's ref and callback hooks are plain stand-ins, and its one context is the lock.
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const hooks = { useRef, useCallback, useContext };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;

describe('Card accessibilityHint', () => {
  it('a pressable card passes the hint next to its label', () => {
    const el = Card({ children: null, onPress: () => undefined, accessibilityLabel: 'A card', accessibilityHint: 'Ask a grown-up' }) as El;
    expect(el.type).toBe('Pressable');
    expect(el.props.accessibilityLabel).toBe('A card');
    expect(el.props.accessibilityHint).toBe('Ask a grown-up');
  });

  it('a card with no hint renders none', () => {
    const el = Card({ children: null, onPress: () => undefined, accessibilityLabel: 'A card' }) as El;
    expect(el.props.accessibilityHint).toBeUndefined();
  });

  it('a static card passes the hint as well', () => {
    const el = Card({ children: null, accessibilityHint: 'Ask a grown-up' }) as El;
    expect(el.type).toBe('View');
    expect(el.props.accessibilityHint).toBe('Ask a grown-up');
  });
});

describe('Card press guard and no press delay (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  afterEach(() => {
    app.clock = null;
    vi.useRealTimers();
  });

  const press = (onPress: () => void): (() => void) => (Card({ children: null, onPress }) as El).props.onPress as () => void;

  it('shows its pressed look on the first touch frame (no 50 ms delayPressIn)', () => {
    const el = Card({ children: null, onPress: () => undefined }) as El;
    expect(el.props.delayPressIn).toBe(0);
    expect(el.props.unstable_pressDelay).toBe(0);
  });

  it('a bounce within TAP_LOCK_MS opens once; a press after it opens again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const onPress = vi.fn();
    const run = press(onPress);
    run();
    vi.setSystemTime(1_200);
    run();
    expect(onPress).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000 + TAP_LOCK_MS);
    run();
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('a press during the app lock is dropped; a press that runs sets the lock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    let until = 5_300;
    const lock = vi.fn((ms: number) => {
      until = Date.now() + ms;
    });
    app.clock = { until: () => until, lock };
    const onPress = vi.fn();
    const run = press(onPress);
    run();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(5_300);
    run();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith(TAP_LOCK_MS);
  });

  it('a static card has no press props at all', () => {
    const el = Card({ children: null }) as El;
    expect(el.props.onPress).toBeUndefined();
    expect(el.props.delayPressIn).toBeUndefined();
  });
});
