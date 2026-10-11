import type { Messages } from '@hangul-route/i18n';
import type { QuestResultOutcome } from './results-award';

/**
 * F-STORY-006 §3.7 — what the Results "more cards joined your Library" banner
 * shows (wireframe results/extra-cards). Pure, so the screen only renders.
 *
 * The extras are the cards a run brought besides the quest card: the cards of
 * an episode, stage or set it completed (and, at most once, the welcome card).
 * The live path (`applyQuestResult`) already decided and wrote them; this only
 * chooses what to draw.
 */

/** Thumbnails in the banner's row; the rest are counted, never shown as a fraction. */
export const EXTRA_CARDS_SHOWN = 6;

export interface ExtraCardsView<C extends { id: string }> {
  /** Every extra card that resolves, in the order the live path decided them. */
  cards: C[];
  /** The first `max` of them, drawn as thumbnails. */
  shown: C[];
  /** How many more joined than the row shows. */
  more: number;
  /** The episode this run finished, for "You finished <title>!". */
  episodeId: string | null;
}

/**
 * Null (no banner) until the outcome is decided and whenever no extra card
 * resolves: a replay, a run that completed nothing, or a completion whose
 * cards were already owned. The quest card has its own banner, so it is never
 * repeated here; neither is a duplicate or a card this build does not know.
 */
export function extraCardsView<C extends { id: string }>(
  outcome: Pick<QuestResultOutcome, 'award' | 'extras' | 'episodeCompleted'> | null,
  lookup: (cardId: string) => C | undefined,
  max: number = EXTRA_CARDS_SHOWN,
): ExtraCardsView<C> | null {
  if (!outcome) return null;
  const seen = new Set<string>(outcome.award ? [outcome.award.cardId] : []);
  const cards: C[] = [];
  for (const extra of outcome.extras) {
    if (seen.has(extra.cardId)) continue;
    seen.add(extra.cardId);
    const card = lookup(extra.cardId);
    if (card) cards.push(card);
  }
  if (cards.length === 0) return null;
  const shown = cards.slice(0, max);
  return { cards, shown, more: cards.length - shown.length, episodeId: outcome.episodeCompleted };
}

/**
 * The one sentence assistive tech reads for the banner: the episode first
 * (when one just completed), then the count and every card title.
 */
export function extraCardsAnnouncement(
  m: Messages['learner']['results']['extraCards'],
  cardTitles: readonly string[],
  episodeTitle: string | undefined,
): string {
  const count = m.announce(cardTitles.length, cardTitles);
  return episodeTitle ? `${m.episodeDone(episodeTitle)} ${count}` : count;
}
