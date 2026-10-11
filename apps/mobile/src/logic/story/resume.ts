import type { Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import { clampScene, resumeStepIndex, type Bookmark } from './bookmarks';
import { levelOfQuest, storyIdOfQuest, storyReadStep } from './story-ref';

/**
 * Continue where you left off (F-STORY-004 §3.8, PR 4.4b): the rules the
 * quest player, the reader's bookmark seam (F-STORY-002 §3.6) and Results
 * wire to `useStoryStore`. Every fallback is silent: a missing bookmark, one
 * for another level or an unreadable one means step 0 and scene 0.
 */

/** Looks up the active profile's bookmark of a story. */
export type BookmarkOf = (storyId: string) => Bookmark | undefined;

/**
 * Where `QuestPlayer` starts. With `resume` and a bookmark of the quest's
 * story at the quest's level, the `story-read` step (the intro is skipped);
 * otherwise step 0. No bookmark is read without `resume`.
 */
export function questStartStep(
  quest: Pick<Quest, 'steps'> | undefined,
  resume: boolean | undefined,
  bookmarkOf: BookmarkOf,
): number {
  if (!resume || !quest) return 0;
  const read = storyReadStep(quest);
  if (!read) return 0;
  return resumeStepIndex(quest, bookmarkOf(read.ref.storyId));
}

export interface ReaderStart {
  /** The scene the quest-mode reader opens on. */
  initialIndex: number;
  /** True when that is a restored scene (past scene 0): `story.bookmark.resumed` fires. */
  resumed: boolean;
}

/**
 * The scene a quest-mode reader opens on: the bookmark's, kept inside a story
 * that may have got shorter (`clampScene`). A bookmark for another level is
 * ignored (§7 scenario 3). It does not depend on how the quest was started:
 * a plain start (no `resume`) still opens on a same-level bookmark, as
 * F-STORY-002 §3.6 and F-STORY-004 §3.8 ("reads getBookmark on mount") say.
 */
export function readerStart(bookmark: Bookmark | undefined, level: StoryLevel, sceneCount: number): ReaderStart {
  const initialIndex = clampScene(bookmark?.level === level ? bookmark : undefined, sceneCount);
  return { initialIndex, resumed: initialIndex > 0 };
}

/** The `story.bookmark.resumed` payload (§3.11: ids and counts only), or null when nothing was restored. */
export function bookmarkResumedPayload(
  storyId: string,
  start: ReaderStart,
): { storyId: string; sceneIndex: number } | null {
  if (!start.resumed || storyId === '') return null;
  return { storyId, sceneIndex: start.initialIndex };
}

/** The `story.bookmark.resumed` event, with the profile when there is one; null when nothing was restored. */
export function bookmarkResumedEvent(
  profileId: string | null,
  storyId: string,
  start: ReaderStart,
): { name: 'story.bookmark.resumed'; profileId?: string; payload: { storyId: string; sceneIndex: number } } | null {
  const payload = bookmarkResumedPayload(storyId, start);
  if (!payload) return null;
  return { name: 'story.bookmark.resumed', ...(profileId === null ? {} : { profileId }), payload };
}

/** Whose bookmark of which story the reader reads and writes; null (nothing read or written) with no profile or no story. */
export function bookmarkTarget(
  profileId: string | null,
  storyId: string,
): { profileId: string; storyId: string } | null {
  if (profileId === null || storyId === '') return null;
  return { profileId, storyId };
}

/**
 * The story whose bookmark Results clears, right after the single score write
 * (§3.8): a story quest with a score written (`total > 0`) whose stored
 * bookmark is for the quest's level. A run with every game skipped writes no
 * score, so the story stays unfinished and keeps its bookmark. A bookmark for
 * another level of the story is kept too: only that (story, level) is
 * finished, the rule `pruneBookmarks` follows.
 */
export function bookmarkClearedByResults(
  quest: Pick<Quest, 'steps'>,
  total: number,
  bookmarkOf: BookmarkOf,
): string | null {
  if (total <= 0) return null;
  const storyId = storyIdOfQuest(quest);
  if (storyId === null) return null;
  const bookmark = bookmarkOf(storyId);
  return bookmark !== undefined && bookmark.level === levelOfQuest(quest) ? storyId : null;
}

/** Scenes of the tier the reader plays; 0 for an unknown story or a missing level (the reader's fallback). */
export function sceneCountOf(story: Pick<Story, 'tiers'> | undefined, level: StoryLevel): number {
  return story?.tiers.find((t) => t.level === level)?.scenes.length ?? 0;
}
