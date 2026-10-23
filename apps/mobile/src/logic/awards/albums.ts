import type { HeritageCard, StageKey, ThemeKey } from '@hangul-route/content-schema';
import type { CardSet } from './types';

/**
 * The five category albums (F-CURR-002 §7.2, row CM-23). Pure; read by the Library's albums chunk and by the tests.
 *
 * An album is one theme's upper-cell cards across the album stages (Stages 2, 3, 4, 6 and 7): one slot per stage, filled
 * by the card of that stage's cell once the learner holds it. Progress only fills (D3): the album shows the cards held,
 * never a count of what is left. A finished album unlocks the theme's legendary card through the set rule
 * (`set:album-<theme>`); those legendary cards ship in row CM-23c, once every album can complete, so `albumSets` names
 * no set while any slot of an album has no card in the bundle.
 */
export interface AlbumSlot {
  stage: StageKey;
  /** The slot's card in the bundle, or null while its stage's card has not shipped (parts 2 and 3 of row CM-23). */
  card: HeritageCard | null;
  held: boolean;
}

export interface AlbumView {
  theme: ThemeKey;
  slots: AlbumSlot[];
  /** The cards of the album the learner holds, in stage order. */
  held: HeritageCard[];
  /** Every slot has a card in the bundle, so the album can be finished. */
  canComplete: boolean;
  /** Every slot holds a card the learner owns. */
  complete: boolean;
}

/** The albums in `themes` order, each with one slot per album stage; `ids` are the upper-cell cards, one per cell. */
export function albumViews(
  ids: readonly string[],
  cards: readonly HeritageCard[],
  owned: ReadonlySet<string>,
  themes: readonly ThemeKey[],
  stages: readonly StageKey[],
): AlbumView[] {
  const listed = new Set(ids);
  const albumCards = cards.filter((c) => listed.has(c.id));
  return themes.map((theme) => {
    const slots = stages.map((stage): AlbumSlot => {
      const card = albumCards.find((c) => c.theme === theme && c.stage === stage) ?? null;
      return { stage, card, held: card !== null && owned.has(card.id) };
    });
    const held = slots.flatMap((s) => (s.held && s.card ? [s.card] : []));
    const canComplete = slots.every((s) => s.card !== null);
    return { theme, slots, held, canComplete, complete: canComplete && held.length === slots.length };
  });
}

/** The set id of a theme's album: its legendary card names it (`unlockedBy: 'set:album-<theme>'`, row CM-23c). */
export const albumSetId = (theme: ThemeKey): string => `set:album-${theme}`;

/**
 * The album sets the award engine reads, one per album that can complete, its members the album's cards. `cardIdOf`
 * names each album's legendary card (row CM-23c); an album with none yet, or one with a slot still empty, has no set.
 */
export function albumSets(albums: readonly AlbumView[], cardIdOf: (theme: ThemeKey) => string | undefined, titleOf: (theme: ThemeKey) => string): CardSet[] {
  return albums.flatMap((a) => {
    const cardId = cardIdOf(a.theme);
    if (!a.canComplete || cardId === undefined) return [];
    return [{ id: albumSetId(a.theme), cardId, titleEn: titleOf(a.theme), memberCardIds: a.slots.map((s) => (s.card as HeritageCard).id) }];
  });
}
