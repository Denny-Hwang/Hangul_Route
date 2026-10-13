import { RomanizationModeSchema, UiLocaleSchema } from '@hangul-route/content-schema';
import { z } from 'zod';

/**
 * Lesson display settings kept on the device (F-BROWSE-001 sections 4.9 and
 * 5.3, `browse:prefs`): written only while the keep switch is on, never a
 * learner's settings and never the device locale. Strict, so no person field
 * can ride along; anything else reads as absent (and is removed by the reader).
 */
export const BrowsePrefsSchema = z
  .object({
    v: z.literal(1),
    romanization: RomanizationModeSchema,
    uiLocale: UiLocaleSchema.optional(),
  })
  .strict();

export type BrowsePrefs = z.infer<typeof BrowsePrefsSchema>;

/** The stored settings, or `null` for anything that is not a v1 `BrowsePrefs`. */
export function parsePrefs(value: unknown): BrowsePrefs | null {
  const parsed = BrowsePrefsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
