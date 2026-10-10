import { z } from 'zod';

/** Shared by lint, mobile and web (F-STORY-005 §3.2). The registry `PILLAR_TAGS` is F-STORY-005 PR 5.1. */
export const PillarTagSchema = z.string().regex(/^[A-E][1-9]$/); // 'A1' .. 'E9'; must exist in PILLAR_TAGS (lint)
export type PillarTag = z.infer<typeof PillarTagSchema>;

export const CompanionIdSchema = z.enum(['hoya']); // 'hoya' only until F-STORY-005 §3.7 unlocks more
export type CompanionId = z.infer<typeof CompanionIdSchema>;

export const CatalogueFieldsSchema = z.object({
  pillarTags: z.array(PillarTagSchema).max(3).default([]), // first = primary; no duplicates
  companionId: CompanionIdSchema.default('hoya'),
});
export type CatalogueFields = z.infer<typeof CatalogueFieldsSchema>;
