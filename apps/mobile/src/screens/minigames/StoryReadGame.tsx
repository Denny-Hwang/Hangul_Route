import React, { useMemo } from 'react';
import { useLocale } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { readGameHandlers, readGameTarget } from '../../logic/story/read-game';
import { readerStory } from '../../logic/story/reader-locale';
import { sceneCountOf } from '../../logic/story/resume';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useQuestRunStore } from '../../store/quest-run-store';
import { StoryReaderView } from '../story/StoryReaderView';
import { useReaderBookmark } from '../story/use-reader-bookmark';
import { useStoryNotesFound } from '../story/use-story-notes-found';

interface Props {
  scope: MinigameScope;
  /** The shell's close (`minigame.finished`, then back); called after the step is marked complete. */
  onFinish: () => void;
  /** Back to the quest step without completing it (Close, the back gesture, the fallback's Back). */
  onBack: () => void;
  /** "More in Culture notes", from the game shell (`MinigameScreen`); drawn only once the story's notes are found. */
  onOpenCultureNote?: (noteId: string) => void;
}

/**
 * The `story-read` quest step (F-STORY-002 §3.1, §3.3, §3.6; wireframe
 * design/wireframes/story/reader.md; component spec
 * design/components/StoryReaderView/spec.md). The same reader as the replay
 * route, in quest mode: it opens on the learner's bookmark, saves one on each
 * scene change from scene 2 on, reports checkpoint rounds (the inline card, PR 2.9) to the
 * quest run, and its end-page Continue completes the step. Reading itself
 * scores nothing. The rules are in `logic/story/read-game.ts`.
 */
export function StoryReadGame({ scope, onFinish, onBack, onOpenCultureNote }: Props): React.ReactElement {
  const locale = useLocale();
  const { story: source, level } = useMemo(() => readGameTarget(scope), [scope]);
  // The story in the UI language, with the voice of the narration shown in each scene (PR 2.8).
  const { story, narrationLangs } = useMemo(() => readerStory(source, level, locale), [source, level, locale]);
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const storyId = story?.id ?? scope.story?.storyId ?? '';
  const bookmark = useReaderBookmark(profileId, storyId, level, sceneCountOf(story, level));
  // On a first read the notes are not found yet, so the screen would not show the note: no button.
  const notesFound = useStoryNotesFound(storyId);

  // Rebuilt on every render on purpose: the shell's `onFinish` / `onBack` are new each render, and
  // the reader reads its callbacks through a live ref, so no effect re-runs on a new identity.
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
      onOpenCultureNote={notesFound ? onOpenCultureNote : undefined}
      narrationLangs={narrationLangs}
      sourceStory={source}
    />
  );
}
