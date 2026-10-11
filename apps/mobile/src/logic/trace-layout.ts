/**
 * Trace Stroke layout (audit UX-09). The game opts out of Screen scrolling —
 * the canvas owns vertical drags — so everything, Done and Skip included, has
 * to fit the viewport by itself. The canvas takes whatever the controls leave
 * (like the PIN pad) between a floor and a ceiling, and the controls
 * rearrange instead of overflowing:
 *
 *   - `roomy`   tall portrait: Hoya bubble, stacked Done / Skip (the original layout);
 *   - `compact` short portrait (iPhone SE, Safari toolbar): small feedback strip,
 *               Done and Skip side by side, the helper caption dropped;
 *   - `side`    wide and short (phone landscape): canvas on the left, controls beside it.
 *
 * Pure so the thresholds are tested without a renderer.
 */

import type { LayoutClass, ScreenWidth } from '@hangul-route/design-system';
import { gameArrangement } from './layout/game-layout';

export type TraceLayoutMode = 'roomy' | 'compact' | 'side';

export const TRACE_CANVAS_MIN = 160;
/** The phone ceiling; a tablet multiplies it by its media scale (`traceCanvasMax`). */
export const TRACE_CANVAS_MAX = 320;
/** No window makes the canvas bigger than this (320 x the wide media scale 1.4). */
export const TRACE_CANVAS_CEILING = 448;

/**
 * Thresholds are on the Screen's content box (measured with onLayout, so the
 * Screen's width cap and the safe-area insets are already accounted for), not
 * on the window.
 */

/** Content height the stacked layout needs for a canvas of at least 240. */
export const TRACE_ROOMY_MIN_HEIGHT = 700;
/** A content box this wide and wider than tall puts the controls beside the canvas. */
export const TRACE_SIDE_MIN_WIDTH = 440;

export interface TraceLayoutInput {
  /** Content box of the screen: inside the padding and the safe-area insets. */
  width: number;
  height: number;
}

export function traceLayoutMode({ width, height }: TraceLayoutInput): TraceLayoutMode {
  if (width > height && width >= TRACE_SIDE_MIN_WIDTH) return 'side';
  return height >= TRACE_ROOMY_MIN_HEIGHT ? 'roomy' : 'compact';
}

/**
 * Largest canvas the window class allows (F-LAYOUT-001 §3.6): 320 x `mediaScale`
 * (320 on a phone and on any short window, 384 regular, 448 wide), never past 448.
 */
export function traceCanvasMax(l: Pick<LayoutClass, 'mediaScale'>): number {
  const scaled = Math.round(TRACE_CANVAS_MAX * (Number.isFinite(l.mediaScale) ? l.mediaScale : 1));
  return Math.max(TRACE_CANVAS_MAX, Math.min(TRACE_CANVAS_CEILING, scaled));
}

/**
 * The `Screen` width Trace asks for. On a wide landscape window the reading
 * column (720) would be taller than wide and stack the controls under the
 * canvas, so the game takes the full width there and gets the `side` mode with
 * a 448 canvas. Everywhere else, the reading column as before (a landscape
 * phone reaches `side` inside it, as today).
 */
export function traceScreenWidth(l: Pick<LayoutClass, 'sideBySide' | 'short'>): Extract<ScreenWidth, 'reading' | 'full'> {
  return gameArrangement(l) === 'side' ? 'full' : 'reading';
}

/** Largest square that fits the canvas slot, kept inside [MIN, max] (`max` from `traceCanvasMax`). */
export function traceCanvasSize(slotWidth: number, slotHeight: number, max: number = TRACE_CANVAS_MAX): number {
  const fit = Math.floor(Math.min(slotWidth, slotHeight));
  return Math.max(TRACE_CANVAS_MIN, Math.min(max, fit));
}

/**
 * Width of the control column beside the canvas in `side` mode: just under half
 * the content, but wide enough for Show me + Clear and Done + Skip in a row
 * (240) and no wider than 380.
 */
export function traceSidePanelWidth(contentWidth: number): number {
  return Math.max(240, Math.min(380, Math.floor(contentWidth * 0.45)));
}
