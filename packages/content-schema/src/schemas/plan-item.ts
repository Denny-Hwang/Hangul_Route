import { z } from 'zod';

/**
 * One item of a plan — F-PLAN-001 section 3.1, extended by F-PLAN-002
 * section 3.5. In its own module so the curriculum draft (which builds on it)
 * and the plan schemas (which carry a curriculum meta) do not import each other.
 */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The item's fields without the cross-field check, for schemas that extend an item (`CurriculumItemSchema`). */
export const PlanItemShapeSchema = z.object({
  kind: z.enum(['quest', 'episode']),
  id: z.string().min(1),
  targetDate: z.string().regex(DATE_KEY).optional(),
  note: z.string().trim().max(80).optional(),
  /** The curriculum week (1-based) the item belongs to; absent on a classic plan. */
  week: z.number().int().min(1).max(52).optional(),
  /**
   * The class day that taught it (AMENDMENTS-ROUTE-CLASS-BLEND section 9.2, row BL-W): only on an item of a blended
   * class plan, and then `targetDate` is a later day. An older app strips it and plays the item on its date.
   */
  lectureDate: z.string().regex(DATE_KEY).optional(),
});

/** Section 9.2: `lectureDate` needs a `targetDate` after it. */
export function refinePlanItem(item: { targetDate?: string | undefined; lectureDate?: string | undefined }, ctx: z.RefinementCtx): void {
  if (item.lectureDate === undefined) return;
  if (item.targetDate === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetDate'], message: 'An item with a lectureDate needs a targetDate' });
  } else if (item.targetDate <= item.lectureDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetDate'], message: `targetDate ${item.targetDate} is not after lectureDate ${item.lectureDate}` });
  }
}

export const PlanItemSchema = PlanItemShapeSchema.superRefine(refinePlanItem);
export type PlanItem = z.infer<typeof PlanItemSchema>;
