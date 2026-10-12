import type { Catalog } from '../catalog/schema';
import { addDays, daysBetween, isDateKey } from '../curriculum/dates';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import { PlacementStrandSchema, type StrandStatus } from '../schemas/placement';
import type { Plan } from '../schemas/plan';
import {
  CLASS_DAY_BANDS_BY_PERIOD,
  REPORT_DAYS_MAX,
  REPORT_MONTHS_MAX,
  ReportLetterSchema,
  reportPeriodOf,
  type ActivitySummary,
  type ClassDayBand,
  type ClassReport,
  type ReportPeriod,
} from '../schemas/report';
import type { ReportSummary } from '../schemas/report-response';
import { teachingOrder } from './learner-report';
import { addMonths, firstRowDayOf, lettersIn, monthOf, rowsFromOf, sumDays, todayFor, windowOf, type DaySums } from './windows';

/**
 * Class statistics — F-REPORT-001 section 3.7 (RP-2c): a class's projected summaries turned into aggregates for one
 * period, computed on the Worker (RP-5b) so the class page never receives a per-learner row.
 *
 * Hard rules (a test per rule): the result holds no learner id, no name, no avatar and no per-learner array; nothing
 * is ordered by any learner's figure (letters are content, ordered by how many learners they apply to); no "top",
 * "most", "least", "best" or "lowest" field; no standing distribution by stage or level (OD-4: stage milestones are
 * events in the window); level-check strands as counts only (OD-5); no percentage (OD-6); an up-only marker and never
 * a down one, against the class's own previous window (OD-11). A family space has no class report: the route answers
 * 409 (RP-5b), and the input has no slot for a space at all.
 *
 * Each learner's window is their own: it ends at their own last saved day, in their own offset, and a class copy
 * holds no day row, month row or milestone from before the learner joined (RP-W2), so for `day`, `week` and `month`
 * a day before the join day counts nowhere. `all` reads `activity.total`, which the class copy keeps as lifetime
 * totals (RP-W2): its practiced count, minutes, quests and cards include practice from before the learner joined,
 * while its letters and milestones are from the join day on.
 *
 * "Not saved" is never shown as "did not practice": a learner whose window the class cannot vouch for (it lies
 * wholly after their device's last saved day or has not begun in their offset, it ends before they joined, or it is
 * older than their day rows with no month row to stand in) is left out of every window figure (practiced, the bands,
 * the sums, the letters, the milestones and the comparison) and counted in `practice.notSaved` instead, so the bands
 * and `notSaved` add up to `withActivity`. They still count as members in the headline and the class line. A member
 * in the class for the window whose device saved past its start reads a known 0 on days with no row.
 */

/** One member of the class as the Worker hands it over: the class projection of their summary, and no id or name. */
export interface ClassReportLearner {
  /** `teacherVisibleSummary` with the membership's join day (RP-W2); null when the server holds none. */
  summary: ReportSummary | null;
  /** The server's last sync of this learner; null when never synced. */
  lastSyncedAt: string | null;
  /**
   * When the learner joined this class (`memberships.joined_at`, the instant RP-W2 clips the class copy with). Its
   * learner-local day (at `activity.tz`) is where the class's view begins, so a member who joined long ago and has
   * no row in a window reads 0 there, and a member who joined after it sits out. Unreadable or null: the first day
   * the class copy holds stands in (today when it holds nothing).
   */
  joinedAt: string | null;
}

/** The class's plans (`plansOf`): only published, non-archived plans are homework rows. */
export type ClassReportPlan = Pick<Plan, 'id' | 'title' | 'publishedAt' | 'archivedAt' | 'createdAt'>;

export interface ClassReportInput {
  /** Every learner member of the class, in any order: the result does not depend on it. */
  learners: readonly ClassReportLearner[];
  plans: readonly ClassReportPlan[];
  period: ReportPeriod;
  /**
   * A day that selects a past window (OD-18), as the URL carries it. Anything malformed, after today or outside the
   * class stepper's limits (`classAtOf`) reads as the current window.
   */
  at?: string | null;
  now: Date;
  /** The catalogue: the order letters are taught in. */
  catalog: Catalog;
}

const DAY_MS = 86_400_000;
const STALE_DAYS = 7;
const LETTERS_MAX = 5;
const PLANS_MAX = 3;
/** The typical time hides under this many learners who practiced. */
const MEDIAN_MIN_LEARNERS = 3;
const STAGES = StageKeySchema.options;
const ZERO: DaySums = { days: 0, min: 0, q: 0, c: 0, w: 0 };
/** The widest learner offset either way (`activity.tz`, minutes). */
const TZ_MAX = 840;

