import { z } from 'zod';
import { StageKeySchema, ThemeKeySchema } from './heritage-card';

/**
 * Heritage Journey grid: 7 stages × 5 themes = 35 cells.
 */
export const StageDefSchema = z.object({
  key: StageKeySchema,
  order: z.number().int().min(1).max(7),
  titleEn: z.string(),
  oneLinerEn: z.string(),
  anchorSkillEn: z.string(),
  unlockedByDefault: z.boolean(),
});
export type StageDef = z.infer<typeof StageDefSchema>;

export const ThemeDefSchema = z.object({
  key: ThemeKeySchema,
  order: z.number().int().min(1).max(5),
  titleEn: z.string(),
  oneLinerEn: z.string(),
});
export type ThemeDef = z.infer<typeof ThemeDefSchema>;

export const GridCellSchema = z.object({
  stage: StageKeySchema,
  theme: ThemeKeySchema,
  episodeId: z.string().nullable(),
  status: z.enum(['locked', 'available', 'in-progress', 'completed', 'coming-soon']),
});
export type GridCell = z.infer<typeof GridCellSchema>;
