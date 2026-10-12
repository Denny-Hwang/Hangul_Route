import { z } from 'zod';
import type { Catalog } from '../catalog/schema';
import { StageKeySchema } from '../schemas/heritage-card';
import { PlacementStrandSchema, type PlacementStrand } from '../schemas/placement';
import { QUEST_ID_RE } from '../schemas/quest';
import { ReportLetterSchema, type ActivitySummary, type ReportPeriod } from '../schemas/report';
import type { ReportSummary } from '../schemas/report-response';
import type { VocabSummary } from '../schemas/sync';
import { VocabIdSchema } from '../schemas/vocab';
import { REPORT_WORDS_VISIBLE, type LearnerReport, type ReportStage, type ReportViewer } from './learner-report';
import { lettersIn, localRunEndingAt, todayFor } from './windows';

/**
 * "What went well" and "What to practice next" — F-REPORT-001 section 3.6 (RP-2b). Rule-based and deterministic:
 * rules run in table order, the first three that fire are kept, and a rule fires only when its data is present (a
 * missing `activity`, `placement`, `journey` or `vocab` silently skips it). A line is a code and its params (counts,
 * stage keys, letter keys, strand ids, catalogue quest ids, word ids): never a name and never a sentence. The renderer
 * (console RP-7a1, learner app RP-9) builds the sentence from `report.insight.<code>`, or `report.you.insight.<code>`
 * when the report's voice is `second` (OD-17); a plan line's `kind` picks the class ("homework") or family ("plan")
 * words.
 *
 * Anti-shame (CLAUDE.md section 1): a line is an invitation, never a warning; nothing compares the learner with anyone
 * else; nothing names a decline: the only comparison is `minutes_up`, with the learner's own past, and only when it
 * grew (OD-11).
 */

// ---------------------------------------------------------------------------
// Codes and rule tables (section 3.6)
// ---------------------------------------------------------------------------

/** At most this many lines in each section. */
export const INSIGHT_LINES_MAX = 3;

const ALL_PERIODS = ['day', 'week', 'month', 'all'] as const satisfies readonly ReportPeriod[];

/**
 * The went-well rules in table order; W0 is the last resort. `totalsOnly`: the rule also runs on a month older than
 * the day rows, whose figures come from its month row (section 3.2: W0, W3, W5 and W6 only).
 */
export const WENT_WELL_RULES = [
  { id: 'W1', code: 'stage_done', periods: ALL_PERIODS, totalsOnly: false },
  { id: 'W2', code: 'letters_new', periods: ALL_PERIODS, totalsOnly: false },
  { id: 'W3', code: 'practice_days', periods: ALL_PERIODS, totalsOnly: true },
  { id: 'W4', code: 'minutes_up', periods: ['week', 'month'], totalsOnly: false },
  { id: 'W5', code: 'quests_new', periods: ALL_PERIODS, totalsOnly: true },
  { id: 'W6', code: 'cards_new', periods: ALL_PERIODS, totalsOnly: true },
  { id: 'W7', code: 'level_secure', periods: ['week', 'month', 'all'], totalsOnly: false },
  { id: 'W8', code: 'plan_done', periods: ALL_PERIODS, totalsOnly: false },
  { id: 'W9', code: 'streak', periods: ['day', 'week'], totalsOnly: false },
  { id: 'W10', code: 'words_new', periods: ['week', 'month', 'all'], totalsOnly: false },
  { id: 'W0', code: 'showed_up', periods: ALL_PERIODS, totalsOnly: true },
] as const satisfies readonly { id: string; code: string; periods: readonly ReportPeriod[]; totalsOnly: boolean }[];

/**
 * The practice-next rules in table order. P0 is first whenever it fires. `day` keeps only P1 (no daily nudging), so
 * every other rule leaves `day` out.
 */
export const PRACTICE_NEXT_RULES = [
  { id: 'P0', codes: ['rhythm'], periods: ['week', 'month'] },
  { id: 'P1', codes: ['letters_revisit'], periods: ALL_PERIODS },
  { id: 'P2', codes: ['strand_next'], periods: ['week', 'month', 'all'] },
  { id: 'P3', codes: ['plan_open'], periods: ['week', 'month', 'all'] },
  { id: 'P4', codes: ['next_in_plan', 'next_on_route', 'free_days_done'], periods: ['week', 'month', 'all'] },
  { id: 'P5', codes: ['words_revisit'], periods: ['week', 'month', 'all'] },
] as const satisfies readonly { id: string; codes: readonly string[]; periods: readonly ReportPeriod[] }[];

