import {
  TEACHER_HIDDEN_SUMMARY_KEYS,
  TEACHER_VISIBLE_SUMMARY_KEYS,
  type ActivitySummary,
  type ProgressSummary,
  type SpaceKind,
  type TeacherVisibleSummaryKey,
} from '@hangul-route/content-schema';

/**
 * What a roster reader receives of a learner's summary — F-SPACE-002 T-1a
 * (T16a, section 4.11). The stored summary is projected to the allow-list the
 * consent text is generated from, so `nothing_else` stays true: keys on no
 * list (`stage1Anchor`, `schemaVersion`, anything an older or newer writer
 * left behind) never leave, and `planProgress` keeps only the viewing space's
 * own plans, never another class's or a family's.
 *
 * A key missing from a legacy summary stays missing; `planProgress` is always
 * an object (empty when missing or malformed) because readers index into it.
 */
export type TeacherVisibleSummary = Pick<ProgressSummary, TeacherVisibleSummaryKey>;

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The three Hangul-stage figures the consent item `quests` names. */
const STAGE1_KEYS = ['questsDone', 'questsTotal', 'anchorAccuracy'] as const satisfies readonly (keyof ProgressSummary['stage1'])[];

function pick(source: Plain, keys: readonly string[]): Plain {
  const out: Plain = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

type Journey = NonNullable<ProgressSummary['journey']>;
const JOURNEY_KEYS = ['v', 'here', 'stages'] as const satisfies readonly (keyof Journey)[];
const JOURNEY_STAGE_KEYS = ['stage', 'state', 'done', 'known', 'total'] as const satisfies readonly (keyof Journey['stages'][number])[];

/** My route stage counts (F-ROUTE-001 R-8, OD-11), projected to the known keys at every level. */
function journeyOf(value: Plain): Plain {
  const stages = Array.isArray(value.stages) ? value.stages.filter(isPlain).map((s) => pick(s, JOURNEY_STAGE_KEYS)) : [];
  return { ...pick(value, JOURNEY_KEYS), stages };
}

/**
 * Who reads a projected `activity` (F-REPORT-001 section 3.8): the kind of the
 * viewing space and when the learner joined it (`memberships.joined_at`).
 */
export interface ActivityViewer {
  readonly kind: SpaceKind;
  readonly joinedAt?: string | null;
}

const ACTIVITY_KEYS = ['v', 'tz', 'asOf'] as const satisfies readonly (keyof ActivitySummary)[];
const ACTIVITY_DAY_KEYS = ['d', 'min', 'q', 'c', 'w', 'j'] as const satisfies readonly (keyof ActivitySummary['days'][number])[];
const ACTIVITY_MONTH_KEYS = ['m', 'min', 'q', 'c', 'w', 'days'] as const satisfies readonly (keyof ActivitySummary['months'][number])[];
const ACTIVITY_TOTAL_KEYS = ['since', 'min', 'q', 'c', 'w', 'days'] as const satisfies readonly (keyof ActivitySummary['total'])[];
const ACTIVITY_MILESTONE_KEYS = ['stage', 'on'] as const satisfies readonly (keyof ActivitySummary['milestones'][number])[];
const ACTIVITY_NEXT_QUEST_KEYS = ['q', 'plan'] as const;

/**
 * Word counts reach no grown-up while `vocab` is hidden: F-VOC-005 P-4 moves
 * `vocab` to the allow-list with its own consent item, and from then on `w`
 * travels as sent (a test pins the coupling).
 */
const WORDS_HIDDEN = (TEACHER_HIDDEN_SUMMARY_KEYS as readonly string[]).includes('vocab');

/** The learner-local day (`YYYY-MM-DD`) of an instant at `tz` minutes east of UTC, or null when it does not parse. */
function localDayOf(iso: string | null | undefined, tz: number): string | null {
  const ms = typeof iso === 'string' ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? new Date(ms + tz * 60_000).toISOString().slice(0, 10) : null;
}

const rowsOf = (value: unknown, keys: readonly string[]): Plain[] => (Array.isArray(value) ? value.filter(isPlain).map((row) => pick(row, keys)) : []);
const withoutWords = (row: Plain): Plain => (WORDS_HIDDEN ? { ...row, w: 0 } : row);

/**
 * The day-by-day activity a viewer may read (F-REPORT-001 section 3.8), picked
 * to its known keys at every level like `journeyOf`.
 *
 * - Every word count `w` is 0 while `vocab` is hidden, for every viewer.
 * - A family reads the rest whole.
 * - A class or a school reads no history from before the learner joined it:
 *   days and milestones before the learner-local day of `joinedAt` (at
 *   `activity.tz`) and months up to and including the join month are dropped;
 *   `total` keeps its lifetime counts (they match the roster) but `since`, the
 *   first practice day, becomes null; `next.end` (the free plan is done) is
 *   dropped, because a family's plan is not a teacher's business, and
 *   `next.plan` is always false: the flag cannot tell the class's own plan from
 *   a family plan or the learner's self-route (F-PLAN-002 section 3.10), so a
 *   teacher reads the app's next quest but never whether a plan chose it.
 *   Without a usable `joinedAt` nothing is provably after joining, so no
 *   history is kept.
 */
export function activityOf(value: Plain, viewer: ActivityViewer): ActivitySummary {
  const out: Plain = pick(value, ACTIVITY_KEYS);
  let days = rowsOf(value.days, ACTIVITY_DAY_KEYS).map(withoutWords);
  let months = rowsOf(value.months, ACTIVITY_MONTH_KEYS).map(withoutWords);
  let milestones = rowsOf(value.milestones, ACTIVITY_MILESTONE_KEYS);
  const total = isPlain(value.total) ? withoutWords(pick(value.total, ACTIVITY_TOTAL_KEYS)) : null;
  const next = isPlain(value.next) ? (value.next.end === true ? { end: true } : pick(value.next, ACTIVITY_NEXT_QUEST_KEYS)) : null;
  const family = viewer.kind === 'family';

  if (!family) {
    const joinDay = localDayOf(viewer.joinedAt, typeof value.tz === 'number' ? value.tz : 0);
    const fromJoin = (day: unknown): boolean => joinDay !== null && typeof day === 'string' && day >= joinDay;
    days = days.filter((row) => fromJoin(row.d));
    milestones = milestones.filter((row) => fromJoin(row.on));
    months = months.filter((row) => joinDay !== null && typeof row.m === 'string' && row.m > joinDay.slice(0, 7));
  }

  out.days = days;
  out.months = months;
  if (total) out.total = family ? total : { ...total, since: null };
  out.milestones = milestones;
  if (next && family) out.next = next;
  else if (next && next.end !== true) out.next = { ...next, plan: false };
  if (value.revisit !== undefined) out.revisit = value.revisit;
  // Stored summaries were validated by ActivitySummarySchema on write (routes/sync.ts); this only removes and narrows.
  return out as ActivitySummary;
}

/**
 * The allow-listed projection of a stored summary. `viewer` matters for
 * `activity` only; without one the reader is a class with no known join time,
 * which receives no day-by-day history.
 */
export function teacherVisibleSummary(summary: unknown, planIds: ReadonlySet<string>, viewer: ActivityViewer = { kind: 'class' }): TeacherVisibleSummary | null {
  if (!isPlain(summary)) return null;
  const out: Plain = {};
  for (const key of TEACHER_VISIBLE_SUMMARY_KEYS) {
    const value = summary[key];
    if (key === 'planProgress') {
      out.planProgress = isPlain(value) ? pick(value, Object.keys(value).filter((id) => planIds.has(id))) : {};
    } else if (key === 'stage1') {
      if (isPlain(value)) out.stage1 = pick(value, STAGE1_KEYS);
    } else if (key === 'journey') {
      if (isPlain(value)) out.journey = journeyOf(value);
    } else if (key === 'activity') {
      if (isPlain(value)) out.activity = activityOf(value, viewer);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  // Stored summaries were validated by ProgressSummarySchema on write (routes/sync.ts); this only removes keys.
  return out as TeacherVisibleSummary;
}

const SELF_ROUTE_KEYS = ['done', 'total', 'notReady', 'weeks', 'endsOn'] as const satisfies readonly (keyof NonNullable<ProgressSummary['selfRoute']>)[];
const ROUTE_GOAL_KEYS = ['stage', 'from'] as const satisfies readonly (keyof NonNullable<ProgressSummary['routeGoal']>)[];

/** What a family space additionally reads of its learner's summary. */
export type FamilyVisibleSummary = TeacherVisibleSummary & Pick<ProgressSummary, 'selfRoute' | 'routeGoal'>;

/**
 * The roster's summary for a space of `kind` (F-PLAN-002 section 3.10): the
 * teacher projection above, plus the self-route counts and the Learning Route
 * goal (Learning Route section 9, LR-W1) for a family space only. A class or
 * school never receives `selfRoute` or `routeGoal`; one summary is shared by
 * every space the learner is in, so the fields are removed at read time.
 * `joinedAt` is the learner's membership of the viewing space: a class or
 * school sees no `activity` day from before it (F-REPORT-001 section 3.8), and
 * the roster and the report routes pass it alike.
 */
export function rosterSummary(summary: unknown, planIds: ReadonlySet<string>, kind: SpaceKind, opts: { joinedAt?: string | null } = {}): FamilyVisibleSummary | null {
  const out: FamilyVisibleSummary | null = teacherVisibleSummary(summary, planIds, { kind, joinedAt: opts.joinedAt });
  if (!out || kind !== 'family' || !isPlain(summary)) return out;
  // Projected to the known keys, like every other field here: keys a newer writer left under them never leave.
  if (isPlain(summary.selfRoute)) out.selfRoute = pick(summary.selfRoute, SELF_ROUTE_KEYS) as ProgressSummary['selfRoute'];
  if (isPlain(summary.routeGoal)) out.routeGoal = pick(summary.routeGoal, ROUTE_GOAL_KEYS) as ProgressSummary['routeGoal'];
  return out;
}
