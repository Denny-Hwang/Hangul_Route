import { addDays, dateKey } from '../curriculum/dates';
import {
  DAY_LOG_INSTALL_KEYS_MAX,
  GoalsSchema,
  PROGRESS_RECORD_MAX,
  capRecord,
  trimDayLog,
  type CellLevel,
  type DayLog,
  type Goals,
  type ProgressSnapshot,
  type StreakLocal,
} from './progress';

/**
 * Merge rules for the F-CURR-002 snapshot fields (section 4.8). One definition
 * serves the app's merge (apps/mobile/src/logic/sync/merge.ts) and the
 * Worker's preserve rule (packages/backend/src/lib/additive-fields.ts).
 *
 * Every rule is commutative, associative and idempotent, so merge order never
 * changes the result. Each takes values already read through the lenient
 * schemas of `progress.ts`. A side that is absent contributes nothing, and the
 * result is `undefined` only when both sides are absent, so a snapshot that
 * predates a key keeps its shape. Record keys come out in code-point order.
 */

const codePointOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Orders two ISO instants by the moment they name (an offset form and a `Z`
 * form compare as equal instants). The schemas only admit the ECMAScript
 * Date Time String Format on a calendar day (`IsoInstantSchema`), which every
 * engine parses the same way. A value that does not parse sorts first; equal instants and two
 * unparseable values fall back to code-point order, so the order is total.
 */
export function compareIsoInstant(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const fa = Number.isFinite(ta);
  const fb = Number.isFinite(tb);
  if (fa && fb && ta !== tb) return ta < tb ? -1 : 1;
  if (fa !== fb) return fa ? 1 : -1;
  return codePointOrder(a, b);
}

/** The earlier of two latch times; a value that parses beats one that does not. */
export function earlierInstant(a: string, b: string): string {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const fa = Number.isFinite(ta);
  const fb = Number.isFinite(tb);
  if (fa !== fb) return fa ? a : b;
  return compareIsoInstant(a, b) <= 0 ? a : b;
}

/** Every key of either side, `pick` where both have one, at most `max` keys in code-point order. */
function unionEntries<V>(a: Readonly<Record<string, V>>, b: Readonly<Record<string, V>>, pick: (x: V, y: V) => V, max: number): Record<string, V> {
  const out = new Map<string, V>();
  for (const side of [a, b]) {
    for (const [key, value] of Object.entries(side)) {
      const prev = out.get(key);
      out.set(key, prev === undefined ? value : pick(prev, value));
    }
  }
  return capRecord(out, max);
}

function unionRecord<V>(
  a: Readonly<Record<string, V>> | undefined,
  b: Readonly<Record<string, V>> | undefined,
  pick: (x: V, y: V) => V,
  max: number,
): Record<string, V> | undefined {
  if (a === undefined && b === undefined) return undefined;
  return unionEntries(a ?? {}, b ?? {}, pick, max);
}

/** `cellBest`: key union, the higher level wins, so the visible level never drops. */
export function mergeCellBest(
  a: Readonly<Record<string, CellLevel>> | undefined,
  b: Readonly<Record<string, CellLevel>> | undefined,
): Record<string, CellLevel> | undefined {
  return unionRecord(a, b, (x, y) => (x >= y ? x : y), PROGRESS_RECORD_MAX);
}

/** `cellCheckAt`, `stageCheckAt`, `testedOut` and `stamps`: key union, the earliest time wins. */
export function mergeLatchRecord(
  a: Readonly<Record<string, string>> | undefined,
  b: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  return unionRecord(a, b, earlierInstant, PROGRESS_RECORD_MAX);
}

/** `memSeededAt`: the earliest time, so seeding is never run twice on a merged copy. */
export function mergeEarliest(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return earlierInstant(a, b);
}