export type WentWellCode = (typeof WENT_WELL_RULES)[number]['code'];
export type PracticeNextCode = (typeof PRACTICE_NEXT_RULES)[number]['codes'][number];
export type InsightCode = WentWellCode | PracticeNextCode;

export const WENT_WELL_CODES: readonly WentWellCode[] = WENT_WELL_RULES.map((rule) => rule.code);
export const PRACTICE_NEXT_CODES: readonly PracticeNextCode[] = PRACTICE_NEXT_RULES.flatMap((rule) => rule.codes);
/** Every insight code, each once: one `report.insight.<code>` message per code. */
export const INSIGHT_CODES: readonly InsightCode[] = [...WENT_WELL_CODES, ...PRACTICE_NEXT_CODES];

// ---------------------------------------------------------------------------
// Lines (codes and numbers only)
// ---------------------------------------------------------------------------

const Count = z.number().int().nonnegative();
const Letter = ReportLetterSchema;
const QuestId = z.string().regex(QUEST_ID_RE);
const PlanId = z.string().regex(/^plan:[a-z0-9-]+$/);
/** Plan words: a class reads "homework", a family (and the device) reads "plan" (section 3.11). */
const PlanKind = z.enum(['class', 'family']);
const line = <C extends string, P extends z.ZodRawShape>(code: C, params: P) => z.object({ code: z.literal(code), params: z.object(params).strict() }).strict();
const lineWith = <C extends string, P extends z.ZodRawShape, L extends z.ZodRawShape>(code: C, params: P, links: L) =>
  z.object({ code: z.literal(code), params: z.object(params).strict(), links: z.object(links).strict().optional() }).strict();

/**
 * One insight line. `params` hold counts, stage keys, letter keys, strand ids, catalogue quest ids and word ids only;
 * `links` carry the ids an action opens (the renderer shows **Add to a plan** and **Open the plan** to a console
 * viewer with `plan.write` only; an action never changes learner data by itself).
 */
export const InsightLineSchema = z.discriminatedUnion('code', [
  line('stage_done', { stage: z.object({ stage: StageKeySchema, n: z.number().int().min(1).max(StageKeySchema.options.length) }).strict() }),
  line('letters_new', { letters: z.array(Letter).min(1).max(5) }),
  line('practice_days', { days: Count }),
  line('minutes_up', { minutes: Count, period: z.enum(['week', 'month']) }),
  line('quests_new', { count: Count }),
  line('cards_new', { count: Count }),
  line('level_secure', { strands: z.array(PlacementStrandSchema).min(1).max(2) }),
  line('plan_done', { done: Count, kind: PlanKind }),
  line('streak', { days: Count }),
  line('words_new', { count: Count }),
  line('showed_up', { days: Count, period: z.enum(ALL_PERIODS) }),
  line('rhythm', {}),
  lineWith('letters_revisit', { letters: z.array(Letter).min(1).max(3), questId: QuestId.nullable() }, { addToPlan: QuestId }),
  line('strand_next', { strand: PlacementStrandSchema }),
  lineWith('plan_open', { count: Count, kind: PlanKind }, { openPlan: PlanId }),
  line('next_in_plan', { questId: QuestId }),
  line('next_on_route', { questId: QuestId }),
  line('free_days_done', {}),
  line('words_revisit', { words: z.array(VocabIdSchema).min(1).max(3) }),
]);
export type InsightLine = z.infer<typeof InsightLineSchema>;
type LineOf<C extends InsightCode> = Extract<InsightLine, { code: C }>;

/**
 * The summary the report read. The device viewer may also pass its word slice (`vocab`), which no console
 * projection carries until F-VOC-005 P-4; word lines stay hidden until then anyway (`REPORT_WORDS_VISIBLE`).
 */
export type InsightSummary = ReportSummary & { vocab?: VocabSummary };

/**
 * `report` is `learnerReport(...)` of the same `summary` and `catalog`; its viewer, period, window and figures drive the
 * rules. `catalog` is this build's catalogue: a quest id it does not hold (a retired quest, or one from a newer app
 * build) is never named or linked, because the renderer would have no title for it.
 */
