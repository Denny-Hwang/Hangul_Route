import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useMessages } from '../../i18n/use-messages';
import type { BrowseStackParamList } from '../../navigation/browse';
import { useQuestRunStore } from '../../store/quest-run-store';
import { MinigameScreen } from '../minigames/MinigameScreen';
import { StoryReaderScreen } from '../story/StoryReaderScreen';
import { StorySourcesScreen } from '../story/StorySourcesScreen';
import { OopsScreen } from '../system/OopsScreen';
import { LeavePreviewSheet } from './LeavePreviewSheet';
import { PreviewFrame } from './PreviewFrame';
import { endPreview } from './preview-session';

/**
 * The learner's own lesson screens in the All lessons stack (F-BROWSE-001
 * section 4.7, BR-8), through the navigation adapter (BR-5c): every exit is a
 * browse route, so none of them names a learner route. No learner navigation
 * is passed, so they record no practice time, and the culture-note link is
 * left out (`null`). The game and the story reader sit under the preview strip;
 * the sources page is not a lesson screen and has no strip, and its links are
 * copy-only (`onOpenLink: null`: no Open, no PIN, no external navigation).
 */

/** The strip's [ Leave preview ] with its confirm, and the error screen's way back to the lesson page. */
function useLeave(toItem: () => void): { confirming: boolean; ask: () => void; keep: () => void; leave: () => void } {
  const [confirming, setConfirming] = useState(false);
  const leave = useCallback((): void => {
    setConfirming(false);
    toItem();
  }, [toItem]);
  return { confirming, ask: () => setConfirming(true), keep: () => setConfirming(false), leave };
}

type MinigameProps = NativeStackScreenProps<BrowseStackParamList, 'Minigame'>;

/** A game step of a previewed lesson: the learner game in its own host mode (`'quest'` or `'check'`). */
export function BrowseMinigameScreen({ route, navigation }: MinigameProps): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const { questId } = route.params;
  const toItem = useCallback((): void => {
    useQuestRunStore.getState().reset();
    endPreview(false);
    navigation.navigate('BrowseItem', { kind: 'quest', id: questId });
  }, [navigation, questId]);
  const { confirming, ask, keep, leave } = useLeave(toItem);
  return (
    <PreviewFrame onLeave={ask}>
      <ErrorBoundary fallbackRender={() => <OopsScreen onRetry={leave} actionLabel={m.end.back.cta} />}>
        <MinigameScreen route={route} onBack={() => navigation.goBack()} onHome={() => navigation.navigate('BrowseHome', {})} onOpenCultureNote={null} />
      </ErrorBoundary>
      <LeavePreviewSheet visible={confirming} onKeep={keep} onLeave={leave} />
    </PreviewFrame>
  );
}

type ReaderProps = NativeStackScreenProps<BrowseStackParamList, 'StoryReader'>;

/**
 * A previewed story: the learner replay reader (it writes nothing: no rounds,
 * no bookmark, no progress) under the strip. Done on its end page opens the
 * preview end screen; Close returns to the story page.
 */
export function BrowseStoryReaderScreen({ route, navigation }: ReaderProps): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const { storyId } = route.params;
  const toItem = useCallback((): void => {
    endPreview(false);
    navigation.navigate('BrowseItem', { kind: 'story', id: storyId });
  }, [navigation, storyId]);
  const { confirming, ask, keep, leave } = useLeave(toItem);
  // A preview left by the browser's own back still ends (once).
  useEffect(() => () => endPreview(false), []);
  return (
    <PreviewFrame onLeave={ask}>
      <ErrorBoundary fallbackRender={() => <OopsScreen onRetry={leave} actionLabel={m.end.back.cta} />}>
        <StoryReaderScreen
          route={route}
          onBack={toItem}
          onHome={() => navigation.navigate('BrowseHome', {})}
          onDone={() => {
            endPreview(true);
            navigation.replace('PreviewEnd', { kind: 'story', id: storyId });
          }}
          onOpenSources={(params) => navigation.navigate('StorySources', params)}
          onOpenCultureNote={null}
        />
      </ErrorBoundary>
      <LeavePreviewSheet visible={confirming} onKeep={keep} onLeave={leave} />
    </PreviewFrame>
  );
}

type SourcesProps = NativeStackScreenProps<BrowseStackParamList, 'StorySources'>;

/** A story's sources: Copy link only (there is no PIN in All lessons, and no external page opens from it). */
export function BrowseStorySourcesScreen({ route, navigation }: SourcesProps): React.ReactElement {
  return (
    <StorySourcesScreen
      route={route}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('BrowseHome', {}))}
      onHome={() => navigation.navigate('BrowseHome', {})}
      onOpenLink={null}
    />
  );
}
