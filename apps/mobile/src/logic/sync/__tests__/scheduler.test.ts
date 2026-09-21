import { describe, expect, it, vi } from 'vitest';
import { SYNC_DEBOUNCE_MS, createSyncScheduler } from '../scheduler';

describe('sync scheduler (F-SYNC-002 §3.2)', () => {
  it('coalesces bursts per learner and runs once after the delay', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const s = createSyncScheduler(run, { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) });
    s.request('a');
    s.request('a');
    s.request('b');
    expect(s.pendingCount()).toBe(2);
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(s.pendingCount()).toBe(0);
    vi.useRealTimers();
  });

  it('flush runs everything pending immediately', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const s = createSyncScheduler(run, { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }, 10);
    s.request('a');
    s.flush();
    expect(run).toHaveBeenCalledWith('a');
    vi.advanceTimersByTime(20);
    expect(run).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
