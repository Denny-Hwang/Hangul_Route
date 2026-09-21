import { PlanUpsertSchema, type Plan } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can, type Action } from '../lib/can';
import { id, store, type Account } from '../store';

/**
 * /api/spaces/:id/plans — F-PLAN-001 §3.2. One row per plan; learner
 * devices derive homework from the inbox (no per-learner fan-out).
 */
export const plansRoutes = new Hono();

async function gate(c: Parameters<typeof requireAccount>[0], spaceId: string, action: Action): Promise<Response | { account: Account; spaceId: string }> {
  const space = store.spaces.get(spaceId);
  if (!space || space.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(accountActor(account), action, { kind: 'space', ctx: spaceContext(space) })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  return { account, spaceId: space.id };
}

plansRoutes.put('/:id/plans', async (c) => {
  const gated = await gate(c, c.req.param('id'), 'plan.write');
  if (!('account' in gated)) return gated;
  const parsed = PlanUpsertSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid plan body', 422, { issues: parsed.error.issues });
  const input = parsed.data;

  const targets = input.targetLearnerIds ?? null;
  if (targets) {
    const members = new Set(store.membersOf(gated.spaceId).filter((m) => m.memberKind === 'learner').map((m) => m.memberId));
    const unknown = targets.filter((t) => !members.has(t));
    if (unknown.length > 0) return fail(c, 'unknown_learner', 'Some learners are not in this space', 422, { unknown });
  }

  const now = new Date().toISOString();
  const existing = input.id ? store.plans.get(input.id) : undefined;
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
  store.plans.set(plan.id, plan);
  return ok(c, { plan }, existing ? 200 : 201);
});

plansRoutes.get('/:id/plans', async (c) => {
  const gated = await gate(c, c.req.param('id'), 'summary.read');
  if (!('account' in gated)) return gated;
  const plans = store.plansOf(gated.spaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return ok(c, { plans });
});

plansRoutes.post('/:id/plans/:planId/archive', async (c) => {
  const gated = await gate(c, c.req.param('id'), 'plan.write');
  if (!('account' in gated)) return gated;
  const plan = store.plans.get(c.req.param('planId'));
  if (!plan || plan.spaceId !== gated.spaceId) return fail(c, 'not_found', 'Plan not found', 404);
  const now = new Date().toISOString();
  plan.archivedAt = plan.archivedAt ?? now;
  plan.updatedAt = now;
  return ok(c, { plan });
});

/** Published, live plans that reach a learner, oldest first (F-PLAN-001 §3.2). */
export function inboxPlansFor(learnerId: string) {
  return store
    .membershipsOf('learner', learnerId)
    .map((m) => store.spaces.get(m.spaceId))
    .filter((s): s is NonNullable<typeof s> => !!s && !s.archivedAt)
    .flatMap((space) =>
      store
        .plansOf(space.id)
        .filter((p) => p.publishedAt && !p.archivedAt && (p.targetLearnerIds === null || p.targetLearnerIds.includes(learnerId)))
        .map((p) => ({
          id: p.id,
          spaceId: space.id,
          spaceKind: space.kind,
          spaceName: space.name,
          title: p.title,
          items: p.items,
          publishedAt: p.publishedAt as string,
          updatedAt: p.updatedAt,
        })),
    )
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
}