/**
 * `at` within the class stepper's limits, or null for the current window (section 3.2: an `at` that is malformed or
 * outside the limits reads as the current window). Members keep their own offsets, so the limits are the widest
 * any member can have: `day` and `week`, a day from the first of the 35 day rows of the westernmost today to the
 * easternmost today; `month`, a day in the current month or the 24 before it (the first day of that month); `all`,
 * never. RP-5b and RP-8 echo this value, so the page labels the window the figures read.
 */
export function classAtOf(period: ReportPeriod, at: string | null | undefined, now: Date): string | null {
  if (typeof at !== 'string' || !isDateKey(at) || Number.isNaN(now.getTime())) return null;
  const west = todayFor(now, -TZ_MAX);
  const east = todayFor(now, TZ_MAX);
  if (at > east) return null;
  const p = reportPeriodOf(period);
  if (p === 'day' || p === 'week') return at >= addDays(west, -(REPORT_DAYS_MAX - 1)) ? at : null;
  if (p === 'month') return monthOf(at) >= addMonths(monthOf(west), -REPORT_MONTHS_MAX) ? `${monthOf(at)}-01` : null;
  return null;
}

/** Letters with the number of learners for each: most learners first, then the order they are taught in. */
function letterCounts(counts: ReadonlyMap<string, number>, order: ReadonlyMap<string, number>): { letter: string; learners: number }[] {
  const rank = (letter: string): number => order.get(letter) ?? Number.POSITIVE_INFINITY;
  return [...counts.entries()]
    // Map keys are unique, so two letters never tie on the code point.
    .sort(([x, nx], [y, ny]) => ny - nx || rank(x) - rank(y) || (x < y ? -1 : 1))
    .slice(0, LETTERS_MAX)
    .map(([letter, learners]) => ({ letter, learners }));
}

/** Later instants first; equal ones tie (0). */
const byNewest = (x: string, y: string): number => (x === y ? 0 : x > y ? -1 : 1);

const add = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

/**
 * Last saved more than 7 days ago, by the server's sync or by the device's last day (section 3.5 item 2). A member
 * whose device never saved a summary has neither, so is never counted here (the class line still shows them:
 * `learners - withActivity - olderApp`).
 */
function staleOf(summary: ReportSummary, lastSyncedAt: string | null, clock: Date | null): boolean {
  if (clock === null) return false;
  const syncMs = lastSyncedAt === null ? Number.NaN : Date.parse(lastSyncedAt);
  const bySync = Number.isFinite(syncMs) && clock.getTime() - syncMs > STALE_DAYS * DAY_MS;
  const activity = summary.activity;
  const byAsOf = activity !== undefined && daysBetween(activity.asOf, todayFor(clock, activity.tz)) > STALE_DAYS;
  return bySync || byAsOf;
}

const monthRowOf = (activity: ActivitySummary, month: string): DaySums | null => {
  const row = activity.months.find((m) => m.m === month);
  return row ? { days: row.days, min: row.min, q: row.q, c: row.c, w: row.w } : null;
};

/** Every month older than the oldest month row was dropped by the device (it keeps the newest 24 with activity). */
const monthKept = (activity: ActivitySummary, month: string): boolean => {
  const oldest = activity.months[0];
  return activity.months.length < REPORT_MONTHS_MAX || (oldest !== undefined && month >= oldest.m);
};

/** What the class can vouch for in a window of one learner: its sums, and the day rows read (null: none). */
interface Known {
  sums: DaySums;
  rows: { from: string; to: string } | null;
}

/**
 * The part of `from`..`to` the class can vouch for, or null when it cannot. Days after `asOf` are not saved and count
 * nowhere; the class's view starts at `floor` (the learner-local join day). `month`: the month row stands for the
 * whole month, and a month with no row is a known empty month when the learner was in the class before it began and
 * the device would have kept its row. `whole`: the learner must have been in the class for all of it (the comparison
 * never reads a window the class saw only in part).
 */
function knownOf(activity: ActivitySummary, floor: string, from: string, to: string, month: boolean, whole: boolean): Known | null {
  const { asOf } = activity;
  if (from > asOf) return null;
  const upTo = to < asOf ? to : asOf;
  const seen = floor > from ? floor : from;
  const drawn = seen <= upTo && seen >= rowsFromOf(asOf);
  const rows = drawn ? { from: seen, to: upTo } : null;
  if (month) {
    const row = monthRowOf(activity, monthOf(from));
    if (row) return { sums: row, rows };
    if (!drawn && floor < from && monthKept(activity, monthOf(from))) return { sums: ZERO, rows: null };
  }
  if (whole && floor > from) return null;
  return rows ? { sums: sumDays(activity.days, rows.from, rows.to), rows } : null;
}

