import { REMOTE_FLAG_NAME, type Db, type RemoteConfigRow, type RollupRow } from '../db';
import { cappedDays, MIN_GROUP_EVENTS, ROLLUP_BUDGET_METRIC, ROLLUP_READ_LIMIT } from './learning-rollups';

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
 * Same weekdays on both sides. Use has a weekly rhythm (school days and weekends), and the after window holds 3 to 7
 * days while the before window holds 7. So each cohort keeps only the days whose weekday the other cohort also holds
 * (each window has at most 7 consecutive days, so every weekday counts once on each side): a step on Thursday compared
 * on Monday reads Friday to Sunday after it against Friday to Sunday before it. A day on which the rollups stopped at
 * their global cap (`cappedDays`, row CM-70a) is partial and leans to the hours before the stop, so it is left out of
 * the learner comparisons on both sides in the same way.
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
 * healthy step is lowered stays near 2-5% per step (seeded tests measure it). A comparison runs only when both cohorts
 * hold MIN_COHORT_SESSIONS or more.
 * - Mid-quest quit rate, all game kinds together: the quits (`session.end.questLeft`, dim '', bucket 1) over the
 *   sessions that report `questLeft` (buckets 0 + 1), up by more than 2 pp, and the two-proportion z of the rise at the
 *   threshold or more. This line also sees a game kind that did not exist before the step (a `game.<kind>` ramp).
 * - Mid-quest quit rate per game kind, the same line and test. The rate for kind K is the rollups' own definition
 *   (`learning-rollups.ts`, `sessionEnd`): the quits at K (dim K, bucket 1; a kind is written only for a quit) over the
 *   same reporting sessions, so it is K's share of all play (row CM-70c adds a per-kind count of sessions).
 * - Quits after a wrong streak rising: `session.end.leftAfterWrongStreak` bucket 2 per quest session, the same z-test.
 * - Median session length (`session.end.minutes`) down by more than 10%, and the Mann-Whitney z of "sessions got
 *   shorter" at the threshold or more.
 * - p90 session length reaching 20 minutes when it was under 20 before, and the share of sessions of 20 minutes or
 *   more significantly above 10% (a one-sample z).
 * - D1 rows written per day reaching 50% or more of the free-tier daily quota. The Worker cannot read the account's
 *   D1 analytics, so this reads the rollup sink's own day counter (`ROLLUP_BUDGET_METRIC`: the rows the sink wrote
 *   that day, counted exactly, row CM-70a). The sink stops at ROLLUP_GLOBAL_ROWS_PER_DAY (20% of the quota), so this
 *   line cannot fire while that cap holds: it is advisory, and the account total, sync included, is the owner's check
 *   in the D1 dashboard (runbook K-3).
 *
 * The two absolute lines (p90 and D1 writes) are "must stay under" lines: they count as a breach when the cohort after
 * the step is at or over the line and the cohort before it was under, so a level the ramp did not cause never walks a
 * flag down to 0 one step a day (section 12.3; the owner watches a level that was already over the line).
 *
 * Small groups never trigger anything. The evaluator shows no cell, so it applies MIN_GROUP_EVENTS (20) to the group
 * a comparison uses: a (cohort, metric, dim) sum over the cohort's days. A per-day threshold (the display rule of
 * section 11.2) would leave out nearly every game kind at the app's real traffic (2 or 3 quits a kind a day) and keep
 * only the days with many quits, which leans every rate upward. An after group under 20 is never compared. A before
 * group under 20 is read as its upper bound (19), which understates a rise, so the group that triggers a breach is
 * always the large after group. The D1 counter is not a group of learners, so it is not suppressed. The inputs come
 * from an anonymous endpoint: the closed sets and the sink's budget bound what a forger can write, the significance gate
 * means a breach needs a sustained, sizeable change, and the only thing a forged breach can do is pause a ramp one
 * step, with its reason on the row. A forger who spends the whole budget makes every day capped, which leaves the flag
 * `unchecked`, never lowered.
 *
 * A flag none of whose comparisons had the cohorts to run is reported as skipped `unchecked`, not as kept, so the run
 * log never calls a ramp healthy when nothing was compared.
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
 * baseline from its `updated_at`. The age limit applies to the baseline: once the base step is more than
 * GUARDRAIL_MAX_STEP_AGE_DAYS old the flag is skipped as `stale-step` (it already passed two weeks of checks, and a
 * baseline that old reads seasonal drift as a breach). A stale ramp has no automatic guardrail until the owner
 * advances or re-stamps it; the run log counts such flags as `unguarded`.
 *
 * Bounded: one read of `remote_config`, then (only when a flag is ramping) one read of `learning_rollups` limited to
 * the four metrics used and to the windows of the last GUARDRAIL_MAX_STEP_AGE_DAYS + GUARDRAIL_WINDOW_DAYS days, and
 * at most MAX_GUARDRAIL_LOWERS write attempts (a refused write counts), so with the purge's 36 statements a run stays
 * at 46 of the 50 a Free-plan invocation allows.
 *
 * Kill switch: `GUARDRAIL_EVALUATOR` (a dashboard text variable, kept across deploys) stops the evaluator when set to
 * anything but `enabled`; unset is on. The purge still runs, and the run logs `guardrail.run` with `disabled: true`.
 */

