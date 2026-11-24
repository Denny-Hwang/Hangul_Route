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
  /**
   * The look-here ring (`hint`, F-A11Y-001 AF-1; AnswerFeedback D4): a dashed ring outside the card, the one look-here
   * shape of every game. `null` in every other state.
   */
  ring: ChoiceCardRing | null;
  /** Whether a tap does anything (`idle`, `hint`). */
  interactive: boolean;
  /**
   * `accessibilityState.selected`: the right answer (`correct`). A miss is not `selected` (F-A11Y-001 §3.1): a reader
   * would say "Not this one: pear, selected", and "selected" sounds like the answer.
   */
  selected: boolean;
  /** `accessibilityState.disabled`. */
  disabled: boolean;
}

/** The dashed look-here ring: `width` thick in `color`, `gap` outside the card's border. */
export interface ChoiceCardRing {
  color: string;
  width: number;
  gap: number;
}

const LOOK_HERE: ChoiceCardRing = { color: colors.border.focus, width: borderWidth.thick, gap: spacing.xs };

type StateLook = Pick<ChoiceCardStyle, 'backgroundColor' | 'borderColor' | 'borderWidth' | 'mark' | 'ring' | 'interactive' | 'selected' | 'disabled'>;

const LOOKS: Record<ChoiceCardState, StateLook> = {
  idle: {
    backgroundColor: colors.surface.paper,
    // [AU] AMENDMENTS-AUDIT-2026-11 AU-17e (audit A11Y-4): an option's boundary is a UI graphic, 3:1 on its fill and on
    // the canvas around it (`border.subtle` was 1.32:1). The other states keep their own cues: a fill and a mark
    // (correct, wrong), the thick `border.focus` ring (hint), the sunken fill (disabled).
    borderColor: colors.border.shape,
    borderWidth: borderWidth.base,
    mark: null,
    ring: null,
    interactive: true,
    selected: false,
    disabled: false,
  },
  correct: {
    backgroundColor: colors.feedback.successLight,
    borderColor: colors.feedback.success,
    borderWidth: borderWidth.base,
    mark: { icon: 'check', color: colors.feedback.success },
    ring: null,
    interactive: false,
    selected: true,
    disabled: false,
  },
  wrong: {
    backgroundColor: colors.feedback.nudgeLight,
    borderColor: colors.feedback.nudge,
    borderWidth: borderWidth.base,
    mark: { icon: 'replay', color: colors.text.primary },
    ring: null,
    interactive: false,
    selected: false,
    disabled: false,
  },
  // F-A11Y-001 AF-1 (AnswerFeedback D4): the card keeps idle's border; look-here is the dashed ring outside it (the old
  // thick border.focus border was 1.06:1 against border.shape, so it read by width alone).
  hint: {
    backgroundColor: colors.surface.paper,
    borderColor: colors.border.shape,
    borderWidth: borderWidth.base,
    mark: null,
    ring: LOOK_HERE,
    interactive: true,
    selected: false,
    disabled: false,
  },
  disabled: {
    backgroundColor: colors.surface.sunken,
    borderColor: colors.border.subtle,
    borderWidth: borderWidth.base,
    mark: null,
    ring: null,
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
    ring: look.ring === null ? null : { ...look.ring },
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

/**
 * The look-here ring's own style (F-A11Y-001 AF-1; AnswerFeedback D4): an overlay drawn inside the card as an absolute
 * child, reaching `gap` past the card's border, so it takes no room and nothing moves when it shows, and the drawn card
 * stays the target's first child. `cardBorderWidth` is the border the card draws now (an absolute child is placed from
 * the inside of that border). Pure, for ChoiceCard and for a board that paints the card's looks by hand (Cloze Pick).
 */
export function choiceCardRingStyle(
  ring: ChoiceCardRing,
  borderRadius: number,
  cardBorderWidth: number,
): {
  position: 'absolute';
  top: number;
  right: number;
  bottom: number;
  left: number;
  borderRadius: number;
  borderWidth: number;
  borderStyle: 'dashed';
  borderColor: string;
} {
  const out = -(ring.gap + ring.width + cardBorderWidth);
  return {
    position: 'absolute',
    top: out,
    right: out,
    bottom: out,
    left: out,
    borderRadius: borderRadius + ring.gap + ring.width,
    borderWidth: ring.width,
    borderStyle: 'dashed',
    borderColor: ring.color,
  };
}
