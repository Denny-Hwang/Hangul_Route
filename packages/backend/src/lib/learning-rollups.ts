import {
  CATALOG_VERSION,
  CURR_TELEMETRY_PAYLOADS,
  LAG_BUCKETS,
  ROLLUP_ITEM_COUNT_EDGES,
  ROLLUP_SEEDED_COUNT_EDGES,
  ROLLUP_SPREAD_DAYS_EDGES,
  ROLLUP_STUDY_MINUTES_EDGES,
  ReviewKindSchema,
  SESSION_END_QUEST_FIELDS,
  isCurrTelemetryName,
  questIdsAtVersion,
  rollupBucketCode,
  rollupBucketCodes,
  type TelemetryEventName,
} from '@hangul-route/content-schema';
import type { Db, RollupKey, RollupRow } from '../db';
import { uniqueRollupKeys } from '../db/rollup-types';

/**
 * F-CURR-002 section 11.2 (row CM-70a, Phase 0): where the learning metrics land. POST
 * /api/telemetry keeps its validation and its in-memory log (transient diagnostics); for a name on
 * the allowlist below it also adds 1 to a few cells of `learning_rollups` (migration 0014), keyed
 * by the UTC day of ingest, a metric, a dim and a bucket.
 *
 * - Codes and counts only, from closed sets. This module is handed the event name and its kept
 *   payload, never the envelope, so no profile id, install key or device id can reach the table.
 *   Every dim and bucket comes from a fixed list: a shipped quest id or grid cell, a game kind, an
 *   experiment arm, a bucket code on the shared edges (`curr-rollup-buckets.ts`), or ''. A value
 *   off its list is dropped, or stored as `other` where the count still matters, so a caller can
 *   neither store text of its own nor create new rows at will.
 * - Profile-days for the once-a-day names. `memory.daily`, `items.seeded`, `goal.met` and
 *   `week.goal_met` are sent at most once a local day per profile, so their `events` on one UTC day
 *   are about the profiles that sent them: a local day straddles two UTC days, so a profile can
 *   now and then count twice. A late offline flush (client time more than a day before ingest)
 *   adds no rows, so a device back after days offline counts once, not once per day it was away.
 *   Every other name counts events: one profile can send many.
 * - Bounded writes. At most MAX_ROLLUP_ROWS_PER_EVENT cells an event, one upsert each, plus one
 *   upsert of the day's counter row, and the table is `WITHOUT ROWID`, so a cell costs one row
 *   written. The budget below caps cells per client and per isolate, and the rows all isolates
 *   write through that counter (`ROLLUP_BUDGET_METRIC`), so rollups stay inside their share of the
 *   D1 guardrail of section 3.3.
 * - Kill switch. `LEARNING_ROLLUPS` (a dashboard text variable, kept across deploys) turns the
 *   writes off at once when set to anything but `enabled`; unset is on.
 * - Small groups are hidden when read. `readRollups` applies the suppression of section 11.1.
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

/** The names a profile sends at most once a local day: their events are profile-days. */
export const ONCE_A_DAY_ROLLUP_NAMES: readonly RollupEventName[] = ['memory.daily', 'items.seeded', 'goal.met', 'week.goal_met'];

/** The most cells one event touches: `memory.daily` with answers at all 6 lags and all 4 arms (4 + 6 + 4). */
export const MAX_ROLLUP_ROWS_PER_EVENT = 14;

/** A cell with fewer events than this on a day is hidden from every reader (section 11.1). */
export const MIN_GROUP_EVENTS = 20;

/** The dim that stands for an id the Worker does not ship (a pack before CM-50b lists it, a quest from a newer catalogue). */
export const OTHER_DIM = 'other';

/**
 * The write budget. Rollups are best effort: an event over budget is still accepted and logged, it
 * only adds no rows.
 * - Per client key (the caller's IP, an IPv6 address by its /64 prefix, never stored), per
 *   isolate: cells an hour, and events a UTC day for each once-a-day name. A school address with
 *   more learners than ROLLUP_CLIENT_DAILY_EVENTS sending one name in a day, or more than
 *   ROLLUP_CLIENT_CELLS_PER_HOUR cells in an hour, has the rest of that day or hour left out of the
 *   rollups (never out of the log), so class-heavy days can read a little low.
 * - Per isolate: cells a UTC day.
 * - All isolates: rows written a UTC day, counted exactly. Each event's batch also adds its rows
 *   (its cells plus the counter row itself) to one counter row (`ROLLUP_BUDGET_METRIC`), and the
 *   isolate stops writing for the day once the counter reaches ROLLUP_GLOBAL_ROWS_PER_DAY. Events
 *   already in flight when it does can pass it by a few rows.
 *
 * The shared D1 budget (section 3.3: all rows written under 50% of the free tier's 100,000 a day):
 * rollups take at most ROLLUP_GLOBAL_ROWS_PER_DAY = 20,000 (20%), so 30,000 rows a day stay for
 * sync, the other telemetry sinks and the purges before the guardrail is reached.
 */
