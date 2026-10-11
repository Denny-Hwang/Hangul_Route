import React, { useMemo } from 'react';
import type { MinigameScope } from '../../logic/minigame-config';
import { readGameHandlers, readGameTarget } from '../../logic/story/read-game';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useQuestRunStore } from '../../store/quest-run-store';
import { StoryReaderView } from '../story/StoryReaderView';
import { useReaderBookmark } from '../story/use-reader-bookmark';

interface Props {
  scope: MinigameScope;
  /** The shell's close (`minigame.finished`, then back); called after the step is marked complete. */
  onFinish: () => void;
  /** Back to the quest step without completing it (Close, the back gesture, the fallback's Back). */
  onBack: () => void;
}

/**
 * The `story-read` quest step (F-STORY-002 §3.1, §3.3, §3.6; wireframe
 * design/wireframes/story/reader.md; component spec
 * design/components/StoryReaderView/spec.md). The same reader as the replay
 * route, in quest mode: it opens on the learner's bookmark, saves one on each
 * scene change from scene 2 on, reports checkpoint rounds (PR 2.9) to the
 * quest run, and its end-page Continue completes the step. Reading itself
 * scores nothing. The rules are in `logic/story/read-game.ts`.
 */
export function StoryReadGame({ scope, onFinish, onBack }: Props): React.ReactElement {
  const { story, level } = useMemo(() => readGameTarget(scope), [scope]);
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const bookmark = useReaderBookmark(profileId, story?.id ?? scope.story?.storyId ?? '', level);

  // Rebuilt on every render on purpose: the shell's `onFinish` / `onBack` are new each render, and
  // the reader reads its callbacks through a live ref, so no effect re-runs on a new identity.
  // TODO(F-STORY-002 PR 2.8/2.9): localized story overlay (`localizeStory` with the UI locale) and
  // `narrationLang`, here and in StoryReaderScreen, once locale overlays for stories exist (§9).
  const handlers = readGameHandlers({
    saveBookmark: bookmark.save,
    answerRound: (roundKey, correct) => useQuestRunStore.getState().answerRound(roundKey, correct),
    markStepComplete: () => useQuestRunStore.getState().markStepComplete(),
    finish: onFinish,
    back: onBack,
  });

  return (
    <StoryReaderView
      story={story}
      level={level}
      mode="quest"
      initialIndex={bookmark.initialIndex}
      onSceneChange={handlers.onSceneChange}
      onAnswer={handlers.onAnswer}
      onFinish={handlers.onFinish}
      onClose={handlers.onClose}
    />
  );
}