/** One learner's share of the window: figures, letters, milestones, and the previous window when it is known. */
interface Share {
  now: DaySums;
  letters: string[];
  milestones: StageKey[];
  /** Null when the previous window is not wholly known for this learner (they joined in it, or it aged out). */
  prev: DaySums | null;
}

const stagesOf = (activity: ActivitySummary, from: string | null, to: string | null): StageKey[] =>
  activity.milestones
    .filter((row) => from === null || to === null || (row.on >= from && row.on <= to))
    .flatMap((row) => {
      const stage = StageKeySchema.safeParse(row.stage);
      return stage.success ? [stage.data] : [];
    });

/** The learner-local day of the join instant, else the first day the class copy holds, else today. */
function floorOf(activity: ActivitySummary, joinedAt: string | null, today: string): string {
  const ms = joinedAt === null ? Number.NaN : Date.parse(joinedAt);
  return Number.isFinite(ms) ? todayFor(new Date(ms), activity.tz) : (firstRowDayOf(activity) ?? today);
}

/** `at` names a window that has not begun yet in this learner's offset (a day or month east of theirs). */
function notBegun(period: ReportPeriod, at: string | null, today: string): boolean {
  if (at === null) return false;
  return period === 'month' ? monthOf(at) > monthOf(today) : at > today;
}

/** One learner's share, or null when the class cannot vouch for their window (counted in no window figure). */
function shareOf(activity: ActivitySummary, joinedAt: string | null, period: ReportPeriod, at: string | null, clock: Date | null): Share | null {
  const today = clock ? todayFor(clock, activity.tz) : activity.asOf;
  // `windowOf` would read a day after this learner's today as their current window: their previous day under the
  // requested one. The window has not begun for them, so nothing of it is saved.
  if (period !== 'all' && notBegun(period, at, today)) return null;
  const window = windowOf(period, today, at, activity, true);
  if (period === 'all') {
    // Every day row the class copy holds (none after `asOf`).
    const { days, min, q, c, w } = activity.total;
    return { now: { days, min, q, c, w }, letters: lettersIn(activity.days, window.from, activity.asOf), milestones: stagesOf(activity, null, null), prev: null };
  }
  const month = period === 'month';
  const floor = floorOf(activity, joinedAt, today);
  const known = knownOf(activity, floor, window.from, window.to, month, false);
  if (known === null) return null;
  const { prevFrom, prevTo } = window;
  const prev = prevFrom !== undefined && prevTo !== undefined ? (knownOf(activity, floor, prevFrom, prevTo, month, true)?.sums ?? null) : null;
  return {
    now: known.sums,
    letters: known.rows ? lettersIn(activity.days, known.rows.from, known.rows.to) : [],
    milestones: stagesOf(activity, window.from, window.to < activity.asOf ? window.to : activity.asOf),
    prev,
  };
}

/** The bands of `period` with the number of learners in each, in the fixed order; `all` has none. */
function bandsOf(period: ReportPeriod, practiceDays: readonly number[]): { band: ClassDayBand; learners: number }[] | undefined {
  if (period === 'all') return undefined;
  const bandOf = (days: number): ClassDayBand => {
    if (period === 'day') return days > 0 ? 'practiced' : 'not_yet';
    if (days === 0) return '0';
    if (period === 'week') return days <= 2 ? '1-2' : days <= 4 ? '3-4' : '5-7';
    return days <= 4 ? '1-4' : days <= 9 ? '5-9' : '10+';
  };
  const counts = new Map<ClassDayBand, number>();
  for (const days of practiceDays) counts.set(bandOf(days), (counts.get(bandOf(days)) ?? 0) + 1);
  return CLASS_DAY_BANDS_BY_PERIOD[period].map((band) => ({ band, learners: counts.get(band) ?? 0 }));
}

/** The middle value (the mean of the two middle values, rounded, for an even count). */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

const STATUS_KEY: Readonly<Record<StrandStatus, 'secure' | 'gettingThere' | 'notYet' | 'notTested'>> = {
  secure: 'secure',
  'getting-there': 'gettingThere',
  'not-yet': 'notYet',
  'not-tested': 'notTested',
};

