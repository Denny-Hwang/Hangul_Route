import type { Catalog } from '../catalog/schema';
import { addDays, daysBetween } from '../curriculum/dates';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import { PlacementStrandSchema, type PlacementStrand, type StrandStatus } from '../schemas/placement';
import { reportPeriodOf, type ActivityDay, type ActivitySummary, type ReportPeriod } from '../schemas/report';
import type { ReportSummary } from '../schemas/report-response';
import { clampAt, horizonOf, monthOf, rowsFromOf, stepOf, sumDays, todayFor, windowOf, type DaySums, type ReportStep, type ReportWindow } from './windows';

/**
 * The learner report — F-REPORT-001 section 3.5 (RP-2a): one learner's summary turned into a report for a period,
 * as codes and numbers. The renderer (console RP-7a1, learner app RP-9) builds every sentence from `packages/i18n`
 * `report.*`; "went well" and "practice next" (section 3.6) are `insights.ts` (RP-2b).
 *
 * Rules that hold for every viewer: no percentage (OD-6), no figure of anyone else (the input has no slot for one),
 * an up-only marker and never a down one (OD-11), a growth line that only rises (OD-10), days after the device's
 * last saved day counted nowhere, and `oralStage` never read.
 */

/** Who reads the report: a family space, a class (or a school admin over it), or the learner's own device. */
export type ReportViewer = 'family' | 'class' | 'device';
/** `second` only on a self-only device (OD-17); every other viewer reads the third person. */
export type ReportVoice = 'third' | 'second';

/**
 * Word figures stay hidden for every viewer, console and device, until F-VOC-005 P-4 adds their consent item
 * (section 3.10); P-4 flips this, and RP-2b's W10 / P5 read it too.
 */
export const REPORT_WORDS_VISIBLE: boolean = false;

export interface LearnerReportInput {
  /** The roster projection (console) or the full local summary (device); null when the server holds none. */
  summary: ReportSummary | null;
  viewer: ReportViewer;
  voice: ReportVoice;
  period: ReportPeriod;
  /** A learner-local day that selects a past window (OD-18); anything malformed or out of limits is ignored. */
  at?: string | null;
  now: Date;
  /** The catalogue: the order letters are taught in. */
  catalog: Catalog;
  /** The server's last sync of this learner; null on the device. */
  lastSyncedAt: string | null;
}

/** `no_data`: no summary stored; `empty`: never practiced; `legacy`: no day-by-day data; `ready`. */
export type LearnerReportState = 'no_data' | 'empty' | 'legacy' | 'ready';
export type ReportHeadlineCode = 'stage_done' | 'practiced' | 'none_saved' | 'none_yet' | 'getting_started';
export type ReportCalendarKind = 'practiced' | 'none' | 'not_saved';

/** A stage with its number (1-7), for "Stage {n}: {stage}". */
export interface ReportStage {
  stage: StageKey;
  n: number;
}

/** A count, with `up` only when it grew against the previous window. */
export interface ReportFigure {
  count: number;
  up?: true;
}

export interface ReportCalendarCell {
  day: string;
  /** Practiced (a filled cell), none (a neutral outline, never labelled) or not saved yet (dashed). */
  kind: ReportCalendarKind;
  minutes: number;
}

/** Done and ready to play; items the device could not assign yet are left out. */
export interface ReportPlanCounts {
  done: number;
  ready: number;
}

export interface LearnerReportDetail {
  /** Letters known well, at most 24, in the order the catalogue teaches them. */
  lettersStrong: string[];
  /** How many more letters are known well than `lettersStrong` names. */
  lettersStrongMore: number;
  /** At most 3, the summary's own order. */
  lettersPractising: string[];
  /** Letters that became strong in the window, in the order learned; null for `all` and a totals-only month. */
  lettersNew: string[] | null;
  /** Since the start: `activity.total`, else the summary's own counts. */
  totals: { quests: number; cards: number };
  /** The newest level check's level, shown with the roster's band words. */
  startingSpot: (ReportStage & { band: number; takenAt: string }) | null;
  /** Stages finished in the window (`all`: every one), ascending. */
  milestones: (ReportStage & { on: string })[];
  /** The newest level check's strands, in the fixed order; words, never counts. */
  levelCheck: { takenAt: string; strands: { strand: PlacementStrand; status: StrandStatus }[] } | null;
  /** class: this class's plans; family: the family's plans and the self-route; device: every plan and the self-route. */
  plan: { kind: ReportViewer; plans: ReportPlanCounts | null; self: ReportPlanCounts | null } | null;
}

