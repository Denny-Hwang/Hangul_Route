/**
 * Class timer (F-TCH-004 §3.5, TD5): a teacher tool that paces an activity
 * for the room and scores no one. Pure reducer; every event carries the
 * current clock time (`now`, ms), so tests use a fake clock and the screen
 * passes `Date.now()` on a light tick.
 *
 * The ring only fills (CLAUDE.md: meters never drop). `+30 s` during a run
 * holds the ring where it is and spreads the rest of the fill over the new
 * time left, so it still completes exactly at zero. At zero the status is
 * `done`; the screen plays the soft chime (never an alarm, never speech).
 * `+30 s` after `done` starts a fresh 30 s run.
 */

export const TIMER_PRESETS_MS = [30_000, 60_000, 180_000, 300_000] as const;
export const TIMER_ADD_MS = 30_000;
/** One hour: keeps m:ss readable and a runaway +30 s bounded. */
export const TIMER_MAX_MS = 3_600_000;

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerState {
  status: TimerStatus;
  totalMs: number;
  remainingMs: number;
  /** Clock time of the last update while running; null otherwise. */
  lastAt: number | null;
  /** Ring fill when the current fill segment began (0 at start, held on +30 s). */
  ringBase: number;
  /** Time left when the current fill segment began. */
  ringBaseMs: number;
}

export type TimerEvent =
  | { type: 'start'; ms: number; now: number }
  | { type: 'add'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

export function initialTimer(): TimerState {
  return { status: 'idle', totalMs: 0, remainingMs: 0, lastAt: null, ringBase: 0, ringBaseMs: 0 };
}

function freshRun(ms: number, now: number): TimerState {
  const total = Math.min(TIMER_MAX_MS, ms);
  return { status: 'running', totalMs: total, remainingMs: total, lastAt: now, ringBase: 0, ringBaseMs: total };
}

/** Brings a running timer up to `now`. A clock that jumps back adds no time and re-anchors there, so the timer never stalls. */
function advance(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.lastAt === null) return state;
  const elapsed = Math.max(0, now - state.lastAt);
  const remainingMs = Math.max(0, state.remainingMs - elapsed);
  if (remainingMs === 0) return { ...state, status: 'done', remainingMs: 0, lastAt: null };
  return { ...state, remainingMs, lastAt: now };
}

export function ringFraction(state: TimerState): number {
  if (state.status === 'idle') return 0;
  if (state.status === 'done') return 1;
  if (state.ringBaseMs <= 0) return 1;
  const segment = 1 - state.remainingMs / state.ringBaseMs;
  return Math.min(1, state.ringBase + (1 - state.ringBase) * Math.max(0, segment));
}

export function reduceTimer(state: TimerState, event: TimerEvent): TimerState {
  // A clock reading that is not a finite number would turn the time left into NaN for good.
  if (event.type !== 'reset' && !Number.isFinite(event.now)) return state;
  switch (event.type) {
    case 'start':
      return Number.isFinite(event.ms) && event.ms > 0 ? freshRun(event.ms, event.now) : state;
    case 'tick':
      return advance(state, event.now);
    case 'pause': {
      if (state.status !== 'running') return state;
      const now = advance(state, event.now);
      return now.status === 'done' ? now : { ...now, status: 'paused', lastAt: null };
    }
    case 'resume':
      if (state.status === 'paused') return { ...state, status: 'running', lastAt: event.now };
      if (state.status === 'idle' && state.totalMs > 0) return freshRun(state.totalMs, event.now);
      return state;
    case 'reset':
      return { ...initialTimer(), totalMs: state.totalMs, remainingMs: state.totalMs };
    case 'add': {
      if (state.status === 'done') return freshRun(TIMER_ADD_MS, event.now);
      const current = advance(state, event.now);
      if (current.status === 'done') return freshRun(TIMER_ADD_MS, event.now);
      const totalMs = Math.min(TIMER_MAX_MS, current.totalMs + TIMER_ADD_MS);
      const remainingMs = Math.min(totalMs, current.remainingMs + TIMER_ADD_MS);
      if (current.status === 'idle') return { ...current, totalMs, remainingMs };
      return { ...current, totalMs, remainingMs, ringBase: ringFraction(current), ringBaseMs: remainingMs };
    }
  }
}

/** True on the update that reached zero (the screen plays the chime once). */
export function justFinished(prev: TimerState, next: TimerState): boolean {
  return prev.status !== 'done' && next.status === 'done';
}

/** m:ss, rounded up to the next whole second, so "0:00" only shows when the time is up. */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
