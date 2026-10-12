import type { HeritageCard, SceneArt, ThemeKey } from '@hangul-route/content-schema';
import { typography } from '@hangul-route/design-system/tokens';

/**
 * What a card's face shows (F-STORY-006 §3.8 Art, D7), decided once for every
 * screen that draws a card, so adding a card never needs a new drawing or a
 * new `supportedCardIds` check. In order:
 *
 *   1. the design system's `HeritageCardArt`, when it can draw the id;
 *   2. a story card's cover scene (its story's `coverSceneId`), cropped to a square;
 *   3. a set card's collection plate: its member cards, at most six, 3 x 2;
 *   4. the Korean word on the card's theme tint (the first letter of the
 *      English title for a card with no Korean word, as the screens did).
 *
 * Every card resolves to one of these, so an owned card always has a face.
 */
export type CardArtSource =
  | { kind: 'heritage'; cardId: string }
  | { kind: 'cover'; art: SceneArt; theme: ThemeKey; word: string }
  | { kind: 'plate'; members: readonly HeritageCard[] }
  | { kind: 'word'; word: string; theme: ThemeKey };

export interface CardArtDeps {
  /** Card ids the design system can draw (`supportedCardIds`). */
  drawnCardIds: readonly string[];
  /** The art of a story's cover scene; null when the story is not bundled or its cover art is pending. */
  storyCover: (storyId: string) => SceneArt | null;
  /** The card catalogue, in order: where a set card finds its members. */
  cardsAll: readonly HeritageCard[];
}

/** A collection plate holds six member cards, three across and two down. */
export const CARD_PLATE_SLOTS = 6;
export const CARD_PLATE_COLUMNS = 3;

/** The word a card shows when it has no picture. */
export function cardWord(card: Pick<HeritageCard, 'subtitleKo' | 'titleEn'>): string {
  return card.subtitleKo ?? card.titleEn.charAt(0);
}

const SET_RULE = /^set:/;

export function cardArtSource(card: HeritageCard, deps: CardArtDeps): CardArtSource {
  if (deps.drawnCardIds.includes(card.id)) return { kind: 'heritage', cardId: card.id };
  const word = cardWord(card);
  if (card.storyId !== undefined) {
    const art = deps.storyCover(card.storyId);
    if (art !== null) return { kind: 'cover', art, theme: card.theme, word };
  }
  if (SET_RULE.test(card.unlockedBy)) {
    const members = deps.cardsAll
      .filter((c) => c.id !== card.id && c.setId === card.unlockedBy && !SET_RULE.test(c.unlockedBy))
      .slice(0, CARD_PLATE_SLOTS);
    if (members.length > 0) return { kind: 'plate', members };
  }
  return { kind: 'word', word, theme: card.theme };
}

/**
 * A cover scene is 4:3. Drawn `size * 4/3` wide it is exactly `size` tall, and
 * shifted left by a sixth of `size` its centre fills the square.
 */
export function cardCoverCrop(size: number): { sceneWidth: number; offsetX: number } {
  return { sceneWidth: (size * 4) / 3, offsetX: -size / 6 };
}

/** Plate margin and the gap between cells, as shares of the plate side. */
const PLATE_INSET_SHARE = 0.06;
const PLATE_GAP_SHARE = 0.03;

export interface CardPlateLayout {
  inset: number;
  gap: number;
  /** Side of one square cell. */
  cell: number;
  /** Top-left corner of each cell, row by row. */
  cells: { x: number; y: number }[];
}

/** Six square cells, three across and two down, centred on a square plate of side `size`. */
export function cardPlateLayout(size: number): CardPlateLayout {
  const inset = size * PLATE_INSET_SHARE;
  const gap = size * PLATE_GAP_SHARE;
  const cell = (size - 2 * inset - (CARD_PLATE_COLUMNS - 1) * gap) / CARD_PLATE_COLUMNS;
  const rows = CARD_PLATE_SLOTS / CARD_PLATE_COLUMNS;
  const top = (size - (rows * cell + (rows - 1) * gap)) / 2;
  const cells = Array.from({ length: CARD_PLATE_SLOTS }, (_, i) => ({
    x: inset + (i % CARD_PLATE_COLUMNS) * (cell + gap),
    y: top + Math.floor(i / CARD_PLATE_COLUMNS) * (cell + gap),
  }));
  return { inset, gap, cell, cells };
}

/** The word fills at most this share of the square's height, and its glyphs this share of its width. */
const WORD_HEIGHT_SHARE = 0.4;
const WORD_WIDTH_SHARE = 0.8;

/**
 * The font size of the fallback word: large on a big card, smaller for a long
 * word so it stays inside the square, never below the caption size.
 */
export function cardWordFontSize(size: number, word: string): number {
  const glyphs = Math.max(1, Array.from(word).length);
  const fit = Math.floor(Math.min(size * WORD_HEIGHT_SHARE, (size * WORD_WIDTH_SHARE) / glyphs));
  return Math.max(typography.size.caption, fit);
}