export interface InsightContext {
  summary: InsightSummary | null;
  report: LearnerReport;
  catalog: Catalog;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const LETTERS_NEW_MAX = 5;
const LETTERS_REVISIT_MAX = 3;
const STRANDS_SECURE_MAX = 2;
const WORDS_REVISIT_MAX = 3;
/** W3: practice days that make a good period. */
const PRACTICE_DAYS_MIN: Readonly<Record<ReportPeriod, number>> = { day: 1, week: 2, month: 4, all: 5 };
const STREAK_MIN = 3;
const WORDS_NEW_MIN = 5;
/** Fewer practice days than this ever: practice next holds only the app's next (section 3.6). */
const GETTING_STARTED_DAYS = 2;
/** P2: the strand statuses that are next to grow, preferred first. */
const STRAND_NEXT_STATUSES = ['getting-there', 'not-yet'] as const;

/** What every rule reads. `window`, `upTo` and `figures` are null without day-by-day data (`legacy`). */
interface Facts {
  summary: InsightSummary;
  viewer: ReportViewer;
  period: ReportPeriod;
  activity: ActivitySummary | undefined;
  window: NonNullable<LearnerReport['window']> | null;
  /** The window's last day that counts: its end or the device's last saved day, whichever is earlier. */
  upTo: string | null;
  figures: LearnerReport['figures'];
  milestones: readonly (ReportStage & { on: string })[];
  totalsOnly: boolean;
  /** The catalogue's quest ids. */
  quests: ReadonlySet<string>;
}

interface Plan {
  id: string;
  done: number;
  total: number;
}

const kindOf = (viewer: ReportViewer): 'class' | 'family' => (viewer === 'class' ? 'class' : 'family');

/** This viewer's plans (already the viewing space's for a console viewer), by id; a class never reads a self-route. */
function plansOf(f: Facts): { plans: Plan[]; self: Plan | null } {
  const plans = Object.entries(f.summary.planProgress ?? {})
    .map(([id, row]) => ({ id, done: row.done, total: row.total }))
    // Record keys are unique, so two ids never tie.
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  const own = f.viewer === 'class' ? undefined : f.summary.selfRoute;
  return { plans, self: own ? { id: 'self', done: own.done, total: own.total } : null };
}

/** The learner-local day of an instant, in the activity's offset; null when unreadable. */
function localDayOf(iso: string, tz: number): string | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? todayFor(new Date(ms), tz) : null;
}

type Rule<C extends InsightCode> = (f: Facts) => LineOf<C> | null;

const W1: Rule<'stage_done'> = (f) => {
  const newest = f.milestones[f.milestones.length - 1];
  return newest ? { code: 'stage_done', params: { stage: { stage: newest.stage, n: newest.n } } } : null;
};

const W2: Rule<'letters_new'> = (f) => {
  if (!f.activity || !f.window || f.upTo === null) return null;
  const letters = lettersIn(f.activity.days, f.window.from, f.upTo).slice(0, LETTERS_NEW_MAX);
  return letters.length ? { code: 'letters_new', params: { letters } } : null;
};

const W3: Rule<'practice_days'> = (f) => {
  const days = f.figures?.days.count ?? 0;
  return days >= PRACTICE_DAYS_MIN[f.period] ? { code: 'practice_days', params: { days } } : null;
};

const W4: Rule<'minutes_up'> = (f) => {
  const minutes = f.figures?.minutes;
  if (!minutes?.up || (f.period !== 'week' && f.period !== 'month')) return null;
  return { code: 'minutes_up', params: { minutes: minutes.count, period: f.period } };
};

const W5: Rule<'quests_new'> = (f) => {
  const count = f.figures?.quests.count ?? 0;
  return count >= 1 ? { code: 'quests_new', params: { count } } : null;
};

const W6: Rule<'cards_new'> = (f) => {
  const count = f.figures?.cards.count ?? 0;
  return count >= 1 ? { code: 'cards_new', params: { count } } : null;
};

const W7: Rule<'level_secure'> = (f) => {
  const placement = f.summary.placement;
  if (!placement || !f.activity || !f.window || f.upTo === null) return null;
  if (f.period !== 'all') {
    const taken = localDayOf(placement.takenAt, f.activity.tz);
    if (taken === null || taken < f.window.from || taken > f.upTo) return null;
  }
  // `oralStage` is never read: nothing in a report shows or counts speaking.
  const strands = PlacementStrandSchema.options.filter((strand) => placement.strands[strand] === 'secure').slice(0, STRANDS_SECURE_MAX);
  return strands.length ? { code: 'level_secure', params: { strands } } : null;
};

