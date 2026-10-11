import type { ProgressSnapshot } from '@hangul-route/content-schema';
import type { DerivedAward } from './types';

/**
 * Add awarded cards to a snapshot (F-STORY-006 §3.2). Only ever adds: an
 * owned card is never removed or changed (rule 1, monotonic). A new card
 * keeps its deterministic `unlockedAt` and is marked new for the Library.
 * Returns the same snapshot object when nothing is new, so callers can skip
 * the write.
 */
export function applyAwards(snapshot: ProgressSnapshot, awards: readonly DerivedAward[], now: string): ProgressSnapshot {
  const owned = new Set(snapshot.cards.map((c) => c.cardId));
  const added: ProgressSnapshot['cards'] = [];
  for (const award of awards) {
    if (owned.has(award.cardId)) continue;
    owned.add(award.cardId);
    added.push({ cardId: award.cardId, unlockedAt: award.unlockedAt, newSinceLastView: true });
  }
  if (added.length === 0) return snapshot;
  return { ...snapshot, cards: [...snapshot.cards, ...added], updatedAt: now };
}
