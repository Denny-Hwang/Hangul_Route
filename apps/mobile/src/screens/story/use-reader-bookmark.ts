import type { StoryLevel } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bookmarkResumedEvent, bookmarkTarget, readerStart } from '../../logic/story/resume';
import { track } from '../../platform/telemetry';
import { useStoryStore } from '../../store/story-store';

/**
 * The reader's bookmark seam (F-STORY-002 §3.6), wired to F-STORY-004's
 * bookmarks (§3.8, PR 4.4b): device-local, per profile, scene level,
 * `story:bookmarks:<profileId>`. On mount it reads the profile's bookmark of
 * the story once and opens on its scene (`readerStart`: same level only,
 * clamped to `sceneCount`), firing `story.bookmark.resumed` when that is a
 * restored scene. `save(index)` writes through `useStoryStore`, which keeps
 * only scene 2 on. The reader calls `save` only in quest mode
 * (`planSceneChange`); the replay route never uses this hook.
 */
export interface ReaderBookmark {
  initialIndex: number;
  save: (index: number) => void;
}

export function useReaderBookmark(
  profileId: string | null,
  storyId: string,
  level: StoryLevel,
  sceneCount: number,
): ReaderBookmark {
  // Read once per mount: the reader takes its first scene from it only when it mounts.
  const [start] = useState(() => {
    const target = bookmarkTarget(profileId, storyId);
    const bookmark = target ? useStoryStore.getState().getBookmark(target.profileId, target.storyId) : undefined;
    return readerStart(bookmark, level, sceneCount);
  });

  const resumedSent = useRef(false);
  useEffect(() => {
    const event = bookmarkResumedEvent(profileId, storyId, start);
    if (!event || resumedSent.current) return;
    resumedSent.current = true;
    void track(event);
  }, [profileId, storyId, start]);

  const save = useCallback(
    (index: number): void => {
      const target = bookmarkTarget(profileId, storyId);
      if (!target) return;
      useStoryStore.getState().setBookmark(target.profileId, target.storyId, { level, sceneIndex: index });
    },
    [profileId, storyId, level],
  );

  return useMemo(() => ({ initialIndex: start.initialIndex, save }), [start.initialIndex, save]);
}
