/**
 * Caregiver-surface copy guard — mirror of
 * `apps/mobile/src/logic/homework/banned-text.ts` (F-HW-001 §3.3, F-PAR-001
 * §3.6). Kept in sync by hand until a shared package exists.
 */
export const BANNED_WORDS = ['missed', 'incomplete', 'failed', 'overdue', 'behind', 'lazy'] as const;

const BANNED_RE = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

export function findBannedWord(text: string): string | null {
  const hit = text.match(BANNED_RE);
  return hit ? (hit[1] as string).toLowerCase() : null;
}

export function isCaregiverSafe(text: string): boolean {
  return findBannedWord(text) === null;
}
