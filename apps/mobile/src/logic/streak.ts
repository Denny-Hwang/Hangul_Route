import { isDateKey, type ProgressSnapshot, type SessionLog, type StreakLocal } from '@hangul-route/content-schema';
import { countsForStreak, keepsRun } from './sessions/session-log';

/**
 * The legacy streak (F-REPORT-001 OD-19): consecutive UTC days with at least
 * one quest session. It still feeds `streakDays`, which older builds read and
 * write, and nothing new displays it (F-CURR-002 section 4.8 step 8).
 */
export function computeStreak(sessionDates: string[], now: Date = new Date()): number {
  if (sessionDates.length === 0) return 0;
  const unique = new Set(sessionDates.map((iso) => iso.slice(0, 10)));
  let streak = 0;
  const d = new Date(now);
  // Allow today to be missed up to 23:59 (don't break streak mid-day)
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (unique.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/*
 * The local-day streak — F-CURR-002 sections 4.8 and 7.4 (row CM-4; OD-14, OD-6).
 *
 * - A learning day is a local day with at least one session that keeps the
 *   run (`keepsRun`): a quest, a story or a word set, and a Daily Review once
 *   it ships. A stand-alone game or a level check records time only.
 * - A session counts on its `localDay`, the learner's day when it was logged.
 *   An older session has none and counts on the UTC day of its start, the day
 *   the old streak counted it on: the same answer on every device and in
 *   every time zone.
 * - Rest days (OD-6): a day before today without learning is a rest day, and
 *   up to 2 a local week (Monday to Sunday) are granted automatically. Today
 *   is never a rest day: the day is not over.
 * - The run is the longest stretch of learning days ending on the last one in
 *   which no local week holds more than 2 rest days, counted in learning days
 *   (a rest day keeps the run and adds nothing). Home shows the run that is
 *   still open today: the rest days since the last learning day count too,
 *   and once even the last learning day alone cannot hold them, the run has
 *   ended and Home shows nothing. More learning days only ever make a stretch
 *   longer, so a sync that brings sessions from another device never lowers
 *   the number.
 * - `streakLocal` keeps the run as of its last learning day (the current run,
 *   or the last one once it ended) and `streakBest` the best. A run carried in
 *   a copy is a floor for the stretch that holds its last day: the switch-over
 *   number, or a session another device has not uploaded yet, is never lost.
 * - Switch-over (section 4.8 step 8): a record with no `streakLocal` starts at
 *   `max(old streakDays, the run recomputed on local days)`.
 *
 * Day keys are `YYYY-MM-DD`; all day arithmetic is on UTC day numbers, so a
 * daylight-saving change or the host time zone never moves a day.
 */

/** Rest days granted in each local week (OD-6). */
export const REST_DAYS_PER_WEEK = 2;

/** Five days in a row always put 3 in one week, so a longer run of rest days never fits. */
const LONGEST_REST = 2 * REST_DAYS_PER_WEEK;

const DAY_MS = 86_400_000;

/** The day number (days since 1970-01-01) of a valid day key. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayKeyOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday that starts the local week of day number `n` (1970-01-01 was a Thursday). */
function weekOf(n: number): number {
  return n - ((((n + 3) % 7) + 7) % 7);
}

/** The day a session counts on: its `localDay`, else the UTC day it started; undefined when neither is a day. */
export function sessionDay(session: Pick<SessionLog, 'startedAt' | 'localDay'>): string | undefined {
  if (session.localDay !== undefined && isDateKey(session.localDay)) return session.localDay;
  const utc = typeof session.startedAt === 'string' ? session.startedAt.slice(0, 10) : '';
  return isDateKey(utc) ? utc : undefined;
}

/** The learning days in `sessions`, ascending and without repeats. */
export function learningDays(sessions: readonly SessionLog[]): string[] {
  const days = new Set<string>();
  for (const session of sessions) {
    if (!keepsRun(session)) continue;
    const day = sessionDay(session);
    if (day !== undefined) days.add(day);
  }
  return [...days].sort();
}

/**
 * Rest days per local week inside a stretch, with the count of weeks over
 * the allowance, so whether the stretch holds is one comparison.
 */
class RestWeeks {
  private readonly used = new Map<number, number>();
  private over = 0;

  /** Adds (`sign` 1) or removes (-1) the days `from` to `to` (inclusive) as rest days. */
  shift(from: number, to: number, sign: 1 | -1): void {
    for (let n = from; n <= to; n += 1) {
      const week = weekOf(n);
      const before = this.used.get(week) ?? 0;
      const after = before + sign;
      this.used.set(week, after);
      if (before <= REST_DAYS_PER_WEEK && after > REST_DAYS_PER_WEEK) this.over += 1;
      if (before > REST_DAYS_PER_WEEK && after <= REST_DAYS_PER_WEEK) this.over -= 1;
    }
  }

  holds(): boolean {
    return this.over === 0;
  }

  clear(): void {
    this.used.clear();
    this.over = 0;
  }
}

export interface StreakInput {
  sessions: readonly SessionLog[];
  /** The runs the copies being read carry (`streakLocal`); each is a floor for the stretch that holds its last day. */
  carried: readonly (StreakLocal | undefined)[];
  /** The copies' `streakBest`. */
  best: readonly (number | undefined)[];
}

export interface StreakState {
  /** The run Home shows: the run still open today in learning days, 0 once it has ended. */
  shown: number;
  /** What `streakLocal` holds: the run as of its last learning day; undefined before any learning day. */
  local: StreakLocal | undefined;
  /** What `streakBest` holds; undefined while there is nothing to keep. */
  best: number | undefined;
}

function validRun(run: StreakLocal | undefined): run is StreakLocal {
  return run !== undefined && Number.isInteger(run.run) && run.run >= 1 && typeof run.lastDay === 'string' && isDateKey(run.lastDay);
}

/**
 * The streak on `today` (the learner's local day) from the sessions and the
 * carried runs. A pure function of the set of learning days, the carried runs
 * and the bests, so merging two copies in either order gives the same result,
 * and more learning days or carried runs never give a lower one.
 */
export function streakState(input: StreakInput, today: string): StreakState {
  const carried = input.carried.filter(validRun);
  const keys = new Set(learningDays(input.sessions));
  for (const run of carried) keys.add(run.lastDay);
  const days = [...keys].map(dayNumber).sort((a, b) => a - b);
  const bests = [...input.best, ...carried.map((c) => c.run)].filter((b): b is number => b !== undefined && Number.isInteger(b) && b >= 0);
  const bestOf = (run: number): number | undefined => (bests.length > 0 || run > 0 ? Math.max(run, ...bests) : undefined);
  const lastIndex = days.length - 1;
  if (lastIndex < 0) return { shown: 0, local: undefined, best: bestOf(0) };

  // Today and later are never rest days; an unreadable today counts no rest day after the last learning day.
  const last = days[lastIndex] as number;
  const now = isDateKey(today) ? dayNumber(today) : last + 1;
  /** The rest days between two learning days: the days in between that are before today. */
  const restBetween = (a: number, b: number): [number, number] => [a + 1, Math.min(b, now) - 1];

  // Two pointers: the stretch [days[start], days[end]] is the longest one ending at `end` that holds.
  const rest = new RestWeeks();
  let start = 0;
  let longest = 1;
  for (let end = 1; end <= lastIndex; end += 1) {
    const [from, to] = restBetween(days[end - 1] as number, days[end] as number);
    if (to - from + 1 > LONGEST_REST) {
      rest.clear();
      start = end;
    } else {
      rest.shift(from, to, 1);
      while (!rest.holds()) {
        const [f, t] = restBetween(days[start] as number, days[start + 1] as number);
        rest.shift(f, t, -1);
        start += 1;
      }
    }
    longest = Math.max(longest, end - start + 1);
  }

  /** The run of the stretch from `first`: its learning days, or a carried run in it plus the learning days after it. */
  const runFrom = (first: number): number => {
    let run = lastIndex - first + 1;
    for (const c of carried) {
      const at = days.indexOf(dayNumber(c.lastDay));
      if (at >= first) run = Math.max(run, c.run + (lastIndex - at));
    }
    return run;
  };
  const atLast = runFrom(start);

  // Still open today: the rest days since the last learning day join the stretch, which gives up its oldest days
  // while a week is over; when the last learning day alone cannot hold them, the run has ended.
  const [from, to] = [last + 1, now - 1];
  let shown = 0;
  if (to - from + 1 <= LONGEST_REST) {
    rest.shift(from, to, 1);
    while (!rest.holds() && start < lastIndex) {
      const [f, t] = restBetween(days[start] as number, days[start + 1] as number);
      rest.shift(f, t, -1);
      start += 1;
    }
    if (rest.holds()) shown = runFrom(start);
  }
  return { shown, local: { run: atLast, lastDay: dayKeyOf(last) }, best: bestOf(Math.max(longest, atLast)) };
}

/** The day of the newest quest session, the last day the old `streakDays` counted (the switch-over's last day). */
function lastQuestDay(sessions: readonly SessionLog[]): string | undefined {
  let lastDay: string | undefined;
  for (const session of sessions) {
    if (!countsForStreak(session)) continue;
    const day = sessionDay(session);
    if (day !== undefined && (lastDay === undefined || day > lastDay)) lastDay = day;
  }
  return lastDay;
}

type StreakCopy = Pick<ProgressSnapshot, 'streakDays' | 'streakLocal' | 'streakBest' | 'sessions'>;

/** What a copy carries: its `streakLocal`, or, before the switch-over, its old `streakDays` on its newest quest day. */
function carriedBy(copy: StreakCopy): StreakLocal | undefined {
  if (validRun(copy.streakLocal)) return copy.streakLocal;
  const legacy = Number.isInteger(copy.streakDays) ? copy.streakDays : 0;
  const lastDay = lastQuestDay(copy.sessions);
  return legacy > 0 && lastDay !== undefined ? { run: legacy, lastDay } : undefined;
}

/**
 * The streak of one or more copies of a learner's record (one on the device,
 * two in a sync merge) over `sessions` (their union). A copy without a
 * `streakLocal` (one written before this build, or by an older build) carries
 * its old `streakDays` on the day of its newest quest session: the
 * switch-over, so the number the new build shows is never below the old one.
 */
export function streakOf(copies: readonly StreakCopy[], sessions: readonly SessionLog[], today: string): StreakState {
  return streakState({ sessions, carried: copies.map(carriedBy), best: copies.map((c) => c.streakBest) }, today);
}

/** The number Home shows for this record on `today`: the current run, or 0 once it has ended. */
export function shownStreak(snapshot: ProgressSnapshot, today: string): number {
  return streakOf([snapshot], snapshot.sessions, today).shown;
}

/** The `streakLocal` and `streakBest` keys to write for a state; a key with nothing to hold is left out. */
export function streakFields(state: StreakState): Pick<ProgressSnapshot, 'streakLocal' | 'streakBest'> {
  return {
    ...(state.local !== undefined ? { streakLocal: state.local } : {}),
    ...(state.best !== undefined ? { streakBest: state.best } : {}),
  };
}

/**
 * `snapshot` with `streakLocal` and `streakBest` brought up to date on
 * `today` (a session logged, a word set finished, the switch-over on
 * hydrate). The same object when nothing changes, so a caller can tell
 * whether to save. `streakDays` is never touched here: older builds own it.
 */
export function withLocalStreak(snapshot: ProgressSnapshot, today: string): ProgressSnapshot {
  const fields = streakFields(streakOf([snapshot], snapshot.sessions, today));
  const sameLocal =
    fields.streakLocal === undefined ||
    (snapshot.streakLocal?.run === fields.streakLocal.run && snapshot.streakLocal.lastDay === fields.streakLocal.lastDay);
  const sameBest = fields.streakBest === undefined || snapshot.streakBest === fields.streakBest;
  return sameLocal && sameBest ? snapshot : { ...snapshot, ...fields };
}
