import { TELEMETRY_DAILY_KEEP_DAYS } from '@hangul-route/content-schema';
import type { Db, TelemetryDailyRow } from '../db';
import type { TelemetryEvent } from '../store';
import { GUEST_PAYLOAD_RULES, OA_PAYLOAD_RULES } from './server-events';

/**
 * [OA] Anonymous daily counters (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1, OA-D18, migration 0015). After
 * `keptEventFields`, POST /api/telemetry adds one to the `telemetry_daily` row of the event's UTC day, its name and
 * the payload the rules kept, for every section 15 name and for `session.start` (counted with empty dims, the G1
 * denominator). Counts only: the row holds no profile, device or account id, no IP address and no time finer than a
 * day; `dims` can only hold codes the rules kept. No route reads the table: the goals of section 1 are D1 queries.
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 12 (row GU-1): every `guest.*` name is counted too, with the payload its
 * rules kept, and `onboarding.started` with only `firstRun` and `fromGuest` as dims (its other keys stay in the event,
 * not in the count; the G5 query). They share the same write budget.
 *
 * The route is anonymous and has no rate limit, and the D1 write quota is shared with every other table, so the
 * writes are bounded per isolate. Each counted event is written through at once, together with anything held, in one
 * D1 batch of `n = n + excluded.n` upserts, while the budget allows; only past the budget are counts held and summed
 * in memory (an event for a held row only adds to it, which costs no write). Two per-isolate bounds hold whatever a
 * caller sends:
 * - at most `TELEMETRY_DAILY_WRITES_PER_MIN` (600) rows are written per one-minute window
 *   (`TELEMETRY_DAILY_WINDOW_MS`), and at most 600 distinct rows are held; an event for a new row past that is
 *   accepted and not counted;
 * - at most `TELEMETRY_DAILY_WRITES_PER_DAY` (5,000) rows are written per UTC day; past it, held counts wait for the
 *   next day's budget (they keep their own `day`).
 * The table is `WITHOUT ROWID` (migration 0015), so an upsert is one row written in D1, a new row included: there is
 * no separate key index to write. A flood therefore costs at most 5,000 rows written a day per isolate.
 * Writing through keeps the counts unbiased in normal traffic: an isolate that ends after a short burst has nothing
 * held, so the later events of a sequence (`who.picked` after `who.shown`) are not the ones lost. Counts are held
 * only past the budget, that is under a flood, when the goals are misread anyway (section 18).
 * The write is best effort and never retried: a failed write, or an isolate that ends while it holds counts, loses
 * the counts it took or held.
 */

/** Rows one isolate writes per one-minute window, and the most distinct rows it holds. */
export const TELEMETRY_DAILY_WRITES_PER_MIN = 600;

/**
 * Rows one isolate writes per UTC day: 5,000 upserts (one row written each, the table being `WITHOUT ROWID`) stay a
 * small share of the D1 Free plan's 100,000 a day. The bound is per isolate; the kill switch answers a quota alert.
 */
export const TELEMETRY_DAILY_WRITES_PER_DAY = 5_000;

/** The window of `TELEMETRY_DAILY_WRITES_PER_MIN`. */
export const TELEMETRY_DAILY_WINDOW_MS = 60_000;

/** Rows removed per purge round (the daily purge's step size). */
export const TELEMETRY_DAILY_PURGE_LIMIT = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TelemetryDailyEnv {
  /** Worker variable; unset, empty or `enabled` = on. Any other value (`disabled`) is the kill switch. */
  TELEMETRY_DAILY?: string;
}

/** On unless the Worker variable says otherwise (the CLASS_SCOPE_FULL pattern): off writes and reads nothing. */
export function telemetryDailyEnabled(env: TelemetryDailyEnv | undefined): boolean {
  const value = env?.TELEMETRY_DAILY;
  return value === undefined || value === '' || value === 'enabled';
}

/**
 * [GU] Section 12: the only `onboarding.started` keys a count keeps, each only as a boolean (never the level, the
 * email flag or anything else the event carries).
 */
export const ONBOARDING_STARTED_DIM_KEYS = ['firstRun', 'fromGuest'] as const;

/** Whether a name is counted: a section 15 name, `session.start`, [GU] a `guest.*` name or `onboarding.started`. */
export function isDailyCountedName(name: string): boolean {
  return name === 'session.start' || name === 'onboarding.started' || Object.hasOwn(OA_PAYLOAD_RULES, name) || Object.hasOwn(GUEST_PAYLOAD_RULES, name);
}

/** The payload a count keeps: [GU] `onboarding.started` keeps its boolean `firstRun` and `fromGuest` only; any other name all its kept payload. */
function dimsPayload(name: string, payload: Record<string, unknown>): Record<string, unknown> {
  if (name !== 'onboarding.started') return payload;
  return Object.fromEntries(ONBOARDING_STARTED_DIM_KEYS.filter((key) => typeof payload[key] === 'boolean').map((key) => [key, payload[key]]));
}

