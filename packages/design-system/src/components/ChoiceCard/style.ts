import { borderWidth, colors, radii, touchTarget } from '../../tokens';
import type { IconName } from '../Icon/types';
import type { ChoiceCardState } from './types';

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

/** The look of one state. An unknown state (persisted junk) reads as `idle`. */
export function choiceCardStyle(state: ChoiceCardState): ChoiceCardStyle {
  const look = LOOKS[state] ?? LOOKS.idle;
  return {
    ...look,
    mark: look.mark === null ? null : { ...look.mark },
    borderRadius: radii.lg,
    minHeight: touchTarget.child,
    textColor: colors.text.primary,
  };
}
