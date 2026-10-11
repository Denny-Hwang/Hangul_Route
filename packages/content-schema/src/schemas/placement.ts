import { z } from 'zod';
import { AssessmentResponseSchema } from '../assessment/question';
import { StageKeySchema } from './heritage-card';
import { UiLocaleSchema } from './locale';

/**
 * Placement (the level check) — F-PLC-001 sections 3.4 and 3.8. Everything
 * here is additive: `ProgressSnapshot.placements` defaults to `[]` and
 * `ProgressSummary.placement` is optional, so old snapshots, backups and
 * server copies still parse.
 */
export const PLACEMENT_GATES = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab', 'sentence'] as const;
export const PlacementGateSchema = z.enum(PLACEMENT_GATES);
export type PlacementGate = z.infer<typeof PlacementGateSchema>;

export const PlacementStrandSchema = z.enum(['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences']);
export type PlacementStrand = z.infer<typeof PlacementStrandSchema>;

/** `vocab` and `sentence` gates use `read` or `oral`; every other gate is `decode`. */
export const PlacementFormSchema = z.enum(['decode', 'read', 'oral']);
export type PlacementForm = z.infer<typeof PlacementFormSchema>;

export const GateResultSchema = z.object({
  gate: PlacementGateSchema,
  form: PlacementFormSchema,
  asked: z.number().int().min(0).max(3),
  correct: z.number().int().min(0).max(3),
  assisted: z.number().int().min(0).max(3),
  result: z.enum(['pass', 'fail', 'not-run']),
  reason: z.enum(['unavailable', 'stopped']).optional(),
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const StrandStatusSchema = z.enum(['secure', 'getting-there', 'not-yet', 'not-tested']);
export type StrandStatus = z.infer<typeof StrandStatusSchema>;

export const PlacementLevelSchema = z.object({ stage: StageKeySchema, band: z.number().int().min(0).max(3) });
export type PlacementLevel = z.infer<typeof PlacementLevelSchema>;

export const StopReasonSchema = z.enum(['complete', 'cap', 'time', 'quit', 'grown-up', 'not-sure']);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const PlacementSourceSchema = z.enum(['onboarding', 'home', 'profile', 'parent']);
export type PlacementSource = z.infer<typeof PlacementSourceSchema>;

export const MotivationSchema = z.enum(['heritage', 'kculture', 'curious', 'friends']);
export type Motivation = z.infer<typeof MotivationSchema>;

const StrandsSchema = z.object({
  'hangul-recognition': StrandStatusSchema,
  'sound-letter': StrandStatusSchema,
  'syllable-reading': StrandStatusSchema,
  vocabulary: StrandStatusSchema,
  sentences: StrandStatusSchema,
});

export const PlacementResultSchema = z.object({
  id: z.string().regex(/^placement:[a-z0-9-]+$/),
  startedAt: z.string(),
  completedAt: z.string(),
  source: PlacementSourceSchema,
  testLocale: UiLocaleSchema,
  length: z.enum(['quick', 'full']),
  revealMode: z.enum(['tap', 'always']),
  bankVersion: z.number().int().positive(),
  contentVer: z.string(),
  motivation: MotivationSchema.optional(),
  responses: z.array(AssessmentResponseSchema).max(24),
  gates: z.array(GateResultSchema).max(9),
  strands: StrandsSchema,
  level: PlacementLevelSchema,
  oralStage: StageKeySchema.nullable(),
  beyondContent: z.boolean(),
  startQuestId: z.string().nullable(),
  placedOutQuestIds: z.array(z.string()).max(40),
  priorityTokens: z.array(z.string()).max(3),
  needsStage: StageKeySchema.nullable(),
  stopReason: StopReasonSchema,
  override: z.object({ by: z.literal('parent'), at: z.string(), startQuestId: z.string() }).optional(),
});
export type PlacementResult = z.infer<typeof PlacementResultSchema>;

/** How many results a snapshot keeps (newest by `completedAt`). */
export const PLACEMENT_KEEP = 10;

/**
 * The only placement data grown-ups and teachers read (`ProgressSummary.placement`):
 * statuses and the level, no per-question data and no counts (F-TCH-001 section 3.2).
 */
export const PlacementSummarySchema = z.object({
  takenAt: z.string(),
  level: PlacementLevelSchema,
  oralStage: StageKeySchema.nullable(),
  strands: StrandsSchema,
  beyondContent: z.boolean(),
  overridden: z.boolean(),
});
export type PlacementSummary = z.infer<typeof PlacementSummarySchema>;
