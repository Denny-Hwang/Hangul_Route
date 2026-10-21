import {
  CURR_TELEMETRY_PAYLOADS,
  EXPERIMENT_IDS,
  LAG_BUCKETS,
  ReviewKindSchema,
  SESSION_END_QUEST_FIELDS,
  isCurrTelemetryName,
  type TelemetryEventName,
} from '@hangul-route/content-schema';
import type { Db, RollupKey, RollupRow } from '../db';
import { uniqueRollupKeys } from '../db/rollup-types';
import { createRateLimiter } from './rate-limit';

/**
 * F-CURR-002 section 11.2 (row CM-70a, Phase 0): where the learning metrics land. POST
 * /api/telemetry keeps its validation and its in-memory log (transient diagnostics); for a name on
 * the allowlist below it also adds 1 to a few cells of `learning_rollups` (migration 0014), keyed
 * by the UTC day of ingest, a metric, a dim and a bucket.
 *
 * - Codes and counts only. This module is handed the event name and its kept payload, never the
 *   envelope, so no profile id, install key or device id can reach the table; every dim and
 *   bucket is a code from a schema (an id, a game kind, an arm, a bucket), never free text.
 * - Profile-days. A per-profile metric is a once-per-local-day device event (`memory.daily`,
 *   `goal.met`), so its `events` on one day are the profiles that sent it that day.
 * - Bounded writes. One upsert per cell touched and at most MAX_ROLLUP_ROWS_PER_EVENT cells per
 *   event; these rows count toward the D1 guardrail of section 3.3.
 * - Small groups are hidden. `readRollups` hides any cell with fewer than MIN_GROUP_EVENTS events
 *   on its day (section 11.1); nothing else reads the table.
 */

/** The names that roll up (section 11.2), each on the shared list. Every other name adds nothing. */
export const ROLLUP_EVENT_NAMES = [
  'memory.daily',
  'items.seeded',
  'session.end',
  'review.complete',
  'goal.met',
  'week.goal_met',
  'mastery.level_up',
  'stage.card_opened',
  'testout.finished',
  'quest.adapt',
  'pack.opened',
  'pack.level_complete',
  'exp.exposure',
] as const satisfies readonly TelemetryEventName[];
type RollupEventName = (typeof ROLLUP_EVENT_NAMES)[number];

/** The most cells one event touches: `memory.daily` with answers at all 6 lags and all 4 arms (2 + 6 + 4). */
export const MAX_ROLLUP_ROWS_PER_EVENT = 12;

/** A cell with fewer events than this on a day is hidden from every reader (section 11.1). */
export const MIN_GROUP_EVENTS = 20;

/**
 * Per client key (the caller's IP, never stored), per isolate: past this many rolled-up events an
 * hour the events are still accepted and logged but add no rows, so one caller cannot spend the
 * daily D1 write quota. Far above what a device sends (one `memory.daily` a day, a few sessions an
 * hour), and above a class sharing one school address.
 */
export const ROLLUP_CLIENT_LIMIT = 600;
export const ROLLUP_CLIENT_WINDOW_MS = 60 * 60 * 1000;
export const rollupLimiter = createRateLimiter(ROLLUP_CLIENT_LIMIT, ROLLUP_CLIENT_WINDOW_MS);

/** Every dim and bucket written is a short code; anything else is dropped (defence in depth). */
const CODE = /^[A-Za-z0-9:._+-]{0,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const ROLLUP_NAMES: ReadonlySet<string> = new Set(ROLLUP_EVENT_NAMES);

/** First-try accuracy buckets: G1 (80% or more) and G4 (70-92%) fall on their edges. */
const RATE_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [93, '93-100'],
  [90, '90-92'],
  [80, '80-89'],
  [70, '70-79'],
  [60, '60-69'],
  [50, '50-59'],
];

/** The accuracy bucket of `right` of `total` answers (`total` > 0), by whole percent rounded down. */
export function rateBucket(right: number, total: number): string {
  const pct = Math.floor((100 * right) / total);
  return RATE_BUCKETS.find(([min]) => pct >= min)?.[1] ?? '0-49';
}

/** Session length: one bucket a whole minute below 30 (so the median and p90 can be read), then 30-59 and 60+. */
export function minutesBucket(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return '60+';
  if (minutes >= 30) return '30-59';
  return String(minutes);
}

const cell = (metric: string, dim: string, bucket: string): RollupKey => ({ metric, dim, bucket });

type Payload = Record<string, unknown>;
type CurrPayload<N extends keyof typeof CURR_TELEMETRY_PAYLOADS> = ReturnType<(typeof CURR_TELEMETRY_PAYLOADS)[N]['parse']>;

/** `memory.daily`: the north star, the due volume, recall per lag bucket, and the north star per experiment arm. */
function memoryDaily(p: CurrPayload<'memory.daily'>): RollupKey[] {
  const keys = [cell('memory.daily.durableWeek', '', p.durableWeekBucket), cell('memory.daily.dueVolume', '', p.dueVolumeBucket)];
  for (const lag of LAG_BUCKETS) {
    let right = 0;
    let wrong = 0;
    for (const c of p.hist) {
      if (c.lag !== lag) continue;
      right += c.right;
      wrong += c.wrong;
    }
    if (right + wrong > 0) keys.push(cell('memory.daily.recallLag', lag, rateBucket(right, right + wrong)));
  }
  for (const id of EXPERIMENT_IDS) {
    const arm = p.arms[id];
    if (arm) keys.push(cell('memory.daily.durableWeekByArm', `${id}:${arm}`, p.durableWeekBucket));
  }
  return keys;
}

/**
 * `session.end` (its payload is kept as sent, so every field is checked here): the session length
 * for the median and p90 guardrail; the mid-quest quit, overall and by the game kind on screen; and,
 * for a quit, the wrong-first-try streak just before it (section 3.3).
 */
