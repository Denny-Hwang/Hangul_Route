import { REMOTE_FLAG_NAME, type Db, type RemoteConfigRow, type RollupRow } from '../db';
import { MIN_GROUP_EVENTS } from './learning-rollups';

/**
 * The daily guardrail evaluator: F-CURR-002 section 12.3 (row CM-70b), the guardrails of section 3.3, and
 * "remote can only reduce" of section 12.2. The Worker's daily Cron Trigger (`scheduled.ts`) runs it next to the
 * retention purge.
 *
 * For each ramping flag of `remote_config` (on, with 0 < pct < 100) it compares the guardrail metrics of
 * `learning_rollups` for the days since the flag's last ramp step (at most the last 7 full UTC days) with the cohort of
 * the 7 days before that step. The step is the row's `updated_at`; the step day itself is in neither window, because
 * part of it ran at each percentage. Section 3.4: with too few weekly actives for an A/B test, a ramp is compared with
 * the cohort before it and the result is directional. The rollups carry no per-flag arm for these metrics (a
 * `session.end` names no flag), so the cohort after the step is everyone who used the app in that window.
 *
 * Guardrails (section 3.3):
 * - Mid-quest quit rate per game kind (`session.end.questLeft`, dim = the kind, bucket 1 of 0 + 1) up by more than 2 pp.
 * - Quits after a wrong streak rising: `session.end.leftAfterWrongStreak` bucket 2 per quest session, a one-sided
 *   two-proportion z-test at 95% (z of 1.645 or more), so day-to-day noise is not read as a rise.
 * - Median session length (`session.end.minutes`) down by more than 10%, or p90 reaching 20 minutes or more.
 * - D1 rows written per day reaching 50% or more of the free-tier daily quota. The Worker cannot read the account's
 *   D1 analytics, so this counts the writes the rollup sink itself makes (one upsert per event in a cell, the sum of
 *   `events` of a day): the write load that grows with the features being ramped, a lower bound of the account total.
 *
 * The two absolute lines (p90 and D1 writes) are "must stay under" lines: they count as a breach when the cohort after
 * the step is at or over the line and the cohort before it was under, so a level the ramp did not cause never walks a
 * flag down to 0 one step a day.
 *
 * Small groups never trigger anything. A group is a (day, metric, dim); one with fewer than MIN_GROUP_EVENTS (20)
 * events on its day is left out (section 11.2: suppression applies per day), and a comparison runs only when both
 * cohorts keep at least MIN_GROUP_EVENTS events. The D1 count is a sum over every row of a day, not a group of
 * learners, so it is not suppressed.
 *
 * Lowering is the only action. On a breach the flag's `pct` goes to the previous ramp step (100 -> 50 -> 10 -> 0; a
 * percentage between steps goes to the step below it), with the breaches in `remote_config.reason` and the time in
 * `updated_at`. The write (`Db.lowerRemoteConfigPct`) applies only while the row still holds the percentage read and
 * never touches `on`, so the evaluator never raises `pct`, never turns a flag on, and never overwrites an edit the
 * owner made during the run. Idempotent within a day: a flag whose `updated_at` falls on today (a lowering, or an
 * owner edit) is skipped, and the windows hold full days only, so a second run the same day reads the same rows and
 * changes nothing.
 *
 * Bounded: one read of `remote_config`, one read of `learning_rollups` (only when a flag is ramping), and at most
 * MAX_GUARDRAIL_LOWERS writes, so with the purge's 36 statements a run stays under the 50 a Free-plan invocation allows.
 */

/** The ramp of section 12.3: 10%, then 50%, then 100% (0 before it starts). */
export const RAMP_STEPS = [0, 10, 50, 100] as const;
/** The days of a cohort window. */
export const GUARDRAIL_WINDOW_DAYS = 7;
/** Mid-quest quit rate per game kind may rise by at most this many percentage points. */
export const QUIT_RATE_MAX_RISE_PP = 2;
/** One-sided 95%: a rise of the wrong-streak quit rate counts at this z or more. */
export const WRONG_STREAK_RISE_Z = 1.645;
/** The median session length may fall by at most this share. */
export const MEDIAN_MAX_FALL = 0.1;
/** The p90 session length must stay under this many minutes. */
export const P90_MAX_MINUTES = 20;
/** Cloudflare D1 Free plan: 100,000 rows written per day (developers.cloudflare.com/d1/platform/pricing/). */
export const D1_FREE_ROWS_WRITTEN_PER_DAY = 100_000;
/** D1 rows written per day must stay under this share of the free-tier quota. */
export const D1_ROWS_WRITTEN_MAX_SHARE = 0.5;
/** The most flags one run lowers; a breached flag past it is lowered on the next day's run. */
export const MAX_GUARDRAIL_LOWERS = 8;
/** `remote_config.reason` is cut to this many characters. */
export const GUARDRAIL_REASON_MAX = 500;

