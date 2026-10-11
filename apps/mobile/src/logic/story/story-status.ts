import type { ProgressSnapshot } from '@hangul-route/content-schema';
import type { Bookmark, BookmarkFile } from './bookmarks';
import type { StoryIndexEntry } from './story-index';

/**
 * Where a learner is with one story entry (F-STORY-004 §3.2): finished when
 * the entry's quest has a `completedAt`; in progress when a bookmark of the
 * same level exists and it is not finished; otherwise new. Stars only on a
 * finish (a 0-star finish stays 0: no empty stars are drawn, D3).
 */

export type StoryState = 'new' | 'in-progress' | 'finished';

export interface StoryStatus {
  state: StoryState;
  stars: 0 | 1 | 2 | 3;
  /** Only when `state` is `in-progress`. */
  bookmark?: Bookmark;
}

export function storyStatus(
  entry: Pick<StoryIndexEntry, 'storyId' | 'questId' | 'level'>,
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined,
  bookmarks: BookmarkFile,
): StoryStatus {
  const progress = snapshot?.quests.find((q) => q.questId === entry.questId);
  if (progress?.completedAt) return { state: 'finished', stars: progress.stars };
  const bookmark = bookmarks.byStory[entry.storyId];
  if (bookmark && bookmark.level === entry.level) return { state: 'in-progress', stars: 0, bookmark };
  return { state: 'new', stars: 0 };
}
