import { RELINK_WINDOW_MS, RelinkCreateSchema, type RelinkRequest, type Space } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, type Db, type StoredRelink } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { hashSecret, newDeviceSecret } from '../lib/device-auth';
import { publicLearner } from '../lib/learners';
import { isJoinCodeLive } from '../lib/join-code';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { id, type Account } from '../store';
import { rosterName } from './spaces';

/**
 * /api/spaces/:id/relink-requests — F-TCH-001 §10.1. A student on a new
 * device picks their roster name; the teacher approves within 10 minutes;
 * the device picks up its credentials once.
 */
export const relinkRoutes = new Hono();

export const RELINK_LIMIT = 10;
export const relinkLimiter = createRateLimiter(RELINK_LIMIT, 60 * 60 * 1000);

/** Marks a pending request expired once its window passed; returns whether it changed. */
function expireIfDue(req: StoredRelink, now: Date): boolean {
  if (req.status === 'pending' && Date.parse(req.expiresAt) <= now.getTime()) {
    req.status = 'expired';
    req.decidedAt = now.toISOString();
    return true;
  }
  return false;
}

function publicRequest(req: StoredRelink): RelinkRequest {
  const { secret: _secret, ...rest } = req;
  return rest;
}

/** Loads a space's requests, persisting any that expired meanwhile. */
async function liveRelinks(db: Db, spaceId: string, now: Date): Promise<StoredRelink[]> {
  const rows = await db.relinksOf(spaceId);
  for (const r of rows) if (expireIfDue(r, now)) await db.putRelink(r);
  return rows;
}

async function requireManager(c: Context, db: Db, spaceId: string): Promise<Response | { account: Account; space: Space }> {
  const space = await db.getSpace(spaceId);
  if (!space) return fail(c, 'not_found', 'Space not found', 404);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!can(await accountActor(db, account), 'roster.manage', { kind: 'space', ctx: await spaceContext(db, space) })) return fail(c, 'forbidden', 'Not allowed for this space', 403);
  return { account, space };
}

relinkRoutes.post('/:id/relink-requests', async (c) => {
  const decision = relinkLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    return c.json({ ok: false, error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds: decision.retryAfterSeconds } } }, 429);
  }
  const db = dbFor(c);
  const space = await db.getSpace(c.req.param('id'));
  if (!space || space.archivedAt) return fail(c, 'not_found', 'Space not found', 404);
  const parsed = RelinkCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid re-link body', 422, { issues: parsed.error.issues });
  const { code, learnerId, deviceId, platform } = parsed.data;
  const now = new Date();
  if (space.joinCode !== code) return fail(c, 'code_not_found', 'That code does not open this space', 404);
  if (!isJoinCodeLive(space, now)) return fail(c, 'code_expired', 'This code has expired', 404);
  if (!(await db.membership(space.id, 'learner', learnerId)) || !(await db.getLearner(learnerId))) return fail(c, 'learner_not_found', 'That name is not in this class', 404);
  if (await db.getDevice(learnerId, deviceId)) return fail(c, 'already_bound', 'This device already has this learner', 409);

  const existing = (await liveRelinks(db, space.id, now)).find((r) => r.learnerId === learnerId && r.deviceId === deviceId && r.status === 'pending');
  if (existing) return ok(c, { request: publicRequest(existing) });

  const request: StoredRelink = {
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
  await db.putRelink(request);
  return ok(c, { request: publicRequest(request) }, 201);
});

relinkRoutes.get('/:id/relink-requests', async (c) => {
  const db = dbFor(c);
  const gated = await requireManager(c, db, c.req.param('id'));
  if (!('space' in gated)) return gated;
  const now = new Date();
  const pending = (await liveRelinks(db, gated.space.id, now)).filter((r) => r.status === 'pending').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const requests = [];
  for (const r of pending) {
    const learner = await db.getLearner(r.learnerId);
    requests.push({ ...publicRequest(r), learnerName: rosterName(gated.space, learner?.displayName ?? '?') });
  }
  return ok(c, { requests });
});

async function decide(c: Context, approve: boolean): Promise<Response> {
  const db = dbFor(c);
  const gated = await requireManager(c, db, c.req.param('id') ?? '');
  if (!('space' in gated)) return gated;
  const req = await db.getRelink(c.req.param('rid') ?? '');
  if (!req || req.spaceId !== gated.space.id) return fail(c, 'not_found', 'Request not found', 404);
  const now = new Date();
  if (expireIfDue(req, now)) await db.putRelink(req);
  if (req.status !== 'pending') return fail(c, req.status === 'expired' ? 'expired' : 'not_pending', `Request is ${req.status}`, 409);
  req.status = approve ? 'approved' : 'denied';
  req.decidedAt = now.toISOString();
  if (approve) {
    const secret = newDeviceSecret();
    // Class-scoped (SEC-4): whoever holds this device — the student, or the teacher who asked for it — gets the class inbox, not the snapshot.
    await db.putDevice({ learnerId: req.learnerId, deviceId: req.deviceId, secretHash: await hashSecret(secret), scope: 'class', createdAt: req.decidedAt, lastSeenAt: req.decidedAt });
    req.secret = secret; // handed to the device on its next poll, once
  }
  await db.putRelink(req);
  return ok(c, { request: publicRequest(req) });
}

relinkRoutes.post('/:id/relink-requests/:rid/approve', (c) => decide(c, true));
relinkRoutes.post('/:id/relink-requests/:rid/deny', (c) => decide(c, false));

/** The requesting device polls here; credentials come back exactly once. */
relinkRoutes.get('/:id/relink-requests/:rid', async (c) => {
  const db = dbFor(c);
  const req = await db.getRelink(c.req.param('rid'));
  const deviceId = c.req.query('deviceId') ?? '';
  if (!req || req.spaceId !== c.req.param('id') || !deviceId || req.deviceId !== deviceId) return fail(c, 'not_found', 'Request not found', 404);
  if (expireIfDue(req, new Date())) await db.putRelink(req);
  if (req.status !== 'approved' || !req.secret) return ok(c, { status: req.status, expiresAt: req.expiresAt });
  const learner = await db.getLearner(req.learnerId);
  if (!learner) return fail(c, 'not_found', 'Learner not found', 404);
  const secret = req.secret;
  req.secret = null;
  await db.putRelink(req);
  // No snapshot: a class role never hands out progress (SEC-4). The learner's Rescue Code brings it back.
  return ok(c, {
    status: 'approved',
    expiresAt: req.expiresAt,
    learner: publicLearner(learner),
    device: { deviceId, secret, scope: 'class' },
    snapshot: null,
  });
});