export const ROLLUP_CLIENT_CELLS_PER_HOUR = 1200;
export const ROLLUP_CLIENT_DAILY_EVENTS = 200;
export const ROLLUP_ISOLATE_CELLS_PER_DAY = 15_000;
export const ROLLUP_GLOBAL_ROWS_PER_DAY = 20_000;
/** Client keys tracked per isolate; a new key past this many adds no rows until the hour turns. */
export const ROLLUP_MAX_CLIENT_KEYS = 10_000;
/** The counter row of the global budget: rows written that UTC day, by every isolate. Not an event count. */
export const ROLLUP_BUDGET_METRIC = 'rollup.cells';
/**
 * A once-a-day name whose client time is more than this before ingest is a late offline flush: it
 * stays in the log but adds no rows, so a device back after days offline does not count as several
 * profile-days on the day it returns.
 */
export const ROLLUP_ONCE_A_DAY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** The most rows one read returns; a wider read is refused, so suppression never runs on a partial day. */
export const ROLLUP_READ_LIMIT = 50_000;

const HOUR_MS = 60 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Defence in depth: whatever the closed sets let through is still a short code. */
const CODE = /^[A-Za-z0-9:._+-]{0,64}$/;

const ROLLUP_NAMES: ReadonlySet<string> = new Set(ROLLUP_EVENT_NAMES);
const ONCE_A_DAY: ReadonlySet<string> = new Set(ONCE_A_DAY_ROLLUP_NAMES);

/** The kill switch: on when unset, empty or `enabled`; any other value (the switch is `disabled`) writes nothing. */
export interface RollupEnv {
  LEARNING_ROLLUPS?: string;
}
export function learningRollupsEnabled(env: RollupEnv | undefined): boolean {
  const v = env?.LEARNING_ROLLUPS;
  return v === undefined || v === '' || v === 'enabled';
}

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

const ITEM_COUNT_CODES: ReadonlySet<string> = new Set(rollupBucketCodes(ROLLUP_ITEM_COUNT_EDGES));
const SEEDED_COUNT_CODES: ReadonlySet<string> = new Set(rollupBucketCodes(ROLLUP_SEEDED_COUNT_EDGES));
const SPREAD_DAYS_CODES: ReadonlySet<string> = new Set(rollupBucketCodes(ROLLUP_SPREAD_DAYS_EDGES));

/** The quest ids the shipped catalogue holds; any other quest id is `other`. */
const SHIPPED_QUEST_IDS = questIdsAtVersion(CATALOG_VERSION);
/**
 * The topic pack ids the Worker ships. Empty until row CM-50b registers the packs (append their
 * `pack:<key>` ids here); until then every pack counts under `other`.
 */
export const SHIPPED_PACK_IDS: ReadonlySet<string> = new Set<string>([]);
const PACK_LEVEL = /^episode:pack-([a-z0-9]+(?:-[a-z0-9]+)*)-s[1-7]$/;

const questDim = (id: string): string => (SHIPPED_QUEST_IDS.has(id) ? id : OTHER_DIM);
const packDim = (id: string): string => (SHIPPED_PACK_IDS.has(id) ? id : OTHER_DIM);
/** A grid cell id is already a closed set (7 stages x 5 themes); a pack level is kept only for a shipped pack. */
function cellDim(id: string): string {
  const key = PACK_LEVEL.exec(id)?.[1];
  if (key === undefined) return id;
  return SHIPPED_PACK_IDS.has(`pack:${key}`) ? id : OTHER_DIM;
}

const cell = (metric: string, dim: string, bucket: string): RollupKey => ({ metric, dim, bucket });

type Payload = Record<string, unknown>;
type CurrPayload<N extends keyof typeof CURR_TELEMETRY_PAYLOADS> = ReturnType<(typeof CURR_TELEMETRY_PAYLOADS)[N]['parse']>;

/**
 * `memory.daily`: the north star (overall and per experiment arm, in one metric so suppression
 * sees the total next to its arms), the due volume, the items newly held and the study minutes
 * (G3), and recall per lag bucket (G1). A bucket code off the shared edges drops its cells.
 */
