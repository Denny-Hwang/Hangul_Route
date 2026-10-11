import type { Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import { clampScene, resumeStepIndex, type Bookmark } from './bookmarks';
import { storyIdOfQuest, storyReadStep } from './story-ref';

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
 * ignored (§7 scenario 3).
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

/**
 * The story whose bookmark Results clears, right after the single score write
 * (§3.8): a story quest with a score written (`total > 0`). A run with every
 * game skipped writes no score, so the story stays unfinished and keeps its
 * bookmark.
 */
export function bookmarkClearedByResults(quest: Pick<Quest, 'steps'>, total: number): string | null {
  if (total <= 0) return null;
  return storyIdOfQuest(quest);
}

/** Scenes of the tier the reader plays; 0 for an unknown story or a missing level (the reader's fallback). */
export function sceneCountOf(story: Pick<Story, 'tiers'> | undefined, level: StoryLevel): number {
  return story?.tiers.find((t) => t.level === level)?.scenes.length ?? 0;
}
