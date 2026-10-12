import { VocabSummarySchema } from '@hangul-route/content-schema';
import type { RosterVocab } from './api';

/**
 * The roster's reading of `summary.vocab`: the slice without `firstTryRate`. The rate is a
 * student's detail view only (F-VOC-005 section 3.8) and P-4b's Worker projection drops it for
 * every roster viewer, so the console neither needs it nor shows it. Zod strips unknown keys, so a
 * slice that still carries the rate parses too and loses it here.
 */
const RosterVocabSchema = VocabSummarySchema.omit({ firstTryRate: true });

/**
 * The one reading of a roster's `summary.vocab` (F-VOC-005 P-4, section 3.8): the student card
 * (`vocab-words.ts`) and the class roll-up (`rollup.ts`) both parse it here, so a slice the schema
 * rejects (a negative count, more than three words, an id that is not a word id) adds nothing to
 * either and the two never disagree. Kept apart from the word catalogue so the roll-up, used on
 * every console page, does not pull the catalogue in.
 */
export function parseVocabSummary(vocab: unknown): RosterVocab | null {
  if (vocab === undefined) return null;
  const parsed = RosterVocabSchema.safeParse(vocab);
  return parsed.success ? parsed.data : null;
}
