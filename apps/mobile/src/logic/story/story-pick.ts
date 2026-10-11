import type { ProgressSnapshot } from '@hangul-route/content-schema';
import type { Bookmark, BookmarkFile } from './bookmarks';
import { compareShelfOrder, type ShelfCategory, type StoryIndexEntry } from './story-index';

/**
 * Which story to offer (F-STORY-004 §3.4, §3.7; F-STORY-003 §3.7 "Next story").
 * One chain for Home and the Library hero tile:
 *
 *   1. continue — a bookmark at the entry's level, quest not finished; newest first
 *   2. next     — the first unfinished shelf entry (Story Time, then Culture, then
 *                 order); once every shelf story is finished, the first unfinished
 *                 book (grid) story quest
 *   3. again    — the finished story with the oldest finish, as an unscored replay
 *
 * Locked and excluded entries are never offered. Nothing here is gated by
 * progress: `fits` (F-STORY-005 StoryFit) only moves fitting stories forward.
 */

export type StoryReason = 'continue' | 'next' | 'again';

export interface StoryPick {
  entry: StoryIndexEntry;
  reason: StoryReason;
  /** `replay` opens the reader unscored (`StoryReader { mode: 'replay' }`). */
  mode: 'play' | 'replay';
  /** The bookmark a `continue` pick resumes from. */
  bookmark?: Bookmark;
}

export interface StoryPickInput {
  entries: readonly StoryIndexEntry[];
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  bookmarks: BookmarkFile;
  /** `isContentLocked('story', id)` for the learner; always false while gating is off. */
  isLocked: (storyId: string) => boolean;
  /** Stories already on the plan (another card), never picked twice. */
  excludeStoryIds?: readonly string[];
  /** Quests already on the plan (e.g. the Journey card). */
  excludeQuestIds?: readonly string[];
  /** F-STORY-005 §3.4: stories that fit the learner come first among `next`; the order is otherwise kept. */
  fits?: (entry: StoryIndexEntry) => boolean;
}

/** Ascending ISO-time order; equal times keep their place (the sort is stable). */
function byTime(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function completedAtOf(input: Pick<StoryPickInput, 'snapshot'>): Map<string, string> {
  const done = new Map<string, string>();
  for (const q of input.snapshot?.quests ?? []) if (q.completedAt) done.set(q.questId, q.completedAt);
  return done;
}

function offerable(input: StoryPickInput): StoryIndexEntry[] {
  const stories = new Set(input.excludeStoryIds ?? []);
  const quests = new Set(input.excludeQuestIds ?? []);
  return input.entries
    .filter((e) => !stories.has(e.storyId) && !quests.has(e.questId) && !input.isLocked(e.storyId))
    .sort(compareShelfOrder);
}

/** Fitting entries first, each part in its existing order. */
function fitFirst(entries: StoryIndexEntry[], fits: StoryPickInput['fits']): StoryIndexEntry[] {
  if (!fits) return entries;
  return [...entries.filter(fits), ...entries.filter((e) => !fits(e))];
}

function pickFrom(candidates: StoryIndexEntry[], input: StoryPickInput): StoryPick | null {
  const done = completedAtOf(input);

  const resumable = candidates
    .map((entry) => ({ entry, bookmark: input.bookmarks.byStory[entry.storyId] }))
    .filter(
      (c): c is { entry: StoryIndexEntry; bookmark: Bookmark } =>
        c.bookmark !== undefined && c.bookmark.level === c.entry.level && !done.has(c.entry.questId),
    );
  // Newest first; equal times keep shelf order.
  resumable.sort((a, b) => byTime(b.bookmark.updatedAt, a.bookmark.updatedAt));
  const resume = resumable[0];
  if (resume) return { entry: resume.entry, reason: 'continue', mode: 'play', bookmark: resume.bookmark };

  const unfinished = candidates.filter((e) => !done.has(e.questId));
  const next =
    fitFirst(unfinished.filter((e) => e.placement === 'shelf'), input.fits)[0] ??
    unfinished.find((e) => e.placement === 'grid');
  if (next) return { entry: next, reason: 'next', mode: 'play' };

  const finished = candidates
    .filter((e) => done.has(e.questId))
    .sort((a, b) => byTime(done.get(a.questId) as string, done.get(b.questId) as string));
  const again = finished[0];
  return again ? { entry: again, reason: 'again', mode: 'replay' } : null;
}

/** The Home "Story time" card (§3.7); null when no story applies. */
export function pickStoryForHome(input: StoryPickInput): StoryPick | null {
  return pickFrom(offerable(input), input);
}

/** The Library hero tile of one shelf category (§3.4): the same chain, inside the category. */
export function pickedForYou(input: StoryPickInput & { category: ShelfCategory }): StoryPick | null {
  const candidates = offerable(input).filter((e) => e.placement === 'shelf' && e.category === input.category);
  return pickFrom(candidates, input);
}

/**
 * The quest Results offers as "Next story" (F-STORY-003 §3.7): within the
 * same book (episode) for a book quest, within the same shelf category for a
 * shelf quest, walking forward from the current one and wrapping; the first
 * unfinished, unlocked, not excluded entry. Null when there is none.
 */
export function nextStoryAfter(questId: string, input: StoryPickInput): StoryIndexEntry | null {
  const current = input.entries.find((e) => e.questId === questId);
  if (!current) return null;
  const group =
    current.placement === 'grid'
      ? input.entries.filter((e) => e.episodeId === current.episodeId)
      : input.entries.filter((e) => e.placement === 'shelf' && e.category === current.category).sort(compareShelfOrder);
  const at = group.indexOf(current);
  const walk = [...group.slice(at + 1), ...group.slice(0, at)];
  const done = completedAtOf(input);
  const allowed = new Set(offerable(input));
  return walk.find((e) => allowed.has(e) && !done.has(e.questId)) ?? null;
}
