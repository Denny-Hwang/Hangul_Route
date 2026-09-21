import { z } from 'zod';
import { SpaceKindSchema } from './space';

/**
 * Plans — F-PLAN-001. One row per space; learner devices derive their own
 * homework from it (no per-learner fan-out on the server).
 */
export const PlanItemSchema = z.object({
  kind: z.enum(['quest', 'episode']),
  id: z.string().min(1),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(80).optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const PLAN_MAX_ITEMS = 30;

export const PlanSchema = z.object({
  id: z.string().regex(/^plan:[a-z0-9-]+$/),
  spaceId: z.string(),
  authorAccountId: z.string(),
  title: z.string().min(1).max(60),
  items: z.array(PlanItemSchema).min(1).max(PLAN_MAX_ITEMS),
  targetLearnerIds: z.array(z.string()).nullable(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** PUT /api/spaces/:id/plans body. */
export const PlanUpsertSchema = z.object({
  id: z.string().regex(/^plan:[a-z0-9-]+$/).optional(),
  title: z.string().trim().min(1).max(60),
  items: z.array(PlanItemSchema).min(1).max(PLAN_MAX_ITEMS),
  targetLearnerIds: z.array(z.string()).nullable().optional(),
  publish: z.boolean().default(false),
});
export type PlanUpsert = z.infer<typeof PlanUpsertSchema>;

/** What a learner device receives in the inbox. */
export const InboxPlanSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  spaceKind: SpaceKindSchema,
  spaceName: z.string(),
  title: z.string(),
  items: z.array(PlanItemSchema),
  publishedAt: z.string(),
  updatedAt: z.string(),
});
export type InboxPlan = z.infer<typeof InboxPlanSchema>;
