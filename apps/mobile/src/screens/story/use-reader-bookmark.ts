import type { StoryLevel } from '@hangul-route/content-schema';

/**
 * The reader's bookmark seam (F-STORY-002 §3.6). Bookmarks are F-STORY-004's
 * (device-local, per profile, scene level, `story:bookmarks:<profileId>`); its
 * PR 4.4b swaps this stub for `useStoryStore` with `clampScene`. Until then
 * every story opens on scene 1 and nothing is written. The reader calls
 * `save(index)` only in quest mode and only from scene 2 on
 * (`planSceneChange`); the replay route never saves.
 */
export interface ReaderBookmark {
  initialIndex: number;
  save: (index: number) => void;
}

const STUB: ReaderBookmark = Object.freeze({ initialIndex: 0, save: () => undefined });

export function useReaderBookmark(_profileId: string | null, _storyId: string, _level: StoryLevel): ReaderBookmark {
  return STUB;
}
