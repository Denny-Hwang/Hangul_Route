import {
  ACCEPTED_CONSENT_TEXT_VERSIONS,
  TRANSFER_CONSENT_TEXT_VERSION,
  TRANSFER_LIST_MAX,
  TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY,
  TRANSFER_MAX_OPEN_PER_DESTINATION,
  TRANSFER_PURGE_AFTER_MS,
  DeviceTransferApproveBodySchema,
  DeviceTransferCreateBodySchema,
  DeviceTransferPreviewBodySchema,
  DeviceTransferPrefsBodySchema,
  TransferEmptyBodySchema,
  isTransferConsentLocale,
  transferConsentLineIds,
  type DeviceTransferConsent,
  type DeviceTransferCreateBody,
  type DeviceTransferPreviewBody,
  type InboxTransfer,
  type Space,
} from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor, transferRateKey, type Db, type LearnerConsentRecord, type StoredTransfer } from '../db';
import { isOpenTransfer } from '../db/transfer-rules';
import { fail, ok } from '../envelope';
import { authorizeDevice } from '../lib/device-auth';
import { isJoinCodeLive } from '../lib/join-code';
import { createRateLimiter } from '../lib/rate-limit';
import { classSeatCheck } from '../lib/seats';
import { classTransferEnabled, learnerSideCooldown, newRequest, newTransferId, settle, transferDeviceConsentEnabled, type TransferEnv } from '../lib/transfer';
import { destinationFacts, hasCaregiverRoute, learnerSideView, viewLookups, type TransferLearnerSideView } from '../lib/transfer-views';
import {
  DAY_MS,
  HOUR_MS,
  PURGE_RATE_HITS_LIMIT,
  PURGE_TRANSFERS_LIMIT,
  badRequest,
  closed,
  codeBrake,
  consentSheet,
  listOrder,
  locked,
  notFound,
  readBody,
  readCodeBody,
  recent,
  settleAll,
  tooMany,
  type Ctx,
} from './transfers';

/**
 * /api/sync/learners/:id/transfer-requests and /transfer-prefs — F-SPACE-002
 * section 4.4, the learner's own device (PR T-5c), plus the inbox fields.
 *
 * Every route checks the `CLASS_TRANSFER` lock first (T15). Create and
 * approve, the two routes that let a device fill the learner slot, also check
 * `CLASS_TRANSFER_DEVICE_CONSENT` (decision A4): it stays unset, even after
 * the flip, until counsel signs off (flip gate G6). Preview, decline, cancel,
 * the switch and the inbox need only `CLASS_TRANSFER`: they never make a yes,
 * and the veto (guard 11) only reduces what can happen. Both locks answer
 * before a header, a body or the database is read.
 *
 * Every route needs a full-scope device of the learner: a class-scoped one
 * gets `403 scope_limited` (guard 8, `authorizeDevice` without
 * `allowClassScope`). A request is addressed through its learner: a `:tid`
 * whose learner is not `:id` is 404. A device consent is an attestation,
 * never "verifiable": it is stored as `device_attested` with the client's
 * claim, may be given only for a learner-started request (guard 10), and only
 * for a learner who manages their own classes or has no caregiver account.
 */
export const transferSyncRoutes = new Hono<{ Bindings: TransferEnv }>();

/**
 * Device-started preview + create, in memory per isolate (section 4.9: 10 per client an hour). Keyed by the
 * authenticated device, checked after auth, like the console's per-account limiter: a school's tablets behind
 * one address must not share ten an hour. The durable per-learner limits back it.
 */
export const DEVICE_TRANSFER_LIMIT = 10;
export const deviceTransferLimiter = createRateLimiter(DEVICE_TRANSFER_LIMIT, HOUR_MS);

const deviceLocked = (c: Ctx): Response => fail(c, 'device_consent_locked', 'Moves cannot be agreed on this device yet', 422);
/** Guard 10 and the device row of the matrix (section 4.2): a child with a caregiver account answers in the console. */
const caregiverRequired = (c: Ctx): Response => fail(c, 'caregiver_required', 'Ask the grown-up with the account to answer this in the console', 409);
const tooManyCreates = (c: Ctx): Response => tooMany(c, 'too_many_requests', DAY_MS / 1000, 'Too many requests today — try again tomorrow');

