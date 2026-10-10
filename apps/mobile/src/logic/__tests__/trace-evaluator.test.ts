import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACE_IDLE_MS, createTraceEvaluator, type TraceEvaluator } from '../trace-evaluator';

describe('createTraceEvaluator — one evaluation per Trace attempt (F-004 §3.3)', () => {
  let onEvaluate: ReturnType<typeof vi.fn<() => void>>;
  let gate: TraceEvaluator;

  beforeEach(() => {
    vi.useFakeTimers();
    onEvaluate = vi.fn<() => void>();
    gate = createTraceEvaluator({ idleMs: TRACE_IDLE_MS, onEvaluate });
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('uses the 1.5 s idle window from F-004', () => {
    expect(TRACE_IDLE_MS).toBe(1500);
  });

  it('evaluates once after the idle window following the last stroke', () => {
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS - 1);
    expect(onEvaluate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a new stroke restarts the wait — multi-stroke letters are not cut short', () => {
    gate.strokeEnded();
    vi.advanceTimersByTime(1000);
    gate.strokeStarted();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('Done inside the idle window scores once; the idle timer does not score again', () => {
    gate.strokeEnded();
    vi.advanceTimersByTime(500);
    expect(gate.done()).toBe(true);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a second Done tap is ignored', () => {
    gate.strokeEnded();
    expect(gate.done()).toBe(true);
    expect(gate.done()).toBe(false);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('strokes drawn while a result is showing do not queue another evaluation', () => {
    gate.done();
    gate.strokeStarted();
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    expect(gate.isLocked()).toBe(true);
  });

  it('reopen() after a failed try allows the next attempt', () => {
    gate.done();
    gate.reopen();
    expect(gate.isLocked()).toBe(false);
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(2);
  });

  it('nextRound() drops a pending idle evaluation and reopens', () => {
    gate.strokeEnded();
    gate.nextRound();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
    gate.done();
    gate.nextRound();
    expect(gate.isLocked()).toBe(false);
  });

  it('clear() drops a pending idle evaluation but stays open', () => {
    gate.strokeEnded();
    gate.clear();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
    expect(gate.done()).toBe(true);
  });

  it('dispose() cancels the countdown and nothing evaluates afterwards', () => {
    gate.strokeEnded();
    gate.dispose();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(gate.done()).toBe(false);
    gate.reopen();
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
  });

  it('takes an injected scheduler', () => {
    const pending: Array<() => void> = [];
    const custom = createTraceEvaluator({
      idleMs: 10,
      onEvaluate,
      scheduler: {
        setTimeout: (fn) => {
          pending.push(fn);
          return pending.length;
        },
        clearTimeout: () => {
          pending.length = 0;
        },
      },
    });
    custom.strokeEnded();
    expect(pending).toHaveLength(1);
    pending[0]!();
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });
});
