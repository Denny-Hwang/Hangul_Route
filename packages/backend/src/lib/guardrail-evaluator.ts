import { REMOTE_FLAG_NAME, type Db, type RemoteConfigRow, type RollupRow } from '../db';
import { MIN_GROUP_EVENTS, ROLLUP_BUDGET_METRIC, ROLLUP_READ_LIMIT } from './learning-rollups';

/**
 * The daily guardrail evaluator: F-CURR-002 section 12.3 (row CM-70b), the guardrails of section 3.3, and
 * "remote can only reduce" of section 12.2. The Worker's daily Cron Trigger (`scheduled.ts`) runs it right after the
 * retention purge.
 *
 * For each ramping flag of `remote_config` (on, with 0 < pct < 100) it compares the guardrail metrics of
 * `learning_rollups` for the days since the flag's last ramp step (at most the last 7 full UTC days, and at least
 * GUARDRAIL_MIN_AFTER_DAYS of them) with the cohort of the 7 days before that step. The step is the row's
 * `updated_at`; the step day itself is in neither window, because part of it ran at each percentage.
 *
 * Cohorts, not arms (a recorded deviation, section 12.3 and section 19). Section 3.4: with too few weekly actives for
 * an A/B test, a ramp is compared with the cohort before it and the result is directional. The rollups carry no
 * per-flag arm for these metrics (a `session.end` names no flag), so the cohort after the step is everyone who used the
 * app in that window. Two things follow, both on purpose: a real effect inside a 10% arm shows about 10 times smaller
 * overall, and a breach cannot be pinned on one flag, so every ramping flag whose windows show it is lowered in the
 * same run (lowering is the safe direction). Row CM-70c adds per-flag arms to `session.end` so this can become the arm
 * comparison.
 *
 * Guardrails (section 3.3). Each statistical rule needs the point line AND a one-sided test at GUARDRAIL_FAMILY_ALPHA
 * (2%) shared (Bonferroni) by every comparison of the run for that flag, so day-to-day noise across 20-odd game kinds
 * is not read as a breach. A step is checked on about 5 daily runs that share most of their days, so the chance a
 * healthy step is lowered stays near 2-5% per step (seeded tests measure it). A comparison runs only when both cohorts hold MIN_COHORT_SESSIONS or more.
 * - Mid-quest quit rate per game kind (`session.end.questLeft`, dim = the kind, bucket 1 of 0 + 1) up by more than
 *   2 pp, and the two-proportion z of the rise at the threshold or more.
 * - Quits after a wrong streak rising: `session.end.leftAfterWrongStreak` bucket 2 per quest session, the same z-test.
 * - Median session length (`session.end.minutes`) down by more than 10%, and the Mann-Whitney z of "sessions got
 *   shorter" at the threshold or more.
 * - p90 session length reaching 20 minutes when it was under 20 before, and the share of sessions of 20 minutes or
 *   more significantly above 10% (a one-sample z).
 * - D1 rows written per day reaching 50% or more of the free-tier daily quota. The Worker cannot read the account's
 *   D1 analytics, so this reads the rollup sink's own day counter (`ROLLUP_BUDGET_METRIC`, the cells reserved that day,
 *   at least the rows the sink wrote). The sink's global budget stops at 40%, so this line only fires if that budget is
 *   raised; the account total, sync included, is the owner's check in the D1 dashboard (runbook K-3).
 *
 * The two absolute lines (p90 and D1 writes) are "must stay under" lines: they count as a breach when the cohort after
 * the step is at or over the line and the cohort before it was under, so a level the ramp did not cause never walks a
 * flag down to 0 one step a day.
 *
 * Small groups never trigger anything. A group is a (day, metric, dim); one with fewer than MIN_GROUP_EVENTS (20)
 * events on its day is left out (section 11.2: suppression applies per day). The D1 counter is not a group of learners,
 * so it is not suppressed. The inputs come from an anonymous endpoint: the closed sets and the sink's budget bound what
 * a forger can write, the significance gate means a breach needs a sustained, sizeable change, and the only thing a
 * forged breach can do is pause a ramp one step, with its reason on the row.
 *
 * Lowering is the only action. On a breach the flag's `pct` goes to the previous ramp step (100 -> 50 -> 10 -> 0; a
 * percentage between steps goes to the step below it), with the breaches in `remote_config.reason` and the time in
 * `updated_at`. The write (`Db.lowerRemoteConfigPct`) applies only while the row is still exactly as read and never
 * touches `on`, so the evaluator never raises `pct`, never turns a flag on, and never overwrites an edit the owner made
 * during the run. Idempotent within a day: a flag whose `updated_at` falls on today (a lowering, or an owner edit) is
 * skipped, and the windows hold full days only, so a second run the same day reads the same rows and changes nothing.
 *
 * The baseline survives a lowering. The reason names the step whose before window was used (`base <day>`). The next
 * run on a row the evaluator lowered (its `updated_at` day and `pct` still those of the reason) keeps that before
 * window and compares the days after the lowering with it, so a lower step that is still worse than the cohort before
 * the ramp is lowered again instead of being compared with the breached week. Any owner edit of the row starts a new
 * baseline from its `updated_at`.
 *
 * Bounded: one read of `remote_config`, then (only when a flag is ramping) one read of `learning_rollups` limited to
 * the four metrics used and to steps of the last GUARDRAIL_MAX_STEP_AGE_DAYS days (an older step is skipped as
 * `stale-step`: it already passed two weeks of checks, and a baseline that old reads seasonal drift as a breach), and at
 * most MAX_GUARDRAIL_LOWERS writes, so with the purge's 36 statements a run stays at 46 of the 50 a Free-plan
 * invocation allows.
 */

