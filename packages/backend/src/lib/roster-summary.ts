import { TEACHER_VISIBLE_SUMMARY_KEYS, type ProgressSummary, type SpaceKind, type TeacherVisibleSummaryKey } from '@hangul-route/content-schema';

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

export function teacherVisibleSummary(summary: unknown, planIds: ReadonlySet<string>): TeacherVisibleSummary | null {
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
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  // Stored summaries were validated by ProgressSummarySchema on write (routes/sync.ts); this only removes keys.
  return out as TeacherVisibleSummary;
}

const SELF_ROUTE_KEYS = ['done', 'total', 'notReady', 'weeks', 'endsOn'] as const satisfies readonly (keyof NonNullable<ProgressSummary['selfRoute']>)[];

/** What a family space additionally reads of its learner's summary. */
export type FamilyVisibleSummary = TeacherVisibleSummary & Pick<ProgressSummary, 'selfRoute'>;

/**
 * The roster's summary for a space of `kind` (F-PLAN-002 section 3.10): the
 * teacher projection above, plus the self-route counts for a family space
 * only. A class or school never receives `selfRoute`; one summary is shared by
 * every space the learner is in, so the field is removed at read time.
 */
export function rosterSummary(summary: unknown, planIds: ReadonlySet<string>, kind: SpaceKind): FamilyVisibleSummary | null {
  const out = teacherVisibleSummary(summary, planIds);
  if (!out || kind !== 'family' || !isPlain(summary) || !isPlain(summary.selfRoute)) return out;
  // Projected to the known keys, like every other field here: keys a newer writer left under it never leave.
  return { ...out, selfRoute: pick(summary.selfRoute, SELF_ROUTE_KEYS) as ProgressSummary['selfRoute'] };
}
