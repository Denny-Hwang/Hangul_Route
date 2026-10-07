import { PlanUpsertSchema, type Plan } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action } from '../lib/can';
import { id, type Account } from '../store';

/**
 * /api/spaces/:id/plans — F-PLAN-001 §3.2. One row per plan; learner
 * devices derive homework from the inbox (no per-learner fan-out).
 */
export const plansRoutes = new Hono();

async function gate(c: Context, db: Db, spaceId: string, action: Action): Promise<Response | { account: Account; spaceId: string }> {
  const space = await db.getSpace(spaceId);
  if (!space || space.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), action, { kind: 'space', ctx: await spaceContext(db, space) })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  return { account, spaceId: space.id };
}

plansRoutes.put('/:id/plans', async (c) => {
  const db = dbFor(c);
  const gated = await gate(c, db, c.req.param('id'), 'plan.write');
  if (!('account' in gated)) return gated;
  const parsed = PlanUpsertSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid plan body', 422, { issues: parsed.error.issues });
  const input = parsed.data;

  const targets = input.targetLearnerIds ?? null;
  if (targets) {
    const members = new Set((await db.membersOf(gated.spaceId)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId));
    const unknown = targets.filter((t) => !members.has(t));
    if (unknown.length > 0) return fail(c, 'unknown_learner', 'Some learners are not in this space', 422, { unknown });
  }

  const now = new Date().toISOString();
  const existing = input.id ? await db.getPlan(input.id) : null;
  if (input.id && (!existing || existing.spaceId !== gated.spaceId)) return fail(c, 'not_found', 'Plan not found', 404);

  const plan: Plan = existing
    ? { ...existing, title: input.title, items: input.items, targetLearnerIds: targets, publishedAt: existing.publishedAt ?? (input.publish ? now : null), updatedAt: now }
    : {
        id: id('plan'),
        spaceId: gated.spaceId,
        authorAccountId: gated.account.id,
        title: input.title,
        items: input.items,
        targetLearnerIds: targets,
        publishedAt: input.publish ? now : null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
  await db.putPlan(plan);
  return ok(c, { plan }, existing ? 200 : 201);
});

plansRoutes.get('/:id/plans', async (c) => {
  const db = dbFor(c);
  const gated = await gate(c, db, c.req.param('id'), 'summary.read');
  if (!('account' in gated)) return gated;
  const plans = (await db.plansOf(gated.spaceId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return ok(c, { plans });
});

plansRoutes.post('/:id/plans/:planId/archive', async (c) => {
  const db = dbFor(c);
  const gated = await gate(c, db, c.req.param('id'), 'plan.write');
  if (!('account' in gated)) return gated;
  const plan = await db.getPlan(c.req.param('planId'));
  if (!plan || plan.spaceId !== gated.spaceId) return fail(c, 'not_found', 'Plan not found', 404);
  const now = new Date().toISOString();
  plan.archivedAt = plan.archivedAt ?? now;
  plan.updatedAt = now;
  await db.putPlan(plan);
  return ok(c, { plan });
});

/** Published, live plans that reach a learner, oldest first (F-PLAN-001 §3.2). */
export async function inboxPlansFor(db: Db, learnerId: string) {
  const rows = [];
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (!space || space.archivedAt) continue;
    for (const p of await db.plansOf(space.id)) {
      if (!p.publishedAt || p.archivedAt || (p.targetLearnerIds !== null && !p.targetLearnerIds.includes(learnerId))) continue;
      rows.push({ id: p.id, spaceId: space.id, spaceKind: space.kind, spaceName: space.name, title: p.title, items: p.items, publishedAt: p.publishedAt, updatedAt: p.updatedAt });
    }
  }
  // Stable sort: plans published in the same millisecond keep creation order.
  return rows.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}
