import { useEffect, useRef } from 'react';
import { TICK_INTERVAL_MS, tickDelta } from '../../logic/vocab/session-clock';

/** A monotonic reading in ms (`performance.now()`), the wall clock where there is none. */
function monotonicNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

/**
 * Drives the Speed Round session's `tick` (F-VOC-004 §3.4): every 250 ms
 * while `running` (a question on screen and nothing over it), it sends the
 * active time since the last tick, read from a monotonic clock. The delta is
 * whatever elapsed, never negative and capped at 2 s (`tickDelta`), so a tab
 * throttled to 1 Hz still counts and a frozen one does not end a round in one
 * step. Each run starts from its own first reading, so the time between two
 * runs (a reveal, a pause, the stop sheet) is never sent.
 */
export function useSpeedClock(running: boolean, onTick: (dtMs: number) => void): void {
  const latest = useRef(onTick);
  latest.current = onTick;

  useEffect(() => {
    if (!running) return undefined;
    let previous = monotonicNow();
    const id = setInterval(() => {
      const now = monotonicNow();
      const dt = tickDelta(previous, now);
      previous = now;
      if (dt > 0) latest.current(dt);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running]);
}
