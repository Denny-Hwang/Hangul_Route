import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAILY_REVIEW_HOME_WAIT_MS, onLateRead } from '../home-wait';

/**
 * F-CURR-002 section 4.3 ("never blocks new content"), row CM-14 (review of #831): Home waits for the Daily Review's
 * first read at most `DAILY_REVIEW_HOME_WAIT_MS`, then pins the day's plan without it.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('onLateRead', () => {
  it('a read that never settles: late once, after the wait', async () => {
    vi.useFakeTimers();
    const onLate = vi.fn();
    onLateRead(new Promise(() => undefined), DAILY_REVIEW_HOME_WAIT_MS, onLate);
    await vi.advanceTimersByTimeAsync(DAILY_REVIEW_HOME_WAIT_MS - 1);
    expect(onLate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onLate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * DAILY_REVIEW_HOME_WAIT_MS);
    expect(onLate).toHaveBeenCalledTimes(1);
  });

  it('a read that settles in time, or fails in time, is never late', async () => {
    vi.useFakeTimers();
    const onLate = vi.fn();
    onLateRead(Promise.resolve('ready'), DAILY_REVIEW_HOME_WAIT_MS, onLate);
    onLateRead(Promise.reject(new Error('unreadable')), DAILY_REVIEW_HOME_WAIT_MS, onLate);
    await vi.advanceTimersByTimeAsync(2 * DAILY_REVIEW_HOME_WAIT_MS);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('cancel clears the wait', async () => {
    vi.useFakeTimers();
    const onLate = vi.fn();
    const cancel = onLateRead(new Promise(() => undefined), DAILY_REVIEW_HOME_WAIT_MS, onLate);
    cancel();
    await vi.advanceTimersByTimeAsync(2 * DAILY_REVIEW_HOME_WAIT_MS);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('waits under the memory hooks\' 3 s', () => {
    expect(DAILY_REVIEW_HOME_WAIT_MS).toBeLessThanOrEqual(3000);
  });
});
