import type { ReactNode } from 'react';
import type { ScreenEdge } from '../../layout';

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
  testID?: string;
}
