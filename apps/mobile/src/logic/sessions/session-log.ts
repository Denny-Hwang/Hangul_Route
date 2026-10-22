import type { SessionLog } from '@hangul-route/content-schema';

/**
 * Session log rules (F-REPORT-001 section 3.3.2, RP-3b).
 *
 * The quest player's sessions move the learner's streak, as they always have.
 * Story, stand-alone game and level-check sessions record time only (OD-19):
 * they count toward a report's minutes and practice days, never toward the
 * old streak (`streakDays`). They are told apart by their id, which every
 * build and the Worker keep as it is, so no new snapshot field is needed: a
 * time-only id starts with `TIME_ONLY_SESSION_PREFIX`, and every reader of the
 * old streak (`nextStreak` in the store, `computeStreak` in the sync merge)
 * reads only the other sessions.
 *
 * The local-day streak (F-CURR-002 OD-14, row CM-4, `logic/streak.ts`) is kept
 * by any learning activity: a quest, a story or a word set (and a Daily
 * Review once it ships). A story or word-set session is a learning session:
 * time only for every older reader (its id still starts with the time-only
 * prefix), and kept apart by `LEARNING_SESSION_PREFIX` for `keepsRun`.
 */

/** A session counts at most 60 minutes, so a tab left open never inflates the minutes. */
export const SESSION_COUNT_CAP_S = 3600;

/** The id prefix of a time-only session (OD-19). */
export const TIME_ONLY_SESSION_PREFIX = 'session:time:';

/** The id prefix of a learning session (F-CURR-002 OD-14): time only for older readers, and it keeps the local-day run. */
export const LEARNING_SESSION_PREFIX = 'session:time:learn:';

const STREAK_SESSION_PREFIX = 'session:';

/** What a session is: a quest session, a learning session (story, word set) or a time-only one (game, level check). */
export type SessionKind = 'quest' | 'learn' | 'time';

const PREFIX: Record<SessionKind, string> = { quest: STREAK_SESSION_PREFIX, learn: LEARNING_SESSION_PREFIX, time: TIME_ONLY_SESSION_PREFIX };

/**
 * A new session id: `session:<start>` for a quest session (today's format),
 * `session:time:learn:<start>` for a learning session, `session:time:<start>`
 * for a time-only one, with `:<n>` added when the log already holds that id
 * (two sessions begun in the same millisecond), since the sync merge unions
 * sessions by id.
 */
export function newSessionId(startedAt: string, kind: SessionKind, sessions: readonly SessionLog[]): string {
  const base = `${PREFIX[kind]}${startedAt}`;
  const taken = new Set(sessions.map((s) => s.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}:${n}`)) n += 1;
  return `${base}:${n}`;
}

/** Whether a session moves the old streak (`streakDays`): every session but a time-only one. */
export function countsForStreak(session: Pick<SessionLog, 'id'>): boolean {
  return !session.id.startsWith(TIME_ONLY_SESSION_PREFIX);
}

/** Whether a session keeps the local-day run (F-CURR-002 OD-14): a quest session or a learning session. */
export function keepsRun(session: Pick<SessionLog, 'id'>): boolean {
  return countsForStreak(session) || session.id.startsWith(LEARNING_SESSION_PREFIX);
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

/**
 * The grown-up dashboard's totals (F-REPORT-001 section 3.3.2, RP-3b review):
 * `sessions` counts the quest sessions only, so a story, game or level-check
 * visit never adds one; `minutes` sums every session's counted (capped)
 * seconds, time-only sessions included (OD-19), rounded once.
 */
export function practiceTotals(sessions: readonly SessionLog[]): { sessions: number; minutes: number } {
  const seconds = sessions.reduce((sum, s) => sum + countedSeconds(s), 0);
  return { sessions: sessions.filter(countsForStreak).length, minutes: Math.round(seconds / 60) };
}
