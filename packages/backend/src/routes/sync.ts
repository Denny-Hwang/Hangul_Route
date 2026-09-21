import { LearnerRegisterSchema, SnapshotPutSchema } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { authorizeDevice, hashSecret, newDeviceSecret } from '../lib/device-auth';
import { id, store, type Learner, type SnapshotRecord } from '../store';

/**
 * /api/sync — F-SYNC-001 §3.2. One snapshot row per learner with
 * optimistic concurrency (`rev`); the client merges on 409.
 */
export const syncRoutes = new Hono();

syncRoutes.post('/learners', async (c) => {
  const parsed = LearnerRegisterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid registration body', 422, { issues: parsed.error.issues });
  const { deviceId, learner: input } = parsed.data;

  const learnerId = input.id && !store.learners.has(input.id) ? input.id : id('profile');
  if (input.id && store.learners.has(input.id)) {
    return fail(c, 'conflict', 'Learner id already registered — restore instead', 409);
  }
  const now = new Date().toISOString();
  const learner: Learner = {
    id: learnerId,
    displayName: input.displayName,
    ageGroup: input.ageGroup,
    avatar: input.avatar,
    recoveryHash: null,
    createdAt: now,
    lastActiveAt: now,
  };
  store.learners.set(learner.id, learner);

  const secret = newDeviceSecret();
  store.bindDevice({ learnerId: learner.id, deviceId, secretHash: await hashSecret(secret), createdAt: now, lastSeenAt: now });
  return ok(c, { learner, device: { deviceId, secret } }, 201);
});

syncRoutes.put('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;

  const parsed = SnapshotPutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid snapshot body', 422, { issues: parsed.error.issues });
  const body = parsed.data;
  if (body.snapshot.profileId !== learnerId) {
    return fail(c, 'bad_request', 'snapshot.profileId must match the learner', 422);
  }

  const current = store.snapshots.get(learnerId);
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
  store.snapshots.set(learnerId, record);
  const learner = store.learners.get(learnerId);
  if (learner) learner.lastActiveAt = record.updatedAt;
  return ok(c, { rev: record.rev, updatedAt: record.updatedAt });
});

syncRoutes.get('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const record = store.snapshots.get(learnerId);
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
  // plans / memberships / tier are wired in F-PLAN-001 / F-SPACE-001 / F-ENT-001.
  return ok(c, {
    rev: store.snapshots.get(learnerId)?.rev ?? 0,
    plans: [],
    memberships: [],
    tier: 'free',
    serverTime: new Date().toISOString(),
  });
});
