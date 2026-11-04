import { z } from 'zod';
import { StageKeySchema, ThemeKeySchema } from '../schemas/heritage-card';
import { MotivationSchema, PlacementLevelSchema } from '../schemas/placement';
import { WEEKDAYS, isDateKey, weekdayOf } from './dates';
import { CURRICULUM_MAX_ITEMS } from './presets';

/**
 * The inputs of `generateCurriculum` (F-PLAN-002 section 3.1). Codes only: the
 * route a draft describes is the same in every UI language.
 */

/** A UTC day, like every day key in the app. */
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type DateKey = z.infer<typeof DateKeySchema>;

export const WeekdaySchema = z.enum(WEEKDAYS);

export const FocusSchema = z.enum(['reading', 'words', 'culture', 'balanced']);
export type Focus = z.infer<typeof FocusSchema>;

export const DaysOffSchema = z.object({ from: DateKeySchema, to: DateKeySchema });
export type DaysOff = z.infer<typeof DaysOffSchema>;

export const CurriculumGoalsSchema = z
  .object({
    focus: FocusSchema.default('balanced'),
    /** Emphasised first, in this order. */
    themes: z.array(ThemeKeySchema).max(5).optional(),
    motivation: MotivationSchema.optional(),
  })
  .default({ focus: 'balanced' });

/**
 * Class days and practice days in one plan (AMENDMENTS-ROUTE-CLASS-BLEND section 9.1, row BL-W). `L` class days a
 * week (`lecture.days`) at the class length, and `P` practice sessions a week (`personal.perWeek`, the owner's "1-7
 * times a week") at the practice length. Absent: a single-cadence plan, as before. Only a class plan carries it
 * (`blend-not-class`). The generator also writes `sessionsPerWeek` (distinct days), `sessionDays` (their union) and
 * `minutesPerSession` (`personal.minutes`), so a reader that ignores `blend` still sees a valid plan.
 */
export const BlendSchema = z.object({
  mode: z.enum(['overlap', 'split']),
  lecture: z.object({
    days: z.array(WeekdaySchema).min(1).max(5),
    /** BL-OD-13. */
    minutes: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  }),
  personal: z.object({
    /** BL-OD-19: 1 to 7; practice may also fall on a class day, after class. */
    perWeek: z.number().int().min(1).max(7),
    /** Teacher's default practice weekdays; length = perWeek when present (else practiceDaysFor). */
    days: z.array(WeekdaySchema).min(1).max(7).optional(),
    minutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  }),
  /** Class days that do not happen while practice goes on (section 5.3). */
  classDaysOff: z.array(DateKeySchema).max(52).default([]),
  /** Extend the route by the full weeks lost to days off (section 6.1, BL-OD-18). */
  keepAverage: z.boolean().default(false),
});
export type Blend = z.infer<typeof BlendSchema>;
export type BlendInput = z.input<typeof BlendSchema>;

const paramsShape = {
  /** Wording and defaults only. */
  audience: z.enum(['class', 'family', 'self']),
  level: PlacementLevelSchema,
  /**
   * The exact set from a placement result, or a level's coarse set; wins over `level`. At most 120
   * (was 40): a stage6 or stage7 level places out every grid quest of Stages 1-6 as F-CURR-001 cells ship.
   */
  placedOutQuestIds: z.array(z.string()).max(120).optional(),
  /** A single learner (family, self); empty for a class. Never stored in a plan (`toMeta`). */
  completedQuestIds: z.array(z.string()).max(400).default([]),
  startDate: DateKeySchema,
  weeks: z.number().int().min(1).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  /** When present its length wins over `sessionsPerWeek`. */
  sessionDays: z.array(WeekdaySchema).min(1).max(7).optional(),
  minutesPerSession: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  /** "Holidays": no sessions on these days (removed, not moved). */
  daysOff: z.array(DaysOffSchema).max(12).default([]),
  goals: CurriculumGoalsSchema,
  /** Default: 4 when `weeks >= 12`, else 0. */
  reviewEvery: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(6)]).optional(),
  includeComingSoon: z.boolean().default(true),
  /** Hangeul Day, Seollal and Chuseok pull their story into their week. */
  culturalAnchors: z.boolean().default(true),
  /** The audience's entitlement; lessons of other stages are listed as locked, never scheduled. */
  unlockedStages: z.array(StageKeySchema).min(1),
  /**
   * The last stage the lesson queue visits (default `stage7`). One below the level's stage is
   * allowed and simply schedules no lesson: the plan holds stories (and free practice) only.
   */
  endStage: StageKeySchema.optional(),
  /** AMENDMENTS-ROUTE-CLASS-BLEND section 9.1: class days and practice days; audience 'class' only. */
  blend: BlendSchema.optional(),
};

/** Sessions a week after normalisation: `sessionDays` wins when present. */
export const sessionsPerWeekOf = (params: { sessionsPerWeek: number; sessionDays?: readonly string[] | undefined }): number =>
  params.sessionDays === undefined ? params.sessionsPerWeek : params.sessionDays.length;

