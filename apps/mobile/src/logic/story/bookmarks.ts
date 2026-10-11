import type { ProgressSnapshot, Quest, StoryLevel } from '@hangul-route/content-schema';
import { z } from 'zod';
import { parseStoryMinigameRef } from './story-ref';

/**
 * Story bookmarks (F-STORY-004 §3.1, §3.8): the scene a learner reached in an
 * unfinished story. Device-local, one file per profile, never synced and never
 * part of a backup or a rescue-code restore (§3.13). Pure reducers over a
 * `BookmarkFile`; `store/story-store.ts` owns reading and writing it.
 */

export const BookmarkSchema = z.object({
  level: z.enum(['listen', 'read-along', 'read']),
  sceneIndex: z.number().int().min(0).max(40),
  updatedAt: z.string(), // ISO
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const BookmarkFileSchema = z.object({
  v: z.literal(1),
  byStory: z.record(z.string(), BookmarkSchema), // key = storyId
});
export type BookmarkFile = z.infer<typeof BookmarkFileSchema>;

/** At most this many bookmarks are kept; the oldest `updatedAt` goes first. */
export const BOOKMARK_LIMIT = 20;

/** Storage key under `platform/storage` (which adds the `hr:` prefix). */
export function bookmarksKey(profileId: string): string {
  return `story:bookmarks:${profileId}`;
}

export function emptyBookmarks(): BookmarkFile {
  return { v: 1, byStory: {} };
}

/** True when `storyId` has been finished at `level` (its quest has a `completedAt`). */
export type FinishedCheck = (storyId: string, level: StoryLevel) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Newest first; ties by story id (keys are unique) so the order never depends on insertion. */
function newestFirst([aId, a]: [string, Bookmark], [bId, b]: [string, Bookmark]): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return aId < bId ? -1 : 1;
}

/**
 * Drops the bookmarks of stories finished at their level, then keeps the
 * newest `limit`. Returns the same file when nothing is dropped.
 */
export function pruneBookmarks(
  file: BookmarkFile,
  options: { isFinished?: FinishedCheck; limit?: number } = {},
): BookmarkFile {
  const { isFinished, limit = BOOKMARK_LIMIT } = options;
  const entries = Object.entries(file.byStory);
  const kept = entries
    .filter(([storyId, bookmark]) => !isFinished?.(storyId, bookmark.level))
    .sort(newestFirst)
    .slice(0, limit);
  if (kept.length === entries.length) return file;
  return { v: 1, byStory: Object.fromEntries(kept) };
}

/**
 * A saved value as a `BookmarkFile`. Anything that is not a v1 file (nothing
 * saved, garbage, another version) is empty, never thrown; inside a v1 file a
 * broken entry is dropped on its own so it cannot take the others with it.
 */
export function parseBookmarkFile(raw: unknown): BookmarkFile {
  if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.byStory)) return emptyBookmarks();
  const byStory: Record<string, Bookmark> = {};
  for (const [storyId, value] of Object.entries(raw.byStory)) {
    const parsed = BookmarkSchema.safeParse(value);
    if (parsed.success) byStory[storyId] = parsed.data;
  }
  return pruneBookmarks({ v: 1, byStory });
}

/**
 * Records the scene reached. Only scene 1 and later is a bookmark (opening a
 * story is not progress); an index the schema would reject writes nothing, so
 * a bad call can never make the saved file unreadable. Returns the same file
 * when nothing is written.
 */
export function setBookmark(
  file: BookmarkFile,
  storyId: string,
  at: { level: StoryLevel; sceneIndex: number },
  now: string,
): BookmarkFile {
  const bookmark: Bookmark = { level: at.level, sceneIndex: at.sceneIndex, updatedAt: now };
  if (at.sceneIndex < 1 || !BookmarkSchema.safeParse(bookmark).success) return file;
  return pruneBookmarks({ v: 1, byStory: { ...file.byStory, [storyId]: bookmark } });
}

/** Forgets the story's bookmark; the same file when it had none. */
export function clearBookmark(file: BookmarkFile, storyId: string): BookmarkFile {
  if (!(storyId in file.byStory)) return file;
  const { [storyId]: _cleared, ...rest } = file.byStory;
  return { v: 1, byStory: rest };
}

/**
 * Writes made before the saved file loaded, merged with it: every story of
 * both, the newer bookmark of a story in both, and none of the stories cleared
 * in that window (they were cleared after the saved copy was written).
 */
export function mergeBookmarks(
  unsaved: BookmarkFile,
  saved: BookmarkFile,
  clearedBeforeLoad: ReadonlySet<string> = new Set(),
): BookmarkFile {
  const byStory: Record<string, Bookmark> = {};
  for (const [storyId, bookmark] of Object.entries(saved.byStory)) {
    if (!clearedBeforeLoad.has(storyId)) byStory[storyId] = bookmark;
  }
  for (const [storyId, bookmark] of Object.entries(unsaved.byStory)) {
    const other = byStory[storyId];
    if (!other || bookmark.updatedAt >= other.updatedAt) byStory[storyId] = bookmark;
  }
  return pruneBookmarks({ v: 1, byStory });
}

/** The story and level of a quest's `story-read` step, or null for any other quest. */
function storyReadStep(quest: Pick<Quest, 'steps'>): { index: number; storyId: string; level: StoryLevel } | null {
  const index = quest.steps.findIndex((s) => s.minigameKind === 'story-read');
  const ref = index === -1 ? undefined : quest.steps[index]?.minigameRef;
  const parsed = ref ? parseStoryMinigameRef(ref) : null;
  return parsed ? { index, storyId: parsed.storyId, level: parsed.level } : null;
}

/**
 * Which (story, level) pairs the learner has finished: a story quest with a
 * `completedAt`. A bookmark of a finished pair is ignored and pruned (§3.8),
 * for example when the story was finished on another device.
 */
export function finishedStoryLevels(
  quests: readonly Pick<Quest, 'id' | 'steps'>[],
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined,
): FinishedCheck {
  const done = new Set((snapshot?.quests ?? []).filter((q) => q.completedAt).map((q) => q.questId));
  const finished = new Set<string>();
  for (const quest of quests) {
    if (!done.has(quest.id)) continue;
    const read = storyReadStep(quest);
    if (read) finished.add(`${read.storyId}|${read.level}`);
  }
  return (storyId, level) => finished.has(`${storyId}|${level}`);
}

/**
 * Where a resumed quest starts (§3.8): its `story-read` step, skipping the
 * intro, when the bookmark is for the quest's level; otherwise step 0.
 */
export function resumeStepIndex(quest: Pick<Quest, 'steps'>, bookmark: Bookmark | undefined): number {
  if (!bookmark) return 0;
  const read = storyReadStep(quest);
  return read && read.level === bookmark.level ? read.index : 0;
}

/** The scene the reader opens on: the bookmark's, kept inside a story that may have got shorter. */
export function clampScene(bookmark: Bookmark | undefined, sceneCount: number): number {
  if (!bookmark || sceneCount < 1) return 0;
  return Math.min(bookmark.sceneIndex, sceneCount - 1);
}
