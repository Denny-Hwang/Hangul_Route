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
  /** Sound value from JAMO_SOUND_VALUES (F-CNT-002 C6), e.g. 'g/k', 'silent/ng'. */
  romanization: z.string().min(1).max(12),
  ipa: z.string().optional(),
  kind: JamoKindSchema,
  nameEn: z.string(),
  exampleWordKo: z.string().optional(),
  /** Revised Romanization, unhyphenated (D13). Required with exampleWordKo from F-CNT-002 PR 2b. */
  exampleWordRomanization: z.string().min(1).optional(),
  exampleWordEn: z.string().optional(),
  audioRef: z.string().optional(),
  /** Base English sound hint shown in Discover (F-QUEST-002); es / ko come from the i18n overlay. */
  soundHint: z.string().max(60).optional(),
  order: z.number().int().nonnegative(),
});

export type Jamo = z.infer<typeof JamoSchema>;
export const JamoListSchema = z.array(JamoSchema);
