import { z } from 'zod';

/**
 * Shared shape for taught Korean (F-QUEST-002 §3.1; single owner of this file).
 * Taught Korean always travels with a romanization and a gloss (CLAUDE.md §1,
 * F-CNT-001), so no consumer needs to remember to add them.
 */
export const KoTextSchema = z
  .object({
    ko: z.string().min(1),
    /** Revised Romanization, unhyphenated, pronunciation-based (D13, F-CNT-002). */
    romanization: z.string().min(1),
    /** Gloss in the content base language (UI locales overlay it, F-I18N-001). */
    en: z.string().min(1),
    /** What the voice says when it differs from `ko` (F-AUDIO-004). */
    spokenKo: z.string().min(1).optional(),
    /** MP3 path; wins over TTS when present (D6). */
    audioRef: z.string().optional(),
    /** Teaching-UI split, e.g. ['a','beo','ji']; join('') must equal `romanization`. */
    syllables: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.syllables && value.syllables.join('') !== value.romanization) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['syllables'],
        message: 'syllables must join to the romanization',
      });
    }
  });
export type KoText = z.infer<typeof KoTextSchema>;

/**
 * `card:<id>` -> HeritageCardArt, `word:<id>` -> WordArt (F-VOC),
 * `swatch:<token>` -> a colour chip. An unresolved ref falls back to text.
 */
export const PictureRefSchema = z.string().regex(/^(card|word|swatch):[a-z0-9-]+$/);
export type PictureRef = z.infer<typeof PictureRefSchema>;
