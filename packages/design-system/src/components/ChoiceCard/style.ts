import { borderWidth, colors, radii, spacing, touchTarget } from '../../tokens';
import type { IconName } from '../Icon/types';
import type { ChoiceCardState, ChoiceCardWrongMark } from './types';

/**
 * Pure state styles behind `ChoiceCard` (F-STORY-003 §3.4). The component only
 * paints what this returns, so the look of each state and its accessibility
 * flags are unit-tested without a renderer. Tokens only, no literals.
 *
 * Amber (`feedback.nudge`) is the miss colour, never red and never an X. The
 * amber border is under 3:1 on paper, so a wrong card also carries a mark.
 */

export const CHOICE_CARD_STATES = ['idle', 'correct', 'wrong', 'hint', 'disabled'] as const satisfies readonly ChoiceCardState[];

/** Decorative status mark at the end of the card; the state itself is in the accessible name. */
export interface ChoiceCardMark {
  icon: IconName;
  color: string;
}

export interface ChoiceCardStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  minHeight: number;
  textColor: string;
  mark: ChoiceCardMark | null;
  /** Whether a tap does anything (`idle`, `hint`). */
  interactive: boolean;
  /** `accessibilityState.selected`: the learner chose this card (`correct`, `wrong`). */
  selected: boolean;
  /** `accessibilityState.disabled`. */
  disabled: boolean;
}

type StateLook = Pick<ChoiceCardStyle, 'backgroundColor' | 'borderColor' | 'borderWidth' | 'mark' | 'interactive' | 'selected' | 'disabled'>;

const LOOKS: Record<ChoiceCardState, StateLook> = {
  idle: {
    backgroundColor: colors.surface.paper,
    borderColor: colors.border.subtle,
    borderWidth: borderWidth.base,
    mark: null,
    interactive: true,
    selected: false,
    disabled: false,
  },
  correct: {
    backgroundColor: colors.feedback.successLight,
    borderColor: colors.feedback.success,
    borderWidth: borderWidth.base,
    mark: { icon: 'check', color: colors.feedback.success },
    interactive: false,
    selected: true,
    disabled: false,
  },
  wrong: {
    backgroundColor: colors.feedback.nudgeLight,
    borderColor: colors.feedback.nudge,
    borderWidth: borderWidth.base,
    mark: { icon: 'replay', color: colors.text.primary },
    interactive: false,
    selected: true,
    disabled: false,
  },
  hint: {
    backgroundColor: colors.surface.paper,
    borderColor: colors.border.focus,
    borderWidth: borderWidth.thick,
    mark: null,
    interactive: true,
    selected: false,
    disabled: false,
  },
  disabled: {
    backgroundColor: colors.surface.sunken,
    borderColor: colors.border.subtle,
    borderWidth: borderWidth.base,
    mark: null,
    interactive: false,
    selected: false,
    disabled: true,
  },
};

export interface ChoiceCardStyleOptions {
  /** The mark of the `wrong` state: `replay` ("try another", the default) or `dash` (a locked miss with no retry). */
  wrongMark?: ChoiceCardWrongMark;
}

/** The look of one state. An unknown state (persisted junk) reads as `idle`. */
export function choiceCardStyle(state: ChoiceCardState, options: ChoiceCardStyleOptions = {}): ChoiceCardStyle {
  const look = LOOKS[state] ?? LOOKS.idle;
  const dash = state === 'wrong' && options.wrongMark === 'dash';
  return {
    ...look,
    mark: look.mark === null ? null : { ...look.mark, ...(dash ? { icon: 'dash' as const } : null) },
    borderRadius: radii.lg,
    minHeight: touchTarget.child,
    textColor: colors.text.primary,
  };
}

/**
 * The narrowest `layout="tile"` card for a picture `artSize` dp wide: the art, the horizontal padding and
 * the thickest state border. The tile draws its status mark on the corner, so no width is kept for it
 * (a `row` card adds the mark and its gap at the end of the row).
 */
export function choiceCardTileWidth(artSize: number): number {
  return artSize + 2 * spacing.lg + 2 * borderWidth.thick;
}
