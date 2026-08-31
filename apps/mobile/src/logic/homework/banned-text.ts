/**
 * Anti-shame text guard — F-HW-001 §3.3.
 *
 * A learner must never read these words. Kept as pure logic so generated copy
 * (mission cards, Hoya lines) can be asserted in unit tests; the content-JSON
 * counterpart lives in `scripts/validate-content.mjs` (F-CNT-001). Both lists
 * must stay in sync — see F-HW-001 §9.5 for why there are two.
 */

export const BANNED_LEARNER_WORDS = ['missed', 'incomplete', 'failed', 'overdue'] as const;

export type BannedLearnerWord = (typeof BANNED_LEARNER_WORDS)[number];

/**
 * Word-boundary matched and case-insensitive: "dismissed" and "incompletely"
 * are ordinary copy, not violations.
 */
const BANNED_RE = new RegExp(`\\b(${BANNED_LEARNER_WORDS.join('|')})\\b`, 'i');

export function findBannedWord(text: string): BannedLearnerWord | null {
  const hit = text.match(BANNED_RE);
  return hit ? (hit[1]!.toLowerCase() as BannedLearnerWord) : null;
}

export function isLearnerSafe(text: string): boolean {
  return findBannedWord(text) === null;
}

/** Every banned word found across a set of strings, de-duplicated. */
export function scanLearnerCopy(texts: readonly string[]): BannedLearnerWord[] {
  const found = new Set<BannedLearnerWord>();
  for (const text of texts) {
    const hit = findBannedWord(text);
    if (hit !== null) found.add(hit);
  }
  return [...found];
}
