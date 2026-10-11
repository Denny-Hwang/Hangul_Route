import type { EdgeInsets } from '@hangul-route/design-system';

/**
 * Where a window-level overlay (PWA banners, install guide) sits —
 * F-LAYOUT-001 §3.3 / §3.5, audit UX-26. Pure so the arithmetic is tested
 * without a renderer.
 *
 * - The caller centres the overlay in a column capped at
 *   `layout.maxWidth.reading`, so a toast is not a strip across a desktop window.
 * - Left / right clear the landscape notch plus `gap`.
 * - Bottom clears the home indicator, or the tab bar when it shows. The tab
 *   bar already sits over the home indicator (`tabBarMetrics` height includes
 *   the bottom inset), so its height replaces the inset instead of adding to it.
 */
export interface OverlayFrameInput {
  insets: EdgeInsets;
  /** Height of the visible bottom tab bar; 0 when no tab bar shows. */
  tabBarHeight: number;
  /** Space between the overlay and the side edges. */
  gap: number;
  /** Space between the overlay and the bottom edge / tab bar; `gap` when omitted. */
  bottomGap?: number;
}

export interface OverlayFrame {
  bottom: number;
  left: number;
  right: number;
}

function size(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function overlayFrame({ insets, tabBarHeight, gap, bottomGap = gap }: OverlayFrameInput): OverlayFrame {
  const tabBar = size(tabBarHeight);
  return {
    bottom: (tabBar > 0 ? tabBar : size(insets.bottom)) + bottomGap,
    left: size(insets.left) + gap,
    right: size(insets.right) + gap,
  };
}