function sessionEnd(p: Payload): RollupKey[] {
  const keys: RollupKey[] = [];
  const seconds = p.durationSeconds;
  if (typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds >= 0) keys.push(cell('session.end.minutes', '', minutesBucket(seconds)));
  const left = SESSION_END_QUEST_FIELDS.questLeft.safeParse(p.questLeft);
  if (!left.success) return keys;
  keys.push(cell('session.end.questLeft', '', String(left.data)));
  const kind = SESSION_END_QUEST_FIELDS.leftAtKind.safeParse(p.leftAtKind);
  if (kind.success) keys.push(cell('session.end.questLeft', kind.data, String(left.data)));
  const streak = SESSION_END_QUEST_FIELDS.afterWrongStreak.safeParse(p.afterWrongStreak);
  if (left.data === 1 && streak.success) keys.push(cell('session.end.leftAfterWrongStreak', '', String(streak.data)));
  return keys;
}

/** `review.complete` (an ordinary event, kept as sent): stars by review kind, both checked here. */
function reviewComplete(p: Payload): RollupKey[] {
  const kind = ReviewKindSchema.safeParse(p.kind);
  const stars = p.stars;
  if (!kind.success || typeof stars !== 'number' || !Number.isInteger(stars) || stars < 0 || stars > 3) return [];
  return [cell('review.complete.stars', kind.data, String(stars))];
}

/** The section R names on the allowlist, from a payload that parsed against its strict schema. */
const CURR_ROLLUPS: { [N in Exclude<RollupEventName, 'session.end' | 'review.complete'>]: (p: CurrPayload<N>) => RollupKey[] } = {
  'memory.daily': memoryDaily,
  'items.seeded': (p) => [cell('items.seeded.count', '', p.countBucket), cell('items.seeded.spreadDays', '', p.spreadDaysBucket)],
  'goal.met': (p) => [cell('goal.met', '', String(p.target))],
  'week.goal_met': (p) => [cell('week.goal_met', '', String(p.target))],
  'mastery.level_up': (p) => [cell('mastery.level_up', p.cellId, String(p.level))],
  'stage.card_opened': (p) => [cell('stage.card_opened', p.stage, '')],
  'testout.finished': (p) => [
    cell('testout.finished.passed', p.cellId, p.passed ? '1' : '0'),
    ...(p.items > 0 ? [cell('testout.finished.accuracy', p.cellId, rateBucket(p.firstTryCorrect, p.items))] : []),
  ],
  'quest.adapt': (p) => [cell('quest.adapt', p.questId, p.dir)],
  'pack.opened': (p) => [cell('pack.opened', p.packId, '')],
  'pack.level_complete': (p) => [cell('pack.level_complete', p.packId, p.stage)],
  'exp.exposure': (p) => [cell('exp.exposure', `${p.experimentId}:${p.arm}`, '')],
};

function keysOf(name: RollupEventName, payload: Payload): RollupKey[] {
  if (name === 'session.end') return sessionEnd(payload);
  if (name === 'review.complete') return reviewComplete(payload);
  if (!isCurrTelemetryName(name)) return [];
  const parsed = CURR_TELEMETRY_PAYLOADS[name].safeParse(payload);
  if (!parsed.success) return [];
  return (CURR_ROLLUPS[name] as (p: unknown) => RollupKey[])(parsed.data);
}

/**
 * The cells an event adds 1 to: none for a name off the allowlist or a payload that does not fit,
 * each cell once, codes only, and never more than MAX_ROLLUP_ROWS_PER_EVENT.
 */
export function rollupKeysFor(name: string, payload: Payload | undefined): RollupKey[] {
  if (!ROLLUP_NAMES.has(name) || !payload) return [];
  return uniqueRollupKeys(keysOf(name as RollupEventName, payload))
    .filter((k) => CODE.test(k.dim) && CODE.test(k.bucket))
    .slice(0, MAX_ROLLUP_ROWS_PER_EVENT);
}

/**
 * Rolls one accepted event up: the stored name and kept payload (never the envelope), on the UTC
 * day it was received. Answers the cells written. A slip never fails the event: a missing binding,
 * a Worker that runs before migration 0014, or a D1 error writes nothing and answers 0.
 */
export async function rollUpEvent(db: () => Db, event: { name: string; payload?: Payload; receivedAt: string }, client: string): Promise<number> {
  const keys = rollupKeysFor(event.name, event.payload);
  if (keys.length === 0 || !rollupLimiter.check(client).allowed) return 0;
  try {
    await db().addRollups(event.receivedAt.slice(0, 10), keys);
    return keys.length;
  } catch {
    return 0;
  }
}

export interface RollupQuery {
  /** First UTC day, `YYYY-MM-DD`, inclusive. */
  fromDay: string;
  /** Last UTC day, `YYYY-MM-DD`, inclusive. */
  toDay: string;
  metric?: string;
}

/**
 * The read helper every reader uses (the owner metrics page, row CM-70; the guardrail evaluator,
 * row CM-70b): the cells of the days asked for, with suppression applied. A cell is the smallest
 * group, so a cell with fewer than MIN_GROUP_EVENTS events on its day is hidden, and with it every
 * group whose total on that day is under MIN_GROUP_EVENTS. Counts only.
 */
export async function readRollups(db: Db, query: RollupQuery): Promise<RollupRow[]> {
  if (!DAY.test(query.fromDay) || !DAY.test(query.toDay)) throw new RangeError('rollup days are YYYY-MM-DD');
  const rows = await db.rollupRows(query.fromDay, query.toDay, query.metric);
  return rows.filter((r) => r.events >= MIN_GROUP_EVENTS);
}
