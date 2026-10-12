import { z } from 'zod';
import { CurriculumMetaSchema } from '../curriculum/draft';
import { CURRICULUM_MAX_ITEMS } from '../curriculum/presets';
import { PlacementResultSchema } from './placement';
import { PlanItemSchema } from './plan-item';
import { VocabProgressSchema } from './vocab-progress';

/**
 * Progress — per-profile snapshot of learning state.
 */
export const QuestProgressSchema = z.object({
  questId: z.string(),
  episodeId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  attempts: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const EpisodeProgressSchema = z.object({
  episodeId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  questsCompleted: z.number().int().nonnegative(),
  totalQuests: z.number().int().nonnegative(),
});
export type EpisodeProgress = z.infer<typeof EpisodeProgressSchema>;

export const CardCollectionEntrySchema = z.object({
  cardId: z.string(),
  unlockedAt: z.string(),
  newSinceLastView: z.boolean(),
});
export type CardCollectionEntry = z.infer<typeof CardCollectionEntrySchema>;

export const SessionLogSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  episodesTouched: z.array(z.string()),
});
export type SessionLog = z.infer<typeof SessionLogSchema>;

/**
 * HomeworkAssignment — an explicit caregiver assignment (F-HW-001 §3.4).
 * `assignedAt` is the ordering key when several compete for the same day;
 * `targetDate` (YYYY-MM-DD) is the day the assignment is *for*, which is not
 * the day it was created.
 */
export const HomeworkAssignmentSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  questId: z.string(),
  episodeId: z.string(),
  assignedBy: z.enum(['parent', 'teacher', 'system']),
  assignedAt: z.string(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type HomeworkAssignment = z.infer<typeof HomeworkAssignmentSchema>;

export const ReviewKindSchema = z.enum(['daily', 'feedback', 'stage-certificate']);
export type ReviewKind = z.infer<typeof ReviewKindSchema>;

export const ReviewEntrySchema = z.object({
  id: z.string(),
  kind: ReviewKindSchema,
  generatedAt: z.string(),
  scope: z.string(),
  itemIds: z.array(z.string()),
  resultStars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  /** Items answered wrong on the first try (F-QUEST-002 §3.9); absent on older entries. */
  missedItemIds: z.array(z.string()).optional(),
});
export type ReviewEntry = z.infer<typeof ReviewEntrySchema>;

/**
 * A self-route (F-PLAN-002 section 3.5 / 3.9): a curriculum kept on the
 * learner's device, inside the progress snapshot, so it rides sync, the backup
 * file and Rescue Code restore. A stopped route is archived (`archivedAt`),
 * never set to null, so the Worker's preserve rule can tell a stop from an old
 * client that does not know the field.
 */
export const SelfRouteSchema = z.object({
  id: z.string().regex(/^route:[a-z0-9-]+$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
  meta: CurriculumMetaSchema,
  items: z.array(PlanItemSchema).max(CURRICULUM_MAX_ITEMS),
});
export type SelfRoute = z.infer<typeof SelfRouteSchema>;

export const ProgressSnapshotSchema = z.object({
  profileId: z.string(),
  updatedAt: z.string(),
  episodes: z.array(EpisodeProgressSchema),
  quests: z.array(QuestProgressSchema),
  cards: z.array(CardCollectionEntrySchema),
  sessions: z.array(SessionLogSchema),
  homework: z.array(HomeworkAssignmentSchema),
  reviews: z.array(ReviewEntrySchema),
  streakDays: z.number().int().nonnegative(),
  /** Level checks, newest ten (F-PLC-001 section 3.8); absent in snapshots written before it. */
  placements: z.array(PlacementResultSchema).default([]),
  /**
   * Stage latch (F-ROUTE-001 section 3.15): stage key -> ISO time the stage was
   * first complete. A latched stage stays Complete whatever content ships later.
   * Absent in snapshots written before it; readers treat a missing value as `{}`.
   * Keys are not validated on the wire so a newer build's stage never fails a sync.
   * Writers store `new Date().toISOString()`; mergers compare instants, not strings.
   */
  stageDoneAt: z.record(z.string(), z.string()).optional(),
  /**
   * The learner's own weekly plan (F-PLAN-002 section 3.5); null when there is
   * none. Lenient: a malformed or newer-shaped route reads as null instead of
   * failing the whole upload or backup restore, and the Worker's preserve rule
   * then keeps the stored route.
   */
  selfRoute: SelfRouteSchema.nullable().catch(null).default(null),
  /**
   * Word progress (F-VOC-005 section 3.1). Optional, not defaulted: snapshots,
   * backups and server rows written before it parse unchanged, and readers go
   * through `vocabOf(snapshot)`. Strict on purpose: a malformed slice is a 422,
   * and the Worker's preserve rule keeps a stored slice when the key is absent.
   */
  vocab: VocabProgressSchema.optional(),
  /**
   * Quest latch (F-REPORT-001 section 3.3.1): quest id -> ISO time the quest was
   * first completed. Only ever gains keys; the earliest instant wins on merge.
   * Absent in snapshots written before it; readers treat a missing value as {}.
   * Builds from RP-3a on always write the key (an empty record when nothing is
   * latched), so "key absent" means "an older build".
   */
  questDoneAt: z.record(z.string(), z.string()).optional(),
});
/**
 * `placements` is optional in the *type* although the schema defaults it to
 * `[]`: the apps read their own local copy without parsing (F-PLC-001
 * section 3.8), so every snapshot stored before the key existed lacks it at
 * runtime and every reader must treat a missing list as `[]`.
 */
export type ProgressSnapshot = Omit<z.infer<typeof ProgressSnapshotSchema>, 'placements' | 'selfRoute'> & {
  placements?: z.infer<typeof ProgressSnapshotSchema>['placements'];
  /** Optional for the same reason as `placements`: readers treat a missing value as null. */
  selfRoute?: SelfRoute | null;
};
