import { z } from 'zod';
import { FestivalAnchorSchema } from '../catalog/schema';
import { StageKeySchema } from '../schemas/heritage-card';
import { PlanItemSchema } from '../schemas/plan-item';
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
] as const;
export const WarningCodeSchema = z.enum(WARNING_CODES);
export type WarningCode = z.infer<typeof WarningCodeSchema>;

export const CurriculumWarningSchema = z.object({
  code: WarningCodeSchema,
  week: z.number().int().optional(),
  count: z.number().int().optional(),
});
export type CurriculumWarning = z.infer<typeof CurriculumWarningSchema>;

export const CurriculumItemSchema = PlanItemSchema.extend({ week: z.number().int() });
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
});
export type CurriculumMeta = z.infer<typeof CurriculumMetaSchema>;