/** May this device fill the learner slot for this learner (section 4.2): the learner manages their own classes, or no caregiver account can. */
async function deviceMayConsent(db: Db, learnerId: string): Promise<boolean> {
  return (await db.getTransferPrefs(learnerId)).selfManaged || !(await hasCaregiverRoute(db, learnerId));
}

/** Guard 7 for a device consent: a version legal has not retired, and a locale with a reviewed text. */
function consentTextRefusal(c: Ctx, consent: DeviceTransferConsent): Response | null {
  if (!ACCEPTED_CONSENT_TEXT_VERSIONS.includes(consent.textVersion)) return fail(c, 'consent_text_stale', 'The consent text has changed', 422, { current: TRANSFER_CONSENT_TEXT_VERSION });
  if (!isTransferConsentLocale(consent.locale)) return fail(c, 'consent_locale_unavailable', 'This consent text is not available in that language yet', 422);
  return null;
}

/** The daily count of device consents for a learner (create and approve, guard 10), D1-backed. */
async function createsToday(db: Db, learnerId: string, now: Date): Promise<number> {
  return db.countRateHits(transferRateKey.createLearner(learnerId), new Date(now.getTime() - DAY_MS));
}

// ---------------------------------------------------------------------------
// Inbox (section 4.4)

/**
 * One learner-side view as the sync inbox carries it: exactly the fields of
 * `InboxTransferSchema`, nothing else (no learner name or id, no terms
 * digest, no timestamps the app does not draw). `canVeto` is always true:
 * only a full-scope device reads transfers, and it can always say no.
 */
export function inboxTransferView(v: TransferLearnerSideView): InboxTransfer {
  return {
    id: v.id,
    status: v.status,
    initiator: v.initiator,
    from: { spaceId: v.from.spaceId, name: v.from.name },
    to: { spaceId: v.to.spaceId, name: v.to.name, ownerName: v.to.ownerName, schoolName: v.to.schoolName, ageBucket: v.to.ageBucket },
    learnerState: v.learnerState,
    sourceState: v.sourceState,
    destinationState: v.destinationState,
    introduce: v.introduce,
    premiumChange: v.premiumChange,
    destinationConsentMode: v.destinationConsentMode,
    relinkAffected: v.relinkAffected,
    sourcePlansAffected: v.sourcePlansAffected,
    visibleToday: v.visibleToday,
    blockReason: v.blockReason,
    executeAfter: v.executeAfter,
    expiresAt: v.expiresAt,
    learnerRoute: v.learnerRoute,
    canVeto: true,
    endedFrom: v.endedFrom,
  };
}

/** The four inbox fields of section 4.4 / T15. */
export interface InboxTransferFields {
  transfersEnabled: boolean;
  transferDeviceConsent: boolean;
  selfManaged: boolean;
  transfers: InboxTransfer[];
}

const INBOX_LOCKED: InboxTransferFields = { transfersEnabled: false, transferDeviceConsent: false, selfManaged: false, transfers: [] };

/** The learner-side views of these rows for this learner's device (the console family list builds the same ones). */
async function deviceViews(db: Db, learnerId: string, rows: readonly StoredTransfer[], env: TransferEnv | undefined, now: Date): Promise<InboxTransfer[]> {
  if (rows.length === 0) return [];
  const [look, prefs, caregiverRoute] = await Promise.all([viewLookups(db, rows), db.getTransferPrefs(learnerId), hasCaregiverRoute(db, learnerId)]);
  const ctx = { family: null, selfManaged: prefs.selfManaged, caregiverRoute, deviceConsent: transferDeviceConsentEnabled(env), now };
  const out: InboxTransfer[] = [];
  for (const t of rows) out.push(inboxTransferView(await learnerSideView(db, t, look, ctx)));
  return out;
}

/**
 * The inbox's transfer fields. **The lock is read before any table**: locked,
 * every field is off or empty and the inbox costs nothing more. A
 * class-scoped device gets no transfers, no switch and no device consent (it
 * can neither consent nor veto, guard 8). A full-scope device gets the
 * learner's requests, open ones settled first (so a read can perform a due
 * move, section 4.6), then the ones that ended or moved in the last 30 days,
 * so the app sees `executed` and refreshes its classes.
 */
