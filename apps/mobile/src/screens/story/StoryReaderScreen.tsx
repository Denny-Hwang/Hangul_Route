import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { storyById } from '../../content/stories';
import { backOrHome, resolveScreenExits, type ScreenExitProps } from '../../logic/navigation/screen-exits';
import { sourcesRouteParams, type SourcesRouteParams } from '../../logic/story/source-link';
import { useLocale } from '../../i18n/use-messages';
import { readerStory } from '../../logic/story/reader-locale';
import type { RootStackParamList } from '../../navigation/types';
import { StoryReaderView } from './StoryReaderView';

/**
 * The learner stack passes `route` and `navigation`; another host (All lessons, F-BROWSE-001 §4.7)
 * passes `route` and the exits (`onBack`, `onHome`, `onOpenSources`) instead.
 */
type Props = {
  route: { params: RootStackParamList['StoryReader'] };
  navigation?: Pick<NativeStackScreenProps<RootStackParamList, 'StoryReader'>['navigation'], 'canGoBack' | 'goBack' | 'navigate'>;
  /** Opens Sources over the reader; the learner default is the `StorySources` route. */
  onOpenSources?: (params: SourcesRouteParams) => void;
} & ScreenExitProps;

const NOTHING = (): void => undefined;

/**
 * The replay route `StoryReader { storyId, level, mode: 'replay', sceneIndex? }`
 * (F-STORY-002 §3.1, §3.6): the same reader as the quest step, unscored and
 * writing nothing — no rounds, no step completion, no bookmark, no progress.
 * Entered from "Read it again" (F-STORY-003 Results, F-STORY-004 shelf and
 * episode page). Done, Close and the back gesture return to where it came from.
 * Sources (top bar and end page, PR 2.7) opens `StorySources` on top of it.
 */
export function StoryReaderScreen({ route, navigation, onOpenSources, ...exitProps }: Props): React.ReactElement {
  const { storyId, level, sceneIndex } = route.params;
  const locale = useLocale();
  // The story in the UI language, with the voice of the narration shown in each scene (PR 2.8).
  const source = useMemo(() => storyById(storyId), [storyId]);
  const { story, narrationLangs } = useMemo(() => readerStory(source, level, locale), [source, level, locale]);

  // Learner defaults: back where it came from, else Home; Sources is the `StorySources` route.
  const { onBack, onHome } = exitProps;
  const exits = useMemo(() => {
    const home = onHome ?? ((): void => navigation?.navigate('Main', { screen: 'Home' }));
    return resolveScreenExits(
      { onBack, onHome },
      { back: () => (navigation ? backOrHome(navigation, home) : home()), home, openLink: () => undefined },
    );
  }, [navigation, onBack, onHome]);
  const leave = exits.back;

  const openSources = useCallback(
    (from: 'reader' | 'end', index: number): void => {
      const params = sourcesRouteParams(storyId, from, index);
      if (onOpenSources) onOpenSources(params);
      else navigation?.navigate('StorySources', params);
    },
    [navigation, onOpenSources, storyId],
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
      onOpenCultureNote={(noteId) => navigation.navigate('CultureNotes', { noteId })}
      narrationLangs={narrationLangs}
      sourceStory={source}
    />
  );
}
