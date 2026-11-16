import { colors, spacing } from '../../tokens';
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

/** Decorative status mark on the tile's top corner; the caller's accessible name carries the state. */
export interface TileMark {
  icon: IconName;
  color: string;
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
    borderColor: colors.border.subtle,
    labelColor: colors.text.primary,
    mark: null,
  },
  correct: {
    backgroundColor: colors.feedback.successLight,
    borderColor: colors.feedback.success,
    labelColor: colors.feedback.success,
    mark: null,
  },
  wrong: {
    backgroundColor: colors.feedback.nudgeLight,
    borderColor: colors.feedback.nudge,
    labelColor: colors.text.primary,
    // The mark ChoiceCard draws on a miss ("try another"), in the same colour.
    mark: { icon: 'replay', color: colors.text.primary },
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
 * Where the mark sits: on the top corner, out of the flow, so the tile keeps its size. The glyph and the romanization
 * line sit inside the tile's padding (`spacing.md`) and their own side padding (`spacing.sm`), 20 dp from the inner
 * edge; the mark ends 18 dp from it (`inset + size`), so it covers neither at any text size (a bigger glyph grows the
 * tile, the padding stays).
 */
export const TILE_MARK = { size: spacing.lg, inset: spacing.xxs } as const;