interface RefinableParams {
  startDate: string;
  weeks: number;
  sessionsPerWeek: number;
  sessionDays?: readonly string[] | undefined;
  daysOff: readonly DaysOff[];
  audience?: string;
  blend?: Blend | undefined;
}

/**
 * Stable codes of the cross-field checks, carried as `issue.params.code` next to the field's
 * `path`. Messages are for developers; a form maps the code to its own localised wording.
 */
export const PARAMS_ISSUE_CODES = [
  'session-day-repeated',
  'too-many-sessions',
  'days-off-reversed',
  'not-a-real-day',
  // AMENDMENTS-ROUTE-CLASS-BLEND section 9.1 (row BL-W)
  'blend-not-class',
  'class-day-repeated',
  'practice-day-repeated',
  'practice-days-count',
  'class-day-off-not-class-day',
] as const;
export type ParamsIssueCode = (typeof PARAMS_ISSUE_CODES)[number];

const refineParams = (params: RefinableParams, ctx: z.RefinementCtx): void => {
  const fail = (code: ParamsIssueCode, path: Array<string | number>, message: string): void =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message, params: { code } });
  const days = params.sessionDays ?? [];
  days.forEach((day, index) => {
    if (days.indexOf(day) !== index) fail('session-day-repeated', ['sessionDays', index], `sessionDays: ${day} is repeated`);
  });
  // A blended plan holds L + P sessions a week (class days that also hold practice count twice): section 6.6.
  const blend = params.blend;
  const perWeek = blend ? Math.max(sessionsPerWeekOf(params), blend.lecture.days.length + blend.personal.perWeek) : sessionsPerWeekOf(params);
  if (params.weeks * perWeek > CURRICULUM_MAX_ITEMS) {
    fail('too-many-sessions', ['weeks'], `weeks x sessions a week is above ${CURRICULUM_MAX_ITEMS}`);
  }
  params.daysOff.forEach((range, index) => {
    if (!isDateKey(range.from)) fail('not-a-real-day', ['daysOff', index, 'from'], `daysOff.from: ${range.from} is not a real day`);
    if (!isDateKey(range.to)) fail('not-a-real-day', ['daysOff', index, 'to'], `daysOff.to: ${range.to} is not a real day`);
    if (range.from > range.to) fail('days-off-reversed', ['daysOff', index, 'to'], `daysOff: ${range.to} is before ${range.from}`);
  });
  if (!isDateKey(params.startDate)) fail('not-a-real-day', ['startDate'], `startDate: ${params.startDate} is not a real day`);
  if (blend) refineBlend(blend, params.audience, fail);
};

/** Section 9.1: class plans only; no repeated weekday; `personal.days` (class days allowed) has `perWeek` days; a class day off is a class weekday. */
function refineBlend(blend: Blend, audience: string | undefined, fail: (code: ParamsIssueCode, path: Array<string | number>, message: string) => void): void {
  if (audience !== 'class') fail('blend-not-class', ['blend'], `blend: only a class plan has class days (audience ${String(audience)})`);
  const lecture = blend.lecture.days;
  lecture.forEach((day, index) => {
    if (lecture.indexOf(day) !== index) fail('class-day-repeated', ['blend', 'lecture', 'days', index], `blend.lecture.days: ${day} is repeated`);
  });
  const practice = blend.personal.days;
  if (practice) {
    practice.forEach((day, index) => {
      if (practice.indexOf(day) !== index) fail('practice-day-repeated', ['blend', 'personal', 'days', index], `blend.personal.days: ${day} is repeated`);
    });
    if (practice.length !== blend.personal.perWeek) {
      fail('practice-days-count', ['blend', 'personal', 'days'], `blend.personal.days: ${practice.length} days for ${blend.personal.perWeek} a week`);
    }
  }
  blend.classDaysOff.forEach((day, index) => {
    const path = ['blend', 'classDaysOff', index];
    if (!isDateKey(day)) fail('not-a-real-day', path, `blend.classDaysOff: ${day} is not a real day`);
    else if (!lecture.includes(weekdayOf(day))) fail('class-day-off-not-class-day', path, `blend.classDaysOff: ${day} is not a class day`);
  });
}

export const CurriculumParamsSchema = z.object(paramsShape).superRefine(refineParams);
/** Parsed params (defaults filled). */
export type CurriculumParams = z.infer<typeof CurriculumParamsSchema>;
/** What a caller may pass (defaults optional). */
export type CurriculumParamsInput = z.input<typeof CurriculumParamsSchema>;

/**
 * The params a plan stores (section 3.5): everything but `completedQuestIds`,
 * a device-side fact that is passed to `regenerateFrom` when needed.
 */
export const StoredCurriculumParamsSchema = z
  .object(paramsShape)
  .omit({ completedQuestIds: true })
  .superRefine(refineParams);
export type StoredCurriculumParams = z.infer<typeof StoredCurriculumParamsSchema>;