export interface LearnerReport {
  v: 1;
  state: LearnerReportState;
  viewer: ReportViewer;
  voice: ReportVoice;
  period: ReportPeriod;
  /** Last saved more than 7 days ago, by sync or by `asOf`: the older learner-local day. */
  stale: { lastSaved: string } | null;
  horizon: { asOf: string; partial: boolean } | null;
  /** Two lines that do not depend on the period. */
  glance: { nowOn: ReportStage | null; lastPractice: string | null } | null;
  window: {
    period: ReportPeriod;
    from: string;
    to: string;
    /** The `at` for the URL; null on the current window. */
    at: string | null;
    /** current; previous: the first step back ("Last week"); earlier: further back (the dates). */
    step: 'current' | 'previous' | 'earlier';
    totalsOnly: boolean;
    prev: ReportStep | null;
    next: ReportStep | null;
  } | null;
  headline: { code: ReportHeadlineCode; days: number; quests: number; stage: ReportStage | null } | null;
  figures: {
    days: ReportFigure;
    minutes: ReportFigure;
    quests: ReportFigure;
    cards: ReportFigure;
    /** Null for a totals-only month. */
    letters: ReportFigure | null;
    /** Null until F-VOC-005 P-4 (`REPORT_WORDS_VISIBLE`). */
    words: ReportFigure | null;
  } | null;
  /** `week`: 7 cells; `month`: one per day of the window; otherwise null. */
  calendar: ReportCalendarCell[] | null;
  /** `all`: quests and cards before the first month listed, then the running sum per month. */
  growth: { baseline: { quests: number; cards: number }; months: { m: string; quests: number; cards: number }[] } | null;
  detail: LearnerReportDetail | null;
}

const DAY_MS = 86_400_000;
const STALE_DAYS = 7;
const STRONG_SHOWN = 24;
const STAGES = StageKeySchema.options;

const stageOf = (key: string | null | undefined): ReportStage | null => {
  const parsed = StageKeySchema.safeParse(key);
  return parsed.success ? { stage: parsed.data, n: STAGES.indexOf(parsed.data) + 1 } : null;
};
const byCodeUnit = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** A summary without `activity` that never had a quest, a card or an active day reads as `empty`. */
function neverActive(summary: ReportSummary): boolean {
  const journeyDone = sum((summary.journey?.stages ?? []).map((row) => row.done));
  return !summary.stage1?.questsDone && !summary.cardsUnlocked && journeyDone === 0 && !summary.lastActiveAt;
}

function stateOf(summary: ReportSummary | null): LearnerReportState {
  if (summary === null) return 'no_data';
  if (summary.activity) return summary.activity.total.days === 0 ? 'empty' : 'ready';
  return neverActive(summary) ? 'empty' : 'legacy';
}

/** Section 3.5 item 2: last saved more than 7 days ago by the server's sync or by the device's last day. */
function staleOf(summary: ReportSummary, lastSyncedAt: string | null, now: Date): LearnerReport['stale'] {
  const activity = summary.activity;
  const tz = activity?.tz ?? 0;
  const syncMs = lastSyncedAt === null ? Number.NaN : Date.parse(lastSyncedAt);
  const synced = Number.isFinite(syncMs);
  const bySync = synced && now.getTime() - syncMs > STALE_DAYS * DAY_MS;
  const byAsOf = activity !== undefined && daysBetween(activity.asOf, todayFor(now, tz)) > STALE_DAYS;
  if (!bySync && !byAsOf) return null;
  const days = [synced ? todayFor(new Date(syncMs), tz) : null, activity?.asOf ?? null].filter((d): d is string => d !== null);
  return { lastSaved: days.sort(byCodeUnit)[0] as string };
}

/** Each taught symbol's first place in the catalogue (quest order, then each quest's `teaches`). */
function teachingOrder(catalog: Catalog): Map<string, number> {
  const order = new Map<string, number>();
  for (const quest of catalog.quests) for (const symbol of quest.teaches) if (!order.has(symbol)) order.set(symbol, order.size);
  return order;
}

function planOf(summary: ReportSummary, viewer: ReportViewer): LearnerReportDetail['plan'] {
  const rows = Object.values(summary.planProgress ?? {});
  const done = sum(rows.map((row) => row.done));
  const total = sum(rows.map((row) => row.total));
  const plans = total > 0 ? { done, ready: Math.max(0, total - done) } : null;
  // A class never reads a self-route (F-PLAN-002 section 3.10), even if one reached it.
  const own = viewer === 'class' ? undefined : summary.selfRoute;
  const self = own && own.total > 0 ? { done: own.done, ready: Math.max(0, own.total - own.done) } : null;
  return plans || self ? { kind: viewer, plans, self } : null;
}