function memoryDaily(p: CurrPayload<'memory.daily'>): RollupKey[] {
  const keys: RollupKey[] = [];
  if (ITEM_COUNT_CODES.has(p.durableWeekBucket)) {
    keys.push(cell('memory.daily.durableWeek', '', p.durableWeekBucket));
    for (const [id, arm] of Object.entries(p.arms ?? {})) if (arm) keys.push(cell('memory.daily.durableWeek', `${id}:${arm}`, p.durableWeekBucket));
  }
  if (ITEM_COUNT_CODES.has(p.dueVolumeBucket)) keys.push(cell('memory.daily.dueVolume', '', p.dueVolumeBucket));
  keys.push(cell('memory.daily.newHeld', '', rollupBucketCode(p.newHeld, ROLLUP_ITEM_COUNT_EDGES)));
  keys.push(cell('memory.daily.minutes', '', rollupBucketCode(p.minutes, ROLLUP_STUDY_MINUTES_EDGES)));
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
  return keys;
}

/** `items.seeded`: the seeded count and the due spread, each only on its shared edges. */
function itemsSeeded(p: CurrPayload<'items.seeded'>): RollupKey[] {
  const keys: RollupKey[] = [];
  if (SEEDED_COUNT_CODES.has(p.countBucket)) keys.push(cell('items.seeded.count', '', p.countBucket));
  if (SPREAD_DAYS_CODES.has(p.spreadDaysBucket)) keys.push(cell('items.seeded.spreadDays', '', p.spreadDaysBucket));
  return keys;
}

/**
 * `session.end` (its payload is kept as sent, so every field is checked here): the session length
 * for the median and p90 guardrail; the mid-quest quit, overall and by the game kind on screen; and,
 * for a quit, the wrong-first-try streak just before it (section 3.3).
 *
 * The quit rate per game kind has one denominator: the sessions that report `questLeft` (the ''
 * cells, buckets 0 and 1). `leftAtKind` names the round on screen at a quit; a session that ends
 * after the reward step has no round on screen, so a kind's own bucket 0 would count only stray
 * sends and make the kind's rate look like 100%. So a kind is written only for a quit (bucket 1),
 * and the rate for kind K on a day is `questLeft[K][1] / (questLeft[''][0] + questLeft[''][1])`:
 * the share of reporting sessions that ended in a quit at K. It moves when quits at K move, and
 * also, a little, when the mix of kinds played shifts; a reader compares it across arms or across
 * the days around a ramp step, where the mix holds.
 */
function sessionEnd(p: Payload): RollupKey[] {
  const keys: RollupKey[] = [];
  const seconds = p.durationSeconds;
  if (typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds >= 0) keys.push(cell('session.end.minutes', '', minutesBucket(seconds)));
  const left = SESSION_END_QUEST_FIELDS.questLeft.safeParse(p.questLeft);
  if (!left.success) return keys;
  keys.push(cell('session.end.questLeft', '', String(left.data)));
  if (left.data !== 1) return keys;
  const kind = SESSION_END_QUEST_FIELDS.leftAtKind.safeParse(p.leftAtKind);
  if (kind.success) keys.push(cell('session.end.questLeft', kind.data, '1'));
  const streak = SESSION_END_QUEST_FIELDS.afterWrongStreak.safeParse(p.afterWrongStreak);
  if (streak.success) keys.push(cell('session.end.leftAfterWrongStreak', '', String(streak.data)));
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
  'items.seeded': itemsSeeded,
  'goal.met': (p) => [cell('goal.met', '', String(p.target))],
  'week.goal_met': (p) => [cell('week.goal_met', '', String(p.target))],
  'mastery.level_up': (p) => [cell('mastery.level_up', cellDim(p.cellId), String(p.level))],
  'stage.card_opened': (p) => [cell('stage.card_opened', p.stage, '')],
  'testout.finished': (p) => [
    cell('testout.finished.passed', p.cellId, p.passed ? '1' : '0'),
    ...(p.items > 0 ? [cell('testout.finished.accuracy', p.cellId, rateBucket(p.firstTryCorrect, p.items))] : []),
  ],
  'quest.adapt': (p) => [cell('quest.adapt', questDim(p.questId), p.dir)],
  'pack.opened': (p) => [cell('pack.opened', packDim(p.packId), '')],
  'pack.level_complete': (p) => [cell('pack.level_complete', packDim(p.packId), p.stage)],
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
 * The rollup key of a caller: its IPv4 address as is, an IPv6 address by its /64 prefix (one home
 * or one network holds a whole /64, so rotating addresses inside it does not reset the caps).
 */
export function rollupClientKey(ip: string): string {
  if (!ip.includes(':') || ip.includes('.')) return ip;
  const [head = '', tail] = ip.toLowerCase().split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, ''));
  return `${prefix.join(':')}::/64`;
}

