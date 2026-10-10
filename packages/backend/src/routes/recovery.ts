import { RescueClaimSchema } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, learnerContexts, requireAccount } from '../lib/access';
import { can } from '../lib/can';
import { authorizeDevice, hashSecret, newDeviceSecret, parseDeviceHeader } from '../lib/device-auth';
import { publicLearner } from '../lib/learners';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { rescueHash, rescueLookupHashes, rescuePepper } from '../lib/rescue-hash';
import { randomRescueCode } from '../lib/rescue-words';
import type { Learner } from '../store';

/**
 * /api/recovery — F-RESTORE-001. Codes are hashed at rest (keyed with
 * RESCUE_PEPPER when set, SEC-5); claiming from a new device mints a device
 * binding and hands back the snapshot.
 */
export const recoveryRoutes = new Hono();

/**
 * Per client key, per isolate (lib/rate-limit). Not durable across isolates;
 * with >= 50-bit codes online guessing is out of reach regardless, so a
 * D1-backed counter is left for later (F-RESTORE-001 §3.2).
 */
export const CLAIM_LIMIT = 5;
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;
export const claimLimiter = createRateLimiter(CLAIM_LIMIT, CLAIM_WINDOW_MS);

/** Draws per issue before giving up: a collision needs two equal ~52-bit codes, so a second draw is already rare. */
export const ISSUE_ATTEMPTS = 3;
let nextCode: () => string = () => randomRescueCode();

/** Tests only: script the codes `/issue` draws (null restores the crypto generator). */
export function setRescueCodeSourceForTests(source: (() => string) | null): void {
  nextCode = source ?? (() => randomRescueCode());
}

const isUniqueViolation = (err: unknown): boolean => err instanceof Error && /UNIQUE constraint failed/i.test(err.message);

/** Stores a fresh code for the learner, drawing again if its hash is already taken. Null when every draw collided. */
async function storeNewCode(save: (learner: Learner) => Promise<void>, learner: Learner, pepper: string | undefined): Promise<string | null> {
  for (let attempt = 0; attempt < ISSUE_ATTEMPTS; attempt += 1) {
    const code = nextCode();
    try {
      await save({ ...learner, recoveryHash: await rescueHash(code, pepper) }); // replaces any previous code
      return code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return null;
}

recoveryRoutes.post('/issue', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { learnerId?: string };
  const learnerId = typeof body.learnerId === 'string' ? body.learnerId : '';
  if (!learnerId) return fail(c, 'bad_request', 'learnerId required', 422);
  const db = dbFor(c);
  if (parseDeviceHeader(c.req.header('Authorization'))) {
    const auth = await authorizeDevice(c, learnerId);
    if (typeof auth !== 'string') return auth;
  } else {
    // Grown-up path (F-TCH-001 §10.2, narrowed by SEC-4): a code is a bearer credential for the
    // whole snapshot, so only an adult who may read it (family owner / caregiver) re-issues one.
    const account = await requireAccount(c);
    if (!('id' in account)) return account;
    if (!can(await accountActor(db, account), 'snapshot.read', { kind: 'learner', learnerId, spaces: await learnerContexts(db, learnerId) })) {
      return fail(c, 'forbidden', 'Not allowed for this learner', 403);
    }
  }
  const learner = await db.getLearner(learnerId);
  if (!learner) return fail(c, 'not_found', 'Learner not found', 404);
  const code = await storeNewCode((l) => db.putLearner(l), learner, rescuePepper(c.env));
  if (!code) return fail(c, 'code_unavailable', 'Could not issue a code right now — try again', 500);
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
  if (!parsed.success) return fail(c, 'bad_request', 'Rescue code must look like WORD-WORD-WORD-WORD-123456', 422);
  const { code, deviceId } = parsed.data;
  const db = dbFor(c);
  let learner: Learner | null = null;
  for (const hash of await rescueLookupHashes(code, rescuePepper(c.env))) {
    learner = await db.learnerByRecoveryHash(hash);
    if (learner) break;
  }
  if (!learner) return fail(c, 'code_not_found', 'No learner matches this code', 404);

  const now = new Date().toISOString();
  const secret = newDeviceSecret();
  // 'full' also widens a class-approved binding on this device: the code proves the grown-up's say-so.
  await db.putDevice({ learnerId: learner.id, deviceId, secretHash: await hashSecret(secret), scope: 'full', createdAt: now, lastSeenAt: now });
  const record = await db.getSnapshot(learner.id);
  return ok(c, {
    learner: publicLearner(learner),
    device: { deviceId, secret },
    snapshot: record ? { rev: record.rev, snapshot: record.payload, summary: record.summary } : null,
  });
});