export async function inboxTransfers(db: Db, learnerId: string, scope: 'full' | 'class', env: TransferEnv | undefined, now: Date): Promise<InboxTransferFields> {
  if (!classTransferEnabled(env)) return INBOX_LOCKED;
  if (scope === 'class') return { transfersEnabled: true, transferDeviceConsent: false, selfManaged: false, transfers: [] };
  const [prefs, all] = await Promise.all([db.getTransferPrefs(learnerId), db.transfersOfLearner(learnerId)]);
  const rows = (await settleAll(db, all, now, env))
    .filter((t) => recent(t, now))
    .sort(listOrder)
    .slice(0, TRANSFER_LIST_MAX);
  return { transfersEnabled: true, transferDeviceConsent: transferDeviceConsentEnabled(env), selfManaged: prefs.selfManaged, transfers: await deviceViews(db, learnerId, rows, env, now) };
}

async function deviceView(db: Db, learnerId: string, row: StoredTransfer, env: TransferEnv | undefined, now: Date): Promise<InboxTransfer> {
  const [view] = await deviceViews(db, learnerId, [row], env, now);
  return view as InboxTransfer;
}

// ---------------------------------------------------------------------------
// Preview and create (sections 4.2, 4.4, 4.9)

type DeviceMoveBody = (DeviceTransferPreviewBody & { destinationSpaceId?: undefined; introduce?: undefined; consent?: undefined }) | DeviceTransferCreateBody;

/**
 * Preview and create from the learner's device, in the console's order
 * (section 4.2): locks; the device (full scope); the per-device limiter; the
 * body; the learner in a live source class (404 otherwise, guard 2); the
 * device row of the matrix (`caregiver_required`) and the consent text; the
 * failed-code brake per learner and the code (guards 3 and 4); an open
 * request, settled first (idempotent for the same device on create); already
 * a member; the 7-day cooldown; advisory capacity; a busy destination; then,
 * on create only, the sheet the device showed and the daily limits.
 */