/** The per-isolate write budget (see the constants above). Hour and day windows are fixed, so old keys are dropped when a window turns. */
class RollupBudget {
  private hour = -1;
  private clientCells = new Map<string, number>();
  private day = '';
  private clientDaily = new Map<string, number>();
  private spent = 0;
  /** The day's global counter as last seen (undefined until read or written this day). */
  private total: number | undefined = undefined;
  /** The first counter read of the day, shared by the events that arrive while it is in flight. */
  private reading: Promise<number> | null = null;

  /** Charges the event to the client and the isolate when it fits; answers whether it may be written. */
  admit(client: string, name: string, cells: number, nowMs: number, day: string): boolean {
    const hour = Math.floor(nowMs / HOUR_MS);
    if (hour !== this.hour) {
      this.hour = hour;
      this.clientCells.clear();
    }
    if (day !== this.day) {
      this.day = day;
      this.clientDaily.clear();
      this.spent = 0;
      this.total = undefined;
      this.reading = null;
    }
    if (this.capped()) return false;
    const used = this.clientCells.get(client);
    if (used === undefined && this.clientCells.size >= ROLLUP_MAX_CLIENT_KEYS) return false;
    if ((used ?? 0) + cells > ROLLUP_CLIENT_CELLS_PER_HOUR) return false;
    const dailyKey = `${name}\n${client}`;
    const daily = this.clientDaily.get(dailyKey) ?? 0;
    if (ONCE_A_DAY.has(name) && daily >= ROLLUP_CLIENT_DAILY_EVENTS) return false;
    if (this.spent + cells > ROLLUP_ISOLATE_CELLS_PER_DAY) return false;
    this.clientCells.set(client, (used ?? 0) + cells);
    if (ONCE_A_DAY.has(name)) this.clientDaily.set(dailyKey, daily + 1);
    this.spent += cells;
    return true;
  }

  private capped(): boolean {
    return this.total !== undefined && this.total >= ROLLUP_GLOBAL_ROWS_PER_DAY;
  }

  /**
   * Whether an admitted event of `day` may write: false once the day's global counter has reached
   * the cap, or when the isolate has already moved on to the next day (a stale event never reads
   * or writes for a day the isolate left). The first event of a day reads the counter once (a read,
   * not a row written); the events behind it share that read.
   */
  async open(db: Db, day: string): Promise<boolean> {
    if (day !== this.day) return false;
    if (this.total === undefined) {
      if (!this.reading) {
        const p: Promise<number> = db.rollupRows(day, day, ROLLUP_BUDGET_METRIC, 1).then((rows) => rows[0]?.events ?? 0);
        // A failed read (no table yet) is not kept, so the next event of the day asks again.
        p.catch(() => {
          if (this.reading === p) this.reading = null;
        });
        this.reading = p;
      }
      const seen = await this.reading;
      if (day !== this.day) return false;
      this.note(day, seen);
    }
    return !this.capped();
  }

  /** Records a counter total read or written for `day`; one from a day the isolate left is ignored. */
  note(day: string, total: number): void {
    if (day !== this.day) return;
    this.total = Math.max(this.total ?? 0, total);
  }

  reset(): void {
    this.hour = -1;
    this.day = '';
    this.clientCells.clear();
    this.clientDaily.clear();
    this.spent = 0;
    this.total = undefined;
    this.reading = null;
  }
}

export const rollupBudget = new RollupBudget();

/**
 * Rolls one accepted event up: the stored name and kept payload (never the envelope), on the UTC
 * day it was received. Answers the cells written. A slip never fails the event and never rejects:
 * the switch off, a spent budget, a late offline flush of a once-a-day name, a missing binding, a
 * Worker that runs before migration 0014, a D1 error or any other error writes nothing and answers
 * 0. Rollups count at least once: a client that retries after a lost answer is counted again.
 */
