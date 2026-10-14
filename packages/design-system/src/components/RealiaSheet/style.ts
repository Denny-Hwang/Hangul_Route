import { borderWidth, colors, radii, spacing, touchTarget } from '../../tokens';
import type { RealiaLineMark, RealiaSheetKind } from './types';

/**
 * Pure looks behind `RealiaSheet` (F-CURR-001 G-2; design/screens/minigame-realia-read/,
 * README "Constants"). Tokens only; the named constants below are derived from tokens.
 * The found mark is green with a check and the gloss, the look-here mark a dashed focus ring
 * with a pointer: never colour alone, and never red.
 */

/** Height of a top dressing strip (awning, mountains): `spacing.xxxl` less `spacing.sm`. */
export const REALIA_TOP_DRESSING = spacing.xxxl - spacing.sm;
/** Height of a bottom dressing strip (counter, post foot). */
export const REALIA_BOTTOM_DRESSING = spacing.xxl;
/** Height of the goods drawn above a price card: `touchTarget.min` less `spacing.sm`. */
export const REALIA_GOODS_HEIGHT = touchTarget.min - spacing.sm;
/** Width of the ticket stub after the dotted cut. */
export const REALIA_STUB_WIDTH = touchTarget.min;
/** Size of the look-here pointer and the found check. */
export const REALIA_MARK_SIZE = spacing.xl;
/** A trail board's share of the sign's width, so the post stays visible on its other side. */
export const REALIA_BOARD_WIDTH = '88%';
/** Minimum width of a price card before the cards stack: a four-digit price in won at bodyLg plus padding. */
export const REALIA_CARD_MIN_WIDTH = touchTarget.hero + spacing.xxxl;

export interface RealiaDressing {
  top?: string;
  bottom?: string;
}

/** The scene-art props that dress each kind (`REALIA_REGISTRY`); the plain sheet has none. */
export const REALIA_DRESSINGS: Readonly<Record<RealiaSheetKind, RealiaDressing>> = {
  menu: { top: 'prop:realia-awning', bottom: 'prop:realia-counter' },
  ticket: { top: 'prop:realia-train-band' },
  sign: { top: 'prop:realia-mountains', bottom: 'prop:realia-post-foot' },
  'price-card': {},
  plain: {},
};

export const REALIA_STUB = 'prop:realia-ticket-stub';

/** The goods prop for a price card. */
export const realiaGoodsRef = (goods: 'apples' | 'fan' | 'hanji'): string => `prop:realia-goods-${goods}`;

export interface RealiaLineLook {
  backgroundColor: string | undefined;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed';
  /** The glyph drawn at the start of the line, or none. */
  icon: { name: 'check' | 'arrow-right'; color: string } | null;
}

export function realiaLineLook(mark: RealiaLineMark): RealiaLineLook {
  switch (mark) {
    case 'found':
      return {
        backgroundColor: colors.feedback.successLight,
        borderColor: colors.feedback.success,
        borderWidth: borderWidth.thick,
        borderStyle: 'solid',
        icon: { name: 'check', color: colors.feedback.successDark },
      };
    case 'lookHere':
      return {
        backgroundColor: undefined,
        borderColor: colors.border.focus,
        borderWidth: borderWidth.thick,
        borderStyle: 'dashed',
        icon: { name: 'arrow-right', color: colors.border.focus },
      };
    default:
      return { backgroundColor: undefined, borderColor: 'transparent', borderWidth: borderWidth.thick, borderStyle: 'solid', icon: null };
  }
}

/** The surface a kind's lines sit on: a trail board is amber paper, everything else white paper. */
export function realiaPaper(kind: RealiaSheetKind): { backgroundColor: string; borderColor: string; borderRadius: number } {
  if (kind === 'sign') return { backgroundColor: colors.feedback.nudgeLight, borderColor: colors.text.secondary, borderRadius: radii.sm };
  return { backgroundColor: colors.surface.paper, borderColor: kind === 'plain' ? colors.border.shape : colors.text.secondary, borderRadius: radii.md };
}
