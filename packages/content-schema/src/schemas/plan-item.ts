import { z } from 'zod';

/**
 * One item of a plan — F-PLAN-001 section 3.1, extended by F-PLAN-002
 * section 3.5. In its own module so the curriculum draft (which builds on it)
 * and the plan schemas (which carry a curriculum meta) do not import each other.
 */
export const PlanItemSchema = z.object({
  kind: z.enum(['quest', 'episode']),
  id: z.string().min(1),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(80).optional(),
  /** The curriculum week (1-based) the item belongs to; absent on a classic plan. */
  week: z.number().int().min(1).max(52).optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;