/** The ramp of section 12.3: 10%, then 50%, then 100% (0 before it starts). */
export const RAMP_STEPS = [0, 10, 50, 100] as const;
/** The days of a cohort window. */
export const GUARDRAIL_WINDOW_DAYS = 7;
/** A step is compared only once this many full days have passed since it. */
export const GUARDRAIL_MIN_AFTER_DAYS = 3;
/** A step (or a lowering) older than this many days is no longer compared (`stale-step`). */
export const GUARDRAIL_MAX_STEP_AGE_DAYS = 14;
/** The chance, per run and flag, that a ramp with no real change is lowered anyway: shared by every comparison. */
export const GUARDRAIL_FAMILY_ALPHA = 0.02;
/** A comparison needs at least this many sessions (or quest sessions) in each cohort. */
export const MIN_COHORT_SESSIONS = 100;
/** Mid-quest quit rate per game kind may rise by at most this many percentage points. */
export const QUIT_RATE_MAX_RISE_PP = 2;
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
/** The only metrics the evaluator reads. */
export const GUARDRAIL_METRICS = [QUIT, STREAK, MINUTES, ROLLUP_BUDGET_METRIC] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const REASON = /^guardrail (\d{4}-\d{2}-\d{2}) base (\d{4}-\d{2}-\d{2}) pct \d+->(\d+): /;

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

/**
 * The step day whose before window a row is compared with: the `base` of the evaluator's own reason while the row is
 * as the evaluator left it (its `updated_at` day and `pct` are those of the reason), else the row's own step day.
 */
export function baseDayOf(row: Pick<RemoteConfigRow, 'pct' | 'reason'>, stepDay: string): string {
  const m = row.reason ? REASON.exec(row.reason) : null;
  if (!m || m[1] !== stepDay || Number(m[3]) !== row.pct) return stepDay;
  const base = stepDayOf(m[2]!);
  return base !== null && base < stepDay ? base : stepDay;
}

export interface CohortWindow {
  fromDay: string;
  toDay: string;
}

/**
 * The standard normal quantile (inverse CDF) for 0 < p < 1: Acklam's rational approximation, relative error under
 * 1.2e-9, which is far finer than a guardrail needs.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const tail = (q: number): number =>
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** The one-sided z a rise must reach when `comparisons` tests share GUARDRAIL_FAMILY_ALPHA (Bonferroni). */
export function familyZ(comparisons: number): number {
  return normalQuantile(1 - GUARDRAIL_FAMILY_ALPHA / Math.max(1, comparisons));
}

/** A session length bucket of `minutesBucket` as the minutes it spans: `3` is [3, 4), `30-59` is [30, 60), `60+` is 60. */
function minutesRange(bucket: string): readonly [number, number] | null {
  if (bucket === '30-59') return [30, 60];
  if (bucket === '60+') return [60, 60];
  if (!/^\d{1,2}$/.test(bucket)) return null;
  const m = Number(bucket);
  return m < 30 ? [m, m + 1] : null;
}

