/**
 * What `StoryScene` shows and says (F-STORY-002 §3.9.9), decided in one pure
 * place: the 4:3 size, the picture or the tinted fallback, and the assistive
 * technology view. The component only paints this.
 */
import type { ThemeKey } from '../tokens';
import { drawScene, type DrawnScene } from './draw';
import type { Registry, ResolveIssue } from './resolve';
import type { SceneArtLike } from './types';

export const DEFAULT_SCENE_WIDTH = 320;
/** Opacity of the fallback tint; one of the art opacity steps. */
export const FALLBACK_TINT_OPACITY = 0.15;
export const DEFAULT_FALLBACK_THEME: ThemeKey = 'letters';

export interface StorySceneModelInput {
  art?: SceneArtLike | null;
  theme?: ThemeKey;
  variant?: 'full' | 'thumb';
  width?: number;
  decorative?: boolean;
  accessibilityLabel?: string;
}

export interface StorySceneModel {
  width: number;
  /** `width * 3 / 4`. */
  height: number;
  theme: ThemeKey;
  /** The picture, or null when the tinted fallback panel is shown. */
  scene: DrawnScene | null;
  /** Why layers or the setting did not draw; the screen may flag it in development. */
  issues: ResolveIssue[];
  /** The accessible name; absent when there is none (then the node is not an image). */
  label: string | undefined;
  /** Hidden from assistive technology (recap thumbnails). */
  decorative: boolean;
}

function draw(art: SceneArtLike | null | undefined, registry: Registry, variant: 'full' | 'thumb'): Pick<StorySceneModel, 'scene' | 'issues'> {
  if (!art) return { scene: null, issues: [] };
  try {
    const scene = drawScene(art, registry, { variant });
    // No background set means no picture: the fallback panel, with the reason.
    return { scene: scene.issues.some((i) => i.kind === 'unresolved-setting') ? null : scene, issues: scene.issues };
  } catch {
    return { scene: null, issues: [] }; // malformed data: the fallback panel, never an error box
  }
}

export function storySceneModel(input: StorySceneModelInput, registry: Registry): StorySceneModel {
  const width = typeof input.width === 'number' && Number.isFinite(input.width) && input.width > 0 ? input.width : DEFAULT_SCENE_WIDTH;
  const decorative = input.decorative === true;
  return {
    width,
    height: (width * 3) / 4,
    theme: input.theme ?? DEFAULT_FALLBACK_THEME,
    ...draw(input.art, registry, input.variant ?? 'full'),
    label: decorative ? undefined : input.accessibilityLabel ?? input.art?.altEn,
    decorative,
  };
}