function detailOf(
  summary: ReportSummary,
  viewer: ReportViewer,
  catalog: Catalog,
  window: { lettersNew: string[] | null; milestones: LearnerReportDetail['milestones'] },
): LearnerReportDetail {
  const order = teachingOrder(catalog);
  const rank = (symbol: string): number => order.get(symbol) ?? Number.POSITIVE_INFINITY;
  const strong = [...new Set(summary.jamoRecognized ?? [])].sort((x, y) => rank(x) - rank(y) || byCodeUnit(x, y));
  const placement = summary.placement;
  const level = placement ? stageOf(placement.level.stage) : null;
  const activity = summary.activity;
  return {
    lettersStrong: strong.slice(0, STRONG_SHOWN),
    lettersStrongMore: Math.max(0, strong.length - STRONG_SHOWN),
    lettersPractising: [...(summary.needsPractice ?? [])],
    lettersNew: window.lettersNew,
    totals: {
      quests: activity?.total.q ?? summary.stage1?.questsDone ?? 0,
      cards: activity?.total.c ?? summary.cardsUnlocked ?? 0,
    },
    startingSpot: placement && level ? { ...level, band: placement.level.band, takenAt: placement.takenAt } : null,
    milestones: window.milestones,
    // `oralStage` is never read: nothing in a report shows or counts speaking.
    levelCheck: placement
      ? { takenAt: placement.takenAt, strands: PlacementStrandSchema.options.map((strand) => ({ strand, status: placement.strands[strand] })) }
      : null,
    plan: planOf(summary, viewer),
  };
}

/** Valid milestones with their stage number, ascending by day. */
function milestonesOf(activity: ActivitySummary): (ReportStage & { on: string })[] {
  return activity.milestones
    .flatMap((row) => {
      const stage = stageOf(row.stage);
      return stage ? [{ ...stage, on: row.on }] : [];
    })
    .sort((x, y) => byCodeUnit(x.on, y.on) || x.n - y.n);
}

/** The first day anything happened: `total.since`, else the oldest row, month or milestone (a class reads no `since`). */
function sinceOf(activity: ActivitySummary): string | null {
  const firsts = [activity.days[0]?.d, activity.months[0] ? `${activity.months[0].m}-01` : undefined, ...activity.milestones.map((row) => row.on)];
  const known = firsts.filter((d): d is string => d !== undefined).sort(byCodeUnit);
  return activity.total.since ?? known[0] ?? null;
}

const figure = (count: number, prev: number | null): ReportFigure =>
  prev !== null && prev > 0 && count > prev ? { count, up: true } : { count };

const monthSums = (activity: ActivitySummary, month: string): DaySums | null => {
  const row = activity.months.find((m) => m.m === month);
  return row ? { days: row.days, min: row.min, q: row.q, c: row.c, w: row.w, letters: 0 } : null;
};

/** The previous window's sums for the up-only marker, or null when there is nothing whole to compare with. */
function previousOf(activity: ActivitySummary, window: ReportWindow): DaySums | null {
  if (window.period === 'week' && (window.prevFrom as string) >= rowsFromOf(activity.asOf)) {
    return sumDays(activity.days, window.prevFrom as string, window.prevTo as string);
  }
  if (window.period === 'month') return monthSums(activity, monthOf(window.prevFrom as string));
  return null;
}

function stepLabel(period: ReportPeriod, today: string, at: string | null): 'current' | 'previous' | 'earlier' {
  if (at === null) return 'current';
  const previous =
    period === 'month' ? monthOf(addDays(`${monthOf(today)}-01`, -1)) === monthOf(at) : addDays(today, period === 'day' ? -1 : -7) === at;
  return previous ? 'previous' : 'earlier';
}

function calendarOf(activity: ActivitySummary, window: ReportWindow): ReportCalendarCell[] | null {
  if (window.period === 'day' || window.period === 'all' || window.totalsOnly) return null;
  const rows = new Map<string, ActivityDay>(activity.days.map((row) => [row.d, row]));
  const cells: ReportCalendarCell[] = [];
  for (let day = window.from; day <= window.to; day = addDays(day, 1)) {
    const row = rows.get(day);
    if (day > activity.asOf) cells.push({ day, kind: 'not_saved', minutes: 0 });
    else cells.push(row ? { day, kind: 'practiced', minutes: row.min } : { day, kind: 'none', minutes: 0 });
  }
  return cells;
}

