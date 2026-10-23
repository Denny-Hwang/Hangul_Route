import type { AwardWorld } from './types';

/**
 * The `upperCards` switch on the award world (F-CURR-002 §7.2 and §12.2, row CM-23). Pure.
 *
 * - **On**: the world as shipped, so finishing a cell brings its card, and a reconcile (launch, sync, restore) brings
 *   the cards of cells finished before the row shipped, dated by their first finishes (`firstFinishCardIds`).
 * - **Off**: the gated cards are left out unless the learner already holds them, so no new one is awarded, listed or
 *   hinted; a held card stays, as every earned card does (F-STORY-006 rule 1).
 */
export function withUpperCards(world: AwardWorld, on: boolean, gated: ReadonlySet<string>, owned: ReadonlySet<string>): AwardWorld {
  if (on) return world;
  return { ...world, cards: world.cards.filter((c) => !gated.has(c.id) || owned.has(c.id)) };
}

/** A cell page's reward list under the same switch: a gated card shows while `upperCards` is on, or once it is held. */
export function shownRewardCardIds(ids: readonly string[], on: boolean, gated: ReadonlySet<string>, owned: ReadonlySet<string>): string[] {
  return on ? [...ids] : ids.filter((id) => !gated.has(id) || owned.has(id));
}

/** The ids a snapshot holds, for the two helpers above. */
export function ownedIdsOf(cards: readonly { cardId: string }[] | undefined): Set<string> {
  return new Set((cards ?? []).map((c) => c.cardId));
}

