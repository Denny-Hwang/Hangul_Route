import type { Episode, ProgressSnapshot } from '@hangul-route/content-schema';
import { isEpisodeComplete } from '../journey';
import { playableEpisodes } from '../next-quest';

/**
 * Which item a split pane shows (F-LAYOUT-001 §3.7). Pure, so the screens stay thin.
 * The selection itself lives in screen state, so it survives a rotation between one
 * and two panes; going to one pane never navigates, going to two shows the remembered item.
 */

/**
 * First selection on the Journey: the episode of the learner's next quest, i.e. the first
 * playable episode (shipped or ready, never a preview placeholder) with a quest left, in
 * content order; every episode done, the first playable one. `null` when none is playable.
 */
export function initialEpisode(
  episodes: readonly Episode[],
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined,
): string | null {
  const playable = playableEpisodes(episodes);
  const quests = snapshot?.quests ?? [];
  const next = playable.find((e) => !isEpisodeComplete(e, quests));
  return (next ?? playable[0])?.id ?? null;
}

/** First selection in the Library: the most recently earned card in the list, else the first card. */
export function initialCard(
  cards: readonly { id: string }[],
  unlocked: readonly { cardId: string; unlockedAt: string }[],
): string | null {
  const present = new Set(cards.map((c) => c.id));
  let latest: { cardId: string; unlockedAt: string } | undefined;
  for (const u of unlocked) {
    if (present.has(u.cardId) && (!latest || u.unlockedAt > latest.unlockedAt)) latest = u;
  }
  return latest?.cardId ?? cards[0]?.id ?? null;
}

/**
 * Keeps `prev` while it is still in `items`; otherwise `fallback` when that is present,
 * otherwise the first item; `null` when `items` is empty.
 */
export function reconcileSelection(
  prev: string | null,
  items: readonly { id: string }[],
  fallback: string | null,
): string | null {
  const has = (id: string | null): id is string => id !== null && items.some((i) => i.id === id);
  if (has(prev)) return prev;
  if (has(fallback)) return fallback;
  return items[0]?.id ?? null;
}