function growthOf(activity: ActivitySummary): NonNullable<LearnerReport['growth']> {
  // A class reads lifetime totals with the months before it joined removed: they fold into the baseline.
  let quests = Math.max(0, activity.total.q - sum(activity.months.map((row) => row.q)));
  let cards = Math.max(0, activity.total.c - sum(activity.months.map((row) => row.c)));
  const baseline = { quests, cards };
  const months = activity.months.map((row) => {
    quests += row.q;
    cards += row.c;
    return { m: row.m, quests, cards };
  });
  return { baseline, months };
}

/** Section 3.5: the learner report of one learner for one period. Pure; time comes in as `now`. */
export function learnerReport(input: LearnerReportInput): LearnerReport {
  const { summary, viewer, catalog, now, lastSyncedAt } = input;
  const period = reportPeriodOf(input.period);
  const state = stateOf(summary);
  const base: LearnerReport = {
    v: 1,
    state,
    viewer,
    voice: viewer === 'device' ? input.voice : 'third',
    period,
    stale: null,
    horizon: null,
    glance: null,
    window: null,
    headline: null,
    figures: null,
    calendar: null,
    growth: null,
    detail: null,
  };
  if (summary === null) return base;
  base.stale = staleOf(summary, lastSyncedAt, now);
  if (state === 'empty') return base;
  base.glance = { nowOn: stageOf(summary.journey?.here), lastPractice: summary.lastActiveAt || null };
  const activity = summary.activity;
  if (!activity) {
    base.detail = detailOf(summary, viewer, catalog, { lettersNew: null, milestones: [] });
    return base;
  }

  const today = todayFor(now, activity.tz);
  const at = clampAt(period, today, input.at, activity);
  const window = windowOf(period, today, at, { rowsFrom: rowsFromOf(activity.asOf), since: sinceOf(activity) });
  const horizon = horizonOf(window, activity.asOf);
  const all = period === 'all';
  const strongCount = new Set(summary.jamoRecognized ?? []).size;

  const current: DaySums = all
    ? { days: activity.total.days, min: activity.total.min, q: activity.total.q, c: activity.total.c, w: activity.total.w, letters: strongCount }
    : window.totalsOnly
      ? (monthSums(activity, monthOf(window.from)) ?? { days: 0, min: 0, q: 0, c: 0, w: 0, letters: 0 })
      : sumDays(activity.days, window.from, horizon.upTo);
  const prev = previousOf(activity, window);
  const milestones = milestonesOf(activity).filter((row) => all || (row.on >= window.from && row.on <= horizon.upTo));
  const newest = milestones[milestones.length - 1];

  let code: ReportHeadlineCode = newest ? 'stage_done' : current.days > 0 ? 'practiced' : horizon.saved ? 'none_yet' : 'none_saved';
  if ((code === 'practiced' || code === 'none_yet') && activity.total.days < 2) code = 'getting_started';

  const lettersNew =
    all || window.totalsOnly
      ? null
      : [...new Set(activity.days.filter((row) => row.d >= window.from && row.d <= horizon.upTo).flatMap((row) => row.j))];

  base.horizon = { asOf: horizon.asOf, partial: horizon.partial };
  base.window = {
    period,
    from: window.from,
    to: window.to,
    at,
    step: stepLabel(period, today, at),
    totalsOnly: window.totalsOnly,
    prev: stepOf(period, today, at, 'prev', activity),
    next: stepOf(period, today, at, 'next', activity),
  };
  base.headline = { code, days: current.days, quests: current.q, stage: newest ? { stage: newest.stage, n: newest.n } : null };
  base.figures = {
    days: figure(current.days, prev?.days ?? null),
    minutes: figure(current.min, prev?.min ?? null),
    quests: figure(current.q, prev?.q ?? null),
    cards: figure(current.c, prev?.c ?? null),
    // A month's row has no letters: only a week compares them.
    letters: window.totalsOnly ? null : figure(current.letters, window.period === 'week' ? (prev?.letters ?? null) : null),
    words: REPORT_WORDS_VISIBLE ? figure(current.w, prev?.w ?? null) : null,
  };
  base.calendar = calendarOf(activity, window);
  base.growth = all ? growthOf(activity) : null;
  base.detail = detailOf(summary, viewer, catalog, { lettersNew, milestones });
  return base;
}
