import { UPPER_CARD_GATED_IDS } from '../../content/heritage-cards';
import type { BrowseBundle } from './bundle';

/**
 * All lessons under `upperCards` (F-CURR-002 §12.2, row CM-23). All lessons has no learner to bucket and reads no remote
 * copy, so `on` is the switch for everyone (its built-in launch state). Off, the upper-cell cards are left out of the
 * card list and of every episode's reward list, as for a learner who holds none: no catalogue entry, outline row or
 * card link names one. Imported by the browse root only, so it stays out of the start bundle.
 */
export function browseBundleUnderUpperCards(bundle: BrowseBundle, on: boolean): BrowseBundle {
  if (on) return bundle;
  const shown = (id: string): boolean => !UPPER_CARD_GATED_IDS.has(id);
  return {
    ...bundle,
    cards: bundle.cards.filter((c) => shown(c.id)),
    episodes: bundle.episodes.map((e) => (e.rewardCardIds.every(shown) ? e : { ...e, rewardCardIds: e.rewardCardIds.filter(shown) })),
  };
}
