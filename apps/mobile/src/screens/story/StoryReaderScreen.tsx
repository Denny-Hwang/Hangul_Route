import { Screen } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { storyById } from '../../content/stories';
import { backOrHome, resolveOptionalExit, resolveScreenExits, type ScreenExitProps } from '../../logic/navigation/screen-exits';
import { sourcesRouteParams, type SourcesRouteParams } from '../../logic/story/source-link';
import { useLocale } from '../../i18n/use-messages';
import { readerStory } from '../../logic/story/reader-locale';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useStoryReady } from '../story-content';
import { usePracticeSession } from '../use-practice-session';
import { StoryReaderView } from './StoryReaderView';
import { useStoryNotesFound } from './use-story-notes-found';

/**
 * The learner stack passes `route` and `navigation`; another host (All lessons, F-BROWSE-001 §4.7)
 * passes `route` and the exits (`onBack`, `onHome`, `onOpenSources`) instead.
 */
type Props = {
  route: { params: RootStackParamList['StoryReader'] };
  navigation?: Pick<NativeStackScreenProps<RootStackParamList, 'StoryReader'>['navigation'], 'canGoBack' | 'goBack' | 'navigate' | 'push'>;
  /** Opens Sources over the reader; the learner default is the `StorySources` route. */
  onOpenSources?: (params: SourcesRouteParams) => void;
  /**
   * Done on the end page; the learner default leaves as Close does. All lessons shows its preview end
   * screen instead (F-BROWSE-001 section 4.8).
   */
  onDone?: () => void;
  /**
   * The note card's "More in Culture notes" (F-STORY-004 PR 4.7); the learner default pushes
   * `CultureNotes { noteId }`. `null`, or no learner stack, draws no button.
   */
  onOpenCultureNote?: ((noteId: string) => void) | null;
} & ScreenExitProps;

const NOTHING = (): void => undefined;

/**
 * The replay route `StoryReader { storyId, level, mode: 'replay', sceneIndex? }`
 * (F-STORY-002 §3.1, §3.6): the same reader as the quest step, unscored and
 * writing nothing — no rounds, no step completion, no bookmark, no progress.
 * Entered from "Read it again" (F-STORY-003 Results, F-STORY-004 shelf and
 * episode page). Done, Close and the back gesture return to where it came from.
 * On the learner stack it records practice time (F-REPORT-001 section 3.3.2)
 * in a learning session that keeps the local-day run (F-CURR-002 OD-14).
 * Sources (top bar and end page, PR 2.7) opens `StorySources` on top of it.
 */
export function StoryReaderScreen(props: Props): React.ReactElement {
  // The story's scenes come from its chunk (F-CURR-002 §10, row CM-8): until it is in, the screen draws nothing.
  return useStoryReady(props.route.params.storyId) ? <StoryReaderBody {...props} /> : <Screen>{null}</Screen>;
}

function StoryReaderBody({ route, navigation, onOpenSources, onOpenCultureNote, onDone, ...exitProps }: Props): React.ReactElement {
  const { storyId, level, sceneIndex } = route.params;
  const locale = useLocale();
  // The story in the UI language, with the voice of the narration shown in each scene (PR 2.8).
  const source = useMemo(() => storyById(storyId), [storyId]);
  const { story, narrationLangs } = useMemo(() => readerStory(source, level, locale), [source, level, locale]);
  // Another host (All lessons) passes no navigation and records nothing (F-REPORT-001 section 3.3.2).
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id);
  // A story is a learning activity: it keeps the local-day run (F-CURR-002 OD-14).
  usePracticeSession(profileId, navigation ? `story:${storyId}` : null, true);

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

  // Only once the story's notes are found: the screen lists found notes only.
  const notesFound = useStoryNotesFound(storyId);
  const openCultureNote = useMemo(() => {
    const exit = resolveOptionalExit(
      onOpenCultureNote,
      navigation ? (noteId: string): void => navigation.push('CultureNotes', { noteId }) : undefined,
    );
    return notesFound ? exit : undefined;
  }, [navigation, onOpenCultureNote, notesFound]);

  return (
    <StoryReaderView
      story={story}
      level={level}
      mode="replay"
      initialIndex={sceneIndex ?? 0}
      onSceneChange={NOTHING}
      onAnswer={NOTHING}
      onFinish={onDone ?? leave}
      onClose={leave}
      onOpenSources={openSources}
      onOpenCultureNote={openCultureNote}
      narrationLangs={narrationLangs}
      sourceStory={source}
    />
  );
}
