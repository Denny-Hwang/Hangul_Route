import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADVANCE_MAX_MS, ADVANCE_MIN_MS, afterReply } from '../reply-advance';

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
