import type { ReactNode } from 'react';
import type { ScreenEdge, ScreenWidth } from '../../layout';

export interface ScreenProps {
  children: ReactNode;
  /**
   * Scrolls by default so nothing is clipped on short phones or in landscape
   * (the web reset sets `body{overflow:hidden}`). Content still fills the
   * screen, so a `flex: 1` spacer keeps a CTA pinned to the bottom when there
   * is room. Pass `false` only where a gesture owns the surface (trace canvas).
   */
  scrollable?: boolean;
  padded?: boolean;
  tone?: 'canvas' | 'paper' | 'sunken';
  /**
   * Safe-area edges this screen pads for (default: all four, which covers
   * landscape notches on the left/right). Tab screens drop `bottom` — the tab
   * bar already sits above the home indicator.
   */
  edges?: readonly ScreenEdge[];
  /**
   * Content width cap inside the screen (F-LAYOUT-001 LD3): `reading` = 720
   * (default), `full` = 1120 for pane screens, `bleed` = no cap (presenter
   * stage, full-screen art). Backgrounds stay full-bleed; insets and gutter
   * stay outside the cap.
   */
  width?: ScreenWidth;
  /**
   * Sticky footer slot (a primary CTA that must stay reachable on a short
   * window). Rendered below the scroll area, outside the ScrollView, inside
   * the bottom safe-area padding when the screen owns the `bottom` edge, with
   * the same width cap as the content. Adds no style beyond cap and padding.
   */
  footer?: ReactNode;
  testID?: string;
}
