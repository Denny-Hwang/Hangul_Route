import { z } from 'zod';
import { AssessmentResponseSchema } from '../../assessment/question';
import { StageKeySchema } from '../../schemas/heritage-card';
import { UiLocaleSchema } from '../../schemas/locale';

/**
 * A frozen copy of `PlacementResultSchema` as it was before the three modes
 * (origin/main 820231e to d729a80, unchanged there): the reader an older Worker or app build uses. Like
 * the real one it is not `.strict()`, so it drops the unknown `mode` key.
 * Never edit this to match the live schema: it exists to prove old readers
 * still parse what the new engine writes.
 */
const Gate = z.enum(['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab', 'sentence']);
const Status = z.enum(['secure', 'getting-there', 'not-yet', 'not-tested']);
const GateResultV1 = z.object({
  gate: Gate,
  form: z.enum(['decode', 'read', 'oral']),
  asked: z.number().int().min(0).max(3),
  correct: z.number().int().min(0).max(3),
  assisted: z.number().int().min(0).max(3),
  result: z.enum(['pass', 'fail', 'not-run']),
  reason: z.enum(['unavailable', 'stopped']).optional(),
});

export const PlacementResultSchemaV1 = z.object({
  id: z.string().regex(/^placement:[a-z0-9-]+$/),
  startedAt: z.string(),
  completedAt: z.string(),
  source: z.enum(['onboarding', 'home', 'profile', 'parent']),
  testLocale: UiLocaleSchema,
  length: z.enum(['quick', 'full']),
  revealMode: z.enum(['tap', 'always']),
  bankVersion: z.number().int().positive(),
  contentVer: z.string(),
  motivation: z.enum(['heritage', 'kculture', 'curious', 'friends']).optional(),
  responses: z.array(AssessmentResponseSchema).max(24),
  gates: z.array(GateResultV1).max(9),
  strands: z.object({
    'hangul-recognition': Status,
    'sound-letter': Status,
    'syllable-reading': Status,
    vocabulary: Status,
    sentences: Status,
  }),
  level: z.object({ stage: StageKeySchema, band: z.number().int().min(0).max(3) }),
  oralStage: StageKeySchema.nullable(),
  beyondContent: z.boolean(),
  startQuestId: z.string().nullable(),
  placedOutQuestIds: z.array(z.string()).max(40),
  priorityTokens: z.array(z.string()).max(3),
  needsStage: StageKeySchema.nullable(),
  stopReason: z.enum(['complete', 'cap', 'time', 'quit', 'grown-up', 'not-sure']),
  override: z.object({ by: z.literal('parent'), at: z.string(), startQuestId: z.string() }).optional(),
});