/** The known buckets of a session length distribution as [from, to, sessions], shortest first. */
function minutesRanges(counts: ReadonlyMap<string, number>): Array<readonly [number, number, number]> {
  const ranges: Array<readonly [number, number, number]> = [];
  for (const [bucket, n] of counts) {
    const range = minutesRange(bucket);
    if (range && n > 0) ranges.push([range[0], range[1], n]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** The `q` quantile (0-1) of a session length distribution, interpolated inside its bucket; null with no sessions. */
export function minutesQuantile(counts: ReadonlyMap<string, number>, q: number): number | null {
  const ranges = minutesRanges(counts);
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

/**
 * Mann-Whitney z that sessions `after` are shorter than `before` (one-sided, normal approximation with the tie
 * correction; a bucket is one tied value). 0 when either side is empty or every session ties.
 */
export function shorterZ(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): number {
  const values = new Map<number, [number, number]>(); // bucket start -> [before, after]
  for (const [lo, , n] of minutesRanges(before)) values.set(lo, [(values.get(lo)?.[0] ?? 0) + n, values.get(lo)?.[1] ?? 0]);
  for (const [lo, , n] of minutesRanges(after)) values.set(lo, [values.get(lo)?.[0] ?? 0, (values.get(lo)?.[1] ?? 0) + n]);
  const rows = [...values].sort((x, y) => x[0] - y[0]).map(([, v]) => v);
  const nb = rows.reduce((s, [b]) => s + b, 0);
  const na = rows.reduce((s, [, a]) => s + a, 0);
  const n = na + nb;
  if (na === 0 || nb === 0) return 0;
  let longerBefore = nb;
  let u = 0; // pairs (after, before) with the after session shorter, ties counted half
  let ties = 0;
  for (const [b, a] of rows) {
    longerBefore -= b;
    u += a * (longerBefore + b / 2);
    const t = a + b;
    ties += t * t * t - t;
  }
  const variance = ((na * nb) / 12) * (n + 1 - ties / (n * (n - 1)));
  return variance > 0 ? (u - (na * nb) / 2) / Math.sqrt(variance) : 0;
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

/**
 * One-sided two-proportion z of `after` over `before`, with the continuity correction (so a few dozen sessions are
 * not read as more certain than they are); 0 when the pooled rate is 0 or 1, and never above 0 for a fall.
 */
export function riseZ(before: Rate, after: Rate): number {
  const pooled = (before.num + after.num) / (before.den + after.den);
  if (pooled <= 0 || pooled >= 1) return 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / before.den + 1 / after.den));
  const rise = after.num / after.den - before.num / before.den;
  const corrected = rise > 0 ? Math.max(0, rise - 0.5 * (1 / before.den + 1 / after.den)) : rise;
  return corrected / se;
}

/** The most rows the rollup sink reserved on a day of the window (its day counter, unsuppressed). */
function maxRowsWritten(rows: readonly RollupRow[], w: CohortWindow): number {
  let max = 0;
  for (const r of rows) if (r.metric === ROLLUP_BUDGET_METRIC && inWindow(r, w)) max = Math.max(max, r.events);
  return max;
}

/**
 * The breaches of one ramp step, as short codes with their numbers (`quitRate:match-shape 8.0%->12.0%`), in the
 * order of section 3.3. `rows` are the rollup rows of the guardrail metrics in both windows, unsuppressed.
 */
export function guardrailBreaches(rows: readonly RollupRow[], before: CohortWindow, after: CohortWindow): string[] {
  const kept = visibleGroups(rows.filter((r) => r.metric !== ROLLUP_BUDGET_METRIC));
  const big = (n: number): boolean => n >= MIN_COHORT_SESSIONS;

  // Every comparison that has the cohorts to run shares the family alpha.
  const quitsBefore = quitRates(kept, before);
  const kinds = [...quitRates(kept, after)].filter(([kind, a]) => big(a.den) && big(quitsBefore.get(kind)?.den ?? 0)).sort(([x], [y]) => (x < y ? -1 : 1));
  const sb = wrongStreakRate(kept, before);
  const sa = wrongStreakRate(kept, after);
  const streak = big(sb.den) && big(sa.den);
  const mb = bucketsOf(kept, MINUTES, '', before);
  const ma = bucketsOf(kept, MINUTES, '', after);
  const lengths = big(sum(mb)) && big(sum(ma));
  const z = familyZ(kinds.length + (streak ? 1 : 0) + (lengths ? 2 : 0));

  const out: string[] = [];
  for (const [kind, a] of kinds) {
    const b = quitsBefore.get(kind)!;
    // a/A - b/B > 2/100, in whole numbers so a rise of exactly 2 pp is not a breach
    if (100 * (a.num * b.den - b.num * a.den) > QUIT_RATE_MAX_RISE_PP * a.den * b.den && riseZ(b, a) >= z) out.push(`quitRate:${kind} ${pct1(b.num, b.den)}%->${pct1(a.num, a.den)}%`);
  }

  if (streak && riseZ(sb, sa) >= z) out.push(`wrongStreakQuits ${pct1(sb.num, sb.den)}%->${pct1(sa.num, sa.den)}%`);

  if (lengths) {
    const medB = minutesQuantile(mb, 0.5) ?? 0;
    const medA = minutesQuantile(ma, 0.5) ?? 0;
    if (medA < medB * (1 - MEDIAN_MAX_FALL) && shorterZ(mb, ma) >= z) out.push(`medianMinutes ${medB.toFixed(1)}->${medA.toFixed(1)}`);
    const p90B = minutesQuantile(mb, 0.9) ?? 0;
    const p90A = minutesQuantile(ma, 0.9) ?? 0;
    const na = sum(ma);
    const longShare = minutesRanges(ma).reduce((s, [lo, , n]) => (lo >= P90_MAX_MINUTES ? s + n : s), 0) / na;
    if (p90A >= P90_MAX_MINUTES && p90B < P90_MAX_MINUTES && (longShare - 0.1) / Math.sqrt(0.09 / na) >= z) out.push(`p90Minutes ${p90B.toFixed(1)}->${p90A.toFixed(1)}`);
  }

  const line = D1_FREE_ROWS_WRITTEN_PER_DAY * D1_ROWS_WRITTEN_MAX_SHARE;
  const wb = maxRowsWritten(rows, before);
  const wa = maxRowsWritten(rows, after);
  if (wa >= line && wb < line) out.push(`d1RowsWritten ${wa}/day of ${D1_FREE_ROWS_WRITTEN_PER_DAY}`);

  return out;
}

/** The text stored in `remote_config.reason`: who, when, the baseline step, the step taken, and the breaches; codes and numbers only. */
export function guardrailReason(day: string, base: string, from: number, to: number, breaches: readonly string[]): string {
  const text = `guardrail ${day} base ${base} pct ${from}->${to}: ${breaches.join('; ')}`;
  return text.length <= GUARDRAIL_REASON_MAX ? text : `${text.slice(0, GUARDRAIL_REASON_MAX - 3)}...`;
}

export type GuardrailSkip = 'changed-today' | 'future-updated-at' | 'too-few-days' | 'stale-step' | 'bad-updated-at';

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
  base: string;
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
    const why: GuardrailSkip | null =
      step === null
        ? 'bad-updated-at'
        : step > today
          ? 'future-updated-at'
          : step === today
            ? 'changed-today'
            : step < addDays(today, -GUARDRAIL_MAX_STEP_AGE_DAYS)
              ? 'stale-step'
              : step > addDays(today, -1 - GUARDRAIL_MIN_AFTER_DAYS)
                ? 'too-few-days'
                : null;
    if (why !== null || step === null) {
      out.skipped.push({ flag: row.flag, why: why ?? 'bad-updated-at' });
      continue;
    }
    const base = baseDayOf(row, step);
    const fromDay = addDays(step, 1) > addDays(today, -GUARDRAIL_WINDOW_DAYS) ? addDays(step, 1) : addDays(today, -GUARDRAIL_WINDOW_DAYS);
    plans.push({ row, base, before: { fromDay: addDays(base, -GUARDRAIL_WINDOW_DAYS), toDay: addDays(base, -1) }, after: { fromDay, toDay: yesterday } });
  }
  if (plans.length === 0) return out;

  const first = plans.reduce((min, p) => (p.before.fromDay < min ? p.before.fromDay : min), yesterday);
  const rows = await db.rollupRowsOf(first, yesterday, GUARDRAIL_METRICS, ROLLUP_READ_LIMIT + 1);
  if (rows.length > ROLLUP_READ_LIMIT) throw new RangeError('guardrail read over the rollup read limit');
  const at = now.toISOString();
  for (const { row, base, before, after } of plans) {
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
    const reason = guardrailReason(today, base, row.pct, to, breaches);
    if (await db.lowerRemoteConfigPct(row.flag, row.pct, row.updatedAt, to, at, reason)) out.lowered.push({ flag: row.flag, from: row.pct, to, reason });
    else out.deferred.push(row.flag);
  }
  return out;
}

/** One log line of a run for Workers Logs: flag names, steps, skip codes and counts only (no reason text, no ids). */
export function guardrailRunLog(result: GuardrailRunResult): string {
  return JSON.stringify({
    event: 'guardrail.run',
    day: result.day,
    ramping: result.ramping,
    lowered: result.lowered.map(({ flag, from, to }) => ({ flag, from, to })),
    kept: result.kept,
    skipped: result.skipped,
    deferred: result.deferred,
  });
}
