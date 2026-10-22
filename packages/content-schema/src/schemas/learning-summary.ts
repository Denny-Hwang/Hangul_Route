import { z } from 'zod';
import { ReportSpaceSchema } from './report-response';
import { MemorySummarySchema } from './sync';

/**
 * The teacher read route `GET /api/spaces/:spaceId/learning-summary` (F-CURR-002 section 8, row CM-16): each
 * learner's `memory` block and a class aggregate of the items most often due, for `class-review` (row CM-63) and the
 * console. Counts and content ids only: no item state (`b`, `d`, `c`, `r`, `n`, `f`, `s`, `at`), no answer history,
 * no name. A learner whose block the viewer may not read (a class reader at a scope below the memory scope, an older
 * app, `memoryRecord` off) has `memory: null` and adds nothing to the aggregate.
 */

/** At most this many items in the class aggregate, as in each learner's `topDue`. */
export const LEARNING_SUMMARY_TOP_DUE_MAX = 8;

const Count = z.number().int().nonnegative();
const ItemId = z.string().min(1).max(64);

/**
 * The counts-only class progress a class-scoped device posts (`POST /api/sync/learners/:id/class-progress`, row
 * CM-62, section 7.6). That route is not built yet: the learning summary carries `classProgress: null` for every
 * learner until it is, and its aggregate then counts these `topDue` ids too.
 */
export const ClassProgressCountsSchema = z.object({
  /** The ISO week, keyed by its Monday (`YYYY-MM-DD`). */
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quests: Count,
  stories: Count,
  refreshed: Count,
  topDue: z.array(ItemId).max(LEARNING_SUMMARY_TOP_DUE_MAX),
});
export type ClassProgressCounts = z.infer<typeof ClassProgressCountsSchema>;

export const LearningSummaryLearnerSchema = z.object({
  /** The opaque `profile:` id the roster already keys its rows by; never a name. */
  learnerId: z.string(),
  memory: MemorySummarySchema.nullable(),
  /** Row CM-62's counts for a class-tablet learner; null until that route exists. */
  classProgress: ClassProgressCountsSchema.nullable(),
});
export type LearningSummaryLearner = z.infer<typeof LearningSummaryLearnerSchema>;

export const LearningSummaryResponseSchema = z.object({
  space: ReportSpaceSchema,
  learners: z.array(LearningSummaryLearnerSchema),
  class: z.object({
    /** Learner members. */
    learners: Count,
    /** Members whose block counts here (`memory` or `classProgress` present). */
    counted: Count,
    /** The items due for the most learners, then by id; each with how many learners have it due. Content ids only. */
    topDue: z.array(z.object({ itemId: ItemId, learners: Count })).max(LEARNING_SUMMARY_TOP_DUE_MAX),
  }),
  serverTime: z.string(),
});
export type LearningSummaryResponse = z.infer<typeof LearningSummaryResponseSchema>;

/**
 * The class aggregate: how many learners have each item among their due items, the most first, then by id (ids are
 * unique), at most 8. Ordered by content, never by a learner; a learner's own list counts each id once.
 */
export function topDueOf(lists: ReadonlyArray<readonly string[]>): Array<{ itemId: string; learners: number }> {
  const counts = new Map<string, number>();
  for (const list of lists) for (const id of new Set(list)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([x, a], [y, b]) => b - a || (x < y ? -1 : x > y ? 1 : 0))
    .slice(0, LEARNING_SUMMARY_TOP_DUE_MAX)
    .map(([itemId, learners]) => ({ itemId, learners }));
}
