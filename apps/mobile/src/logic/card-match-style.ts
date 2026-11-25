import { borderWidth, colors, spacing } from '@hangul-route/design-system/tokens';

/**
 * Card Match's card, as a pure style (F-A11Y-001 §3.1, §3.5; row AF-3; design/components/AnswerFeedback/spec.md D5).
 * `CardMatchGame` only paints what this returns, so each state's look, its mark and the room kept for it are unit-tested
 * (the colour pairs against `contrast.test.ts`'s rules) without a renderer. Tokens only, no literals.
 *
 * - `idle`: paper, a `border.subtle` outline (kept as shipped, AnswerFeedback follow-up F1).
 * - `picked` (a Korean card): the `brand.primaryLight` fill and `brand.primary` border, plus a solid second ring outside
 *   the card, so a pick is told from an idle card in greyscale (`PICK_RING`).
 * - `matched` (both cards of a pair): the success fill and border, a `check`, at **full opacity** (the old 0.5 fade left
 *   its text at 2.94:1).
 * - `wrong` (a meaning tried for the picked word): the nudge fill and border and a `replay`. Never `feedback.danger`,
 *   never an X.
 * - A mark sits inside the top-end corner (`CARD_MARK`) and the card keeps a top band for it in every state
 *   (`cardTopPadding`), so answering never moves the text and the mark never covers it.
 */
export type CardMatchState = 'idle' | 'picked' | 'matched' | 'wrong';

export interface CardMatchMark {
  icon: 'check' | 'replay';
  color: string;
}

export interface CardMatchLook {
  backgroundColor: string;
  borderColor: string;
  mark: CardMatchMark | null;
  /** The solid second ring outside the card: the picked card's cue that is not a colour. */
  ring: boolean;
}

export const CARD_MATCH_STATES = ['idle', 'picked', 'matched', 'wrong'] as const satisfies readonly CardMatchState[];

const LOOKS: Record<CardMatchState, CardMatchLook> = {
  idle: { backgroundColor: colors.surface.paper, borderColor: colors.border.subtle, mark: null, ring: false },
  picked: { backgroundColor: colors.brand.primaryLight, borderColor: colors.brand.primary, mark: null, ring: true },
  matched: {
    backgroundColor: colors.feedback.successLight,
    borderColor: colors.feedback.success,
    mark: { icon: 'check', color: colors.feedback.success },
    ring: false,
  },
  wrong: {
    backgroundColor: colors.feedback.nudgeLight,
    borderColor: colors.feedback.nudge,
    mark: { icon: 'replay', color: colors.text.primary },
    ring: false,
  },
};

/** The look of one state. An unknown state reads as `idle`. */
export function cardMatchStyle(state: CardMatchState): CardMatchLook {
  const look = LOOKS[state] ?? LOOKS.idle;
  return { ...look, mark: look.mark === null ? null : { ...look.mark } };
}

/** The mark: `MARK_MIN` (20) in the top-end corner, `spacing.xs` in from the border (AnswerFeedback D1, D5). */
// `MARK_MIN` of the design system (`answer-mark.ts`: `spacing.lg + spacing.xs`), written as its sum so this logic file
// loads without the component index; the test pins them equal.
export const CARD_MARK = { size: spacing.lg + spacing.xs, inset: spacing.xs } as const;

/**
 * The top band every card keeps: `max(spacing.xl, cardPadding)`. The mark ends 24 below the top (inset + size), so the
 * band is at least that; a window that scales the padding past it keeps the larger one (D5).
 */
export function cardTopPadding(cardPadding: number): number {
  return Math.max(spacing.xl, cardPadding);
}

/**
 * The picked card's solid second ring (D5): a canvas gap `spacing.xxs`, then `borderWidth.thick` in `brand.primary`, 5 dp
 * outside the card in all. It is drawn by a wrapper with a negative margin of `total`, so it costs no layout and is no
 * part of the hit area; the 8 dp row gap leaves 3 dp clear of the next card.
 */
export const PICK_RING = {
  color: colors.brand.primary,
  gap: spacing.xxs,
  width: borderWidth.thick,
  total: spacing.xxs + borderWidth.thick,
} as const;
