import type { Messages } from '@hangul-route/i18n';
import type { SummaryPrimary } from './flashcards';

/**
 * The Words learner copy — F-VOC-003 section 3.2. The strings live in
 * `packages/i18n` (`learner.vocab`, read with `useMessages()` so they follow
 * the UI locale); this module types them and holds the few choices that pick
 * a string from a logic result, so the screens stay thin. Every value is
 * scanned by `__tests__/copy.test.ts` (anti-shame words, no percentage or
 * fraction, no age word, no emoji).
 */

export type VocabCopy = Messages['learner']['vocab'];

export function vocabCopyOf(messages: Messages): VocabCopy {
  return messages.learner.vocab;
}

/** "Next words" or "Review these". */
export function summaryPrimaryLabel(copy: VocabCopy, primary: SummaryPrimary): string {
  return primary.kind === 'next' ? copy.cards.summary.next : copy.cards.summary.review;
}

/** The Speed round button's line: its description, or how many words to learn first (it then opens Learn). */
export function speedActivityLine(copy: VocabCopy, available: boolean, minCollected: number): string {
  return available ? copy.topic.speed.line : copy.topic.speed.needMore(minCollected);
}
