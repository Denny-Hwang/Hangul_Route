import { LearnerRegisterSchema, SnapshotPutSchema, TIER_GRACE_MS } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { authorizeDevice, hashSecret, newDeviceSecret } from '../lib/device-auth';
import { tierForLearner } from '../lib/entitlement';
import { id, type Learner, type SnapshotRecord } from '../store';
import { inboxPlansFor } from './plans';
import { learnerMembershipRows } from './spaces';

/**
 * /api/sync — F-SYNC-001 §3.2. One snapshot row per learner with
 * optimistic concurrency (`rev`); the client merges on 409.
 */
export const syncRoutes = new Hono();

syncRoutes.post('/learners', async (c) => {
  const parsed = LearnerRegisterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid registration body', 422, { issues: parsed.error.issues });
  const { deviceId, learner: input } = parsed.data;
  const db = dbFor(c);

  if (input.id && (await db.getLearner(input.id))) {
    return fail(c, 'conflict', 'Learner id already registered — restore instead', 409);
  }
  const now = new Date().toISOString();
  const learner: Learner = {
    id: input.id ?? id('profile'),
    displayName: input.displayName,
    ageGroup: input.ageGroup,
    avatar: input.avatar,
    recoveryHash: null,
    createdAt: now,
    lastActiveAt: now,
  };
  await db.putLearner(learner);

  const secret = newDeviceSecret();
  await db.putDevice({ learnerId: learner.id, deviceId, secretHash: await hashSecret(secret), createdAt: now, lastSeenAt: now });
  return ok(c, { learner, device: { deviceId, secret } }, 201);
});

syncRoutes.put('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const db = dbFor(c);

  const parsed = SnapshotPutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid snapshot body', 422, { issues: parsed.error.issues });
  const body = parsed.data;
  if (body.snapshot.profileId !== learnerId) {
    return fail(c, 'bad_request', 'snapshot.profileId must match the learner', 422);
  }

  const current = await db.getSnapshot(learnerId);
  const currentRev = current?.rev ?? 0;
  if (body.baseRev !== currentRev) {
    return c.json(
      {
        ok: false,
        error: { code: 'conflict', message: 'Snapshot changed on the server — merge and retry' },
        data: { rev: currentRev, snapshot: current?.payload ?? null, summary: current?.summary ?? null },
      },
      409,
    );
  }

  const record: SnapshotRecord = {
    learnerId,
    rev: currentRev + 1,
    schemaVer: body.schemaVer,
    contentVer: body.contentVer,
    deviceId: auth,
    summary: body.summary,
    payload: body.snapshot,
    updatedAt: new Date().toISOString(),
  };
  await db.putSnapshot(record);
  const learner = await db.getLearner(learnerId);
  if (learner) await db.putLearner({ ...learner, lastActiveAt: record.updatedAt });
  return ok(c, { rev: record.rev, updatedAt: record.updatedAt });
});

syncRoutes.get('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const record = await dbFor(c).getSnapshot(learnerId);
  if (!record) return fail(c, 'no_snapshot', 'No snapshot uploaded yet', 404);
  return ok(c, {
    rev: record.rev,
    snapshot: record.payload,
    summary: record.summary,
    updatedAt: record.updatedAt,
    schemaVer: record.schemaVer,
    contentVer: record.contentVer,
  });
});

syncRoutes.get('/learners/:id/inbox', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const db = dbFor(c);
  const now = new Date();
  const { tier, source } = await tierForLearner(db, learnerId, now);
  return ok(c, {
    rev: (await db.getSnapshot(learnerId))?.rev ?? 0,
    plans: await inboxPlansFor(db, learnerId),
    memberships: await learnerMembershipRows(db, learnerId),
    tier,
    tierSource: source,
    tierValidUntil: tier === 'premium' ? new Date(now.getTime() + TIER_GRACE_MS).toISOString() : null,
    serverTime: now.toISOString(),
  });
});
