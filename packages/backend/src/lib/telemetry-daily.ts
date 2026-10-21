import { TELEMETRY_DAILY_KEEP_DAYS } from '@hangul-route/content-schema';
import type { Db } from '../db';
import type { TelemetryEvent } from '../store';
import { OA_PAYLOAD_RULES } from './server-events';

/**
 * [OA] Anonymous daily counters (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1, OA-D18, migration 0013). After
 * `keptEventFields`, POST /api/telemetry adds one to the `telemetry_daily` row of the event's UTC day, its name and
 * the payload the rules kept, for every section 15 name and for `session.start` (counted with empty dims, the G1
 * denominator). Counts only: the row holds no profile, device or account id, no IP address and no time finer than a
 * day; `dims` can only hold codes the rules kept. The write is best effort and never retried, and a per-isolate
 * budget caps it so a flood on the anonymous route cannot use up the D1 write quota (events past the budget are
 * still accepted, just not counted). No route reads the table: the goals of section 1 are D1 queries.
 */

/** Counter writes one isolate makes per wall-clock minute; past it, events are accepted and not counted. */
export const TELEMETRY_DAILY_WRITES_PER_MIN = 600;

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

/** Whether a name is counted: a section 15 name, or `session.start`. */
export function isDailyCountedName(name: string): boolean {
  return name === 'session.start' || Object.hasOwn(OA_PAYLOAD_RULES, name);
}

/**
 * The `dims` of a kept payload: canonical JSON with sorted keys, or `''` when nothing was kept. `session.start`
 * always counts with `''`, whatever its payload.
 */
export function dailyDims(name: string, payload: Record<string, unknown> | undefined): string {
  if (name === 'session.start' || !payload) return '';
  const keys = Object.keys(payload).sort();
  if (keys.length === 0) return '';
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, payload[key]])));
}

/** The UTC date (YYYY-MM-DD) of an ISO time, as the route stores `at` (always UTC ISO). */
export function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

let budgetMinute = Number.NaN;
let budgetUsed = 0;

/** Takes one counter write from this isolate's budget for the minute of `nowMs`; false when it is spent. */
export function takeDailyWrite(nowMs: number): boolean {
  const minute = Math.floor(nowMs / 60_000);
  if (minute !== budgetMinute) {
    budgetMinute = minute;
    budgetUsed = 0;
  }
  if (budgetUsed >= TELEMETRY_DAILY_WRITES_PER_MIN) return false;
  budgetUsed += 1;
  return true;
}

/** Tests only: a fresh budget. */
export function resetTelemetryDailyBudgetForTests(): void {
  budgetMinute = Number.NaN;
  budgetUsed = 0;
}

/**
 * Counts one stored event, best effort: answers whether a row was added. Off, a name that is not counted, a spent
 * budget, a missing Db or a failed write (for example an isolate that runs before migration 0013) add nothing and
 * never throw, so POST /api/telemetry never fails on a counter.
 */
export async function countTelemetryDaily(
  db: () => Db,
  env: TelemetryDailyEnv | undefined,
  event: Pick<TelemetryEvent, 'name' | 'payload' | 'at'>,
  nowMs: number,
): Promise<boolean> {
  if (!telemetryDailyEnabled(env) || !isDailyCountedName(event.name)) return false;
  if (!takeDailyWrite(nowMs)) return false;
  try {
    await db().addTelemetryDaily(utcDay(event.at), event.name, dailyDims(event.name, event.payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * One bounded purge step of the daily Cron Trigger: rows whose day is more than `TELEMETRY_DAILY_KEEP_DAYS` (400)
 * days before `now`'s UTC day, at most `TELEMETRY_DAILY_PURGE_LIMIT` (200). The purge keeps the retention promise
 * whatever the switch says; it never reads a count. A failure (a Worker that runs before migration 0013) removes
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
