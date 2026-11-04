import { useMemo } from 'react';
import { storiesAll } from '../../content/stories';
import { foundNotes } from '../../logic/story/culture-notes';
import { storyNotesFound } from '../../logic/story/culture-notes-view';
import { defaultStoryIndex } from '../../logic/story/story-index';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { useNoteStoriesLoaded } from '../story-content';

/**
 * Whether the active learner has found this story's culture notes (a quest of
 * the story finished): the reader's hosts draw "More in Culture notes" only
 * then, since the screen lists found notes only (F-STORY-004 §3.5, PR 4.7).
 * A hook over the tested stores and the pure rule (`storyNotesFound`), like
 * `use-messages.ts`, with no unit test of its own.
 */
export function useStoryNotesFound(storyId: string): boolean {
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  // A note's sources come from its story's chunk (F-CURR-002 §10).
  const noteChunks = useNoteStoriesLoaded();
  // A book 2 tale (F-CURR-002 row CM-46) is in the index with the later volumes, read while `volumes` is on.
  const volumesOn = useCurrFlag('volumes');
  return useMemo(
    () => storyNotesFound(foundNotes(defaultStoryIndex({ volumes: volumesOn }), storiesAll, snap), storyId),
    [snap, storyId, noteChunks, volumesOn],
  );
}