const W8: Rule<'plan_done'> = (f) => {
  // `planProgress` is today's snapshot: it speaks only for the current window, and only when the learner practiced in
  // it (with no practice in the window, "What went well" is hidden, section 3.6). A `legacy` summary has no window.
  if (!f.window || !f.figures || f.window.at !== null || f.figures.days.count === 0) return null;
  const { plans, self } = plansOf(f);
  const done = [...plans, ...(self ? [self] : [])].find((plan) => plan.total > 0 && plan.done === plan.total);
  return done ? { code: 'plan_done', params: { done: done.done, kind: kindOf(f.viewer) } } : null;
};

const W9: Rule<'streak'> = (f) => {
  // The run ends at the last saved day, so it speaks only for a window that holds that day.
  if (!f.activity || !f.window || f.window.from > f.activity.asOf || f.window.to < f.activity.asOf) return null;
  const days = localRunEndingAt(f.activity.days, f.activity.asOf);
  return days >= STREAK_MIN ? { code: 'streak', params: { days } } : null;
};

const W10: Rule<'words_new'> = (f) => {
  const count = f.figures?.words?.count ?? 0;
  return REPORT_WORDS_VISIBLE && count >= WORDS_NEW_MIN ? { code: 'words_new', params: { count } } : null;
};

const W0: Rule<'showed_up'> = (f) => {
  const days = f.figures?.days.count ?? 0;
  return days >= 1 ? { code: 'showed_up', params: { days, period: f.period } } : null;
};

const WENT_WELL_FNS: Readonly<Record<(typeof WENT_WELL_RULES)[number]['id'], (f: Facts) => InsightLine | null>> = { W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W0 };

const P0: Rule<'rhythm'> = (f) => {
  // No practice in the saved part of the window (days after `asOf` count nowhere, section 3.2); never on a window that
  // lies wholly after the device's last saved day (`none_saved`: no practice-next line refers to it).
  if (!f.activity || !f.window || !f.figures || f.window.from > f.activity.asOf) return null;
  return f.figures.days.count === 0 ? { code: 'rhythm', params: {} } : null;
};

const P1: Rule<'letters_revisit'> = (f) => {
  const letters = (f.summary.needsPractice ?? []).filter((letter) => Letter.safeParse(letter).success).slice(0, LETTERS_REVISIT_MAX);
  if (!letters.length) return null;
  // The quest the device chose as open for this learner (section 3.3.4 step 9); none on an older build.
  const revisit = f.activity?.revisit;
  const questId = revisit !== undefined && isQuest(f, revisit) ? revisit : null;
  return questId ? { code: 'letters_revisit', params: { letters, questId }, links: { addToPlan: questId } } : { code: 'letters_revisit', params: { letters, questId } };
};

const P2: Rule<'strand_next'> = (f) => {
  const placement = f.summary.placement;
  if (!placement) return null;
  for (const status of STRAND_NEXT_STATUSES) {
    const strand: PlacementStrand | undefined = PlacementStrandSchema.options.find((s) => placement.strands[s] === status);
    if (strand) return { code: 'strand_next', params: { strand } };
  }
  return null;
};

const P3: Rule<'plan_open'> = (f) => {
  const { plans, self } = plansOf(f);
  const holders = [...plans, ...(self ? [self] : [])].filter((plan) => plan.total - plan.done > 0);
  const count = holders.reduce((n, plan) => n + (plan.total - plan.done), 0);
  if (count === 0) return null;
  // "Open the plan" opens one plan: offered only when one plan holds every open item counted, the self-route included
  // (the self-route is not a plan the builder opens).
  const only = holders.length === 1 && holders[0] !== self ? (holders[0] as Plan).id : null;
  const params = { count, kind: kindOf(f.viewer) };
  return only !== null && PlanId.safeParse(only).success ? { code: 'plan_open', params, links: { openPlan: only } } : { code: 'plan_open', params };
};