/** The ramp of section 12.3: 10%, then 50%, then 100% (0 before it starts). */
export const RAMP_STEPS = [0, 10, 50, 100] as const;
/** The days of a cohort window. */
export const GUARDRAIL_WINDOW_DAYS = 7;
/** A step is compared only once this many full days have passed since it. */
export const GUARDRAIL_MIN_AFTER_DAYS = 3;
/** A baseline step older than this many days is no longer compared (`stale-step`). */
export const GUARDRAIL_MAX_STEP_AGE_DAYS = 14;
/** The chance, per run and flag, that a ramp with no real change is lowered anyway: shared by every comparison. */
export const GUARDRAIL_FAMILY_ALPHA = 0.02;
/** A comparison needs at least this many sessions (or quest sessions) in each cohort. */
export const MIN_COHORT_SESSIONS = 100;
/** Mid-quest quit rate (all kinds, and per game kind) may rise by at most this many percentage points. */
export const QUIT_RATE_MAX_RISE_PP = 2;
/** The median session length may fall by at most this share. */
export const MEDIAN_MAX_FALL = 0.1;
/** The p90 session length must stay under this many minutes. */
export const P90_MAX_MINUTES = 20;
/** Cloudflare D1 Free plan: 100,000 rows written per day (developers.cloudflare.com/d1/platform/pricing/). */
export const D1_FREE_ROWS_WRITTEN_PER_DAY = 100_000;
/** D1 rows written per day must stay under this share of the free-tier quota. */
export const D1_ROWS_WRITTEN_MAX_SHARE = 0.5;
/** The most write attempts one run makes; a breached flag past it is lowered on the next day's run. */
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

/** The kill switch: on when unset, empty or `enabled`; any other value (the switch is `disabled`) stops the evaluator. */
export interface GuardrailEnv {
  GUARDRAIL_EVALUATOR?: string;
}
export function guardrailEvaluatorEnabled(env: GuardrailEnv | undefined): boolean {
  const v = env?.GUARDRAIL_EVALUATOR;
  return v === undefined || v === '' || v === 'enabled';
}

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

/** The days from `w.fromDay` to `w.toDay`, inclusive. */
function daysOf(w: CohortWindow): string[] {
  const days: string[] = [];
  for (let d = w.fromDay; d <= w.toDay; d = addDays(d, 1)) days.push(d);
  return days;
}

const weekdayOf = (day: string): number => new Date(`${day}T00:00:00.000Z`).getUTCDay();

/** The days each cohort compares (see the module comment): no capped day, and only the weekdays both cohorts hold. */
export interface CohortDays {
  before: ReadonlySet<string>;
  after: ReadonlySet<string>;
}

/**
 * The days of each window the learner comparisons use: the days on which the rollups did not stop at their global cap,
 * then, on each side, only the days whose weekday the other side also holds. Windows hold at most 7 days, so each
 * weekday counts once on each side.
 */
