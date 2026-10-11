import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { borderWidth, colors, radii } from '../../tokens';
import type { DrawItem } from '../../scene-art/draw';
import { SCENE_ART_REGISTRY } from '../../scene-art/registry';
import { FALLBACK_TINT_OPACITY, storySceneModel } from '../../scene-art/story-scene-model';
import { HeritageCardArt } from '../HeritageCardArt';
import type { StorySceneProps } from './types';

/**
 * StoryScene — a story scene's picture (F-STORY-002 §3.9.9), drawn from data
 * with react-native-svg. What to draw and what to say is decided in
 * `scene-art/story-scene-model.ts`; this only paints it. A missing or
 * unresolvable picture is a tinted panel (with `fallback` centred), never a
 * broken image or an error box. Design: design/components/StoryScene/spec.md.
 */

const TAGS = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon } as const;

function Item({ item }: { item: DrawItem }): React.ReactElement {
  if (item.tag === 'card') {
    return (
      <G transform={item.transform}>
        <HeritageCardArt cardId={item.ref} size={item.size} accessibilityLabel="" />
      </G>
    );
  }
  const Tag = TAGS[item.tag] as React.ComponentType<Record<string, unknown>>;
  return <Tag {...item.geometry} {...item.paint} transform={item.transform} />;
}

function StorySceneBase({ art, theme, variant, width, fallback, decorative, accessibilityLabel, onResolveIssue, testID }: StorySceneProps): React.ReactElement {
  const model = useMemo(
    () => storySceneModel({ art, theme, variant, width, decorative, accessibilityLabel }, SCENE_ART_REGISTRY),
    [art, theme, variant, width, decorative, accessibilityLabel],
  );
  const { issues } = model;

  useEffect(() => {
    if (issues.length > 0) onResolveIssue?.(issues);
  }, [issues, onResolveIssue]);

  const flagged = __DEV__ && issues.length > 0;
  return (
    <View
      testID={testID}
      accessible={model.label !== undefined}
      accessibilityRole={model.label !== undefined ? 'image' : undefined}
      accessibilityLabel={model.label}
      accessibilityElementsHidden={model.decorative}
      importantForAccessibility={model.decorative ? 'no-hide-descendants' : undefined}
      style={{
        width: model.width,
        height: model.height,
        borderRadius: radii.lg,
        overflow: 'hidden',
        ...(flagged ? { borderWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.strong } : {}),
      }}
    >
      {model.scene ? (
        <Svg width={model.width} height={model.height} viewBox={model.scene.viewBox}>
          {model.scene.items.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </Svg>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.theme[model.theme], opacity: FALLBACK_TINT_OPACITY }} />
          {fallback}
        </View>
      )}
    </View>
  );
}

/** Memoised by `art` identity: a scene is data and never changes while it is shown. */
export const StoryScene = React.memo(StorySceneBase);