export async function rollUpEvent(db: () => Db, event: { name: string; payload?: Payload; receivedAt: string; at?: string }, client: string): Promise<number> {
  try {
    const keys = rollupKeysFor(event.name, event.payload);
    if (keys.length === 0) return 0;
    const receivedMs = Date.parse(event.receivedAt);
    if (ONCE_A_DAY.has(event.name) && event.at !== undefined && receivedMs - Date.parse(event.at) > ROLLUP_ONCE_A_DAY_MAX_AGE_MS) return 0;
    const day = event.receivedAt.slice(0, 10);
    if (!rollupBudget.admit(rollupClientKey(client), event.name, keys.length, receivedMs, day)) return 0;
    const d = db();
    if (!(await rollupBudget.open(d, day))) return 0;
    rollupBudget.note(day, await d.addRollups(day, keys, ROLLUP_BUDGET_METRIC));
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

/** Experiment arms (`E1:a`) form one sibling group per experiment; every other dim is one group. */
const dimFamily = (dim: string): string => /^E\d:/.exec(dim)?.[0] ?? '';

/**
 * Small-group suppression (section 11.1), primary and complementary, per day and metric.
 * 1. A cell with fewer than MIN_GROUP_EVENTS events is hidden.
 * 2. Siblings are the cells of one day and metric that share a bucket (across dims, with the ''
 *    total of that bucket in every dim group, and arms grouped by experiment), and the cells that
 *    share a dim (across buckets). When exactly one cell of a sibling group is hidden, the
 *    smallest visible sibling is hidden too, until no group has exactly one hidden cell. So a
 *    hidden cell cannot be worked out as a visible total minus the visible siblings.
 */
export function suppressSmallGroups(rows: readonly RollupRow[]): RollupRow[] {
  const hidden = new Set<RollupRow>(rows.filter((r) => r.events < MIN_GROUP_EVENTS));
  const groups = new Map<string, RollupRow[]>();
  const add = (key: string, r: RollupRow) => {
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  };
  const totals = new Map<string, RollupRow>();
  for (const r of rows) {
    add(`dim\n${r.day}\n${r.metric}\n${r.dim}`, r);
    if (r.dim === '') totals.set(`${r.day}\n${r.metric}\n${r.bucket}`, r);
    else add(`bucket\n${r.day}\n${r.metric}\n${r.bucket}\n${dimFamily(r.dim)}`, r);
  }
  for (const [key, g] of groups) {
    if (!key.startsWith('bucket\n')) continue;
    const [, day, metric, bucket] = key.split('\n');
    const total = totals.get(`${day}\n${metric}\n${bucket}`);
    if (total) g.push(total);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of groups.values()) {
      if (g.length < 2 || g.filter((r) => hidden.has(r)).length !== 1) continue;
      const visible = g.filter((r) => !hidden.has(r)).sort((a, b) => a.events - b.events || Number(a.dim === '') - Number(b.dim === ''));
      hidden.add(visible[0] as RollupRow);
      changed = true;
    }
  }
  return rows.filter((r) => !hidden.has(r));
}

/**
 * The read helper every reader uses (the owner metrics page, row CM-70; the guardrail evaluator,
 * row CM-70b): the cells of the days asked for, with `suppressSmallGroups` applied. Counts only.
 *
 * What a reader must know:
 * - The threshold counts events. Only for the once-a-day names (ONCE_A_DAY_ROLLUP_NAMES) are
 *   events profiles; label every other metric as events, never as profiles.
 * - Show only what this returns, and never combine it with counts from another source (that
 *   could undo the complementary suppression).
 * - The inputs come from an anonymous endpoint. The closed sets and the budget bound what a
 *   forger can write, but not what it can count, so the evaluator (CM-70b) must cross-check a
 *   breach before acting on it.
 * - `ROLLUP_BUDGET_METRIC` is the rows rollups wrote that day, an input to the D1 guardrail, not
 *   events. The evaluator must not count rows a forger spent, up to the cap, as an organic breach.
 * - A day whose counter reached ROLLUP_GLOBAL_ROWS_PER_DAY is partial: writes stopped part-way
 *   through the UTC day, so its counts are low and lean to the hours before the stop. Read the
 *   counter for the same days and pass the rows to `cappedDays`; mark those days or skip them.
 */
/** The days among `rows` whose rollups stopped at the global cap (see `readRollups`). */
export function cappedDays(rows: readonly RollupRow[]): string[] {
  return rows.filter((r) => r.metric === ROLLUP_BUDGET_METRIC && r.dim === '' && r.bucket === '' && r.events >= ROLLUP_GLOBAL_ROWS_PER_DAY).map((r) => r.day);
}

export async function readRollups(db: Db, query: RollupQuery): Promise<RollupRow[]> {
  if (!DAY.test(query.fromDay) || !DAY.test(query.toDay)) throw new RangeError('rollup days are YYYY-MM-DD');
  const rows = await db.rollupRows(query.fromDay, query.toDay, query.metric, ROLLUP_READ_LIMIT + 1);
  if (rows.length > ROLLUP_READ_LIMIT) throw new RangeError('too many rollup rows; read fewer days or one metric');
  return suppressSmallGroups(rows);
}
