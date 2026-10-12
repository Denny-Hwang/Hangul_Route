import type { Catalog } from '../catalog/schema';
import { daysBetween } from '../curriculum/dates';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import { PlacementStrandSchema, type StrandStatus } from '../schemas/placement';
import type { Plan } from '../schemas/plan';
import {
  CLASS_DAY_BANDS_BY_PERIOD,
  ReportLetterSchema,
  reportPeriodOf,
  type ActivitySummary,
  type ClassDayBand,
  type ClassReport,
  type ReportPeriod,
} from '../schemas/report';
import type { ReportSummary } from '../schemas/report-response';
import { lettersIn, monthOf, shownFromOf, sumDays, todayFor, windowOf, type DaySums } from './windows';

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
 * holds nothing from before the learner joined (RP-W2), so a day before the join day counts nowhere.
 */

/** One member of the class as the Worker hands it over: the class projection of their summary, and no id or name. */
export interface ClassReportLearner {
  /** `teacherVisibleSummary` with the membership's join day (RP-W2); null when the server holds none. */
  summary: ReportSummary | null;
  /** The server's last sync of this learner; null when never synced. */
  lastSyncedAt: string | null;
}

/** The class's plans (`plansOf`): only published, non-archived plans are homework rows. */
export type ClassReportPlan = Pick<Plan, 'id' | 'title' | 'publishedAt' | 'archivedAt' | 'createdAt'>;

export interface ClassReportInput {
  /** Every learner member of the class, in any order: the result does not depend on it. */
  learners: readonly ClassReportLearner[];
  plans: readonly ClassReportPlan[];
  period: ReportPeriod;
  /** A day that selects a past window (OD-18); anything malformed or after today reads as the current window. */
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


/** Each taught symbol's first place in the catalogue (quest order, then each quest's `teaches`). */
function teachingOrder(catalog: Catalog): Map<string, number> {
  const order = new Map<string, number>();
  for (const quest of catalog.quests) for (const symbol of quest.teaches) if (!order.has(symbol)) order.set(symbol, order.size);
  return order;
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

const add = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

/** Last saved more than 7 days ago, by the server's sync or by the device's last day (section 3.5 item 2). */
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

/** One learner's share of the window: figures, letters, milestones, and the previous window when it is known. */
interface Share {
  now: DaySums;
  letters: string[];
  milestones: StageKey[];
  /** Null when the previous window is not wholly known for this learner (they joined in it, or it aged out). */
  prev: DaySums | null;
}

function shareOf(activity: ActivitySummary, period: ReportPeriod, at: string | null | undefined, clock: Date | null): Share {
  const today = clock ? todayFor(clock, activity.tz) : activity.asOf;
  const window = windowOf(period, today, at, activity, true);
  const upTo = window.to < activity.asOf ? window.to : activity.asOf;
  const all = period === 'all';
  const month = period === 'month' ? monthRowOf(activity, monthOf(window.from)) : null;
  const now: DaySums = all
    ? { days: activity.total.days, min: activity.total.min, q: activity.total.q, c: activity.total.c, w: activity.total.w }
    : (month ?? (window.totalsOnly ? ZERO : sumDays(activity.days, window.from, upTo)));
  const letters = window.totalsOnly ? [] : lettersIn(activity.days, window.from, upTo);
  const milestones = activity.milestones
    .filter((row) => all || (row.on >= window.from && row.on <= upTo))
    .flatMap((row) => {
      const stage = StageKeySchema.safeParse(row.stage);
      return stage.success ? [stage.data] : [];
    });

  let prev: DaySums | null = null;
  const { prevFrom, prevTo } = window;
  if (prevFrom !== undefined && prevTo !== undefined) {
    // A month row is whole; otherwise the day rows must hold all of the previous window the class could see.
    const row = period === 'month' ? monthRowOf(activity, monthOf(prevFrom)) : null;
    prev = row ?? (prevFrom >= shownFromOf(activity, today, true) ? sumDays(activity.days, prevFrom, prevTo) : null);
  }
  return { now, letters, milestones, prev };
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

  for (const { summary, lastSyncedAt } of input.learners) {
    if (summary === null) {
      // A device that never saved progress here: "not saved", never "did not practice".
      notSaved7d += 1;
      continue;
    }
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
    const share = shareOf(activity, period, input.at, clock);
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
    .filter((plan) => plan.archivedAt === null && plan.publishedAt !== null)
    // Newest first; plans created at the same instant by id (ids are unique).
    .sort((x, y) => (x.createdAt === y.createdAt ? (x.id < y.id ? -1 : 1) : x.createdAt > y.createdAt ? -1 : 1))
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
    practice: dayBands === undefined ? {} : { dayBands },
    time: {
      minutesTotal: { count: total.min, ...up('min') },
      minutesMedian: practiced >= MEDIAN_MIN_LEARNERS ? medianOf(practicedMinutes) : null,
    },
    levelCheck: checks > 0 ? strands : [],
    plans,
  };
}
