import { z } from 'zod';
import { MinigameKindSchema } from './minigame';

/**
 * Quest — 5-step learning sequence (per content-skill timing convention).
 * intro → present → practice → apply → reward.
 */
export const QuestStepKindSchema = z.enum(['intro', 'present', 'practice', 'apply', 'reward']);
export type QuestStepKind = z.infer<typeof QuestStepKindSchema>;

export const QuestStepSchema = z.object({
  id: z.string(),
  kind: QuestStepKindSchema,
  titleEn: z.string(),
  bodyEn: z.string().optional(),
  hoyaLineEn: z.string().optional(),
  minigameKind: MinigameKindSchema.optional(),
  minigameRef: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export type QuestStep = z.infer<typeof QuestStepSchema>;

export const QuestSchema = z.object({
  id: z.string().regex(/^quest:[a-z0-9-]+$/),
  titleEn: z.string(),
  blurbEn: z.string().optional(),
  estimatedMinutes: z.number().int().min(3).max(15),
  steps: z.array(QuestStepSchema).min(3).max(7),
  rewardCardId: z.string().optional(),
});

export type Quest = z.infer<typeof QuestSchema>;
