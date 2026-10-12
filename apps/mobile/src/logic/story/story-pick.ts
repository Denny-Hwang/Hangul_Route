import type { Episode, ProgressSnapshot } from '@hangul-route/content-schema';
import { gridEpisodes } from '../../content/episodes';
import { isContentLocked, type FreeContentRegistry } from '../content-access';
import { isStageEntitled, type Tier } from '../entitlement';
import { stageAvailability } from '../journey';
import { compareInstant } from '../sync/merge';
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
 * `reasons` limits the chain to some of its stages (slot ③ of F-STORY-004
 * §3.7 asks for `next`, then `again`, never `continue`).
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
  /**
   * True when the learner may not open this entry. Callers combine
   * `isContentLocked({ kind: 'story', id: entry.storyId, ... })` (always false
   * while gating is off) with, for a book (grid) entry, the stage gate that
   * Journey applies today: `!isStageEntitled(entry.stage, tier)`, the
   * stage's availability and `!isQuestOpen(entry.questId)` (`storyLockFor`,
   * F-ENT-003 section 3.6). Keyed by entry, so a story's free shelf entry can
   * stay open while its book entry in a stage the learner has not reached is
   * locked.
   */
  isLocked: (entry: StoryIndexEntry) => boolean;
  /** Stories already on the plan (another card), never picked twice. */
  excludeStoryIds?: readonly string[];
  /** Quests already on the plan (e.g. the Journey card). */
  excludeQuestIds?: readonly string[];
  /** F-STORY-005 §3.4: stories that fit the learner come first among `next`; the order is otherwise kept. */
  fits?: (entry: StoryIndexEntry) => boolean;
  /** The chain stages to run, in chain order; default all three. */
  reasons?: readonly StoryReason[];
}

const ALL_REASONS: readonly StoryReason[] = ['continue', 'next', 'again'];

/**
 * Ascending order of ISO times as instants (`compareInstant`: an offset form and
 * `Z` compare by the moment they name); identical times keep their place (the
 * sort is stable).
 */
const byTime = compareInstant;

function completedAtOf(input: Pick<StoryPickInput, 'snapshot'>): Map<string, string> {
  const done = new Map<string, string>();
  for (const q of input.snapshot?.quests ?? []) if (q.completedAt) done.set(q.questId, q.completedAt);
  return done;
}

function offerable(input: StoryPickInput): StoryIndexEntry[] {
  const stories = new Set(input.excludeStoryIds ?? []);
  const quests = new Set(input.excludeQuestIds ?? []);
  return input.entries
    .filter((e) => !stories.has(e.storyId) && !quests.has(e.questId) && !input.isLocked(e))
    .sort(compareShelfOrder);
}

/** Fitting entries first, each part in its existing order. */
function fitFirst(entries: StoryIndexEntry[], fits: StoryPickInput['fits']): StoryIndexEntry[] {
  if (!fits) return entries;
  return [...entries.filter(fits), ...entries.filter((e) => !fits(e))];
}

function pickFrom(candidates: StoryIndexEntry[], input: StoryPickInput): StoryPick | null {
  const done = completedAtOf(input);
  const reasons = new Set(input.reasons ?? ALL_REASONS);

  if (reasons.has('continue')) {
    const resume = resumableOf(candidates, input, done)[0];
    if (resume) return { entry: resume.entry, reason: 'continue', mode: 'play', bookmark: resume.bookmark };
  }

  if (reasons.has('next')) {
    const unfinished = candidates.filter((e) => !done.has(e.questId));
    const next =
      fitFirst(unfinished.filter((e) => e.placement === 'shelf'), input.fits)[0] ??
      unfinished.find((e) => e.placement === 'grid');
    if (next) return { entry: next, reason: 'next', mode: 'play' };
  }

  if (reasons.has('again')) {
    const finished = candidates
      .filter((e) => done.has(e.questId))
      .sort((a, b) => byTime(done.get(a.questId) as string, done.get(b.questId) as string));
    const again = finished[0];
    if (again) return { entry: again, reason: 'again', mode: 'replay' };
  }
  return null;
}

/** Bookmarked entries at the bookmark's level whose quest is not finished; newest first, equal times in shelf order. */
function resumableOf(
  candidates: StoryIndexEntry[],
  input: StoryPickInput,
  done: Map<string, string>,
): Array<{ entry: StoryIndexEntry; bookmark: Bookmark }> {
  const resumable = candidates
    .map((entry) => ({ entry, bookmark: input.bookmarks.byStory[entry.storyId] }))
    .filter(
      (c): c is { entry: StoryIndexEntry; bookmark: Bookmark } =>
        c.bookmark !== undefined && c.bookmark.level === c.entry.level && !done.has(c.entry.questId),
    );
  resumable.sort((a, b) => byTime(b.bookmark.updatedAt, a.bookmark.updatedAt));
  return resumable;
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

/**
 * The `isLocked` that Home (and later the shelf) passes in: the story lock of
 * §3.9 (`isContentLocked`, always open while `gatingEnabled` is off), and for a
 * book (grid) entry also the stage gate Journey applies today, which is not
 * behind the flag: the stage must be entitled for the tier and must not be
 * "soon" (no shipped grid cell yet). A book entry also needs its quest open
 * when `isQuestOpen` is given (F-ENT-003 section 3.6; none is bundled today,
 * the rule is for Stage 5 books); shelf entries keep the story lock alone.
 */
export function storyLockFor(ctx: {
  tier: Tier;
  gatingEnabled: boolean;
  episodes: readonly Episode[];
  registry?: FreeContentRegistry;
  /** `questOpenFor` / `useQuestAccess` (F-ENT-003 section 3.4); omitted means every quest is open. */
  isQuestOpen?: (questId: string) => boolean;
}): (entry: StoryIndexEntry) => boolean {
  const grid = gridEpisodes(ctx.episodes);
  const isQuestOpen = ctx.isQuestOpen;
  return (entry) =>
    isContentLocked({ kind: 'story', id: entry.storyId, tier: ctx.tier, gatingEnabled: ctx.gatingEnabled, registry: ctx.registry }) ||
    (entry.placement === 'grid' &&
      (!isStageEntitled(entry.stage, ctx.tier) ||
        stageAvailability(entry.stage, grid) === 'soon' ||
        (isQuestOpen !== undefined && !isQuestOpen(entry.questId))));
}