export function cohortDays(rows: readonly RollupRow[], before: CohortWindow, after: CohortWindow): CohortDays {
  const capped = new Set(cappedDays(rows));
  const b = daysOf(before).filter((d) => !capped.has(d));
  const a = daysOf(after).filter((d) => !capped.has(d));
  const inB = new Set(b.map(weekdayOf));
  const inA = new Set(a.map(weekdayOf));
  return { before: new Set(b.filter((d) => inA.has(weekdayOf(d)))), after: new Set(a.filter((d) => inB.has(weekdayOf(d)))) };
}

interface Rate {
  num: number;
  den: number;
  /** The numerator is the upper bound of a group under MIN_GROUP_EVENTS, not its count. */
  bound?: boolean;
}

/** One cohort's sums over its days, each a (cohort, metric, dim) group. */
interface Cohort {
  /** Sessions that report `questLeft` (the '' cells, buckets 0 + 1). */
  sessions: number;
  /** Of those, the mid-quest quits (bucket 1). */
  quits: number;
  /** Quits per game kind (the kind's bucket 1). */
  kinds: Map<string, number>;
  /** The wrong-streak group (every bucket) and its bucket 2. */
  streakGroup: number;
  streak2: number;
  /** Session length bucket -> sessions. */
  minutes: Map<string, number>;
}

function cohortOf(rows: readonly RollupRow[], days: ReadonlySet<string>): Cohort {
  const c: Cohort = { sessions: 0, quits: 0, kinds: new Map(), streakGroup: 0, streak2: 0, minutes: new Map() };
  for (const r of rows) {
    if (!days.has(r.day)) continue;
    if (r.metric === QUIT && r.dim === '') {
      if (r.bucket === '0' || r.bucket === '1') c.sessions += r.events;
      if (r.bucket === '1') c.quits += r.events;
    } else if (r.metric === QUIT && r.bucket === '1') {
      c.kinds.set(r.dim, (c.kinds.get(r.dim) ?? 0) + r.events);
    } else if (r.metric === STREAK && r.dim === '') {
      c.streakGroup += r.events;
      if (r.bucket === '2') c.streak2 += r.events;
    } else if (r.metric === MINUTES && r.dim === '') {
      c.minutes.set(r.bucket, (c.minutes.get(r.bucket) ?? 0) + r.events);
    }
  }
  return c;
}

/** A before group's count, or its upper bound when the group is under MIN_GROUP_EVENTS (a suppressed group is never read as its count). */
function beforeRate(group: number, num: number, den: number): Rate {
  return group >= MIN_GROUP_EVENTS ? { num, den } : { num: MIN_GROUP_EVENTS - 1, den, bound: true };
}

const sum = (m: ReadonlyMap<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);
const pct1 = (r: Rate): string => `${r.bound ? '<=' : ''}${((100 * r.num) / r.den).toFixed(1)}%`;


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

/** The most rows the rollup sink wrote on a day of the window (its day counter, unsuppressed). */
function maxRowsWritten(rows: readonly RollupRow[], w: CohortWindow): number {
  let max = 0;
  for (const r of rows) if (r.metric === ROLLUP_BUDGET_METRIC && r.dim === '' && r.bucket === '' && r.day >= w.fromDay && r.day <= w.toDay) max = Math.max(max, r.events);
  return max;
}

/** What one step's check found: the breaches, how many statistical comparisons had the cohorts to run, and the days per cohort. */
export interface GuardrailCheck {
  breaches: string[];
  comparisons: number;
  days: number;
}

/** a/A - b/B > 2/100, in whole numbers so a rise of exactly 2 pp is not a breach. */
const overLine = (b: Rate, a: Rate): boolean => 100 * (a.num * b.den - b.num * a.den) > QUIT_RATE_MAX_RISE_PP * a.den * b.den;

/**
 * Checks one ramp step (section 3.3): the breaches as short codes with their numbers (`quitRate:match-shape
 * 8.0%->12.0%`), in the order of section 3.3. `rows` are the rollup rows of the guardrail metrics in both windows,
 * unsuppressed; see the module comment for the days, the suppression and the tests.
 */
