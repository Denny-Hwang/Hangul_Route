import type { RuntimeVocabItem, UiLocale, VocabProgress } from '@hangul-route/content-schema';
import { vocabSummaryOf } from '../sync/summarize';
import { localizedGloss } from './catalog';
import { localDay, vocabOf } from './progress';

/**
 * The parent dashboard's Words row — F-VOC-005 section 3.8, PR P-3. Pure.
 *
 * The caregiver channel: counts, a first-try rate (a percentage is allowed
 * here, never on a learner screen, P8 and P9) and up to three words to look at
 * together. It reads the same `vocabSummaryOf` as the uploaded summary, so the
 * dashboard and the report never disagree. Taught Korean travels with its
 * romanization and a gloss in the UI language (CLAUDE.md section 1).
 */

export interface CaregiverWord {
  id: string;
  ko: string;
  romanization: string;
  gloss: string;
}

export interface CaregiverWordsRow {
  collected: number;
  strong: number;
  /** The first-try rate as a whole percent, or null before any answer. */
  firstTryPercent: number | null;
  /** Up to three words, in `needsPractice` order; a word this build does not know is left out. */
  together: CaregiverWord[];
}

/** The row for one learner, or null when they have collected no word (no row then). */
export function caregiverWordsRow(
  snapshot: { vocab?: VocabProgress } | undefined,
  now: Date,
  itemOf: (id: string) => RuntimeVocabItem | undefined,
  locale: UiLocale,
): CaregiverWordsRow | null {
  if (snapshot === undefined) return null;
  const summary = vocabSummaryOf(vocabOf(snapshot), localDay(now));
  if (summary.collected === 0) return null;
  const together = summary.needsPractice.flatMap((id): CaregiverWord[] => {
    const item = itemOf(id);
    return item === undefined ? [] : [{ id, ko: item.ko, romanization: item.romanization, gloss: localizedGloss(item, locale) }];
  });
  return {
    collected: summary.collected,
    strong: summary.strong,
    firstTryPercent: summary.firstTryRate === null ? null : Math.round(summary.firstTryRate * 100),
    together,
  };
}
