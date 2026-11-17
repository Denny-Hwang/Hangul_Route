import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS, afterScreenSettles } from '../settle';

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: a sound played by itself waits for the screen. */
describe('afterScreenSettles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 350 ms', () => {
    expect(SCREEN_SETTLE_MS).toBe(350);
  });

  it('plays once the wait is over, and not before', () => {
    const play = vi.fn();
    afterScreenSettles(play);
    vi.advanceTimersByTime(SCREEN_SETTLE_MS - 1);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('a cancelled wait never plays (the screen left, or a speaker was tapped first)', () => {
    const play = vi.fn();
    const cancel = afterScreenSettles(play);
    vi.advanceTimersByTime(200);
    cancel();
    vi.advanceTimersByTime(10_000);
    expect(play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel after the sound was played does nothing', () => {
    const clear = vi.fn();
    let due: (() => void) | undefined;
    const cancel = afterScreenSettles(vi.fn(), {
      set: (run, ms) => {
        expect(ms).toBe(SCREEN_SETTLE_MS);
        due = run;
        return 7;
      },
      clear,
    });
    due?.();
    cancel();
    expect(clear).not.toHaveBeenCalled();
  });

  it('a second cancel does nothing', () => {
    const clear = vi.fn();
    const cancel = afterScreenSettles(vi.fn(), { set: () => 7, clear });
    cancel();
    cancel();
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
