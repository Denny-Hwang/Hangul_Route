import { z } from 'zod';
import { AudioRefSchema } from './audio';

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
  /** Revised Romanization, unhyphenated (D13). Required with exampleWordKo (F-CNT-002 §3.5). */
  exampleWordRomanization: z.string().min(1).optional(),
  exampleWordEn: z.string().optional(),
  /** Sound clip (F-AUDIO-004); every value written today already matches the grammar. */
  audioRef: AudioRefSchema.optional(),
  /** What a sound prompt says: one syllable, or the name 이응 for initial ㅇ (AD2). */
  spokenKo: z.string().regex(/^[가-힣]{1,2}$/).optional(),
  /** Revised Romanization of `spokenKo`, unhyphenated (D13). */
  spokenRomanization: z.string().min(1).max(8).optional(),
  spokenKind: z.enum(['sound', 'name']).default('sound'),
  /** Letter name, e.g. 기역; vowels equal `spokenKo`. */
  nameKo: z.string().regex(/^[가-힣]{1,3}$/).optional(),
  nameAudioRef: AudioRefSchema.optional(),
  /** Base English sound hint shown in Discover (F-QUEST-002); es / ko come from the i18n overlay. */
  soundHint: z.string().max(60).optional(),
  order: z.number().int().nonnegative(),
}).superRefine((jamo, ctx) => {
  if (jamo.spokenRomanization !== undefined && jamo.spokenKo === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spokenRomanization'], message: 'spokenRomanization requires spokenKo' });
  }
  if (jamo.exampleWordKo !== undefined && jamo.exampleWordRomanization === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exampleWordRomanization'],
      message: 'exampleWordKo requires exampleWordRomanization',
    });
  }
  if (jamo.nameAudioRef !== undefined && jamo.nameKo === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nameAudioRef'], message: 'nameAudioRef requires nameKo' });
  }
});

export type Jamo = z.infer<typeof JamoSchema>;
export const JamoListSchema = z.array(JamoSchema);
