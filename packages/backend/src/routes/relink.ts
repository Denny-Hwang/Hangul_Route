import { RELINK_WINDOW_MS, RelinkCreateSchema, type RelinkRequest } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { hashSecret, newDeviceSecret } from '../lib/device-auth';
import { publicLearner } from '../lib/learners';
import { isJoinCodeLive } from '../lib/join-code';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { id, store, type Account } from '../store';
import { rosterName } from './spaces';

/**
 * /api/spaces/:id/relink-requests — F-TCH-001 §10.1. A student on a new
 * device picks their roster name; the teacher approves within 10 minutes;
 * the device picks up its credentials once.
 */
export const relinkRoutes = new Hono();

export const RELINK_LIMIT = 10;
export const relinkLimiter = createRateLimiter(RELINK_LIMIT, 60 * 60 * 1000);

type Stored = RelinkRequest & { secret: string | null };

function expireIfDue(req: Stored, now: Date): void {
  if (req.status === 'pending' && Date.parse(req.expiresAt) <= now.getTime()) {
    req.status = 'expired';
    req.decidedAt = now.toISOString();
  }
}

function publicRequest(req: Stored): RelinkRequest {
  const { secret: _secret, ...rest } = req;
  return rest;
}

async function requireManager(c: Context, spaceId: string): Promise<Response | { account: Account; space: NonNullable<ReturnType<typeof store.spaces.get>> }> {
  const space = store.spaces.get(spaceId);
  if (!space) return fail(c, 'not_found', 'Space not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(accountActor(account), 'roster.manage', { kind: 'space', ctx: spaceContext(space) })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  return { account, space };
}

relinkRoutes.post('/:id/relink-requests', async (c) => {
  const decision = relinkLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    return c.json({ ok: false, error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds: decision.retryAfterSeconds } } }, 429);
  }
  const space = store.spaces.get(c.req.param('id'));
  if (!space || space.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  const parsed = RelinkCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid re-link body', 422, { issues: parsed.error.issues });
  const { code, learnerId, deviceId, platform } = parsed.data;
  const now = new Date();
  if (space.joinCode !== code) return fail(c, 'code_not_found', 'That code does not open this space', 404);
  if (!isJoinCodeLive(space, now)) return fail(c, 'code_expired', 'This code has expired', 404);
  if (!store.membership(space.id, 'learner', learnerId) || !store.learners.has(learnerId)) return fail(c, 'learner_not_found', 'That name is not in this class', 404);
  if (store.device(learnerId, deviceId)) return fail(c, 'already_bound', 'This device already has this learner', 409);

  for (const req of store.relinksOf(space.id)) expireIfDue(req, now);
  const existing = store.relinksOf(space.id).find((r) => r.learnerId === learnerId && r.deviceId === deviceId && r.status === 'pending');
  if (existing) return ok(c, { request: publicRequest(existing) });

  const request: Stored = {
    id: id('relink'),
    spaceId: space.id,
    learnerId,
    deviceId,
    platform: platform ?? null,
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RELINK_WINDOW_MS).toISOString(),
    status: 'pending',
    decidedAt: null,
    secret: null,
  };
  store.relinkRequests.set(request.id, request);
  return ok(c, { request: publicRequest(request) }, 201);
});

relinkRoutes.get('/:id/relink-requests', async (c) => {
  const gated = await requireManager(c, c.req.param('id'));
  if (!('space' in gated)) return gated;
  const now = new Date();
  const requests = store
    .relinksOf(gated.space.id)
    .map((r) => {
      expireIfDue(r, now);
      return r;
    })
    .filter((r) => r.status === 'pending')
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => ({ ...publicRequest(r), learnerName: rosterName(gated.space, store.learners.get(r.learnerId)?.displayName ?? '?') }));
  return ok(c, { requests });
});

async function decide(c: Context, approve: boolean): Promise<Response> {
  const gated = await requireManager(c, c.req.param('id') ?? '');
  if (!('space' in gated)) return gated;
  const req = store.relinkRequests.get(c.req.param('rid') ?? '');
  if (!req || req.spaceId !== gated.space.id) return fail(c, 'not_found', 'Request not found', 404);
  const now = new Date();
  expireIfDue(req, now);
  if (req.status !== 'pending') return fail(c, req.status === 'expired' ? 'expired' : 'not_pending', `Request is ${req.status}`, 409);
  req.status = approve ? 'approved' : 'denied';
  req.decidedAt = now.toISOString();
  if (approve) {
    const secret = newDeviceSecret();
    store.bindDevice({ learnerId: req.learnerId, deviceId: req.deviceId, secretHash: await hashSecret(secret), createdAt: req.decidedAt, lastSeenAt: req.decidedAt });
    req.secret = secret; // handed to the device on its next poll, once
  }
  return ok(c, { request: publicRequest(req) });
}

relinkRoutes.post('/:id/relink-requests/:rid/approve', (c) => decide(c, true));
relinkRoutes.post('/:id/relink-requests/:rid/deny', (c) => decide(c, false));

/** The requesting device polls here; credentials come back exactly once. */
relinkRoutes.get('/:id/relink-requests/:rid', (c) => {
  const req = store.relinkRequests.get(c.req.param('rid'));
  const deviceId = c.req.query('deviceId') ?? '';
  if (!req || req.spaceId !== c.req.param('id') || !deviceId || req.deviceId !== deviceId) return fail(c, 'not_found', 'Request not found', 404);
  expireIfDue(req, new Date());
  if (req.status !== 'approved' || !req.secret) return ok(c, { status: req.status, expiresAt: req.expiresAt });
  const learner = store.learners.get(req.learnerId);
  if (!learner) return fail(c, 'not_found', 'Learner not found', 404);
  const secret = req.secret;
  req.secret = null;
  const record = store.snapshots.get(learner.id);
  return ok(c, {
    status: 'approved',
    expiresAt: req.expiresAt,
    learner: publicLearner(learner),
    device: { deviceId, secret },
    snapshot: record ? { rev: record.rev, snapshot: record.payload, summary: record.summary } : null,
  });
});
