import { z } from 'zod';
import { StageKeySchema, ThemeKeySchema } from './heritage-card';

/**
 * Episode — one grid cell (Stage × Theme). Contains 1–N Quests.
 */
export const EpisodeStatusSchema = z.enum(['draft', 'ready', 'shipped', 'preview']);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

export const EpisodeSchema = z.object({
  id: z.string().regex(/^episode:[a-z0-9-]+$/),
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  order: z.number().int().nonnegative(),
  titleEn: z.string(),
  subtitleEn: z.string().optional(),
  hoyaIntroEn: z.string(),
  questIds: z.array(z.string()).min(1),
  rewardCardIds: z.array(z.string()).min(0),
  estimatedMinutes: z.number().int().min(3).max(60),
  status: EpisodeStatusSchema,
});

export type Episode = z.infer<typeof EpisodeSchema>;
export const EpisodeListSchema = z.array(EpisodeSchema);