/** `streakBest`: the higher run, so a sync from an older copy never lowers it. */
export function mergeStreakBest(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/**
 * `goals`: the later `setAt` wins (last writer wins). Equal instants fall back
 * to the `setAt` text, then the larger daily goal, then the larger weekly
 * goal, so the winner never depends on argument order.
 */
export function mergeGoals(a: Goals | undefined, b: Goals | undefined): Goals | undefined {
  if (a === undefined) return b && { daily: b.daily, weeklyDays: b.weeklyDays, setAt: b.setAt };
  if (b === undefined) return { daily: a.daily, weeklyDays: a.weeklyDays, setAt: a.setAt };
  const order = compareIsoInstant(a.setAt, b.setAt) || a.daily - b.daily || a.weeklyDays - b.weeklyDays;
  const w = order >= 0 ? a : b;
  return { daily: w.daily, weeklyDays: w.weeklyDays, setAt: w.setAt };
}

/**
 * `streakLocal`: the later `lastDay` wins; on the same day the higher `run`
 * wins. Local days are `YYYY-MM-DD`, so text order is calendar order.
 */
export function mergeStreakLocal(a: StreakLocal | undefined, b: StreakLocal | undefined): StreakLocal | undefined {
  if (a === undefined) return b && { run: b.run, lastDay: b.lastDay };
  if (b === undefined) return { run: a.run, lastDay: a.lastDay };
  const order = codePointOrder(a.lastDay, b.lastDay) || a.run - b.run;
  const w = order >= 0 ? a : b;
  return { run: w.run, lastDay: w.lastDay };
}

/**
 * `dayLog`: per day and install key the higher points win, then the log is
 * trimmed to its newest 70 days (`trimDayLog`). Points earned on a phone and a
 * tablet on the same day sit under two install keys and add up when read
 * (`dayLogPoints`); the same device's count only grows during a day, so max
 * never counts a point twice.
 */
export function mergeDayLog(a: DayLog | undefined, b: DayLog | undefined): DayLog | undefined {
  const days = unionRecord<Readonly<Record<string, number>>>(
    a,
    b,
    (x, y) => unionEntries(x, y, (p, q) => Math.max(p, q), DAY_LOG_INSTALL_KEYS_MAX),
    Number.MAX_SAFE_INTEGER,
  );
  return days === undefined ? undefined : trimDayLog(days);
}

/** Points of one local day: the sum over install keys, 0 for a day with none. */
export function dayLogPoints(log: DayLog | undefined, day: string): number {
  return Object.values(log?.[day] ?? {}).reduce((sum, points) => sum + points, 0);
}

/**
 * The latest local day any time zone can have at `now`: the UTC day after
 * `now` (the furthest time zone ahead, UTC+14, is less than one day ahead).
 */
export function latestLocalDay(now: Date): string {
  return addDays(dateKey(now), 1);
}

/** How far ahead of the Worker's clock a sent `goals.setAt` may be and still count as a real change made now (a fast clock). */
export const GOALS_CLOCK_SKEW_MS = 10 * 60_000;

type TimedFields = Pick<
  ProgressSnapshot,
  'cellCheckAt' | 'stageCheckAt' | 'testedOut' | 'stamps' | 'goals' | 'dayLog' | 'streakLocal' | 'memSeededAt' | 'steadyWeeks'
>;
const LATCH_KEYS = ['cellCheckAt', 'stageCheckAt', 'testedOut', 'stamps', 'steadyWeeks'] as const;

/**
 * The time guard the Worker applies to a sent snapshot before it merges
 * (F-CURR-002 section 4.8). A device with a wrong clock, or a tampered
 * client, must not write a time that would win every merge from then on:
 *
 * - a `dayLog` day later than `latestLocalDay(now)` is dropped;
 * - a `streakLocal` whose `lastDay` is later than that reads as absent, so the
 *   stored run is kept;
 * - a `steadyWeeks` week whose Monday is later than that is dropped (row
 *   CM-17): no time zone has reached that week yet;
 * - a latch time (a `steadyWeeks` time too) or `memSeededAt` later than `now` is read as `now` (the
 *   `PATCH /learners` rule for `at`); the earliest wins, so a stored earlier
 *   time still wins;
 * - a `goals.setAt` later than `now` but within `GOALS_CLOCK_SKEW_MS` (a
 *   clock a little fast) is read as `now`;
 * - a `goals.setAt` later than that reads as absent when the server already
 *   holds goals, so the stored goals are kept; the wrong-clock device keeps
 *   its far-future `setAt` and sends it again on every sync, and it must
 *   never beat a later real change made on another device. With no stored
 *   goals it is read as `now`.
 *
 * Kept out of the merge rules themselves, which stay pure, commutative and
 * free of a clock. `stored` is the server's stored payload (only its `goals`
 * is read, leniently). Returns the snapshot itself when nothing is out of bounds.
 */
export function boundToNow<T extends Partial<TimedFields>>(snapshot: T, now: Date, stored?: unknown): T {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const lastDay = latestLocalDay(now);
  const future = (at: string): boolean => Date.parse(at) > nowMs;
  const next: Partial<TimedFields> = {};
  for (const key of LATCH_KEYS) {
    const latch = snapshot[key];
    // A week no time zone has reached yet cannot have latched: a wrong clock wrote it.
    const kept = key === 'steadyWeeks' && latch ? Object.entries(latch).filter(([week]) => week <= lastDay) : undefined;
    const entries = kept ?? (latch ? Object.entries(latch) : []);
    if (latch && (entries.length !== Object.keys(latch).length || entries.some(([, at]) => future(at)))) {
      next[key] = Object.fromEntries(entries.map(([id, at]) => [id, future(at) ? nowIso : at]));
    }
  }
  const farGoals = snapshot.goals !== undefined && Date.parse(snapshot.goals.setAt) > nowMs + GOALS_CLOCK_SKEW_MS;
  const storedGoals = typeof stored === 'object' && stored !== null ? (stored as { goals?: unknown }).goals : undefined;
  const dropGoals = farGoals && GoalsSchema.parse(storedGoals) !== undefined;
  if (snapshot.goals && !dropGoals && future(snapshot.goals.setAt)) next.goals = { ...snapshot.goals, setAt: nowIso };
  if (snapshot.memSeededAt !== undefined && future(snapshot.memSeededAt)) next.memSeededAt = nowIso;
  if (snapshot.dayLog && Object.keys(snapshot.dayLog).some((day) => day > lastDay)) {
    next.dayLog = Object.fromEntries(Object.entries(snapshot.dayLog).filter(([day]) => day <= lastDay));
  }
  const dropStreak = snapshot.streakLocal !== undefined && snapshot.streakLocal.lastDay > lastDay;
  if (!dropStreak && !dropGoals && Object.keys(next).length === 0) return snapshot;
  const out: Record<string, unknown> = { ...snapshot, ...next };
  if (dropStreak) delete out.streakLocal;
  if (dropGoals) delete out.goals;
  return out as T;
}
