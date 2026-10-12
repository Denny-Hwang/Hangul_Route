import type { AwardSource, DerivedAward } from './types';

/** The `card.catchup_granted` payload (F-STORY-006 §3.5, §3.9): how many cards a reconcile added, by source. */
export type CatchUpGrantedPayload = { count: number } & Record<AwardSource, number>;

/**
 * One aggregate event per reconcile that added cards (retro awards never send
 * a per-card `card.unlocked`). Null when nothing was added, or when the
 * welcome card arrived alone: a new profile is not a catch-up.
 */
export function catchUpGrantedPayload(added: readonly DerivedAward[]): CatchUpGrantedPayload | null {
  if (!added.some((a) => a.source !== 'welcome')) return null;
  const payload: CatchUpGrantedPayload = { count: added.length, episode: 0, stage: 0, welcome: 0, quest: 0, set: 0 };
  for (const award of added) payload[award.source] += 1;
  return payload;
}

/** What the Home catch-up card shows (F-STORY-006 §3.5): the cards found this session and how many. */
export interface CatchUpCard {
  /** The ids `See my cards` marks seen, each once. */
  cardIds: readonly string[];
  /** The number of cards found; never a fraction of the collection (D3). */
  count: number;
}

/**
 * The Home catch-up card for the session-only list a reconcile wrote (`progress-store` `catchUp`).
 * Null when nothing is listed or only the welcome card is: a new profile is not a catch-up, and
 * the card stays away once `See my cards` (or the Library) has seen the others.
 */
export function catchUpCard(
  listed: readonly string[] | undefined,
  welcomeCardIds: ReadonlySet<string> | readonly string[],
): CatchUpCard | null {
  if (!listed || listed.length === 0) return null;
  const welcome = new Set(welcomeCardIds);
  const cardIds = [...new Set(listed)];
  if (!cardIds.some((id) => !welcome.has(id))) return null;
  return { cardIds, count: cardIds.length };
}
