import { borderWidth, colors } from './tokens';

/**
 * The press look (docs/specs/AMENDMENTS-TOUCH.md section 4.3, KT-D11; design/components/TapBoard/spec.md): while a
 * finger that will commit a target is down and inside, the target looks "pushed in": a thick `border.shape` outline
 * (at least 3:1 on canvas, paper, sunken and `brand.primaryLight`) and a slight shrink, instant, no transition. It is
 * never a state look (not `border.focus`, the focus ring and ChoiceCard's `hint`; not `brand.primary` or
 * `brand.primaryLight`, a selection; not `surface.sunken`, disabled; never a feedback colour), so a touch that does not
 * count can never look chosen. Under reduced motion there is no shrink: the outline alone.
 *
 * Pure (no React): ChoiceCard and Tile paint what this returns; the shrink goes on the drawn box, never on the hit area
 * the board measures.
 */

/** The shrink while pressed. A look, not a size: the hit area keeps its box. */
export const PRESS_SCALE = 0.97;

export interface PressLook {
  borderColor: string;
  borderWidth: number;
  /** 1 under reduced motion. */
  scale: number;
}

export function pressLook(reducedMotion: boolean): PressLook {
  return { borderColor: colors.border.shape, borderWidth: borderWidth.thick, scale: reducedMotion ? 1 : PRESS_SCALE };
}

/** The drawn box's transform: the shrink while pressed, nothing otherwise (or under reduced motion). */
export function pressTransform(look: PressLook | null): { scale: number }[] | undefined {
  return look === null || look.scale === 1 ? undefined : [{ scale: look.scale }];
}

/**
 * How much thicker the press outline is than the resting border: the drawn box takes it off its padding while
 * pressed, so the box keeps its size and nothing under it moves (the outline grows inward, never the layout).
 */
export function pressInset(look: PressLook | null, restBorderWidth: number): number {
  return look === null ? 0 : Math.max(0, look.borderWidth - restBorderWidth);
}
