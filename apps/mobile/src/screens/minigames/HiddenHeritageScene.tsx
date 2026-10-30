import { drawScene, SCENE_ART_REGISTRY, type DrawItem, type Registry } from '@hangul-route/design-system';
import type { HiddenHeritageScene as Scene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { memo, useMemo, type ComponentType, type ReactElement } from 'react';
import { Circle, Ellipse, Line, Path, Polygon, Rect, Svg } from 'react-native-svg';

/**
 * A Hidden Heritage scene drawn from its data (F-CURR-002 row CM-36): the shared scene-art drawing list
 * (`drawScene`, the one `StoryScene` paints) over the shipped registry plus the items the scene adds, which live only
 * in the scene's lazy chunk. Decorative: the game names the scene by its alt text and every thing by its spot, so the
 * picture itself is hidden from assistive technology. Shared by the game (its chunk) and the projector slide.
 */

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;

function Item({ item }: { item: DrawItem }): ReactElement | null {
  if (item.tag === 'card') return null; // a scene draws no card pictures
  const Tag = TAGS[item.tag] as ComponentType<Record<string, unknown>>;
  return <Tag {...item.geometry} {...item.paint} transform={item.transform} />;
}

function SceneBase({ scene, width, testID }: { scene: Scene; width: number; testID?: string }): ReactElement {
  const drawn = useMemo(() => {
    const registry: Registry = { ...SCENE_ART_REGISTRY, ...Object.fromEntries(scene.items.map((i) => [i.id, i])) };
    return drawScene(scene.art, registry);
  }, [scene]);
  return (
    <Svg testID={testID} width={width} height={(width * 3) / 4} viewBox={drawn.viewBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {drawn.items.map((item) => (
        <Item key={item.key} item={item} />
      ))}
    </Svg>
  );
}

/** Memoised by the scene's identity: a scene is data and never changes while it is shown. */
export const HiddenHeritageSceneArt = memo(SceneBase);
