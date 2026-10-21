import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefetchWhenIdle as nativePrefetch } from '../lesson-prefetch';
import { PREFETCH_FALLBACK_MS, PREFETCH_IDLE_TIMEOUT_MS, prefetchWhenIdle } from '../lesson-prefetch.web';

describe('prefetchWhenIdle (F-CURR-002 §10: every lesson chunk once the first screen is up)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the load when the page is idle, with a timeout, and can be cancelled', () => {
    const load = vi.fn(() => Promise.resolve());
    let queued: (() => void) | undefined;
    const host = {
      requestIdleCallback: vi.fn((cb: () => void, options?: { timeout: number }) => {
        queued = cb;
        expect(options).toEqual({ timeout: PREFETCH_IDLE_TIMEOUT_MS });
        return 7;
      }),
      cancelIdleCallback: vi.fn(),
    };
    const cancel = prefetchWhenIdle(load, host);
    expect(load).not.toHaveBeenCalled();
    queued?.();
    expect(load).toHaveBeenCalledTimes(1);
    cancel();
    expect(host.cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it('without requestIdleCallback (Safari) waits a short timer; a failed load never throws', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    prefetchWhenIdle(load, {});
    vi.advanceTimersByTime(PREFETCH_FALLBACK_MS - 1);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(load).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    const cancelled = vi.fn(() => Promise.resolve());
    prefetchWhenIdle(cancelled, {})();
    vi.advanceTimersByTime(PREFETCH_FALLBACK_MS);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('uses the page’s own idle callback by default, and the native build loads nothing', () => {
    expect(typeof prefetchWhenIdle(() => Promise.resolve())).toBe('function');
    const load = vi.fn(() => Promise.resolve());
    nativePrefetch(load)();
    expect(load).not.toHaveBeenCalled();
  });
});
