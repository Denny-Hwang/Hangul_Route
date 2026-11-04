import { z } from 'zod';
import { FestivalAnchorSchema } from '../catalog/schema';
import { StageKeySchema } from '../schemas/heritage-card';
import { PlanItemShapeSchema, refinePlanItem } from '../schemas/plan-item';
import { CurriculumParamsSchema, DateKeySchema, StoredCurriculumParamsSchema } from './params';
import { HORIZON_DAYS } from './presets';

/**
 * What `generateCurriculum` returns (F-PLAN-002 section 3.3 step 9) and what a
 * plan stores next to its items (section 3.5). Codes and ids only; the UI words
 * labels and warnings through its messages.
 */

export const WeekKindSchema = z.enum(['learn', 'culture', 'review', 'break']);
export type WeekKind = z.infer<typeof WeekKindSchema>;

export const WeekExtraSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('vocab'), topicId: z.string() }),
  z.object({ kind: z.literal('hangul-check') }),
]);
export type WeekExtra = z.infer<typeof WeekExtraSchema>;

export const WeekMetaSchema = z.object({
  index: z.number().int().min(1).max(52),
  startDate: DateKeySchema,
  kind: WeekKindSchema,
  focus: z.object({
    /** Episode of the week's first lesson, or null. */
    episodeId: z.string().nullable(),
    /** The week's stories in date order (a culture week leads with the first). */
    storyIds: z.array(z.string()).max(3),
    festival: FestivalAnchorSchema.nullable(),
  }),
  /** Optional add-ons; never plan items, never counted. */
  extras: z.array(WeekExtraSchema).max(2),
});
export type WeekMeta = z.infer<typeof WeekMetaSchema>;

export const WARNING_CODES = [
  'content-runs-out',
  'coming-soon-included',
  'premium-needed',
  'fewer-sessions-than-units',
  'session-too-short',
  'already-done-skipped',
  // AMENDMENTS-ROUTE-CLASS-BLEND section 6.6 (row BL-W; the blended generator, BL-2, writes them)
  'item-cap',
  'practice-short',
  'class-paced',
] as const;
export const WarningCodeSchema = z.enum(WARNING_CODES);
export type WarningCode = z.infer<typeof WarningCodeSchema>;

export const CurriculumWarningSchema = z.object({
  code: WarningCodeSchema,
  week: z.number().int().optional(),
  count: z.number().int().optional(),
});
export type CurriculumWarning = z.infer<typeof CurriculumWarningSchema>;

export const CurriculumItemSchema = PlanItemShapeSchema.extend({ week: z.number().int() }).superRefine(refinePlanItem);
export type CurriculumItem = z.infer<typeof CurriculumItemSchema>;

const count = z.number().int().min(0);

export const CurriculumStatsSchema = z.object({
  /** Dated slots after days off, review weeks included. */
  sessions: count,
  readyItems: count,
  lessons: count,
  stories: count,
  comingSoonItems: count,
  /** Sessions of learn and culture weeks that hold no item. */
  openSessions: count,
  /** Catalogue minutes of the ready items. */
  minutesPlanned: count,
  /** `sessions * minutesPerSession`. */
  minutesAvailable: count,
  reviewWeeks: count,
  breakWeeks: count,
  cultureWeeks: count,
  vocabWeeks: count,
  /** The highest stage of a scheduled ready lesson (stories do not move it); the level's stage when none. */
  endsAtStage: StageKeySchema,
  /**
   * A blended plan only (AMENDMENTS-ROUTE-CLASS-BLEND section 6.1, row BL-2). `lecture`: class days held, lessons
   * they teach and their class minutes at the class pace. `personal`: practice sessions, the items placed on them
   * (every item of the plan), the Refresh days and the catalogue minutes placed.
   */
  byTrack: z
    .object({
      lecture: z.object({ sessions: count, items: count, minutesPlanned: count }),
      personal: z.object({ sessions: count, items: count, refreshDays: count, minutesPlanned: count }),
    })
    .optional(),
  /** A blended plan only: sessions per week with any session, one decimal (section 6.1). */
  sessionsPerTeachingWeek: z.number().min(0).optional(),
  /** A blended plan only: sessions over the route's calendar weeks, one decimal (section 6.1). */
  sessionsPerCalendarWeek: z.number().min(0).optional(),
});
export type CurriculumStats = z.infer<typeof CurriculumStatsSchema>;

export const CurriculumDraftSchema = z.object({
  params: CurriculumParamsSchema,
  generatorVersion: z.number().int(),
  catalogVersion: z.number().int(),
  weeks: z.array(WeekMetaSchema),
  items: z.array(CurriculumItemSchema),
  /** Lesson quest ids not scheduled because their stage is locked. */
  locked: z.array(z.string()),
  stats: CurriculumStatsSchema,
  warnings: z.array(CurriculumWarningSchema),
  /** A blended plan only: its Refresh dates, stored as `CurriculumMeta.refresh` (row BL-2). */
  refresh: z
    .array(z.object({ date: DateKeySchema, cellIds: z.array(z.string()).min(1).max(6) }))
    .max(364)
    .optional(),
});
export type CurriculumDraft = z.infer<typeof CurriculumDraftSchema>;

/** `plans.meta_json` and a self-route's meta (section 3.5). About 10 KB for 52 weeks. */
export const CurriculumMetaSchema = z.object({
  kind: z.literal('curriculum'),
  generatorVersion: z.number().int(),
  catalogVersion: z.number().int(),
  params: StoredCurriculumParamsSchema,
  weeks: z.array(WeekMetaSchema).max(52),
  horizonDays: z.number().int().min(1).max(28).default(HORIZON_DAYS),
  repacedAt: z.string().nullable(),
  /**
   * Refresh dates of a blended plan (AMENDMENTS-ROUTE-CLASS-BLEND sections 6.4 and 9.2, row BL-W): a practice date
   * with room or no lesson, and the cells class taught in the previous one or two cycles, earliest first. Never plan
   * items and never counted in `planProgress`; at most one entry per practice date.
   */
  refresh: z
    .array(z.object({ date: DateKeySchema, cellIds: z.array(z.string()).min(1).max(6) }))
    .max(364)
    .optional(),
});
export type CurriculumMeta = z.infer<typeof CurriculumMetaSchema>;
