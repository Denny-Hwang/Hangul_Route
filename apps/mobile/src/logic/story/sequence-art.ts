import type { SceneArt } from '@hangul-route/content-schema';
import type { SequenceCard } from './sequence-cards';

/**
 * Scene art on the Story Order cards and in the picture replay (F-STORY-003
 * §3.5, PR 3.5b). Pure: the screen passes the design tokens in
 * (`sequenceCardMetrics`), so the screen and the tests share one formula, and
 * draws what these return.
 *
 * A card shows its picture only when the picture really draws: a legacy step,
 * a scene whose art is pending and a scene whose setting is not in the
 * registry all show the words alone (never a broken image, never the reader's
 * tinted placeholder panel).
 *
 * The scene-art resolver is passed in (the screen hands over the design
 * system's `resolveScene` with its registry): Metro cannot resolve the pure
 * `./scene-art` subpath and the package root pulls react-native into vitest.
 */

/** Resolves a picture against the scene-art registry; only the issue kinds are read. */
export type SceneResolver = (art: SceneArt) => { issues: ReadonlyArray<{ kind: string }> };

/**
 * A stacked story picture may take at most this share of the height: the
 * reader's stacked layout (StoryReaderView imports it) and the replay here.
 */
export const STACKED_ART_SHARE = 0.42;

/** The design tokens the card metrics are built from (the screen passes the real ones). */
export interface SequenceArtTokens {
  spacing: { readonly md: number; readonly lg: number; readonly xl: number };
  borderWidth: { readonly base: number };
  touchTarget: { readonly child: number; readonly hero: number };
}

/** Card grid metrics for pictures, all in dp. */
export interface SequenceCardMetrics {
  /** Gap between card cells. */
  gap: number;
  /**
   * Width a `ChoiceCard` takes around its picture: padding and border on both
   * sides, plus the outcome mark and its gap (kept free so a ring or a nudge
   * never squeezes the picture).
   */
  chrome: number;
  /** Smallest card picture: two columns hold on a 360 dp phone (F-STORY-003 §3.5). */
  minArt: number;
  /** Largest card picture (before the media scale). */
  maxArt: number;
  /** Column hysteresis: a column comes back only when its picture clears `minArt` by this much. */
  slack: number;
}

export function sequenceCardMetrics({ spacing, borderWidth, touchTarget }: SequenceArtTokens): SequenceCardMetrics {
  return {
    gap: spacing.md,
    chrome: 2 * spacing.lg + 2 * borderWidth.base + spacing.xl + spacing.md,
    minArt: touchTarget.child,
    maxArt: 2 * touchTarget.hero,
    slack: spacing.lg,
  };
}

/**
 * The grid width before it is measured: the window less both gutters, at most
 * the screen's content width. The first frame then lays out close to the
 * measured result (no text-only frame that snaps to pictures).
 */
export function estimateGridWidth(windowWidth: number, gutter: number, maxWidth: number): number {
  if (!Number.isFinite(windowWidth) || !Number.isFinite(gutter) || !Number.isFinite(maxWidth)) return 0;
  return Math.max(0, Math.min(windowWidth - 2 * gutter, maxWidth));
}

/** The card's art when its setting resolves in the scene-art registry, else null. Never throws. */
export function sequenceCardArt(card: SequenceCard, resolve: SceneResolver): SceneArt | null {
  const art = card.art;
  if (!art) return null;
  try {
    const resolved = resolve(art);
    return resolved.issues.some((i) => i.kind === 'unresolved-setting') ? null : art;
  } catch {
    return null; // malformed data: the words alone
  }
}

/** True when at least one card of the step draws a picture (the grid then sizes for pictures). */
export function sequenceHasArt(cards: ReadonlyArray<SequenceCard>, resolve: SceneResolver): boolean {
  return cards.some((c) => sequenceCardArt(c, resolve) !== null);
}

function cellWidth(gridWidth: number, columns: number, gap: number): number {
  return Math.floor((gridWidth - (columns - 1) * gap) / columns);
}

/**
 * Card columns when the cards carry pictures: the text layout's `columns`
 * (`sequenceColumns`), reduced until every cell holds a picture at least
 * `minArt` wide next to the card chrome, down to one column (never fewer).
 *
 * `previous` (the last columns drawn) adds hysteresis so a few dp of width
 * (a desktop scrollbar coming and going) cannot flip the layout back and
 * forth: the previous count stays while its picture is within `slack` below
 * `minArt`, and a column comes back only when its picture clears `minArt` by
 * `slack`. While the grid is unmeasured the columns stay as given.
 */
export function sequenceArtColumns(
  columns: number,
  gridWidth: number,
  metrics: SequenceCardMetrics,
  previous?: number,
): number {
  const max = Math.max(1, Math.floor(Number.isFinite(columns) ? columns : 1));
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return max;
  const { gap, chrome, minArt, slack } = metrics;
  const fits = (n: number, extra: number): boolean => cellWidth(gridWidth, n, gap) - chrome >= minArt + extra;
  let base = max;
  while (base > 1 && !fits(base, 0)) base -= 1;
  if (previous === undefined || !Number.isFinite(previous) || previous < 1 || previous > max) return base;
  const prev = Math.floor(previous);
  if (prev > base) return fits(prev, -slack) ? prev : base;
  if (prev < base) {
    let n = base;
    while (n > prev && !fits(n, slack)) n -= 1;
    return n;
  }
  return base;
}

/**
 * Width of a card's picture: its cell less the card chrome, at most `maxArt`.
 * 0 (draw no picture yet) while the grid is unmeasured or the cell has no
 * room, so a picture never overflows its card.
 */
export function sequenceCardArtWidth(
  gridWidth: number,
  columns: number,
  metrics: SequenceCardMetrics,
  maxArt: number,
): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0 || columns < 1) return 0;
  const room = cellWidth(gridWidth, columns, metrics.gap) - metrics.chrome;
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
 * `maxArt`, and short enough (≤ `STACKED_ART_SHARE` of the window height) that
 * the words and the replay controls stay near on a landscape phone.
 */
export function replayArtWidth({ width, windowHeight, chrome, maxArt }: ReplayArtInput): number {
  if (!Number.isFinite(width) || !Number.isFinite(windowHeight) || width <= 0 || windowHeight <= 0) return 0;
  const inner = width - chrome;
  if (inner <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(inner, maxArt, (windowHeight * STACKED_ART_SHARE * 4) / 3)));
}
