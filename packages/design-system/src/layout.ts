import { spacing, touchTarget } from './tokens';

/**
 * Safe-area layout math (audit p2-L2, UX-09). Pure so it is testable without a
 * renderer; `Screen` and the app's bottom tab bar build their padding here.
 *
 * Insets come from react-native-safe-area-context: the status bar / notch on
 * top, the home indicator at the bottom, and the notch on the left or right in
 * landscape. On the web they are the CSS `env(safe-area-inset-*)` values.
 */

export type ScreenEdge = 'top' | 'right' | 'bottom' | 'left';

export const ALL_SCREEN_EDGES: readonly ScreenEdge[] = ['top', 'right', 'bottom', 'left'];

/** Screens inside the bottom tab navigator: the tab bar owns the bottom inset. */
export const TAB_SCREEN_EDGES: readonly ScreenEdge[] = ['top', 'right', 'left'];

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface ScreenPadding {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/**
 * Base padding plus the safe-area inset on each edge the screen owns. A screen
 * inside the tab navigator leaves `bottom` out — the tab bar already sits over
 * the home indicator.
 */
export function screenPadding(
  base: number,
  insets: EdgeInsets,
  edges: readonly ScreenEdge[] = ALL_SCREEN_EDGES,
): ScreenPadding {
  const inset = (edge: ScreenEdge): number => (edges.includes(edge) ? Math.max(0, insets[edge]) : 0);
  return {
    paddingTop: base + inset('top'),
    paddingRight: base + inset('right'),
    paddingBottom: base + inset('bottom'),
    paddingLeft: base + inset('left'),
  };
}

export interface TabBarMetrics {
  height: number;
  paddingTop: number;
  paddingBottom: number;
}

/**
 * Bottom tab bar sized from the bottom inset: the tab row keeps the 64pt
 * touch-target floor and sits fully above the home indicator, with a small
 * gap where there is no inset.
 */
export function tabBarMetrics(bottomInset: number): TabBarMetrics {
  const paddingTop = spacing.xs;
  const paddingBottom = Math.max(spacing.sm, bottomInset);
  return { height: paddingTop + touchTarget.min + paddingBottom, paddingTop, paddingBottom };
}
