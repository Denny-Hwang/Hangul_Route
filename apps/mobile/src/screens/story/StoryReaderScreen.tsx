import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { storyById } from '../../content/stories';
import { sourcesRouteParams } from '../../logic/story/source-link';
import type { RootStackParamList } from '../../navigation/types';
import { StoryReaderView } from './StoryReaderView';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryReader'>;

const NOTHING = (): void => undefined;

/**
 * The replay route `StoryReader { storyId, level, mode: 'replay', sceneIndex? }`
 * (F-STORY-002 §3.1, §3.6): the same reader as the quest step, unscored and
 * writing nothing — no rounds, no step completion, no bookmark, no progress.
 * Entered from "Read it again" (F-STORY-003 Results, F-STORY-004 shelf and
 * episode page). Done, Close and the back gesture return to where it came from.
 * Sources (top bar and end page, PR 2.7) opens `StorySources` on top of it.
 */
export function StoryReaderScreen({ route, navigation }: Props): React.ReactElement {
  const { storyId, level, sceneIndex } = route.params;
  const story = useMemo(() => storyById(storyId), [storyId]);

  const leave = useCallback((): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  }, [navigation]);

  const openSources = useCallback(
    (from: 'reader' | 'end', index: number): void => navigation.navigate('StorySources', sourcesRouteParams(storyId, from, index)),
    [navigation, storyId],
  );

  return (
    <StoryReaderView
      story={story}
      level={level}
      mode="replay"
      initialIndex={sceneIndex ?? 0}
      onSceneChange={NOTHING}
      onAnswer={NOTHING}
      onFinish={leave}
      onClose={leave}
      onOpenSources={openSources}
    />
  );
}
