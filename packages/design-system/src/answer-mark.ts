import { borderWidth, spacing } from './tokens';

/**
 * The size of a result mark (F-A11Y-001 §3.1; design/components/AnswerFeedback/spec.md D1): named sums of tokens, not
 * new tokens, so every answer surface reads the same numbers.
 *
 * - `MARK_MIN` (20): the least size of any mark that is not in the flow. At 16 the icons' 2.2 to 2.6 stroke of the 24
 *   grid drew under 1.8 px; at 20 it is 1.8 to 2.2 px.
 * - A mark in the flow at the end of a row stays `spacing.xl` (24, ChoiceCard).
 * - `MARK_DISC`: a 20 mark on a 26 disc of the state's light fill with a `borderWidth.thin` casing in `text.primary`,
 *   used where the mark straddles an answer's top-end corner (Tile, Sentence Builder's tried tile) or sits on art.
 */
export const MARK_MIN = spacing.lg + spacing.xs;

export const MARK_DISC = {
  /** The mark inside the disc. */
  mark: MARK_MIN,
  /** Between the mark and the casing. */
  padding: spacing.xxs,
  /** The casing's width. */
  casing: borderWidth.thin,
  /** The disc's whole side: 26. */
  size: MARK_MIN + 2 * spacing.xxs + 2 * borderWidth.thin,
  /** How far a straddling disc reaches outside the answer's border (D2). */
  outside: spacing.xs,
} as const;
