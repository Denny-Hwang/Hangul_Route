import type { ReactNode } from 'react';
import type { ThemeKey } from '../../tokens';
import type { ResolveIssue } from '../../scene-art/resolve';
import type { SceneArtLike } from '../../scene-art/types';

export interface StorySceneProps {
  /** Structural twin of the content-schema `SceneArt` (design-system does not depend on content-schema). */
  art?: SceneArtLike | null;
  /** Tint of the fallback panel. */
  theme?: ThemeKey;
  /** `thumb` drops detail shapes and hairlines. */
  variant?: 'full' | 'thumb';
  /** In dp; the height is `width * 3 / 4`. Default 320. */
  width?: number;
  /** Centred on the fallback tint, for example the Korean title on a shelf tile. */
  fallback?: ReactNode;
  /** True: hidden from assistive technology (recap thumbnails). */
  decorative?: boolean;
  /** Default: `art.altEn`. */
  accessibilityLabel?: string;
  /**
   * Called when the setting or a layer did not resolve. In development the
   * picture also gets a dashed outline; nothing is logged.
   */
  onResolveIssue?: (issues: ResolveIssue[]) => void;
  testID?: string;
}