const QUIT = 'session.end.questLeft';
const STREAK = 'session.end.leftAfterWrongStreak';
const MINUTES = 'session.end.minutes';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The ramp step below `pct`: 100 -> 50, 50 -> 10, 10 -> 0, and 25 -> 10. */
export function previousRampStep(pct: number): number {
  let prev = 0;
  for (const step of RAMP_STEPS) if (step < pct) prev = step;
  return prev;
}

/** The UTC day `n` days after `day` (`YYYY-MM-DD`). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The UTC day of a stored `updated_at`, or null when it does not start with a real date. */
export function stepDayOf(updatedAt: string): string | null {
  const day = updatedAt.slice(0, 10);
  if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00.000Z`))) return null;
  return addDays(day, 0) === day ? day : null; // 2026-02-30 parses, but is not a day
}

export interface CohortWindow {
  fromDay: string;
  toDay: string;
}

/** A session length bucket of `minutesBucket` as the minutes it spans: `3` is [3, 4), `30-59` is [30, 60), `60+` is 60. */
function minutesRange(bucket: string): readonly [number, number] | null {
  if (bucket === '30-59') return [30, 60];
  if (bucket === '60+') return [60, 60];
  if (!/^\d{1,2}$/.test(bucket)) return null;
  const m = Number(bucket);
  return m < 30 ? [m, m + 1] : null;
}

/** The `q` quantile (0-1) of a session length distribution, interpolated inside its bucket; null with no sessions. */
export function minutesQuantile(counts: ReadonlyMap<string, number>, q: number): number | null {
  const ranges: Array<readonly [number, number, number]> = [];
  for (const [bucket, n] of counts) {
    const range = minutesRange(bucket);
    if (range && n > 0) ranges.push([range[0], range[1], n]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const total = ranges.reduce((sum, r) => sum + r[2], 0);
  if (total === 0) return null;
  const target = q * total;
  let below = 0;
  let i = 0;
  // the last bucket always holds the target (below + n reaches the total there)
  while (i < ranges.length - 1 && below + ranges[i]![2] < target) below += ranges[i++]![2];
  const [lo, hi, n] = ranges[i]!;
  return lo + ((target - below) / n) * (hi - lo);
}

/** The rows of the days a learner group keeps: a (day, metric, dim) group under MIN_GROUP_EVENTS events is left out. */
export function visibleGroups(rows: readonly RollupRow[]): RollupRow[] {
  const totals = new Map<string, number>();
  const key = (r: RollupRow): string => `${r.day}\n${r.metric}\n${r.dim}`;
  for (const r of rows) totals.set(key(r), (totals.get(key(r)) ?? 0) + r.events);
  return rows.filter((r) => (totals.get(key(r)) ?? 0) >= MIN_GROUP_EVENTS);
}

const inWindow = (r: RollupRow, w: CohortWindow): boolean => r.day >= w.fromDay && r.day <= w.toDay;

/** Bucket -> events of one metric and dim over a window, from rows already suppressed. */
function bucketsOf(rows: readonly RollupRow[], metric: string, dim: string, w: CohortWindow, days?: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.metric !== metric || r.dim !== dim || !inWindow(r, w) || (days && !days.has(r.day))) continue;
    out.set(r.bucket, (out.get(r.bucket) ?? 0) + r.events);
  }
  return out;
}

const sum = (m: ReadonlyMap<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);
const pct1 = (num: number, den: number): string => ((100 * num) / den).toFixed(1);

interface Rate {
  num: number;
  den: number;
}

/** Quit rates per game kind in a window: bucket 1 of buckets 0 + 1. */
function quitRates(rows: readonly RollupRow[], w: CohortWindow): Map<string, Rate> {
  const out = new Map<string, Rate>();
  for (const r of rows) {
    if (r.metric !== QUIT || r.dim === '' || !inWindow(r, w) || (r.bucket !== '0' && r.bucket !== '1')) continue;
    const rate = out.get(r.dim) ?? { num: 0, den: 0 };
    rate.den += r.events;
    if (r.bucket === '1') rate.num += r.events;
    out.set(r.dim, rate);
  }
  return out;
}

/**
 * Quits after two or more wrong first tries, per quest session, on the days both groups were kept (a day whose
 * wrong-streak group was suppressed says nothing about it, so it leaves the quest sessions of that day out too).
 */
function wrongStreakRate(rows: readonly RollupRow[], w: CohortWindow): Rate {
  const quitDays = new Set(rows.filter((r) => r.metric === QUIT && r.dim === '' && inWindow(r, w)).map((r) => r.day));
  const days = new Set(rows.filter((r) => r.metric === STREAK && r.dim === '' && quitDays.has(r.day) && inWindow(r, w)).map((r) => r.day));
  const sessions = bucketsOf(rows, QUIT, '', w, days);
  return { num: bucketsOf(rows, STREAK, '', w, days).get('2') ?? 0, den: (sessions.get('0') ?? 0) + (sessions.get('1') ?? 0) };
}

/** One-sided two-proportion z of `after` over `before`; 0 when the pooled rate is 0 or 1. */
export function riseZ(before: Rate, after: Rate): number {
  const pooled = (before.num + after.num) / (before.den + after.den);
  if (pooled <= 0 || pooled >= 1) return 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / before.den + 1 / after.den));
  return (after.num / after.den - before.num / before.den) / se;
}

/** The most rows a day of the window wrote to the rollup table (every row, unsuppressed). */
function maxRowsWritten(rows: readonly RollupRow[], w: CohortWindow): number {
  const perDay = new Map<string, number>();
  for (const r of rows) if (inWindow(r, w)) perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.events);
  return Math.max(0, ...perDay.values());
}

/**
 * The breaches of one ramp step, as short codes with their numbers (`quitRate:match_shape 8.0%->12.0%`), in the
 * order of section 3.3. `rows` are every rollup row of both windows, unsuppressed.
 */
export function guardrailBreaches(rows: readonly RollupRow[], before: CohortWindow, after: CohortWindow): string[] {
  const kept = visibleGroups(rows);
  const out: string[] = [];

  const quitsBefore = quitRates(kept, before);
  for (const [kind, a] of [...quitRates(kept, after)].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const b = quitsBefore.get(kind);
    if (!b || b.den < MIN_GROUP_EVENTS || a.den < MIN_GROUP_EVENTS) continue;
    // a/A - b/B > 2/100, in whole numbers so a rise of exactly 2 pp is not a breach
    if (100 * (a.num * b.den - b.num * a.den) > QUIT_RATE_MAX_RISE_PP * a.den * b.den) out.push(`quitRate:${kind} ${pct1(b.num, b.den)}%->${pct1(a.num, a.den)}%`);
  }

  const sb = wrongStreakRate(kept, before);
  const sa = wrongStreakRate(kept, after);
  if (sb.den >= MIN_GROUP_EVENTS && sa.den >= MIN_GROUP_EVENTS && riseZ(sb, sa) >= WRONG_STREAK_RISE_Z) out.push(`wrongStreakQuits ${pct1(sb.num, sb.den)}%->${pct1(sa.num, sa.den)}%`);

  const mb = bucketsOf(kept, MINUTES, '', before);
  const ma = bucketsOf(kept, MINUTES, '', after);
  if (sum(mb) >= MIN_GROUP_EVENTS && sum(ma) >= MIN_GROUP_EVENTS) {
    const medB = minutesQuantile(mb, 0.5) ?? 0;
    const medA = minutesQuantile(ma, 0.5) ?? 0;
    if (medA < medB * (1 - MEDIAN_MAX_FALL)) out.push(`medianMinutes ${medB.toFixed(1)}->${medA.toFixed(1)}`);
    const p90B = minutesQuantile(mb, 0.9) ?? 0;
    const p90A = minutesQuantile(ma, 0.9) ?? 0;
    if (p90A >= P90_MAX_MINUTES && p90B < P90_MAX_MINUTES) out.push(`p90Minutes ${p90B.toFixed(1)}->${p90A.toFixed(1)}`);
  }

  const line = D1_FREE_ROWS_WRITTEN_PER_DAY * D1_ROWS_WRITTEN_MAX_SHARE;
  const wb = maxRowsWritten(rows, before);
  const wa = maxRowsWritten(rows, after);
  if (wa >= line && wb < line) out.push(`d1RowsWritten ${wa}/day of ${D1_FREE_ROWS_WRITTEN_PER_DAY}`);

  return out;
}

/** The text stored in `remote_config.reason`: who, when, the step, and the breaches; codes and numbers only. */
export function guardrailReason(day: string, from: number, to: number, breaches: readonly string[]): string {
  const text = `guardrail ${day} pct ${from}->${to}: ${breaches.join('; ')}`;
  return text.length <= GUARDRAIL_REASON_MAX ? text : `${text.slice(0, GUARDRAIL_REASON_MAX - 3)}...`;
}

export type GuardrailSkip = 'changed-today' | 'no-full-day' | 'bad-updated-at';

export interface GuardrailRunResult {
  /** The UTC day of the run. */
  day: string;
  /** Flags that were ramping (on, 0 < pct < 100, a servable name). */
  ramping: number;
  lowered: Array<{ flag: string; from: number; to: number; reason: string }>;
  /** Ramping flags compared with no breach. */
  kept: string[];
  skipped: Array<{ flag: string; why: GuardrailSkip }>;
  /** Breached flags left for the next run: past MAX_GUARDRAIL_LOWERS, or edited during this run. */
  deferred: string[];
}

interface Plan {
  row: RemoteConfigRow;
  before: CohortWindow;
  after: CohortWindow;
}

/** Runs the evaluator once for the UTC day of `now`. See the module comment. */
export async function runGuardrailEvaluator(db: Db, now: Date): Promise<GuardrailRunResult> {
  const today = now.toISOString().slice(0, 10);
  const yesterday = addDays(today, -1);
  const out: GuardrailRunResult = { day: today, ramping: 0, lowered: [], kept: [], skipped: [], deferred: [] };

  const plans: Plan[] = [];
  for (const row of await db.remoteConfig()) {
    if (!row.on || row.pct <= 0 || row.pct >= 100 || !REMOTE_FLAG_NAME.test(row.flag)) continue;
    out.ramping += 1;
    const step = stepDayOf(row.updatedAt);
    if (step === null) {
      out.skipped.push({ flag: row.flag, why: 'bad-updated-at' });
      continue;
    }
    if (step >= today) {
      out.skipped.push({ flag: row.flag, why: 'changed-today' });
      continue;
    }
    const fromDay = addDays(step, 1) > addDays(today, -GUARDRAIL_WINDOW_DAYS) ? addDays(step, 1) : addDays(today, -GUARDRAIL_WINDOW_DAYS);
    if (fromDay > yesterday) {
      out.skipped.push({ flag: row.flag, why: 'no-full-day' });
      continue;
    }
    plans.push({ row, before: { fromDay: addDays(step, -GUARDRAIL_WINDOW_DAYS), toDay: addDays(step, -1) }, after: { fromDay, toDay: yesterday } });
  }
  if (plans.length === 0) return out;

  const first = plans.reduce((min, p) => (p.before.fromDay < min ? p.before.fromDay : min), yesterday);
  const rows = await db.rollupRows(first, yesterday);
  const at = now.toISOString();
  for (const { row, before, after } of plans) {
    const breaches = guardrailBreaches(
      rows.filter((r) => inWindow(r, before) || inWindow(r, after)),
      before,
      after,
    );
    if (breaches.length === 0) {
      out.kept.push(row.flag);
      continue;
    }
    if (out.lowered.length >= MAX_GUARDRAIL_LOWERS) {
      out.deferred.push(row.flag);
      continue;
    }
    const to = previousRampStep(row.pct);
    const reason = guardrailReason(today, row.pct, to, breaches);
    if (await db.lowerRemoteConfigPct(row.flag, row.pct, to, at, reason)) out.lowered.push({ flag: row.flag, from: row.pct, to, reason });
    else out.deferred.push(row.flag);
  }
  return out;
}