/**
 * The `dims` of a kept payload: canonical JSON with sorted keys, or `''` when nothing was kept. `session.start`
 * always counts with `''`, whatever its payload; [GU] `onboarding.started` with its boolean `firstRun` and `fromGuest` only.
 */
export function dailyDims(name: string, payload: Record<string, unknown> | undefined): string {
  if (name === 'session.start' || !payload) return '';
  const dims = dimsPayload(name, payload);
  const keys = Object.keys(dims).sort();
  if (keys.length === 0) return '';
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, dims[key]])));
}

/** The UTC date (YYYY-MM-DD) of an ISO time, as the route stores `at` (always UTC ISO). */
export function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Held counts, keyed by the JSON of (`day`, `name`, `dims`), in the order they were first held. */
const held = new Map<string, TelemetryDailyRow>();
let windowStartMs = Number.NEGATIVE_INFINITY;
let windowUsed = 0;
let budgetDay = '';
let budgetUsed = 0;

/** Tests only: nothing held, a fresh minute window and a fresh daily budget. */
export function resetTelemetryDailyBudgetForTests(): void {
  held.clear();
  windowStartMs = Number.NEGATIVE_INFINITY;
  windowUsed = 0;
  budgetDay = '';
  budgetUsed = 0;
}

/**
 * Holds one counted event in this isolate's sums: answers whether it was counted. Off, a name that is not counted,
 * or a new row while `TELEMETRY_DAILY_WRITES_PER_MIN` rows are already held count nothing.
 */
export function holdDailyCount(env: TelemetryDailyEnv | undefined, event: Pick<TelemetryEvent, 'name' | 'payload' | 'at'>): boolean {
  if (!telemetryDailyEnabled(env) || !isDailyCountedName(event.name)) return false;
  const day = utcDay(event.at);
  const dims = dailyDims(event.name, event.payload);
  const key = JSON.stringify([day, event.name, dims]);
  const row = held.get(key);
  if (row) {
    row.n += 1;
    return true;
  }
  if (held.size >= TELEMETRY_DAILY_WRITES_PER_MIN) return false;
  held.set(key, { day, name: event.name, dims, n: 1 });
  return true;
}

/**
 * Takes the held rows a write at `nowMs` may write, oldest first: as many as the minute window and the UTC day's
 * budget have left (none when either is spent).
 */
function takeDueRows(nowMs: number): TelemetryDailyRow[] {
  if (held.size === 0) return [];
  if (nowMs - windowStartMs >= TELEMETRY_DAILY_WINDOW_MS) {
    windowStartMs = nowMs;
    windowUsed = 0;
  }
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  const allowed = Math.min(TELEMETRY_DAILY_WRITES_PER_MIN - windowUsed, TELEMETRY_DAILY_WRITES_PER_DAY - budgetUsed);
  if (allowed <= 0) return [];
  const rows: TelemetryDailyRow[] = [];
  for (const [key, row] of held) {
    if (rows.length >= allowed) break;
    held.delete(key);
    rows.push(row);
  }
  windowUsed += rows.length;
  budgetUsed += rows.length;
  return rows;
}

/**
 * Writes the held counts the budget allows at `nowMs`, best effort: answers how many rows were written. Nothing
 * held, or a spent budget, asks nothing of the Db; a missing Db or a failed write (for example an isolate that runs before migration
 * 0015) writes nothing, drops the rows it took (never retried) and never throws.
 */
export async function flushTelemetryDaily(db: () => Db, nowMs: number): Promise<number> {
  const rows = takeDueRows(nowMs);
  if (rows.length === 0) return 0;
  try {
    await db().addTelemetryDaily(rows);
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * Counts one stored event and writes it through, with anything held, while the budget allows, best effort: answers how many rows were written. Off
 * holds nothing, writes nothing and never asks for the Db, so POST /api/telemetry never fails on a counter.
 */
export async function countTelemetryDaily(
  db: () => Db,
  env: TelemetryDailyEnv | undefined,
  event: Pick<TelemetryEvent, 'name' | 'payload' | 'at'>,
  nowMs: number,
): Promise<number> {
  if (!telemetryDailyEnabled(env)) return 0;
  holdDailyCount(env, event);
  return flushTelemetryDaily(db, nowMs);
}

/**
 * One bounded purge step of the daily Cron Trigger: rows whose day is more than `TELEMETRY_DAILY_KEEP_DAYS` (400)
 * days before `now`'s UTC day, at most `TELEMETRY_DAILY_PURGE_LIMIT` (200). The purge keeps the retention promise
 * whatever the switch says; it never reads a count. A failure (a Worker that runs before migration 0015) removes
 * nothing and never stops the other purges.
 */
export async function purgeTelemetryDailyStep(db: Db, now: Date): Promise<number> {
  const beforeDay = new Date(now.getTime() - TELEMETRY_DAILY_KEEP_DAYS * DAY_MS).toISOString().slice(0, 10);
  try {
    return await db.purgeTelemetryDaily(beforeDay, TELEMETRY_DAILY_PURGE_LIMIT);
  } catch {
    return 0;
  }
}