async function startDeviceMove(c: Ctx, mode: 'preview' | 'create'): Promise<Response> {
  if (!classTransferEnabled(c.env)) return locked(c);
  if (mode === 'create' && !transferDeviceConsentEnabled(c.env)) return deviceLocked(c);
  const learnerId = c.req.param('id') ?? '';
  const deviceId = await authorizeDevice(c, learnerId);
  if (typeof deviceId !== 'string') return deviceId;
  const limit = deviceTransferLimiter.check(`device:${learnerId}:${deviceId}`);
  if (!limit.allowed) return tooMany(c, 'too_many_attempts', limit.retryAfterSeconds);
  const parsed = await readCodeBody<DeviceMoveBody>(c, mode === 'preview' ? DeviceTransferPreviewBodySchema : DeviceTransferCreateBodySchema);
  if (!parsed) return badRequest(c);
  const body = parsed.data;
  const db = dbFor(c);
  const now = new Date();
  const env = c.env;

  // Guard 2: the learner is in the named source.
  const source = await db.getSpace(body.fromSpaceId);
  if (!source || !(await db.membership(source.id, 'learner', learnerId))) return notFound(c);
  if (source.kind !== 'class' || source.archivedAt) return fail(c, 'not_transferable', 'Only a live class can be moved from', 422);

  // Learner-level rules (they reveal nothing about a destination).
  if (!(await deviceMayConsent(db, learnerId))) return caregiverRequired(c);
  if (body.consent) {
    const refusal = consentTextRefusal(c, body.consent);
    if (refusal) return refusal;
  }

  // Guards 3 and 4: the code, braked durably per learner.
  const codeKey = transferRateKey.codeLearner(learnerId);
  const brake = await codeBrake(db, codeKey, now);
  if (brake !== null) return tooMany(c, 'too_many_attempts', brake);
  const failedCode = async (code: string, message: string, status: 404 | 422): Promise<Response> => {
    await db.recordRateHit(codeKey, now);
    return fail(c, code, message, status);
  };
  if (parsed.codeInvalid) return failedCode('invalid_code', 'Join code must be 6 letters or digits', 422);
  const dest = await db.spaceByCode(body.code);
  if (!dest || dest.archivedAt) return failedCode('code_not_found', 'No class has this code', 404);
  if (!isJoinCodeLive(dest, now)) return failedCode('code_expired', 'This code has expired', 404);
  if (mode === 'create' && dest.id !== body.destinationSpaceId) return fail(c, 'destination_changed', 'This code now opens a different class', 409);
  if (dest.kind !== 'class') return fail(c, 'not_transferable', 'A learner can move into a class only', 422);
  if (dest.id === source.id) return fail(c, 'same_space', 'That is the class the learner is in', 409);

  // One open request per learner; this device's own request comes back on a repeated create (section 4.9).
  const openRaw = await db.openTransferOf(learnerId);
  const settledOpen = openRaw ? (await settle(db, openRaw, now, env)).request : null;
  const open = settledOpen && isOpenTransfer(settledOpen) ? settledOpen : null;
  const isOwn = (t: StoredTransfer): boolean =>
    t.sourceSpaceId === source.id && t.destSpaceId === dest.id && t.initiator === 'learner_side' && t.initiatorAccountId === null && t.learner.basis === 'device_attested' && t.learner.evidence === deviceId;
  const alreadyOpen = (t: StoredTransfer): Response => fail(c, 'already_open', 'A move is already open for this learner', 409, { startedBy: t.initiator === 'source' ? 'class' : 'learner_side' });
  if (open && isOwn(open) && mode === 'create') return ok(c, { request: await deviceView(db, learnerId, open, env, now) });
  if (open && !isOwn(open)) return alreadyOpen(open);

  if (await db.membership(dest.id, 'learner', learnerId)) return fail(c, 'already_member', 'The learner is already in that class', 409);
  const wait = await learnerSideCooldown(db, learnerId, dest.id, now);
  if (wait !== null) return tooMany(c, 'cooldown', wait, 'You can ask this class again later');
  const seat = await classSeatCheck(db, dest, learnerId, now, { excludeSpaceId: source.id });
  if (seat) return fail(c, seat, 'That class has no room right now', 409);
  if ((await db.countOpenTransfersTo(dest.id, now)) >= TRANSFER_MAX_OPEN_PER_DESTINATION) return fail(c, 'destination_busy', 'That class has too many moves waiting', 409);

  if (mode === 'preview') {
    const [facts, shown] = await Promise.all([destinationFacts(db, dest, now), consentSheet(db, learnerId, source, dest, now)]);
    return ok(c, { destination: { id: dest.id, kind: dest.kind, name: dest.name, ...facts }, ...shown.sheet, termsDigest: shown.digest });
  }

  // Create only. Checked with the body shape: the device create always carries a consent.
  const consent = body.consent as DeviceTransferConsent;
  const record = await deviceConsentRecord(db, learnerId, source, dest, deviceId, consent, 'learner_side', now);
  if (!record) return fail(c, 'terms_changed', 'Something about this move has changed. Please look at it again.', 409);
  if ((await createsToday(db, learnerId, now)) >= TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY) return tooManyCreates(c);
  if ((await db.countTransfersCreatedForLearner(learnerId, new Date(now.getTime() - DAY_MS))) >= TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY) return tooManyCreates(c);
  const purgeBefore = new Date(now.getTime() - TRANSFER_PURGE_AFTER_MS);
  await db.purgeTransfers(purgeBefore, purgeBefore, PURGE_TRANSFERS_LIMIT);
  await db.purgeRateHits(new Date(now.getTime() - DAY_MS), PURGE_RATE_HITS_LIMIT);

  const row = newRequest({ id: newTransferId(), learnerId, sourceSpaceId: source.id, destSpaceId: dest.id, introduce: body.introduce ?? false, now, initiator: 'learner_side', initiatorAccountId: null, consent: record });
  const created = await db.createTransfer(row, {
    at: now.toISOString(),
    actorKind: 'device',
    actorRef: deviceId,
    event: 'created',
    slot: 'learner',
    detail: { initiator: 'learner_side', basis: 'device_attested', attest: consent.attest },
  });
  if (created === 'already_open') {
    // Lost a race with another create (the partial unique index is the backstop).
    const winner = await db.openTransferOf(learnerId);
    if (winner && isOwn(winner)) return ok(c, { request: await deviceView(db, learnerId, winner, env, now) });
    return winner ? alreadyOpen(winner) : fail(c, 'already_open', 'A move is already open for this learner', 409);
  }
  await db.recordRateHit(transferRateKey.createLearner(learnerId), now);
  return ok(c, { request: await deviceView(db, learnerId, (await db.getTransfer(row.id)) ?? row, env, now) }, 201);
}

