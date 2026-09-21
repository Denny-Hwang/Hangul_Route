import { RescueClaimSchema } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { accountActor, learnerContexts, requireAccount } from '../lib/access';
import { can } from '../lib/can';
import { authorizeDevice, hashSecret, newDeviceSecret, parseDeviceHeader } from '../lib/device-auth';
import { publicLearner } from '../lib/learners';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { randomRescueCode } from '../lib/rescue-words';
import { store } from '../store';

/**
 * /api/recovery — F-RESTORE-001. Codes are hashed at rest; claiming from a
 * new device mints a device binding and hands back the snapshot.
 */
export const recoveryRoutes = new Hono();

export const CLAIM_LIMIT = 5;
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;
export const claimLimiter = createRateLimiter(CLAIM_LIMIT, CLAIM_WINDOW_MS);

recoveryRoutes.post('/issue', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { learnerId?: string };
  const learnerId = typeof body.learnerId === 'string' ? body.learnerId : '';
  if (!learnerId) return fail(c, 'bad_request', 'learnerId required', 422);
  if (parseDeviceHeader(c.req.header('Authorization'))) {
    const auth = await authorizeDevice(c, learnerId);
    if (typeof auth !== 'string') return auth;
  } else {
    // Teacher / caregiver path (F-TCH-001 §10.2): an adult with roster rights re-issues the code.
    const account = await requireAccount(c);
    if (!('id' in account)) return account;
    if (!can(accountActor(account), 'roster.manage', { kind: 'learner', learnerId, spaces: learnerContexts(learnerId) })) {
      return fail(c, 'forbidden', 'Not allowed for this learner', 403);
    }
  }
  const learner = store.learners.get(learnerId);
  if (!learner) return fail(c, 'not_found', 'Learner not found', 404);
  const code = randomRescueCode();
  learner.recoveryHash = await hashSecret(code); // replaces any previous code
  return ok(c, { code, issuedAt: new Date().toISOString() }, 201);
});

recoveryRoutes.post('/claim', async (c) => {
  const decision = claimLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    return c.json(
      {
        ok: false,
        error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds: decision.retryAfterSeconds } },
      },
      429,
    );
  }
  const parsed = RescueClaimSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Rescue code must look like WORD-WORD-1234', 422);
  const { code, deviceId } = parsed.data;
  const hash = await hashSecret(code);
  const learner = [...store.learners.values()].find((l) => l.recoveryHash === hash);
  if (!learner) return fail(c, 'code_not_found', 'No learner matches this code', 404);

  const now = new Date().toISOString();
  const secret = newDeviceSecret();
  store.bindDevice({ learnerId: learner.id, deviceId, secretHash: await hashSecret(secret), createdAt: now, lastSeenAt: now });
  const record = store.snapshots.get(learner.id);
  return ok(c, {
    learner: publicLearner(learner),
    device: { deviceId, secret },
    snapshot: record ? { rev: record.rev, snapshot: record.payload, summary: record.summary } : null,
  });
});
