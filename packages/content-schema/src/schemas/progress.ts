import { z } from 'zod';
import { PlacementResultSchema } from './placement';

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
   */
  stageDoneAt: z.record(z.string(), z.string()).optional(),
});
/**
 * `placements` is optional in the *type* although the schema defaults it to
 * `[]`: the apps read their own local copy without parsing (F-PLC-001
 * section 3.8), so every snapshot stored before the key existed lacks it at
 * runtime and every reader must treat a missing list as `[]`.
 */
export type ProgressSnapshot = Omit<z.infer<typeof ProgressSnapshotSchema>, 'placements'> & {
  placements?: z.infer<typeof ProgressSnapshotSchema>['placements'];
};
