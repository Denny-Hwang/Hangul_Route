import { z } from 'zod';

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

export const HomeworkAssignmentSchema = z.object({
  id: z.string(),
  questId: z.string(),
  episodeId: z.string(),
  assignedBy: z.enum(['parent', 'teacher', 'system']),
  assignedAt: z.string(),
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
});
export type ProgressSnapshot = z.infer<typeof ProgressSnapshotSchema>;
