import type { SceneArt } from '@hangul-route/content-schema';
import { SCENE_ART_REGISTRY, resolveScene } from '@hangul-route/design-system/scene-art';
import type { SequenceCard } from './sequence-cards';

/**
 * Scene art on the Story Order cards and in the picture replay (F-STORY-003
 * §3.5, PR 3.5b). Pure and token-free: the screen passes the token values
 * (gap, card chrome, picture bounds) and draws what these return.
 *
 * A card shows its picture only when the picture really draws: a legacy step,
 * a scene whose art is pending and a scene whose setting is not in the
 * registry all show the words alone (never a broken image, never the reader's
 * tinted placeholder panel).
 */

/** The picture may take at most this share of the window height in the replay (the reader's stacked share). */
export const REPLAY_ART_SHARE = 0.42;

/** The card's art when its setting resolves in the scene-art registry, else null. Never throws. */
export function sequenceCardArt(card: SequenceCard): SceneArt | null {
  const art = card.art;
  if (!art) return null;
  try {
    const resolved = resolveScene(art, SCENE_ART_REGISTRY);
    return resolved.issues.some((i) => i.kind === 'unresolved-setting') ? null : art;
  } catch {
    return null; // malformed data: the words alone
  }
}

/** True when at least one card of the step draws a picture (the grid then sizes for pictures). */
export function sequenceHasArt(cards: ReadonlyArray<SequenceCard>): boolean {
  return cards.some((c) => sequenceCardArt(c) !== null);
}

function cellWidth(gridWidth: number, columns: number, gap: number): number {
  return Math.floor((gridWidth - (columns - 1) * gap) / columns);
}

/**
 * Card columns when the cards carry pictures: the text layout's `columns`
 * (`sequenceColumns`), reduced until every cell holds a picture at least
 * `minArt` wide next to the card chrome, down to one column. While the grid is
 * unmeasured the columns stay as given.
 */
export function sequenceArtColumns(
  columns: number,
  gridWidth: number,
  gap: number,
  chrome: number,
  minArt: number,
): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return columns;
  let n = Math.max(1, Math.floor(columns));
  while (n > 1 && cellWidth(gridWidth, n, gap) - chrome < minArt) n -= 1;
  return n;
}

/**
 * Width of a card's picture: its cell less the card chrome, at most `maxArt`.
 * 0 (draw no picture yet) while the grid is unmeasured or the cell has no
 * room, so a picture never overflows its card.
 */
export function sequenceCardArtWidth(
  gridWidth: number,
  columns: number,
  gap: number,
  chrome: number,
  maxArt: number,
): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0 || columns < 1) return 0;
  const room = cellWidth(gridWidth, columns, gap) - chrome;
  return room <= 0 ? 0 : Math.min(room, maxArt);
}

export interface ReplayArtInput {
  /** Measured width of the replay card (0 while unmeasured). */
  width: number;
  /** Window height. */
  windowHeight: number;
  /** The card's horizontal padding (both sides). */
  chrome: number;
  /** Largest picture width. */
  maxArt: number;
}

/**
 * Width of the replay picture (4:3): the card's inner width, at most
 * `maxArt`, and short enough (≤ `REPLAY_ART_SHARE` of the window height) that
 * the words and the replay controls stay near on a landscape phone.
 */
export function replayArtWidth({ width, windowHeight, chrome, maxArt }: ReplayArtInput): number {
  if (!Number.isFinite(width) || !Number.isFinite(windowHeight) || width <= 0 || windowHeight <= 0) return 0;
  const inner = width - chrome;
  if (inner <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(inner, maxArt, (windowHeight * REPLAY_ART_SHARE * 4) / 3)));
}
