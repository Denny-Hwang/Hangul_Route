import { z } from 'zod';
import { CurriculumMetaSchema, type CurriculumMeta } from '../curriculum/draft';
import { CURRICULUM_MAX_ITEMS } from '../curriculum/presets';
import { PlanItemSchema, type PlanItem } from './plan-item';
import { SpaceKindSchema } from './space';

export { PlanItemSchema, type PlanItem };

/**
 * Plans — F-PLAN-001. One row per space; learner devices derive their own
 * homework from it (no per-learner fan-out on the server).
 *
 * F-PLAN-002 section 3.5 (additive): a plan may carry a curriculum `meta`
 * (`plans.meta_json`); only such a plan may hold more than `PLAN_MAX_ITEMS`
 * items, up to `CURRICULUM_MAX_ITEMS`. `meta` null is a classic plan.
 */
export const PLAN_MAX_ITEMS = 30;

/** Stable code of the cap issue, carried as `issue.params.code` on path `items`. */
export const PLAN_ITEMS_ISSUE_CODE = 'classic-plan-too-long' as const;

/** The classic cap: more than 30 items needs a curriculum meta. */
export function classicPlanCapIssue(items: readonly unknown[], meta: CurriculumMeta | null | undefined): boolean {
  return (meta === null || meta === undefined) && items.length > PLAN_MAX_ITEMS;
}

const refineCap = (plan: { items: readonly unknown[]; meta?: CurriculumMeta | null }, ctx: z.RefinementCtx, metaAbsentIsClassic: boolean): void => {
  if (plan.meta === undefined && !metaAbsentIsClassic) return;
  if (!classicPlanCapIssue(plan.items, plan.meta)) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['items'],
    message: `A plan without a curriculum holds at most ${PLAN_MAX_ITEMS} items`,
    params: { code: PLAN_ITEMS_ISSUE_CODE },
  });
};

/**
 * Index of the first item whose `week` lies past the last week of `meta`, or
 * null when every item fits (or the plan is classic). Keeps a curriculum's
 * items and its week list from drifting apart.
 */
export function curriculumWeekIssue(items: readonly { week?: number }[], meta: CurriculumMeta | null | undefined): number | null {
  if (meta === null || meta === undefined) return null;
  const index = items.findIndex((item) => item.week !== undefined && item.week > meta.weeks.length);
  return index === -1 ? null : index;
}

/** The issue `curriculumWeekIssue` reports, on path `items.<index>.week`. */
export function curriculumWeekIssueOf(index: number, meta: CurriculumMeta): { path: Array<string | number>; message: string } {
  return { path: ['items', index, 'week'], message: `The plan has ${meta.weeks.length} weeks` };
}

const refineWeeks = (plan: { items: readonly { week?: number }[]; meta?: CurriculumMeta | null }, ctx: z.RefinementCtx): void => {
  if (plan.meta === null || plan.meta === undefined) return;
  const index = curriculumWeekIssue(plan.items, plan.meta);
  if (index !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, ...curriculumWeekIssueOf(index, plan.meta) });
};

const planItems = z.array(PlanItemSchema).min(1).max(CURRICULUM_MAX_ITEMS);

export const PlanSchema = z
  .object({
    id: z.string().regex(/^plan:[a-z0-9-]+$/),
    spaceId: z.string(),
    authorAccountId: z.string(),
    title: z.string().min(1).max(60),
    items: planItems,
    targetLearnerIds: z.array(z.string()).nullable(),
    publishedAt: z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    /** F-PLAN-002 section 3.5; null (the default) = a classic plan. */
    meta: CurriculumMetaSchema.nullable().default(null),
  })
  .superRefine((plan, ctx) => refineCap(plan, ctx, true));
export type Plan = z.infer<typeof PlanSchema>;

/**
 * PUT /api/spaces/:id/plans body. `meta` absent on an update keeps the stored
 * meta (an older console or cached page cannot strip a route's meta); `null`
 * turns the plan into a classic one. The schema applies the classic cap when
 * `meta` is null; when it is absent the route checks the cap against the
 * stored plan's meta.
 */
export const PlanUpsertSchema = z
  .object({
    id: z.string().regex(/^plan:[a-z0-9-]+$/).optional(),
    title: z.string().trim().min(1).max(60),
    items: planItems,
    targetLearnerIds: z.array(z.string()).nullable().optional(),
    publish: z.boolean().default(false),
    meta: CurriculumMetaSchema.nullable().optional(),
  })
  .superRefine((plan, ctx) => {
    refineCap(plan, ctx, false);
    // A body with a meta is checked here; one without it is checked by the route against the stored meta.
    refineWeeks(plan, ctx);
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
  /** F-PLAN-002 section 3.5; sent only to an app that asks with `?cap=curriculum`. */
  meta: CurriculumMetaSchema.nullable().default(null),
});
/**
 * `meta` is optional in the *type* although the schema defaults it to null:
 * devices read their stored inbox copy without parsing, so a plan stored
 * before the key existed lacks it at runtime; readers treat missing as null.
 */
export type InboxPlan = Omit<z.infer<typeof InboxPlanSchema>, 'meta'> & { meta?: CurriculumMeta | null };

/** True for a plan (stored, upserted or inbox) that carries a curriculum meta. */
export function isCurriculumPlan(plan: { meta?: CurriculumMeta | null }): boolean {
  return plan.meta !== null && plan.meta !== undefined;
}
