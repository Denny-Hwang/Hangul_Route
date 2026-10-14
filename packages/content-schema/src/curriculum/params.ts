import { z } from 'zod';
import { StageKeySchema, ThemeKeySchema } from '../schemas/heritage-card';
import { MotivationSchema, PlacementLevelSchema } from '../schemas/placement';
import { WEEKDAYS, isDateKey } from './dates';
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

const paramsShape = {
  /** Wording and defaults only. */
  audience: z.enum(['class', 'family', 'self']),
  level: PlacementLevelSchema,
  /**
   * The exact set from a placement result; wins over `level`. Capped like `completedQuestIds`: a
   * `stage6`/`stage7` level places out every grid lesson and story below it, past 40 once Game
   * Sentences ships (F-CURR-001 S3-5).
   */
  placedOutQuestIds: z.array(z.string()).max(400).optional(),
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
}

/**
 * Stable codes of the cross-field checks, carried as `issue.params.code` next to the field's
 * `path`. Messages are for developers; a form maps the code to its own localised wording.
 */
export const PARAMS_ISSUE_CODES = ['session-day-repeated', 'too-many-sessions', 'days-off-reversed', 'not-a-real-day'] as const;
export type ParamsIssueCode = (typeof PARAMS_ISSUE_CODES)[number];

const refineParams = (params: RefinableParams, ctx: z.RefinementCtx): void => {
  const fail = (code: ParamsIssueCode, path: Array<string | number>, message: string): void =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message, params: { code } });
  const days = params.sessionDays ?? [];
  days.forEach((day, index) => {
    if (days.indexOf(day) !== index) fail('session-day-repeated', ['sessionDays', index], `sessionDays: ${day} is repeated`);
  });
  if (params.weeks * sessionsPerWeekOf(params) > CURRICULUM_MAX_ITEMS) {
    fail('too-many-sessions', ['weeks'], `weeks x sessions a week is above ${CURRICULUM_MAX_ITEMS}`);
  }
  params.daysOff.forEach((range, index) => {
    if (!isDateKey(range.from)) fail('not-a-real-day', ['daysOff', index, 'from'], `daysOff.from: ${range.from} is not a real day`);
    if (!isDateKey(range.to)) fail('not-a-real-day', ['daysOff', index, 'to'], `daysOff.to: ${range.to} is not a real day`);
    if (range.from > range.to) fail('days-off-reversed', ['daysOff', index, 'to'], `daysOff: ${range.to} is before ${range.from}`);
  });
  if (!isDateKey(params.startDate)) fail('not-a-real-day', ['startDate'], `startDate: ${params.startDate} is not a real day`);
};

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