const P4: Rule<'next_in_plan' | 'next_on_route' | 'free_days_done'> = (f) => {
  const next = f.activity?.next;
  if (!next) return null;
  if ('end' in next) {
    // A family's plan is not a teacher's business: a class never reads the free-lessons line (section 3.6).
    return f.viewer === 'class' ? null : { code: 'free_days_done', params: {} };
  }
  if (!isQuest(f, next.q)) return null;
  // A class cannot tell its own plan from a family plan or a self-route: it always reads the route's next.
  return next.plan && f.viewer !== 'class' ? { code: 'next_in_plan', params: { questId: next.q } } : { code: 'next_on_route', params: { questId: next.q } };
};

const P5: Rule<'words_revisit'> = (f) => {
  if (!REPORT_WORDS_VISIBLE) return null;
  const words = (f.summary.vocab?.needsPractice ?? []).slice(0, WORDS_REVISIT_MAX);
  return words.length ? { code: 'words_revisit', params: { words } } : null;
};

const PRACTICE_NEXT_FNS: Readonly<Record<(typeof PRACTICE_NEXT_RULES)[number]['id'], (f: Facts) => InsightLine | null>> = { P0, P1, P2, P3, P4, P5 };

const QUEST_SETS = new WeakMap<Catalog, ReadonlySet<string>>();
/** The catalogue's quest ids, once per catalogue. */
function questsOf(catalog: Catalog): ReadonlySet<string> {
  const cached = QUEST_SETS.get(catalog);
  if (cached) return cached;
  const ids = new Set(catalog.quests.map((quest) => quest.id));
  QUEST_SETS.set(catalog, ids);
  return ids;
}

/** A quest id of the catalogue grammar that this build's catalogue holds. */
const isQuest = (f: Facts, id: string): boolean => QUEST_ID_RE.test(id) && f.quests.has(id);

/** What the rules read, or null when there is no summary (`no_data`). */
function factsOf(ctx: InsightContext): Facts | null {
  const { summary, report } = ctx;
  if (summary === null || report.state === 'no_data') return null;
  const activity = summary.activity;
  const window = report.window;
  const upTo = window && activity ? (window.to < activity.asOf ? window.to : activity.asOf) : null;
  return {
    summary,
    viewer: report.viewer,
    period: report.period,
    activity,
    window,
    upTo,
    figures: report.figures,
    milestones: report.detail?.milestones ?? [],
    totalsOnly: window?.totalsOnly ?? false,
    quests: questsOf(ctx.catalog),
  };
}

const runs = (periods: readonly ReportPeriod[], f: Facts): boolean => periods.includes(f.period);

/**
 * "What went well" (section 3.6): up to 3 lines in table order; W0 only when no other line fired and the learner
 * practiced in the window, so the section is never empty after practice. No line at all without practice in the
 * window (the renderer hides an empty section and its heading).
 */
export function wentWell(ctx: InsightContext): InsightLine[] {
  const f = factsOf(ctx);
  if (f === null || ctx.report.state === 'empty') return [];
  const lines: InsightLine[] = [];
  for (const rule of WENT_WELL_RULES) {
    if (rule.id === 'W0' || lines.length === INSIGHT_LINES_MAX) continue;
    if (!runs(rule.periods, f) || (f.totalsOnly && !rule.totalsOnly)) continue;
    const out = WENT_WELL_FNS[rule.id](f);
    if (out) lines.push(out);
  }
  if (lines.length) return lines;
  const fallback = W0(f);
  return fallback ? [fallback] : [];
}

/**
 * "What to practice next" (section 3.6): an invitation, never a warning. Up to 3 lines in table order, P0 first when
 * it fires. `day` keeps only P1 (no daily nudging). A learner with fewer than 2 practice days ever, and the `empty`
 * state, hold only the app's next (P4), on the periods P4 runs on: nothing on `day`.
 */
export function practiceNext(ctx: InsightContext): InsightLine[] {
  const f = factsOf(ctx);
  if (f === null) return [];
  const gettingStarted = ctx.report.state === 'empty' || (f.activity !== undefined && f.activity.total.days < GETTING_STARTED_DAYS);
  if (gettingStarted) {
    if (!runs(PRACTICE_NEXT_RULES[4].periods, f)) return [];
    const only = P4(f);
    return only ? [only] : [];
  }
  const lines: InsightLine[] = [];
  for (const rule of PRACTICE_NEXT_RULES) {
    if (lines.length === INSIGHT_LINES_MAX) break;
    if (!runs(rule.periods, f)) continue;
    const out = PRACTICE_NEXT_FNS[rule.id](f);
    if (out) lines.push(out);
  }
  return lines;
}