/**
 * The device consent record (section 4.11): basis `device_attested`, the
 * client's claim, the device id as evidence and no guardian role, with the
 * consent-time terms of the sheet computed now. Null when the device sent a
 * `termsDigest` that no longer matches the live sheet (`409 terms_changed`).
 */
async function deviceConsentRecord(db: Db, learnerId: string, source: Space, dest: Space, deviceId: string, consent: DeviceTransferConsent, initiator: StoredTransfer['initiator'], now: Date): Promise<LearnerConsentRecord | null> {
  const shown = await consentSheet(db, learnerId, source, dest, now);
  if (consent.termsDigest !== undefined && consent.termsDigest !== shown.digest) return null;
  return {
    basis: 'device_attested',
    attest: consent.attest,
    evidence: deviceId,
    role: null,
    textVersion: consent.textVersion,
    locale: consent.locale,
    shown: { lineIds: transferConsentLineIds({ initiator, ...shown.flags }), flags: shown.flags },
    terms: shown.terms,
  };
}

transferSyncRoutes.post('/learners/:id/transfer-requests/preview', (c) => startDeviceMove(c, 'preview'));
transferSyncRoutes.post('/learners/:id/transfer-requests', (c) => startDeviceMove(c, 'create'));

// ---------------------------------------------------------------------------
// The request routes: approve (a reset learner-side consent), decline and cancel (the veto, guard 11)

/** Locks, the device and the request of this learner (404 for any other); the body is read by the caller first. */
async function deviceRequestOf(c: Ctx, db: Db): Promise<{ learnerId: string; deviceId: string; row: StoredTransfer } | Response> {
  const learnerId = c.req.param('id') ?? '';
  const deviceId = await authorizeDevice(c, learnerId);
  if (typeof deviceId !== 'string') return deviceId;
  const row = await db.getTransfer(c.req.param('tid') ?? '');
  if (!row || row.learnerId !== learnerId) return notFound(c);
  return { learnerId, deviceId, row };
}

/**
 * A device yes for a learner-started request whose learner consent was reset
 * (section 4.6 step 5). A teacher-started request is answered in the console
 * only (`409 caregiver_required_for_teacher_request`, behaviour 9), whatever
 * state it is in. A learner slot already in answers 200 unchanged.
 */