/** Section 3.7: the class report for one period. Pure; time comes in as `now`. */
export function classReport(input: ClassReportInput): ClassReport {
  const period = reportPeriodOf(input.period);
  const clock = Number.isNaN(input.now.getTime()) ? null : input.now;
  const at = classAtOf(period, input.at, input.now);
  const order = teachingOrder(input.catalog);
  const compares = period === 'week' || period === 'month';

  let withActivity = 0;
  let olderApp = 0;
  let notSaved7d = 0;
  const practiceDays: number[] = [];
  const practicedMinutes: number[] = [];
  const total: DaySums = { ...ZERO };
  // The up-only comparison reads only learners whose previous window is known, on both sides.
  const cmp = { practiced: 0, min: 0, q: 0 };
  const cmpPrev = { practiced: 0, min: 0, q: 0 };
  const lettersNew = new Map<string, number>();
  const revisit = new Map<string, number>();
  const milestones = new Map<StageKey, number>();
  const strands = PlacementStrandSchema.options.map((strand) => ({ strand, secure: 0, gettingThere: 0, notYet: 0, notTested: 0 }));
  let checks = 0;

  let notSaved = 0;
  for (const { summary, lastSyncedAt, joinedAt } of input.learners) {
    // A device that never saved progress here: a member, "not saved", never "did not practice"; never "last saved
    // more than 7 days ago" either (it never saved).
    if (summary === null) continue;
    if (staleOf(summary, lastSyncedAt, clock)) notSaved7d += 1;
    for (const letter of new Set(summary.needsPractice ?? [])) if (ReportLetterSchema.safeParse(letter).success) add(revisit, letter);
    const placement = summary.placement;
    if (placement) {
      checks += 1;
      // `oralStage` is never read: nothing in a report shows or counts speaking.
      for (const row of strands) row[STATUS_KEY[placement.strands[row.strand]]] += 1;
    }

    const activity = summary.activity;
    if (!activity) {
      olderApp += 1;
      continue;
    }
    withActivity += 1;
    const share = shareOf(activity, joinedAt, period, at, clock);
    if (share === null) {
      notSaved += 1;
      continue;
    }
    practiceDays.push(share.now.days);
    if (share.now.days > 0) practicedMinutes.push(share.now.min);
    total.min += share.now.min;
    total.q += share.now.q;
    total.c += share.now.c;
    for (const letter of new Set(share.letters)) add(lettersNew, letter);
    for (const stage of share.milestones) milestones.set(stage, (milestones.get(stage) ?? 0) + 1);
    if (compares && share.prev) {
      cmp.practiced += share.now.days > 0 ? 1 : 0;
      cmp.min += share.now.min;
      cmp.q += share.now.q;
      cmpPrev.practiced += share.prev.days > 0 ? 1 : 0;
      cmpPrev.min += share.prev.min;
      cmpPrev.q += share.prev.q;
    }
  }

  const up = (key: keyof typeof cmp): { up?: true } => (compares && cmpPrev[key] > 0 && cmp[key] > cmpPrev[key] ? { up: true } : {});
  const practiced = practicedMinutes.length;
  const dayBands = bandsOf(period, practiceDays);

  const plans = input.plans
    .flatMap((plan) => (plan.archivedAt === null && plan.publishedAt !== null ? [{ ...plan, publishedAt: plan.publishedAt }] : []))
    // Newest published first (homework is new to the class when it is published), then newest created, then by id
    // (ids are unique).
    .sort((x, y) => byNewest(x.publishedAt, y.publishedAt) || byNewest(x.createdAt, y.createdAt) || (x.id < y.id ? -1 : 1))
    .slice(0, PLANS_MAX)
    .map((plan) => {
      const row = { planId: plan.id, title: plan.title, assigned: 0, started: 0, finished: 0, itemsDone: 0 };
      for (const { summary } of input.learners) {
        const progress = summary?.planProgress?.[plan.id];
        if (!progress || progress.total <= 0) continue;
        row.assigned += 1;
        if (progress.done > 0) row.started += 1;
        if (progress.done >= progress.total) row.finished += 1;
        row.itemsDone += progress.done;
      }
      return row;
    });

  return {
    v: 1,
    period,
    headline: { code: 'class_practiced', practiced, learners: input.learners.length, ...up('practiced') },
    class: { learners: input.learners.length, withActivity, olderApp, notSaved7d },
    wentWell: {
      lettersNew: letterCounts(lettersNew, order),
      questsNew: { count: total.q, ...up('q') },
      cardsNew: total.c,
      milestones: [...milestones.entries()].sort(([x], [y]) => STAGES.indexOf(x) - STAGES.indexOf(y)).map(([stage, count]) => ({ stage, count })),
    },
    revisit: letterCounts(revisit, order),
    practice: dayBands === undefined ? {} : { dayBands, notSaved },
    time: {
      minutesTotal: { count: total.min, ...up('min') },
      minutesMedian: practiced >= MEDIAN_MIN_LEARNERS ? medianOf(practicedMinutes) : null,
    },
    levelCheck: checks > 0 ? strands : [],
    plans,
  };
}
