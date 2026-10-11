/**
 * The only time logic of the shared engine (F-PLC-001 section 3.3). It never
 * reads a clock: the caller passes `nowMs`. A `null` limit means "never".
 * Running out of time ends a session; it never marks an item wrong
 * (CLAUDE.md section 1, anti-shame rules; see `expire` in session.ts).
 */

export const deadline = (startMs: number, limitMs: number | null): number | null =>
  limitMs === null ? null : startMs + limitMs;

export const isExpired = (nowMs: number, deadlineMs: number | null): boolean =>
  deadlineMs !== null && nowMs >= deadlineMs;

export const isIdle = (nowMs: number, lastTouchMs: number, idleMs: number | null): boolean =>
  idleMs !== null && nowMs - lastTouchMs >= idleMs;
