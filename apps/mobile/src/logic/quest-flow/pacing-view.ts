import type { DiscoverItemView, DiscoverPageView } from '../stage1/discover-flow';

/**
 * What the start bundle needs of adaptive pacing (F-CURR-002 section 4.6, row CM-24): the cells that adapt and the
 * compact Discover page the Discover step draws. The rules that decide when a quest is compact, the shorter Apply and
 * the scaffold round live in the pacing chunk (`./quest-adapt.ts`, `./quest-scaffold.ts`).
 */

/** A lesson cell of Stages 2-4, 6 and 7: the quests that adapt (the Stage 1 letters and the story quests do not). */
export const adaptsIn = (episodeId: string): boolean => /^episode:stage[2-467]-/.test(episodeId);

/** A page that can be compact: exactly two word cards (a word, a sentence, a pattern example) and no exchange. */
export const compactView = (page: DiscoverPageView | undefined): boolean =>
  !!page && !page.exchange && page.items.length === 2 && page.items.every((i) => i.kind === 'word');

/** The cards a Discover page draws: one per item, or, compact, one card holding both items. Every item is drawn. */
export function discoverCards(page: DiscoverPageView, compact: boolean): DiscoverItemView[][] {
  return compact && compactView(page) ? [page.items] : page.items.map((i) => [i]);
}
