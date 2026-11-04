import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { TapLockContext, TapLockProvider, type TapLockClock } from '../TapLockProvider';

/**
 * The app-level `board` lock (docs/specs/AMENDMENTS-TOUCH.md KT-D5, rule 10): one clock above the navigator that every
 * board and guarded press reads, so a lock outlives a keyed remount and a screen change. Called directly with React's
 * state hooks kept across calls (as TapBoard.test.tsx does). The boards' side of it (a board mounted 320 ms after a
 * commit is locked until 400 ms) is in controller.test.ts, T19.
 */
const hooks = vi.hoisted(() => ({ store: [] as unknown[], at: 0, effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = <T,>(init: () => T): { value: T } => {
    const at = hooks.at++;
    if (hooks.store.length <= at) hooks.store.push({ value: init() });
    return hooks.store[at] as { value: T };
  };
  const stubs = {
    useState: <T,>(initial: T) => {
      const s = slot(() => initial);
      return [s.value, (v: T) => (s.value = v)] as const;
    },
    useRef: <T,>(initial: T) => slot(() => ({ current: initial })).value,
    useMemo: <T,>(fn: () => T): T => fn(),
    useEffect: (fn: () => void | (() => void)) => {
      hooks.effects.push(fn);
    },
  };
  return { ...actual, ...stubs, default: { ...actual, ...stubs } };
});

type El = ReactElement<{ value: TapLockClock; children: unknown }>;

function render(): TapLockClock {
  hooks.at = 0;
  const el = TapLockProvider({ children: 'app' }) as El;
  expect(el.type).toBe(TapLockContext.Provider);
  expect(el.props.children).toBe('app');
  return el.props.value;
}

beforeEach(() => {
  hooks.store = [];
  hooks.effects = [];
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TapLockProvider', () => {
  it('starts free; lock(ms) sets the clock and re-renders its readers as locked, then free when it ends', () => {
    expect(render().locked).toBe(false);
    expect(render().until()).toBe(0);
    render().lock(TAP_LOCK_MS);
    expect(render().locked).toBe(true);
    expect(render().until()).toBe(10_000 + TAP_LOCK_MS);
    vi.advanceTimersByTime(TAP_LOCK_MS - 1);
    expect(render().locked).toBe(true);
    vi.advanceTimersByTime(1);
    expect(render().locked).toBe(false);
  });

  it('extendTo only extends; a longer lock set while one runs keeps it locked to the end', () => {
    const clock = render();
    clock.extendTo(10_000 + 900);
    clock.extendTo(10_000 + 100);
    expect(render().until()).toBe(10_900);
    vi.advanceTimersByTime(500);
    render().lock(TAP_LOCK_MS);
    expect(render().until()).toBe(10_900);
    vi.advanceTimersByTime(399);
    expect(render().locked).toBe(true);
    vi.advanceTimersByTime(1);
    expect(render().locked).toBe(false);
  });

  it('a timer that fires early waits out the rest (the clock moved on)', () => {
    const clock = render();
    clock.extendTo(10_000 + 300);
    // The clock is extended by a direct write the timer has not seen (another board on the same clock).
    clock.extendTo(10_000 + 600);
    vi.advanceTimersByTime(300);
    expect(render().locked).toBe(true);
    vi.advanceTimersByTime(300);
    expect(render().locked).toBe(false);
  });

  it('unmount clears the timer', () => {
    render().lock(TAP_LOCK_MS);
    for (const effect of hooks.effects.splice(0)) {
      const cleanup = effect();
      if (typeof cleanup === 'function') cleanup();
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
