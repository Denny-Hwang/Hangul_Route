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
