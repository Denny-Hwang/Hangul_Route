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

export type TraceLayoutMode = 'roomy' | 'compact' | 'side';

export const TRACE_CANVAS_MIN = 160;
export const TRACE_CANVAS_MAX = 320;

/**
 * Thresholds are on the Screen's content box (measured with onLayout, so the
 * web build's 480px column on wide windows and the safe-area insets are
 * already accounted for), not on the window.
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

/** Largest square that fits the canvas slot, kept inside [MIN, MAX]. */
export function traceCanvasSize(slotWidth: number, slotHeight: number): number {
  const fit = Math.floor(Math.min(slotWidth, slotHeight));
  return Math.max(TRACE_CANVAS_MIN, Math.min(TRACE_CANVAS_MAX, fit));
}

/**
 * Width of the control column beside the canvas in `side` mode: just under half
 * the content, but wide enough for Show me + Clear and Done + Skip in a row
 * (240) and no wider than 380.
 */
export function traceSidePanelWidth(contentWidth: number): number {
  return Math.max(240, Math.min(380, Math.floor(contentWidth * 0.45)));
}
