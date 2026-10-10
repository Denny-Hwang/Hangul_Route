import { z } from 'zod';
import { StageKeySchema, ThemeKeySchema } from './heritage-card';

/**
 * Episode — one grid cell (Stage × Theme). Contains 1–N Quests.
 */
export const EpisodeStatusSchema = z.enum(['draft', 'ready', 'shipped', 'preview']);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

/**
 * The plain object: the only thing later specs extend (a refined schema is a
 * `ZodEffects` and has no `.extend` / `.merge`, F-STORY-001 §3.9).
 * `format` / `placement` / `volume` default, so every existing episode stays valid.
 */
export const EpisodeObjectSchema = z.object({
  id: z.string().regex(/^episode:[a-z0-9-]+$/),
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  order: z.number().int().nonnegative(),
  titleEn: z.string(),
  subtitleEn: z.string().optional(),
  hoyaIntroEn: z.string(),
  questIds: z.array(z.string()),
  rewardCardIds: z.array(z.string()).min(0),
  estimatedMinutes: z.number().int().min(3).max(60),
  status: EpisodeStatusSchema,
  format: z.enum(['lesson', 'story']).default('lesson'),
  placement: z.enum(['grid', 'shelf']).default('grid'),
  volume: z.number().int().min(1).default(1),
  storyIds: z.array(z.string()).optional(),
});

/** Object-level rules; F-STORY-005's rules join this function. */
export const episodeRules = (
  episode: { questIds: string[]; status: EpisodeStatus },
  ctx: z.RefinementCtx,
): void => {
  if (episode.questIds.length < 1 && episode.status !== 'preview') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['questIds'],
      message: 'questIds needs at least one quest unless the episode is a preview',
    });
  }
};

export const EpisodeSchema = EpisodeObjectSchema.superRefine(episodeRules);

/** Input shape: `format`, `placement` and `volume` stay optional for hand-written episodes. */
export type Episode = z.input<typeof EpisodeObjectSchema>;
export const EpisodeListSchema = z.array(EpisodeSchema);