export function guardrailCheck(rows: readonly RollupRow[], before: CohortWindow, after: CohortWindow): GuardrailCheck {
  const days = cohortDays(rows, before, after);
  const b = cohortOf(rows, days.before);
  const a = cohortOf(rows, days.after);
  const big = (n: number): boolean => n >= MIN_COHORT_SESSIONS;

  // Every comparison that has the cohorts to run shares the family alpha.
  const quitting = big(b.sessions) && big(a.sessions);
  const kinds = quitting ? [...a.kinds].filter(([, n]) => n >= MIN_GROUP_EVENTS).sort(([x], [y]) => (x < y ? -1 : 1)) : [];
  const streak = quitting && a.streakGroup >= MIN_GROUP_EVENTS;
  const lengths = big(sum(b.minutes)) && big(sum(a.minutes));
  const comparisons = (quitting ? 1 : 0) + kinds.length + (streak ? 1 : 0) + (lengths ? 2 : 0);
  const z = familyZ(comparisons);

  const out: string[] = [];
  const rise = (code: string, rb: Rate, ra: Rate, line: boolean): void => {
    if (line && riseZ(rb, ra) >= z) out.push(`${code} ${pct1(rb)}->${pct1(ra)}`);
  };
  if (quitting) {
    const rb = { num: b.quits, den: b.sessions };
    const ra = { num: a.quits, den: a.sessions };
    rise('quitRate', rb, ra, overLine(rb, ra));
  }
  for (const [kind, n] of kinds) {
    const rb = beforeRate(b.kinds.get(kind) ?? 0, b.kinds.get(kind) ?? 0, b.sessions);
    const ra = { num: n, den: a.sessions };
    rise(`quitRate:${kind}`, rb, ra, overLine(rb, ra));
  }
  if (streak) rise('wrongStreakQuits', beforeRate(b.streakGroup, b.streak2, b.sessions), { num: a.streak2, den: a.sessions }, true);

  if (lengths) {
    const medB = minutesQuantile(b.minutes, 0.5) ?? 0;
    const medA = minutesQuantile(a.minutes, 0.5) ?? 0;
    if (medA < medB * (1 - MEDIAN_MAX_FALL) && shorterZ(b.minutes, a.minutes) >= z) out.push(`medianMinutes ${medB.toFixed(1)}->${medA.toFixed(1)}`);
    const p90B = minutesQuantile(b.minutes, 0.9) ?? 0;
    const p90A = minutesQuantile(a.minutes, 0.9) ?? 0;
    const na = sum(a.minutes);
    const longShare = minutesRanges(a.minutes).reduce((s, [lo, , n]) => (lo >= P90_MAX_MINUTES ? s + n : s), 0) / na;
    if (p90A >= P90_MAX_MINUTES && p90B < P90_MAX_MINUTES && (longShare - 0.1) / Math.sqrt(0.09 / na) >= z) out.push(`p90Minutes ${p90B.toFixed(1)}->${p90A.toFixed(1)}`);
  }

  const line = D1_FREE_ROWS_WRITTEN_PER_DAY * D1_ROWS_WRITTEN_MAX_SHARE;
  const wb = maxRowsWritten(rows, before);
  const wa = maxRowsWritten(rows, after);
  if (wa >= line && wb < line) out.push(`d1RowsWritten ${wa}/day of ${D1_FREE_ROWS_WRITTEN_PER_DAY}`);

  return { breaches: out, comparisons, days: days.after.size };
}

/** The breaches of one ramp step (`guardrailCheck`), as short codes with their numbers. */
export function guardrailBreaches(rows: readonly RollupRow[], before: CohortWindow, after: CohortWindow): string[] {
  return guardrailCheck(rows, before, after).breaches;
}

/** The text stored in `remote_config.reason`: who, when, the baseline step, the step taken, and the breaches; codes and numbers only. */
export function guardrailReason(day: string, base: string, from: number, to: number, breaches: readonly string[]): string {
  const text = `guardrail ${day} base ${base} pct ${from}->${to}: ${breaches.join('; ')}`;
  return text.length <= GUARDRAIL_REASON_MAX ? text : `${text.slice(0, GUARDRAIL_REASON_MAX - 3)}...`;
}

export type GuardrailSkip = 'changed-today' | 'future-updated-at' | 'too-few-days' | 'stale-step' | 'bad-updated-at' | 'unchecked';

/** The skips that waiting does not end: the flag has no automatic guardrail until the owner edits the row or traffic grows. */
const UNGUARDED: ReadonlySet<GuardrailSkip> = new Set<GuardrailSkip>(['future-updated-at', 'stale-step', 'bad-updated-at', 'unchecked']);

