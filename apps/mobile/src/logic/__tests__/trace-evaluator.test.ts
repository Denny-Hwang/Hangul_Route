import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACE_IDLE_MS, createTraceEvaluator, idleOnTouch, type TraceEvaluator } from '../trace-evaluator';
import { NO_TRACE_POINTERS, traceTouchesDown, traceTouchesEnd, traceTouchesMove, traceTouchesUp, type TracePointers, type TraceTouchStep } from '../trace-pointers';

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

describe('the idle check follows the fingers (AMENDMENTS-TOUCH KT-D9, 6.8)', () => {
  let onEvaluate: ReturnType<typeof vi.fn<() => void>>;
  let gate: TraceEvaluator;
  let pointers: TracePointers;
  let strokes: number;

  /** The screen's loop: touch steps through trace-pointers, the effects into the gate; `start` adds ink. */
  const touch = (step: (s: TracePointers) => TraceTouchStep): void => {
    const out = step(pointers);
    pointers = out.state;
    for (const e of out.effects) {
      if (e.kind === 'start') strokes += 1;
      idleOnTouch(gate, e.kind, strokes > 0);
    }
  };
  const down = (id: number, x: number, y: number) => touch((s) => traceTouchesDown(s, [{ id, x, y }]));
  const move = (id: number, x: number, y: number) => touch((s) => traceTouchesMove(s, [{ id, x, y }], 4));
  const up = (id: number) => touch((s) => traceTouchesUp(s, [{ id, x: 0, y: 0 }]));
  const line = (id: number): void => {
    down(id, 10, 10);
    move(id, 30, 10);
    move(id, 60, 10);
    up(id);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onEvaluate = vi.fn<() => void>();
    gate = createTraceEvaluator({ idleMs: TRACE_IDLE_MS, onEvaluate });
    pointers = NO_TRACE_POINTERS;
    strokes = 0;
  });

  afterEach(() => {
    gate.dispose();
    vi.useRealTimers();
  });

  it('a stroke: the countdown runs from the lift', () => {
    down(0, 10, 10);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
    move(0, 30, 10);
    up(0);
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a dot after a stroke leaves no ink and re-arms the check: the drawing is still scored once', () => {
    line(0);
    vi.advanceTimersByTime(500);
    down(1, 50, 50);
    up(1);
    expect(strokes).toBe(1);
    vi.advanceTimersByTime(TRACE_IDLE_MS - 1);
    expect(onEvaluate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a 3 px graze after a stroke is a dot too', () => {
    line(0);
    down(1, 50, 50);
    move(1, 53, 50);
    up(1);
    expect(strokes).toBe(1);
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a dot on an empty canvas leaves nothing to check', () => {
    down(0, 50, 50);
    up(0);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).not.toHaveBeenCalled();
  });

  it('a palm resting through the drawing does not stop the check once the finger lifts', () => {
    down(9, 150, 150);
    down(0, 10, 10);
    move(0, 40, 10);
    up(0);
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    up(9);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a gesture cut off before the lifts still re-arms the check', () => {
    line(0);
    down(1, 50, 50);
    touch(traceTouchesEnd);
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('a dot after the attempt was scored does not score it again', () => {
    line(0);
    expect(gate.done()).toBe(true);
    down(1, 50, 50);
    up(1);
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });

  it('works without a gate (the screen unmounted)', () => {
    expect(() => idleOnTouch(null, 'end', true)).not.toThrow();
  });
});
