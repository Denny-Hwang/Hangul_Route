import type { SessionLog } from '@hangul-route/content-schema';

/**
 * Session log rules (F-REPORT-001 section 3.3.2, RP-3b).
 *
 * The quest player's sessions move the learner's streak, as they always have.
 * Story, stand-alone game and level-check sessions record time only (OD-19):
 * they count toward a report's minutes and practice days, never toward the
 * streak. They are told apart by their id, which every build and the Worker
 * keep as it is, so no new snapshot field is needed: a time-only id starts
 * with `TIME_ONLY_SESSION_PREFIX`, and every streak reader (`nextStreak` in
 * the store, `computeStreak` on Home and in the sync merge) reads only the
 * other sessions.
 */

/** A session counts at most 60 minutes, so a tab left open never inflates the minutes. */
export const SESSION_COUNT_CAP_S = 3600;

/** The id prefix of a time-only session (OD-19). */
export const TIME_ONLY_SESSION_PREFIX = 'session:time:';

const STREAK_SESSION_PREFIX = 'session:';

/**
 * A new session id: `session:<start>` for a streak session (today's format),
 * `session:time:<start>` for a time-only one, with `:<n>` added when the log
 * already holds that id (two sessions begun in the same millisecond), since
 * the sync merge unions sessions by id.
 */
export function newSessionId(startedAt: string, streak: boolean, sessions: readonly SessionLog[]): string {
  const base = `${streak ? STREAK_SESSION_PREFIX : TIME_ONLY_SESSION_PREFIX}${startedAt}`;
  const taken = new Set(sessions.map((s) => s.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}:${n}`)) n += 1;
  return `${base}:${n}`;
}

/** Whether a session moves the learner's streak: every session but a time-only one. */
export function countsForStreak(session: Pick<SessionLog, 'id'>): boolean {
  return !session.id.startsWith(TIME_ONLY_SESSION_PREFIX);
}

/** The start times of the sessions that count toward the streak, in log order. */
export function streakSessionDates(sessions: readonly SessionLog[]): string[] {
  return sessions.filter(countsForStreak).map((s) => s.startedAt);
}

/** The UTC day (`YYYY-MM-DD`) of the last session that counts toward the streak. */
export function lastStreakDay(sessions: readonly SessionLog[]): string | undefined {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const session = sessions[i] as SessionLog;
    if (countsForStreak(session)) return session.startedAt.slice(0, 10);
  }
  return undefined;
}

/** Whole seconds from `startedAt` to `endedAt`, never below 0 and never above the cap. */
export function elapsedSeconds(startedAt: string, endedAt: string): number {
  const seconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(SESSION_COUNT_CAP_S, Math.max(0, seconds));
}

/**
 * The seconds a session counts for: its duration, capped at 60 minutes. A
 * session that never ended (the app was killed or the tab closed: an orphan)
 * counts 0, never hours.
 */
export function countedSeconds(session: Pick<SessionLog, 'durationSeconds'>): number {
  const seconds = session.durationSeconds;
  if (seconds === undefined || !Number.isFinite(seconds)) return 0;
  return Math.min(SESSION_COUNT_CAP_S, Math.max(0, seconds));
}