export interface GuardrailRunResult {
  /** The UTC day of the run. */
  day: string;
  /** Flags that were ramping (on, 0 < pct < 100, a servable name). */
  ramping: number;
  lowered: Array<{ flag: string; from: number; to: number; reason: string }>;
  /** Ramping flags compared with no breach (at least one comparison ran). */
  kept: string[];
  skipped: Array<{ flag: string; why: GuardrailSkip }>;
  /** Breached flags left for the next run: past MAX_GUARDRAIL_LOWERS write attempts, or edited during this run. */
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
    const base = step === null ? null : baseDayOf(row, step);
    const why: GuardrailSkip | null =
      step === null || base === null
        ? 'bad-updated-at'
        : step > today
          ? 'future-updated-at'
          : step === today
            ? 'changed-today'
            : base < addDays(today, -GUARDRAIL_MAX_STEP_AGE_DAYS)
              ? 'stale-step'
              : step > addDays(today, -1 - GUARDRAIL_MIN_AFTER_DAYS)
                ? 'too-few-days'
                : null;
    if (why !== null || step === null || base === null) {
      out.skipped.push({ flag: row.flag, why: why ?? 'bad-updated-at' });
      continue;
    }
    const fromDay = addDays(step, 1) > addDays(today, -GUARDRAIL_WINDOW_DAYS) ? addDays(step, 1) : addDays(today, -GUARDRAIL_WINDOW_DAYS);
    plans.push({ row, base, before: { fromDay: addDays(base, -GUARDRAIL_WINDOW_DAYS), toDay: addDays(base, -1) }, after: { fromDay, toDay: yesterday } });
  }
  if (plans.length === 0) return out;

  const first = plans.reduce((min, p) => (p.before.fromDay < min ? p.before.fromDay : min), yesterday);
  const rows = await db.rollupRowsOf(first, yesterday, GUARDRAIL_METRICS, ROLLUP_READ_LIMIT + 1);
  if (rows.length > ROLLUP_READ_LIMIT) throw new RangeError('guardrail read over the rollup read limit');
  const at = now.toISOString();
  let attempts = 0;
  for (const { row, base, before, after } of plans) {
    const inWindows = rows.filter((r) => (r.day >= before.fromDay && r.day <= before.toDay) || (r.day >= after.fromDay && r.day <= after.toDay));
    const check = guardrailCheck(inWindows, before, after);
    if (check.breaches.length === 0) {
      if (check.comparisons === 0) out.skipped.push({ flag: row.flag, why: 'unchecked' });
      else out.kept.push(row.flag);
      continue;
    }
    // A refused write counts too, so the run never prepares more than MAX_GUARDRAIL_LOWERS UPDATEs.
    if (attempts >= MAX_GUARDRAIL_LOWERS) {
      out.deferred.push(row.flag);
      continue;
    }
    attempts += 1;
    const to = previousRampStep(row.pct);
    const reason = guardrailReason(today, base, row.pct, to, check.breaches);
    if (await db.lowerRemoteConfigPct(row.flag, row.pct, row.updatedAt, to, at, reason)) out.lowered.push({ flag: row.flag, from: row.pct, to, reason });
    else out.deferred.push(row.flag);
  }
  return out;
}

/**
 * One log line of a run for Workers Logs: flag names, steps, skip codes and counts only (no reason text, no ids).
 * `unguarded` counts the ramping flags that have no automatic guardrail until the owner acts (a stale, future or
 * unreadable step, or no comparison with the cohorts to run).
 */
export function guardrailRunLog(result: GuardrailRunResult): string {
  return JSON.stringify({
    event: 'guardrail.run',
    day: result.day,
    ramping: result.ramping,
    lowered: result.lowered.map(({ flag, from, to }) => ({ flag, from, to })),
    kept: result.kept,
    skipped: result.skipped,
    deferred: result.deferred,
    unguarded: result.skipped.filter((s) => UNGUARDED.has(s.why)).length,
  });
}

/** The log line of a run with the kill switch on: nothing was read or written. */
export function guardrailDisabledLog(now: Date): string {
  return JSON.stringify({ event: 'guardrail.run', day: now.toISOString().slice(0, 10), disabled: true });
}
