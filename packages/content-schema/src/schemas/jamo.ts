import { z } from 'zod';

/**
 * Jamo — Korean alphabet unit (consonant / vowel / batchim).
 * Stage 1 anchor units. 24 base jamo + 6 batchim = 30 for MVP.
 */
export const JamoKindSchema = z.enum(['consonant', 'vowel', 'batchim']);
export type JamoKind = z.infer<typeof JamoKindSchema>;

export const JamoSchema = z.object({
  id: z.string().regex(/^jamo:[a-z0-9-]+$/),
  char: z.string().min(1).max(2),
  romanization: z.string().min(1).max(8),
  ipa: z.string().optional(),
  kind: JamoKindSchema,
  nameEn: z.string(),
  exampleWordKo: z.string().optional(),
  exampleWordEn: z.string().optional(),
  audioRef: z.string().optional(),
  order: z.number().int().nonnegative(),
});

export type Jamo = z.infer<typeof JamoSchema>;
export const JamoListSchema = z.array(JamoSchema);