transferSyncRoutes.post('/learners/:id/transfer-requests/:tid/approve', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  if (!transferDeviceConsentEnabled(c.env)) return deviceLocked(c);
  const db = dbFor(c);
  const found = await deviceRequestOf(c, db);
  if (found instanceof Response) return found;
  const body = await readBody(c, DeviceTransferApproveBodySchema);
  if (!body) return badRequest(c);
  const { learnerId, deviceId, row: loaded } = found;
  const now = new Date();
  if (loaded.initiator !== 'learner_side') return fail(c, 'caregiver_required_for_teacher_request', 'A move a teacher started is answered by the grown-up with the account', 409);

  const settled = (await settle(db, loaded, now, c.env)).request;
  if (!settled) return notFound(c);
  const unchanged = (t: StoredTransfer): Promise<Response> => deviceView(db, learnerId, t, c.env, now).then((request) => ok(c, { request }));
  if (settled.status === 'executed') return unchanged(settled);
  if (!isOpenTransfer(settled)) return closed(c, settled);
  if (settled.learner.state !== 'pending') return unchanged(settled);

  if (!(await deviceMayConsent(db, learnerId))) return caregiverRequired(c);
  const refusal = consentTextRefusal(c, body.consent);
  if (refusal) return refusal;
  if ((await createsToday(db, learnerId, now)) >= TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY) return tooManyCreates(c);
  const spaces = new Map((await db.getSpaces([settled.sourceSpaceId, settled.destSpaceId])).map((s) => [s.id, s]));
  const source = spaces.get(settled.sourceSpaceId);
  const dest = spaces.get(settled.destSpaceId);
  if (!source || !dest) return notFound(c);
  const record = await deviceConsentRecord(db, learnerId, source, dest, deviceId, body.consent, settled.initiator, now);
  if (!record) return fail(c, 'terms_changed', 'Something about this move has changed. Please look at it again.', 409);

  const event = { at: now.toISOString(), actorKind: 'device' as const, actorRef: deviceId, event: 'consented' as const, slot: 'learner' as const, detail: { basis: 'device_attested', attest: body.consent.attest } };
  const changed = await db.consentSlot(settled.id, { kind: 'learner', record }, now, [event]);
  if (changed === 1) await db.recordRateHit(transferRateKey.createLearner(learnerId), now);
  const after = await db.getTransfer(settled.id);
  if (!after) return notFound(c);
  // Lost a race: answered meanwhile (200 as it is), or ended (409).
  if (changed === 0 && !isOpenTransfer(after)) return closed(c, after);
  const final = (await settle(db, after, now, c.env)).request ?? after;
  return unchanged(final);
});

transferSyncRoutes.post('/learners/:id/transfer-requests/:tid/decline', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const db = dbFor(c);
  const found = await deviceRequestOf(c, db);
  if (found instanceof Response) return found;
  if (!(await readBody(c, TransferEmptyBodySchema))) return badRequest(c);
  return endFromDevice(c, db, found, 'decline');
});

transferSyncRoutes.post('/learners/:id/transfer-requests/:tid/cancel', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const db = dbFor(c);
  const found = await deviceRequestOf(c, db);
  if (found instanceof Response) return found;
  if (!(await readBody(c, TransferEmptyBodySchema))) return badRequest(c);
  return endFromDevice(c, db, found, 'cancel');
});

/**
 * The learner's veto (guard 11): a decline ends the request `declined_learner`,
 * a cancel `withdrawn_learner`, both with `end_actor: device` and the audit
 * event in the same transaction as the CAS. Any open request, whatever route
 * filled the learner slot and whoever started it.
 */
async function endFromDevice(c: Ctx, db: Db, found: { learnerId: string; deviceId: string; row: StoredTransfer }, kind: 'decline' | 'cancel'): Promise<Response> {
  const now = new Date();
  const settled = (await settle(db, found.row, now, c.env)).request;
  if (!settled) return notFound(c);
  if (!isOpenTransfer(settled)) return closed(c, settled);
  const event = { at: now.toISOString(), actorKind: 'device' as const, actorRef: found.deviceId, event: kind === 'decline' ? ('declined' as const) : ('cancelled' as const), slot: 'learner' as const, detail: null };
  const changed = kind === 'decline' ? await db.declineSlot(settled.id, 'learner', 'declined_learner', 'device', now, event) : await db.cancelTransfer(settled.id, 'withdrawn_learner', 'device', now, event);
  const after = await db.getTransfer(settled.id);
  if (!after) return notFound(c);
  if (changed === 0) return closed(c, after);
  return ok(c, { request: await deviceView(db, found.learnerId, after, c.env, now) });
}

// ---------------------------------------------------------------------------
// The learner's switch (section 4.2 guard 13): only `selfManaged`; `blockTeacherRequests` is the family's.

transferSyncRoutes.put('/learners/:id/transfer-prefs', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const learnerId = c.req.param('id');
  const deviceId = await authorizeDevice(c, learnerId);
  if (typeof deviceId !== 'string') return deviceId;
  const body = await readBody(c, DeviceTransferPrefsBodySchema);
  if (!body) return badRequest(c);
  const db = dbFor(c);
  await db.setTransferPref(learnerId, 'selfManaged', body.selfManaged, new Date());
  return ok(c, { prefs: { selfManaged: (await db.getTransferPrefs(learnerId)).selfManaged } });
});
