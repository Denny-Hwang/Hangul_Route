import { StoryScene } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { LectureSceneView } from '../../../logic/lecture/sources/story';
import { SCENE_STAGE, units } from '../../../logic/lecture/stage-constants';
import { STAGE_RADIUS } from '../stage-metrics';
import { usePresenterView } from '../presenter-context';

/**
 * A story scene on the stage (slide-story.md, slide-title.md): F-STORY-002's `StoryScene` at 400 x
 * 300 units with the stage radius. Its accessible name is the scene caption (README D8), which is
 * never drawn. A scene with no art yet is the story theme's tinted panel.
 */
export function StoryArt({ scene, testID }: { scene: LectureSceneView | undefined; testID?: string }): React.ReactElement {
  const { unit } = usePresenterView();
  const width = units(unit, SCENE_STAGE);
  return (
    <View style={{ width, borderRadius: units(unit, STAGE_RADIUS), overflow: 'hidden', flexShrink: 0 }}>
      <StoryScene
        testID={testID}
        art={scene?.art ?? null}
        {...(scene ? { theme: scene.theme } : {})}
        width={width}
        {...(scene && scene.label !== '' ? { accessibilityLabel: scene.label } : { decorative: true })}
      />
    </View>
  );
}
