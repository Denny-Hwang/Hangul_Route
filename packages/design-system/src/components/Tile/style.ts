import { MARK_DISC } from '../../answer-mark';
import { borderWidth, colors } from '../../tokens';
import type { IconName } from '../Icon/types';
import type { TileState } from './types';

/**
 * Pure state styles behind `Tile`, so the colour of every state is a token the contrast contract
 * (`src/__tests__/contrast.test.ts`) reads, as `ChoiceCard/style.ts` does for the option card.
 *
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17a (audit A11Y-1): the wrong-state label was a literal amber, 2.85:1 on the nudge
 * tint. It is `text.primary` now, and a miss also carries ChoiceCard's "try another" mark, because the amber border is
 * under 3:1 on paper and colour may not be the only signal. Amber stays the miss colour: never red, never an X.
 */

export const TILE_STATES = ['idle', 'correct', 'wrong', 'disabled'] as const satisfies readonly TileState[];

/**
 * Decorative status mark on a disc straddling the tile's top-end corner; the caller's accessible name carries the state.
 * F-A11Y-001 AF-1: a right tile has `check` too, so right and miss are told apart without colour.
 */
export interface TileMark {
  icon: IconName;
  color: string;
  /** The disc behind the mark: the state's light fill. */
  disc: string;
}

export interface TileStyle {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  /** The romanization line under the glyph, the same in every state. */
  romanizationColor: string;
  mark: TileMark | null;
}

const LOOKS: Record<TileState, Omit<TileStyle, 'romanizationColor'>> = {
  idle: {
    backgroundColor: colors.surface.paper,
    // [AU] AU-17e (audit A11Y-4): an answer tile's boundary is a UI graphic, 3:1 on its fill and on the canvas around it.
    borderColor: colors.border.shape,
    labelColor: colors.text.primary,
    mark: null,
  },
  correct: {
    backgroundColor: colors.feedback.successLight,
    borderColor: colors.feedback.success,
    labelColor: colors.feedback.success,
    // F-A11Y-001 §3.1 (row AF-1): the check of a right answer, in the success colour on its light disc (4.28:1).
    mark: { icon: 'check', color: colors.feedback.success, disc: colors.feedback.successLight },
  },
  wrong: {
    backgroundColor: colors.feedback.nudgeLight,
    borderColor: colors.feedback.nudge,
    labelColor: colors.text.primary,
    // The mark ChoiceCard draws on a miss ("try another"), in the same colour.
    mark: { icon: 'replay', color: colors.text.primary, disc: colors.feedback.nudgeLight },
  },
  disabled: {
    backgroundColor: colors.surface.sunken,
    borderColor: colors.border.subtle,
    labelColor: colors.text.muted,
    mark: null,
  },
};

/** The look of one state. An unknown state reads as `idle`. */
export function tileStyle(state: TileState): TileStyle {
  return { ...(LOOKS[state] ?? LOOKS.idle), romanizationColor: colors.text.muted };
}

/**
 * Where the mark sits (F-A11Y-001 AF-1; design/components/AnswerFeedback/spec.md D2): a 20 mark (`MARK_MIN`) on a 26
 * disc straddling the tile's top-end corner, out of the flow, so the tile keeps its size. The disc reaches
 * `MARK_DISC.outside` (4) outside the border and about 20 inside it, where the glyph's column starts, so a tile that
 * shrank to its jamo at a large text size is never covered (inside the corner, the 16 dp mark of AU-17a covered it at
 * 200 %). `offset` is the disc's `top` and `right` from the tile's inner (padding) edge.
 */
export const TILE_MARK = {
  size: MARK_DISC.mark,
  disc: MARK_DISC.size,
  padding: MARK_DISC.padding,
  casing: MARK_DISC.casing,
  offset: -(MARK_DISC.outside + borderWidth.base),
} as const;
