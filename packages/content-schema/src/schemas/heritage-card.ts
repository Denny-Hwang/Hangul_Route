import { z } from 'zod';

export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary']);
export type Rarity = z.infer<typeof RaritySchema>;

export const ThemeKeySchema = z.enum(['letters', 'life', 'rites', 'nature', 'crafts']);
export type ThemeKey = z.infer<typeof ThemeKeySchema>;

export const StageKeySchema = z.enum([
  'stage1',
  'stage2',
  'stage3',
  'stage4',
  'stage5',
  'stage6',
  'stage7',
]);
export type StageKey = z.infer<typeof StageKeySchema>;

/**
 * Heritage Card — a collectible piece of Korean culture earned by completing
 * an episode or milestone. The primary reward of Hangul Route.
 */
export const HeritageCardSchema = z.object({
  id: z.string().regex(/^card:[a-z0-9-]+$/),
  titleEn: z.string(),
  subtitleKo: z.string().optional(),
  romanization: z.string().optional(),
  blurbEn: z.string(),
  factEn: z.string().optional(),
  theme: ThemeKeySchema,
  stage: StageKeySchema,
  rarity: RaritySchema,
  illustrationRef: z.string().optional(),
  unlockedBy: z.string(),
  era: z.string().optional(),
  region: z.string().optional(),
});

export type HeritageCard = z.infer<typeof HeritageCardSchema>;
export const HeritageCardListSchema = z.array(HeritageCardSchema);
