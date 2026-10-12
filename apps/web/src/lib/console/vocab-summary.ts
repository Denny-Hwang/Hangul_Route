import { VocabSummarySchema, type VocabSummary } from '@hangul-route/content-schema';

/**
 * The one reading of a roster's `summary.vocab` (F-VOC-005 P-4, section 3.8): the student card
 * (`vocab-words.ts`) and the class roll-up (`rollup.ts`) both parse it here, so a slice the schema
 * rejects (a negative count, more than three words, an id that is not a word id) adds nothing to
 * either and the two never disagree. Kept apart from the word catalogue so the roll-up, used on
 * every console page, does not pull the catalogue in.
 */
export function parseVocabSummary(vocab: unknown): VocabSummary | null {
  if (vocab === undefined) return null;
  const parsed = VocabSummarySchema.safeParse(vocab);
  return parsed.success ? parsed.data : null;
}
