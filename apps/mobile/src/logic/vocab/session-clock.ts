import type { ClockScale } from '@hangul-route/content-schema';

/**
 * The Speed Round's one session clock (F-VOC-004 §3.4, S1-S2). Pure.
 *
 * Relaxed (the default) has no clock at all. Challenge (opt-in) has one
 * countdown for the whole round, 60 s times the learner's scale; there is
 * never a per-question timer. The digits round up, the bar moves in steps of
 * 1/60 (at most once a second on a 60 s clock), and nothing here blinks,
 * pulses or changes colour as time runs low (§3.8): the last 10 seconds only
 * add static words.
 */

export type SpeedMode = 'relaxed' | 'challenge';

/** One Challenge round at scale 1. */
export const CLOCK_BASE_MS = 60_000;
/** The last stretch that adds the static "A few seconds left" line. */
export const FEW_SECONDS_LEFT_MS = 10_000;
/** How often `useSpeedClock` sends a tick. */
export const TICK_INTERVAL_MS = 250;
/** The longest single tick, so a frozen or throttled tab does not end a round in one step. */
export const MAX_TICK_MS = 2_000;

/** Bar steps over a whole clock. */
const BAR_STEPS = 60;

const finiteOr0 = (n: number): number => (Number.isFinite(n) ? n : 0);

/** `null` in Relaxed; `60000 * scale` in Challenge. */
export function clockFor(mode: SpeedMode, scale: ClockScale): number | null {
  return mode === 'challenge' ? CLOCK_BASE_MS * scale : null;
}

/** "0:42": minutes and two-digit seconds, seconds rounded up so 0:00 means the time is over. */
export function formatClock(ms: number): string {
  const seconds = Math.ceil(Math.max(0, finiteOr0(ms)) / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** How full the clock bar is, 0..1, in steps of 1/60, rounded up like the digits. */
export function clockBar(ms: number, total: number): number {
  if (!(total > 0)) return 0;
  const fraction = Math.min(1, Math.max(0, finiteOr0(ms) / total));
  return Math.ceil(fraction * BAR_STEPS) / BAR_STEPS;
}

/** Inside the last 10 seconds of a clock that has not run out. */
export function fewSecondsLeft(ms: number): boolean {
  return ms > 0 && ms <= FEW_SECONDS_LEFT_MS;
}

/**
 * The tick to send between two readings of a monotonic clock
 * (`performance.now()`): whatever elapsed, never negative, capped at 2 s.
 */
export function tickDelta(previousMs: number, nowMs: number): number {
  const dt = nowMs - previousMs;
  return Number.isFinite(dt) ? Math.min(MAX_TICK_MS, Math.max(0, dt)) : 0;
}
