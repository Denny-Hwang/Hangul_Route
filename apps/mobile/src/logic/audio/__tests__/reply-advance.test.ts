import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADVANCE_MAX_MS, ADVANCE_MIN_MS, ANSWER_SOUND_MAX_MS, afterReply, afterSound } from '../reply-advance';

/**
 * Tap & Respond (F-AUDIO-004 §3.9, A-5b): after a right reply the next turn
 * waits for the reply to be said, at least ADVANCE_MIN_MS and at most
 * ADVANCE_MAX_MS, so the reply is never cut off by the next NPC line.
 */
describe('afterReply', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const settledAt = (reply: Promise<unknown>): { done: () => boolean } => {
    let done = false;
    void afterReply(reply).then(() => {
      done = true;
    });
    return { done: () => done };
  };

  it('uses the documented bounds', () => {
    expect(ADVANCE_MIN_MS).toBe(900);
    expect(ADVANCE_MAX_MS).toBe(6000);
  });

  it('waits at least the minimum even when the reply ends at once (or could not play)', async () => {
    const t = settledAt(Promise.resolve('unavailable'));
    await vi.advanceTimersByTimeAsync(ADVANCE_MIN_MS - 1);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });

  it('waits for a reply that is still being said, past the minimum', async () => {
    let end: (v: string) => void = () => undefined;
    const t = settledAt(new Promise<string>((resolve) => (end = resolve)));
    await vi.advanceTimersByTimeAsync(2500);
    expect(t.done()).toBe(false);
    end('played');
    await vi.advanceTimersByTimeAsync(0);
    expect(t.done()).toBe(true);
  });

  it('never waits longer than the maximum for a reply that does not end', async () => {
    const t = settledAt(new Promise<string>(() => undefined));
    await vi.advanceTimersByTimeAsync(ADVANCE_MAX_MS - 1);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });

  it('a reply that fails still moves on after the minimum', async () => {
    const t = settledAt(Promise.reject(new Error('engine')));
    await vi.advanceTimersByTimeAsync(ADVANCE_MIN_MS);
    expect(t.done()).toBe(true);
  });
});

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: `afterReply` generalised, one helper for every game. */
describe('afterSound (QS-4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const watch = (pending: Promise<void>): { done: () => boolean } => {
    let done = false;
    void pending.then(() => {
      done = true;
    });
    return { done: () => done };
  };

  it('caps a word at 2500 ms by default', () => {
    expect(ANSWER_SOUND_MAX_MS).toBe(2500);
  });

  it('holds the advance until the sound ends, past the game\'s own delay', async () => {
    let end: () => void = () => undefined;
    const t = watch(afterSound(new Promise<void>((resolve) => (end = resolve)), { minMs: 700 }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.done()).toBe(false);
    end();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.done()).toBe(true);
  });

  it('a sound that ends early still waits the game\'s own delay', async () => {
    const t = watch(afterSound(Promise.resolve('played'), { minMs: 700 }));
    await vi.advanceTimersByTimeAsync(699);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });

  it('releases at the cap when the sound never ends', async () => {
    const t = watch(afterSound(new Promise<void>(() => undefined), { minMs: 700 }));
    await vi.advanceTimersByTimeAsync(ANSWER_SOUND_MAX_MS - 1);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });

  it('a sentence may take the long cap', async () => {
    const t = watch(afterSound(new Promise<void>(() => undefined), { minMs: 700, maxMs: ADVANCE_MAX_MS }));
    await vi.advanceTimersByTimeAsync(ADVANCE_MAX_MS - 1);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });

  it('no sound at all is the least wait alone, and a failed sound moves on after it', async () => {
    const none = watch(afterSound(null, { minMs: 600 }));
    const failed = watch(afterSound(Promise.reject(new Error('engine')), { minMs: 600 }));
    await vi.advanceTimersByTimeAsync(599);
    expect([none.done(), failed.done()]).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect([none.done(), failed.done()]).toEqual([true, true]);
  });

  it('a cap under the least wait counts as the least wait', async () => {
    const t = watch(afterSound(new Promise<void>(() => undefined), { minMs: 1000, maxMs: 500 }));
    await vi.advanceTimersByTimeAsync(999);
    expect(t.done()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done()).toBe(true);
  });
});
