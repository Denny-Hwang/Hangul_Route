import {
  ACCEPTED_CONSENT_TEXT_VERSIONS,
  TRANSFER_CODE_FAILS_PER_DAY,
  TRANSFER_CODE_FAILS_PER_HOUR,
  TRANSFER_CONSENT_TEXT_VERSION,
  TRANSFER_LIST_MAX,
  TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY,
  TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY,
  TRANSFER_MAX_OPEN_PER_DESTINATION,
  TRANSFER_PURGE_AFTER_MS,
  TransferApproveBodySchema,
  TransferCreateBodySchema,
  TransferDeclineBodySchema,
  TransferEmptyBodySchema,
  TransferFamilyPrefsBodySchema,
  TransferPreviewBodySchema,
  isTransferConsentLocale,
  transferConsentLineIds,
  type Space,
  type TransferApproveBody,
  type TransferConsent,
  type TransferCreateBody,
  type TransferEndReason,
  type TransferInitiator,
  type TransferPreviewBody,
  type TransferSlot,
} from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor, transferRateKey, type Db, type StoredTransfer, type TransferEndActor, type TransferGuardianRole, type TransferVia } from '../db';
import { isEndedTransfer, isOpenTransfer } from '../db/transfer-rules';
import { fail, ok } from '../envelope';
import { requireAccount, spaceContext } from '../lib/access';
import { can, type AccountActor } from '../lib/can';
import { isJoinCodeLive } from '../lib/join-code';
import { createRateLimiter } from '../lib/rate-limit';
import { classSeatCheck } from '../lib/seats';
import {
  classTransferEnabled,
  consentTermsDigest,
  consentTermsFor,
  familyGuardianRole,
  guardianOf,
  guardianOfLearner,
  learnerSideCooldown,
  newRequest,
  newTransferId,
  partiesOf,
  planTeacherConsent,
  settle,
  sourceRequestRefused,
  teacherVia,
  transferDeviceConsentEnabled,
  type TransferEnv,
} from '../lib/transfer';
import {
  destinationFacts,
  destinationView,
  hasCaregiverRoute,
  learnerSideTerms,
  learnerSideView,
  sourceView,
  viewLookups,
  type TransferDestinationView,
  type TransferLearnerSideView,
  type LearnerSideContext,
  type TransferSourceView,
  type ViewLookups,
} from '../lib/transfer-views';
import type { Account } from '../store';
import { rosterName } from './spaces';

/**
 * /api/spaces/:id/transfer-requests — F-SPACE-002 section 4.4: the
 * console routes (preview, create, list, decline, cancel, PR T-5a; approve,
 * retry and the move itself through `settle`, PR T-5b) and the guardian's
 * `transfer-prefs` switch. `:id` is the acting space: the source or the
 * destination class (a manager holding `learner.transfer`), the family (a
 * guardian, guard 9) or, for the list only, a school (counts). The learner's
 * device routes and the inbox fields are in `transfer-device.ts` (PR T-5c).
 *
 * Every handler checks the `CLASS_TRANSFER` lock first (T15): locked, it
 * answers 422 `transfers_locked` before it reads a header, a body or the
 * database. Every body is `.strict()`. Anything the caller may not act on
 * answers 404 `not_found`, never 403, so no route is an existence oracle.
 */
export const transferSpaceRoutes = new Hono<{ Bindings: TransferEnv }>();

export type Ctx = Context<{ Bindings: TransferEnv }>;

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** Ended and executed requests stay on a class or family page this long (wireframe: "Terminal cards stay 30 days"). */
const HISTORY_MS = 30 * DAY_MS;
/** History rows (ended or executed) read per role before filtering; open rows are read apart, with no window. */
const LIST_FETCH = 200;
/** Bounded purge on create (section 4.1). */
export const PURGE_TRANSFERS_LIMIT = 50;
export const PURGE_RATE_HITS_LIMIT = 200;

/**
 * Per-account limiter on preview + create, in memory per isolate (section 4.2 guard 4). Keyed by the
 * signed-in account, not the client address: a school behind one NAT address would otherwise share 20
 * an hour across every teacher and guardian. The durable per-account and per-learner limits back it.
 */
export const TRANSFER_CLIENT_LIMIT = 20;
export const transferClientLimiter = createRateLimiter(TRANSFER_CLIENT_LIMIT, HOUR_MS);

export const locked = (c: Ctx): Response => fail(c, 'transfers_locked', 'Class moves are not available yet', 422);
export const notFound = (c: Ctx): Response => fail(c, 'not_found', 'Not found', 404);
export const badRequest = (c: Ctx): Response => fail(c, 'bad_request', 'Invalid move request', 422);
export const tooMany = (c: Ctx, code: string, retryAfterSeconds: number, message = 'Too many attempts — try again later'): Response => fail(c, code, message, 429, { retryAfterSeconds });
export const closed = (c: Ctx, row: StoredTransfer): Response => (row.status === 'expired' ? fail(c, 'expired', 'This request has expired', 409) : fail(c, 'not_open', 'This request is no longer open', 409));
/** One neutral answer for every reason a teacher may not start a request (section 4.9): no reason, no days, no hint that anyone said no. */
const cannotSend = (c: Ctx): Response => fail(c, 'cannot_send', 'This request cannot be sent right now', 422);

async function actorOf(db: Db, account: Account): Promise<AccountActor> {
  return { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
}

// ---------------------------------------------------------------------------
// Bodies

export interface ParsedSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<string | number> }> } };
}

/** A well-formed code put in place of a malformed one, so the rest of the body still parses; never resolved. */
const PLACEHOLDER_CODE = 'AAAAAA';

/**
 * Parses a preview / create body. A malformed code alone is not a bad body
 * but a failed code attempt (`invalid_code`, counted after the caller is
 * authorized, guard 4); any other problem, unknown keys included, is null.
 * Only a code that was typed counts: a missing or non-string `code` is a bad
 * body, so a buggy client cannot brake an account without trying a code.
 */
export async function readCodeBody<T>(c: Ctx, schema: ParsedSchema<T>): Promise<{ data: T; codeInvalid: boolean } | null> {
  const raw: unknown = await c.req.json().catch(() => null);
  const first = schema.safeParse(raw);
  if (first.success) return { data: first.data, codeInvalid: false };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof (raw as { code?: unknown }).code !== 'string' || !first.error.issues.every((issue) => issue.path[0] === 'code')) return null;
  const second = schema.safeParse({ ...(raw as Record<string, unknown>), code: PLACEHOLDER_CODE });
  return second.success ? { data: second.data, codeInvalid: true } : null;
}

export async function readBody<T>(c: Ctx, schema: ParsedSchema<T>): Promise<T | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Preview and create (sections 4.2, 4.4, 4.9)

/** Who is starting the move, after guard 2 (entitled to the learner and the source). `consent` is null on a preview. */
type StartingSide = { kind: 'class'; source: Space; via: TransferVia } | { kind: 'family'; family: Space; source: Space; role: TransferGuardianRole; consent: TransferConsent | null };

/** Seconds until the failed-code brake opens, or null while it is open (D1-backed, whatever the isolate). */
export async function codeBrake(db: Db, key: string, now: Date): Promise<number | null> {
  if ((await db.countRateHits(key, new Date(now.getTime() - HOUR_MS))) >= TRANSFER_CODE_FAILS_PER_HOUR) return HOUR_MS / 1000;
  if ((await db.countRateHits(key, new Date(now.getTime() - DAY_MS))) >= TRANSFER_CODE_FAILS_PER_DAY) return DAY_MS / 1000;
  return null;
}

/** The learner-side view needs the learner's switches; a family page always has a caregiver route (the viewer is one). */
async function familyViewContext(db: Db, family: Space, learnerId: string, env: TransferEnv | undefined, now: Date) {
  const prefs = await db.getTransferPrefs(learnerId);
  return { family, selfManaged: prefs.selfManaged, caregiverRoute: true, deviceConsent: transferDeviceConsentEnabled(env), now };
}

/**
 * What the learner side is shown and agrees to, computed once so the terms and the flags agree
 * (`premiumChange` is computed a single time): the preview's sheet, the create's record and the digest
 * that ties the two together (section 4.11).
 */
export async function consentSheet(db: Db, learnerId: string, source: Space, dest: Space, now: Date) {
  const sheet = await learnerSideTerms(db, learnerId, source, dest, now);
  const flags = { premiumChange: sheet.premiumChange, destinationConsentMode: sheet.destinationConsentMode, relinkAffected: sheet.relinkAffected, sourcePlansAffected: sheet.sourcePlansAffected };
  const terms = await consentTermsFor(db, learnerId, source, dest, now, sheet.premiumChange);
  return { sheet, flags, terms, digest: await consentTermsDigest(terms, flags) };
}

async function startedView(db: Db, side: StartingSide, row: StoredTransfer, env: TransferEnv | undefined, now: Date): Promise<TransferSourceView | TransferLearnerSideView> {
  const look = await viewLookups(db, [row]);
  return side.kind === 'class' ? sourceView(row, look) : learnerSideView(db, row, look, await familyViewContext(db, side.family, row.learnerId, env, now));
}

type MoveBody = (TransferPreviewBody & { destinationSpaceId?: undefined; introduce?: undefined; consent?: undefined }) | TransferCreateBody;

/**
 * Preview and create share one sequence of guards (section 4.2), in this order:
 * lock; account; per-account limiter; the acting space and the caller's right
 * to the learner and the source (404 otherwise, guard 2); body shape per
 * route; learner-level rules that say nothing about any destination; the
 * failed-code brake and the code (guard 3 and 4); the destination; guard 9
 * for a guardian; an open request, settled first (idempotent for the same
 * caller on create); already a member; the 7-day cooldown; advisory capacity;
 * a busy destination; then, on create only, the terms the guardian was shown
 * and the daily create limits.
 */
async function startMove(c: Ctx, mode: 'preview' | 'create'): Promise<Response> {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const limit = transferClientLimiter.check(`acct:${account.id}`);
  if (!limit.allowed) return tooMany(c, 'too_many_attempts', limit.retryAfterSeconds);
  const parsed = await readCodeBody<MoveBody>(c, mode === 'preview' ? TransferPreviewBodySchema : TransferCreateBodySchema);
  if (!parsed) return badRequest(c);
  const body = parsed.data;
  const db = dbFor(c);
  const now = new Date();
  const env = c.env;

  // Guard 2: the caller must be entitled to the learner and the source first.
  const acting = await db.getSpace(c.req.param('id') ?? '');
  if (!acting || acting.archivedAt) return notFound(c);
  const actor = await actorOf(db, account);
  let side: StartingSide;
  if (acting.kind === 'class') {
    const via = teacherVia(actor, await spaceContext(db, acting));
    if (!via || !(await db.membership(acting.id, 'learner', body.learnerId))) return notFound(c);
    // `fromSpaceId` and `consent` are family fields; `introduce` is the learner side's choice alone (T8).
    if (body.fromSpaceId !== undefined || body.consent !== undefined || body.introduce !== undefined) return badRequest(c);
    side = { kind: 'class', source: acting, via };
  } else if (acting.kind === 'family') {
    const role = await familyGuardianRole(db, account.id, body.learnerId, acting.id);
    if (!role) return notFound(c);
    const consent = body.consent ?? null;
    if (body.fromSpaceId === undefined || (mode === 'create' && consent === null)) return badRequest(c);
    const source = await db.getSpace(body.fromSpaceId);
    if (!source || !(await db.membership(source.id, 'learner', body.learnerId))) return notFound(c);
    if (source.kind !== 'class' || source.archivedAt) return fail(c, 'not_transferable', 'Only a live class can be moved from', 422);
    side = { kind: 'family', family: acting, source, role, consent };
  } else {
    return notFound(c);
  }
  const { learnerId } = body;
  const source = side.source;

  // Learner-level rules (they reveal nothing about a destination).
  if (side.kind === 'class') {
    if (await sourceRequestRefused(db, learnerId, now)) return cannotSend(c);
    if (!(await hasCaregiverRoute(db, learnerId))) return fail(c, 'family_needed', 'A family account is needed to answer this', 422);
  } else {
    if ((await db.getTransferPrefs(learnerId)).selfManaged) return fail(c, 'learner_manages_own', 'This learner manages their own classes', 409);
    if (body.consent && !ACCEPTED_CONSENT_TEXT_VERSIONS.includes(body.consent.textVersion)) {
      return fail(c, 'consent_text_stale', 'The consent text has changed', 422, { current: TRANSFER_CONSENT_TEXT_VERSION });
    }
    if (body.consent && !isTransferConsentLocale(body.consent.locale)) return fail(c, 'consent_locale_unavailable', 'This consent text is not available in that language yet', 422);
  }

  // Guards 3 and 4: the code, braked durably on failures.
  const codeKey = transferRateKey.codeAccount(account.id);
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

  // Guard 9 (b, c) for a guardian, now that both classes are known.
  if (side.kind === 'family') {
    const guardian = await guardianOf(db, account.id, learnerId, { sourceSpaceId: source.id, destSpaceId: dest.id, initiator: 'learner_side', initiatorAccountId: account.id }, now, { familyId: side.family.id });
    if (!guardian.ok) {
      if (guardian.error === 'family_too_new') return fail(c, 'family_too_new', 'Moves open one day after a family is set up', 422);
      if (guardian.error === 'conflicted_guardian') return fail(c, 'conflicted_guardian', 'A teacher of either class cannot answer for the family', 409);
      return notFound(c);
    }
  }

  // One open request per learner; the same caller's own request comes back on a repeated create (section 4.9).
  // The open row is settled first (there is no scheduler): one past its expiry, or whose learner left its
  // source, is not open any more and must neither block this request nor come back as a live one.
  const initiator: TransferInitiator = side.kind === 'class' ? 'source' : 'learner_side';
  const openRaw = await db.openTransferOf(learnerId);
  const settledOpen = openRaw ? (await settle(db, openRaw, now, env)).request : null;
  const open = settledOpen && isOpenTransfer(settledOpen) ? settledOpen : null;
  const isOwn = (t: StoredTransfer): boolean => t.sourceSpaceId === source.id && t.destSpaceId === dest.id && t.initiator === initiator && t.initiatorAccountId === account.id;
  const alreadyOpen = (t: StoredTransfer): Response =>
    side.kind === 'family'
      ? fail(c, 'already_open', 'A move is already open for this learner', 409, { startedBy: t.initiator === 'source' ? 'class' : 'learner_side' })
      : fail(c, 'already_open', 'A move is already open for this learner', 409);
  if (open && isOwn(open) && mode === 'create') return ok(c, { request: await startedView(db, side, open, env, now) });
  if (open && !isOwn(open)) return alreadyOpen(open);

  if (await db.membership(dest.id, 'learner', learnerId)) return fail(c, 'already_member', 'The learner is already in that class', 409);
  if (side.kind === 'family') {
    const wait = await learnerSideCooldown(db, learnerId, dest.id, now);
    if (wait !== null) return tooMany(c, 'cooldown', wait, 'You can ask this class again later');
  }
  const seat = await classSeatCheck(db, dest, learnerId, now, { excludeSpaceId: source.id });
  if (seat) return fail(c, seat, 'That class has no room right now', 409);
  // Only requests still inside their 14 days count: an expired row nobody has listed yet is not waiting.
  if ((await db.countOpenTransfersTo(dest.id, now)) >= TRANSFER_MAX_OPEN_PER_DESTINATION) return fail(c, 'destination_busy', 'That class has too many moves waiting', 409);

  if (mode === 'preview') {
    if (side.kind === 'class') return ok(c, { destination: { id: dest.id, kind: dest.kind, name: dest.name } });
    const [facts, shown] = await Promise.all([destinationFacts(db, dest, now), consentSheet(db, learnerId, source, dest, now)]);
    return ok(c, { destination: { id: dest.id, kind: dest.kind, name: dest.name, ...facts }, ...shown.sheet, termsDigest: shown.digest });
  }

  // Create only: the row. For a guardian, what they were shown must still be what they agree to (section 4.11).
  const common = { id: newTransferId(), learnerId, sourceSpaceId: source.id, destSpaceId: dest.id, introduce: body.introduce ?? false, now };
  let row: StoredTransfer;
  if (side.kind === 'class') {
    row = newRequest({ ...common, initiator: 'source', initiatorAccountId: account.id, via: side.via });
  } else {
    const shown = await consentSheet(db, learnerId, source, dest, now);
    // Checked with the body shape above: the family route's create always carries a consent.
    const consent = side.consent as TransferConsent;
    if (consent.termsDigest !== undefined && consent.termsDigest !== shown.digest) return fail(c, 'terms_changed', 'Something about this move has changed. Please look at it again.', 409);
    row = newRequest({
      ...common,
      initiator: 'learner_side',
      initiatorAccountId: account.id,
      consent: {
        basis: 'caregiver',
        attest: null,
        evidence: account.id,
        // Guard 9 was checked through this same family, whose one membership of the account gives the role.
        role: side.role,
        textVersion: consent.textVersion,
        locale: consent.locale,
        shown: { lineIds: transferConsentLineIds({ initiator: 'learner_side', ...shown.flags }), flags: shown.flags },
        terms: shown.terms,
      },
    });
  }

  // Then the daily limits, the bounded purge, and the insert.
  const dayAgo = new Date(now.getTime() - DAY_MS);
  if ((await db.countTransfersCreatedBy(account.id, dayAgo)) >= TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY) return tooMany(c, 'too_many_requests', DAY_MS / 1000, 'Too many requests today — try again tomorrow');
  if ((await db.countTransfersCreatedForLearner(learnerId, dayAgo)) >= TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY) return tooMany(c, 'too_many_requests', DAY_MS / 1000, 'Too many requests today — try again tomorrow');
  const purgeBefore = new Date(now.getTime() - TRANSFER_PURGE_AFTER_MS);
  await db.purgeTransfers(purgeBefore, purgeBefore, PURGE_TRANSFERS_LIMIT);
  await db.purgeRateHits(dayAgo, PURGE_RATE_HITS_LIMIT);

  const detail: Record<string, string> = side.kind === 'class' ? { initiator, via: side.via } : { initiator, basis: 'caregiver' };
  const created = await db.createTransfer(row, { at: now.toISOString(), actorKind: 'account', actorRef: account.id, event: 'created', slot: side.kind === 'class' ? 'source' : 'learner', detail });
  if (created === 'already_open') {
    // Lost a race with another create (the partial unique index is the backstop).
    const winner = await db.openTransferOf(learnerId);
    if (winner && isOwn(winner)) return ok(c, { request: await startedView(db, side, winner, env, now) });
    return winner ? alreadyOpen(winner) : fail(c, 'already_open', 'A move is already open for this learner', 409);
  }
  const stored = (await db.getTransfer(row.id)) ?? row;
  return ok(c, { request: await startedView(db, side, stored, env, now) }, 201);
}

transferSpaceRoutes.post('/:id/transfer-requests/preview', (c) => startMove(c, 'preview'));
transferSpaceRoutes.post('/:id/transfer-requests', (c) => startMove(c, 'create'));

// ---------------------------------------------------------------------------
// List (section 4.4): settles each open row first, then builds views set-based.
// Open rows are read apart from the history window, so newer ended rows can never hide one.

/** Brings open rows up to date (expiry, archived destination, learner left). There is no scheduler; reads do it. */
export async function settleAll(db: Db, rows: readonly StoredTransfer[], now: Date, env: TransferEnv | undefined): Promise<StoredTransfer[]> {
  const out: StoredTransfer[] = [];
  for (const row of rows) {
    if (!isOpenTransfer(row)) {
      out.push(row);
      continue;
    }
    const settled = (await settle(db, row, now, env)).request;
    if (settled) out.push(settled);
  }
  return out;
}

/** The settled open rows, then the history rows not already among them (an open row settled into history keeps its new state). */
function withHistory(settled: readonly StoredTransfer[], history: readonly StoredTransfer[]): StoredTransfer[] {
  const seen = new Set(settled.map((t) => t.id));
  return [...settled, ...history.filter((t) => !isOpenTransfer(t) && !seen.has(t.id))];
}

export const recent = (t: StoredTransfer, now: Date): boolean => {
  const since = new Date(now.getTime() - HISTORY_MS).toISOString();
  return isOpenTransfer(t) || (t.status === 'executed' && (t.executedAt ?? '') >= since) || (isEndedTransfer(t) && (t.endedAt ?? '') >= since);
};

/** Open first, then newest first; stable within a refresh. */
export const listOrder = (a: StoredTransfer, b: StoredTransfer): number => Number(isOpenTransfer(b)) - Number(isOpenTransfer(a)) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/**
 * Whether the destination may know of a request at all (T8): once the learner
 * side said yes. A destination that has answered keeps seeing it when the
 * learner consent is reset later (section 4.6 step 5): it has seen the card
 * already, and the move now waits for the family again.
 */
const destinationMayKnow = (t: StoredTransfer): boolean => t.learner.state === 'consented' || t.destination.state === 'consented';

/**
 * What a class sees as the destination: the requests it may know of; of the
 * ended ones, only those this class ended itself (other endings disappear for
 * the destination at once, section 4.9).
 */
const destinationSees = (t: StoredTransfer): boolean => destinationMayKnow(t) && (!isEndedTransfer(t) || t.endActor === 'destination');

transferSpaceRoutes.get('/:id/transfer-requests', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const now = new Date();
  const space = await db.getSpace(c.req.param('id'));
  if (!space) return notFound(c);
  const actor = await actorOf(db, account);
  const ctx = await spaceContext(db, space);

  if (space.kind === 'class') {
    if (!teacherVia(actor, ctx)) return notFound(c);
    const [openSource, openDest, pastSource, pastDest] = await Promise.all([
      db.openTransfersOfSpaces([space.id], 'source'),
      db.openTransfersOfSpaces([space.id], 'destination'),
      db.transfersOfSpace(space.id, 'source', LIST_FETCH),
      db.transfersOfSpace(space.id, 'destination', LIST_FETCH),
    ]);
    const src = withHistory(await settleAll(db, openSource, now, c.env), pastSource).filter((t) => recent(t, now));
    const dst = withHistory(await settleAll(db, openDest, now, c.env), pastDest).filter((t) => recent(t, now) && destinationSees(t));
    const rows = [...src, ...dst].sort(listOrder).slice(0, TRANSFER_LIST_MAX);
    const look = await viewLookups(db, rows);
    const requests: Array<TransferSourceView | TransferDestinationView> = rows.map((t) => (t.sourceSpaceId === space.id ? sourceView(t, look) : destinationView(t, look)));
    return ok(c, { requests });
  }

  if (space.kind === 'family') {
    if (space.archivedAt || !can(actor, 'snapshot.read', { kind: 'space', ctx })) return notFound(c);
    const learnerIds = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId);
    const perLearner = await Promise.all(
      learnerIds.map(async (learnerId) => {
        const [rows, prefs, memberships] = await Promise.all([db.transfersOfLearner(learnerId), db.getTransferPrefs(learnerId), db.membershipsOf('learner', learnerId)]);
        return { learnerId, rows, prefs, spaceIds: memberships.map((m) => m.spaceId) };
      }),
    );
    const rows = (await settleAll(db, perLearner.flatMap((p) => p.rows), now, c.env)).filter((t) => recent(t, now)).sort(listOrder).slice(0, TRANSFER_LIST_MAX);
    const [look, learnerList, memberSpaces] = await Promise.all([viewLookups(db, rows), db.getLearners(learnerIds), db.getSpaces(perLearner.flatMap((p) => p.spaceIds))]);
    const learners = new Map(learnerList.map((l) => [l.id, l]));
    const liveClasses = new Map(memberSpaces.filter((s) => s.kind === 'class' && !s.archivedAt).map((s) => [s.id, s]));
    const deviceConsent = transferDeviceConsentEnabled(c.env);
    // Every row belongs to one of these learners, so each has its context.
    const contexts = new Map(perLearner.map((p) => [p.learnerId, { family: space, selfManaged: p.prefs.selfManaged, caregiverRoute: true, deviceConsent, now }]));
    const options = perLearner.flatMap((p) => {
      const learner = learners.get(p.learnerId);
      if (!learner) return [];
      const classes = p.spaceIds.flatMap((id) => {
        const s = liveClasses.get(id);
        return s ? [{ spaceId: s.id, name: s.name }] : [];
      });
      return [{ learnerId: p.learnerId, name: rosterName(space, learner.displayName), classes, selfManaged: p.prefs.selfManaged, blockTeacherRequests: p.prefs.blockTeacherRequests }];
    });
    const requests: TransferLearnerSideView[] = [];
    for (const t of rows) requests.push(await learnerSideView(db, t, look, contexts.get(t.learnerId) as LearnerSideContext));
    return ok(c, { requests, options });
  }

  // A school sees how many moves wait per child class, nothing else (TransferSchoolCountView). The counts
  // are read set-based and settle nothing (a school may have many busy classes; settling every row could pass
  // the per-request query limit): a row past its expiry is left out, and the class pages settle the rest.
  if (space.archivedAt || !can(actor, 'roster.manage', { kind: 'space', ctx })) return notFound(c);
  const classes = (await db.childSpaces(space.id)).filter((cls) => cls.kind === 'class' && !cls.archivedAt);
  const ids = classes.map((cls) => cls.id);
  const [asSource, asDest] = await Promise.all([db.openTransfersOfSpaces(ids, 'source'), db.openTransfersOfSpaces(ids, 'destination')]);
  const at = now.toISOString();
  const liveSource = asSource.filter((t) => t.expiresAt > at);
  const liveDest = asDest.filter((t) => t.expiresAt > at && destinationSees(t));
  const counts = ids.map((id) => ({ spaceId: id, waiting: liveSource.filter((t) => t.sourceSpaceId === id).length + liveDest.filter((t) => t.destSpaceId === id).length }));
  return ok(c, { requests: [], counts });
});

// ---------------------------------------------------------------------------
// Decline and cancel (sections 4.2, 4.4)

/** The acting party on a `:tid` route, after the ownership rules of section 4.4; a class party carries how its account holds the class (A12). */
type Party = { kind: 'source' | 'destination'; space: Space; via: TransferVia } | { kind: 'family'; family: Space };

/** A class party: `:id` is this request's source or destination, live, and the caller holds `learner.transfer` there. */
async function classParty(db: Db, actor: AccountActor, space: Space, row: StoredTransfer, slot: 'source' | 'destination'): Promise<Party | null> {
  if (space.kind !== 'class' || space.archivedAt) return null;
  if (space.id !== (slot === 'source' ? row.sourceSpaceId : row.destSpaceId)) return null;
  const via = teacherVia(actor, await spaceContext(db, space));
  if (!via) return null;
  // The destination cannot see a request before the learner side said yes (T8).
  if (slot === 'destination' && !destinationMayKnow(row)) return null;
  return { kind: slot, space, via };
}

/** A guardian party: `:id` is a live family holding the learner and the caller is its owner or caregiver (guard 9a; the safe direction needs no more). */
async function familyParty(db: Db, account: Account, space: Space, row: StoredTransfer): Promise<Party | null> {
  if (space.kind !== 'family' || space.archivedAt) return null;
  return (await familyGuardianRole(db, account.id, row.learnerId, space.id)) ? { kind: 'family', family: space } : null;
}

async function partyView(db: Db, party: Party, row: StoredTransfer, env: TransferEnv | undefined, now: Date): Promise<TransferSourceView | TransferDestinationView | TransferLearnerSideView> {
  const look: ViewLookups = await viewLookups(db, [row]);
  if (party.kind === 'family') return learnerSideView(db, row, look, await familyViewContext(db, party.family, row.learnerId, env, now));
  return party.kind === 'source' ? sourceView(row, look) : destinationView(row, look);
}

/** Settles the request and refuses one that is no longer open (decline and cancel). */
async function openRow(c: Ctx, db: Db, row: StoredTransfer, now: Date): Promise<StoredTransfer | Response> {
  const settled = (await settle(db, row, now, c.env)).request;
  if (!settled) return notFound(c);
  return isOpenTransfer(settled) ? settled : closed(c, settled);
}

/** The audit detail of a deciding party (codes only): a class party's `via`, plus the destination's reason. */
const decidedBy = (party: Party, reason?: string): Record<string, string> | null => (party.kind === 'family' ? null : { ...(reason ? { reason } : {}), via: party.via });

const END_BY_SLOT: Record<TransferSlot, { reason: TransferEndReason; actor: TransferEndActor }> = {
  learner: { reason: 'declined_learner', actor: 'family' },
  source: { reason: 'declined_source', actor: 'source' },
  destination: { reason: 'declined_destination', actor: 'destination' },
};

transferSpaceRoutes.post('/:id/transfer-requests/:tid/decline', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = await readBody(c, TransferDeclineBodySchema);
  if (!body) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const [space, loaded] = await Promise.all([db.getSpace(c.req.param('id')), db.getTransfer(c.req.param('tid'))]);
  if (!space || !loaded) return notFound(c);
  const party = body.slot === 'learner' ? await familyParty(db, account, space, loaded) : await classParty(db, await actorOf(db, account), space, loaded, body.slot);
  if (!party) return notFound(c);

  const row = await openRow(c, db, loaded, now);
  if (row instanceof Response) return row;
  const end = END_BY_SLOT[body.slot];
  // The row keeps only the end actor's kind; who decided, and how and why, is in this event, written with the CAS.
  const event = { at: now.toISOString(), actorKind: 'account' as const, actorRef: account.id, event: 'declined' as const, slot: body.slot, detail: decidedBy(party, body.reason) };
  const changed = await db.declineSlot(row.id, body.slot, end.reason, end.actor, now, event);
  const after = await db.getTransfer(row.id);
  if (!after) return notFound(c);
  if (changed === 0) return closed(c, after);
  return ok(c, { request: await partyView(db, party, after, c.env, now) });
});

transferSpaceRoutes.post('/:id/transfer-requests/:tid/cancel', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!(await readBody(c, TransferEmptyBodySchema))) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const [space, loaded] = await Promise.all([db.getSpace(c.req.param('id')), db.getTransfer(c.req.param('tid'))]);
  if (!space || !loaded) return notFound(c);
  // The class that started the request, or any guardian of the learner (any request on their learner).
  const party = space.kind === 'family' ? await familyParty(db, account, space, loaded) : loaded.initiator === 'source' ? await classParty(db, await actorOf(db, account), space, loaded, 'source') : null;
  if (!party) return notFound(c);

  const row = await openRow(c, db, loaded, now);
  if (row instanceof Response) return row;
  const byFamily = party.kind === 'family';
  const event = { at: now.toISOString(), actorKind: 'account' as const, actorRef: account.id, event: 'cancelled' as const, slot: byFamily ? ('learner' as const) : ('source' as const), detail: decidedBy(party) };
  const changed = await db.cancelTransfer(row.id, byFamily ? 'withdrawn_learner' : 'cancelled_initiator', byFamily ? 'family' : 'source', now, event);
  const after = await db.getTransfer(row.id);
  if (!after) return notFound(c);
  if (changed === 0) return closed(c, after);
  return ok(c, { request: await partyView(db, party, after, c.env, now) });
});

// ---------------------------------------------------------------------------
// Approve and retry (sections 4.2, 4.4, 4.6; PR T-5b). After its compare-and-set an approve runs `settle`
// (promote when every slot is in, then the move once the cooling-off has passed), and so does retry: the
// move happens only inside `settle`'s self-guarding batch, which also revokes the source's class devices,
// closes its pending re-links and writes the audit rows. `settle` checks the learner consent is still fresh
// first and asks the learner side again when it is not.

/** The event of each slot an account fills, written with the CAS (codes only: a class party's `via`, a guardian's basis). */
const consentedEvent = (accountId: string, slot: TransferSlot, detail: Record<string, string>, now: Date) => ({ at: now.toISOString(), actorKind: 'account' as const, actorRef: accountId, event: 'consented' as const, slot, detail });

/** Settles after a consent and answers with the request in its real state (promoted, moved, or reset). */
async function settledView(c: Ctx, db: Db, party: Party, row: StoredTransfer, now: Date): Promise<Response> {
  const settled = (await settle(db, row, now, c.env)).request;
  if (!settled) return notFound(c);
  return ok(c, { request: await partyView(db, party, settled, c.env, now) });
}

const TEACHER_REFUSALS = {
  awaiting_learner: ['awaiting_learner', 'The learner side has not answered yet'],
  one_slot_per_action: ['one_slot_per_action', 'A school admin answers for one class at a time'],
} as const;

/** How many times a teacher approve re-plans after losing a race (another click filled a slot, or a reset emptied the learner slot). */
const APPROVE_ATTEMPTS = 3;

/**
 * Settles the request, then answers for one that is no longer open. Approve stays idempotent after the move:
 * a request that has `executed` with every slot the caller named already in (`named`) answers 200 with its
 * view, so a resent or double-tapped last approval never reads as "no longer open" (section 4.4). Any other
 * closed request answers 409 `not_open` / `expired`. An open one comes back settled.
 */
async function approvableRow(c: Ctx, db: Db, party: Party, loaded: StoredTransfer, now: Date, named: (row: StoredTransfer) => boolean): Promise<StoredTransfer | Response> {
  const settled = (await settle(db, loaded, now, c.env)).request;
  if (!settled) return notFound(c);
  if (isOpenTransfer(settled)) return settled;
  if (settled.status === 'executed' && named(settled)) return ok(c, { request: await partyView(db, party, settled, c.env, now) });
  return closed(c, settled);
}

/**
 * Teacher slots, on a class route. `:id` is the request's source or destination, live, and the caller
 * holds `learner.transfer` there (the destination only once the learner side said yes, T8); every slot
 * named is checked by `planTeacherConsent` against its own class, so one click fills both slots only for
 * a direct owner/teacher of both classes (T11) and a school admin fills one slot per action. Ownership is
 * decided before anything about the body's content is answered, so no 422 tells a stranger the request exists.
 */
async function approveTeacherSlots(c: Ctx, db: Db, account: Account, space: Space, loaded: StoredTransfer, body: TransferApproveBody, now: Date): Promise<Response> {
  // A class never fills the learner slot (T10).
  if (body.slots.includes('learner')) return notFound(c);
  const actor = await actorOf(db, account);
  const ownSlot = space.id === loaded.sourceSpaceId ? 'source' : space.id === loaded.destSpaceId ? 'destination' : null;
  const party = ownSlot ? await classParty(db, actor, space, loaded, ownSlot) : null;
  if (!party) return notFound(c);
  // The consent record and `introduce` are the learner side's alone.
  if (body.consent !== undefined || body.introduce !== undefined) return badRequest(c);
  const slots = body.slots.filter((slot): slot is 'source' | 'destination' => slot !== 'learner');

  const spaces = new Map((await db.getSpaces([loaded.sourceSpaceId, loaded.destSpaceId])).map((s) => [s.id, s]));
  const source = spaces.get(loaded.sourceSpaceId);
  const dest = spaces.get(loaded.destSpaceId);
  if (!source || !dest) return notFound(c);
  const ctx = { source: await spaceContext(db, source), destination: await spaceContext(db, dest) };
  // Every named slot must be the caller's to answer (the per-slot rule of section 4.4), whatever state the request is in.
  if (!slots.every((slot) => teacherVia(actor, ctx[slot]) !== null)) return notFound(c);
  const settled = await approvableRow(c, db, party, loaded, now, (t) => slots.every((slot) => t[slot].state !== 'pending'));
  if (settled instanceof Response) return settled;
  let row = settled;

  for (let attempt = 0; attempt < APPROVE_ATTEMPTS; attempt += 1) {
    const plan = planTeacherConsent(actor, row, slots, ctx);
    // The first plan runs on a row settled just above; a row reloaded after a lost race is settled before it answers.
    if (plan.kind === 'unchanged') return attempt === 0 ? ok(c, { request: await partyView(db, party, row, c.env, now) }) : settledView(c, db, party, row, now);
    if (plan.kind === 'refused') {
      if (plan.error === 'not_found') return notFound(c);
      if (plan.error === 'not_open') return closed(c, row);
      const [code, message] = TEACHER_REFUSALS[plan.error];
      return fail(c, code, message, 409);
    }
    const events = plan.consent.slots.map((slot) => consentedEvent(account.id, slot, { via: plan.consent.via }, now));
    if ((await db.consentSlot(row.id, plan.consent, now, events)) === 1) return settledView(c, db, party, row, now);
    // Lost a race: plan again on the row as it is now.
    const reloaded = await db.getTransfer(row.id);
    if (!reloaded) return notFound(c);
    if (!isOpenTransfer(reloaded)) return closed(c, reloaded);
    row = reloaded;
  }
  // Still open, but it kept changing under this click: not an ending, so not `not_open`.
  return fail(c, 'request_changed', 'This request changed while you answered. Please look at it again.', 409);
}

/**
 * The learner slot, on the family route (a teacher-started request, or a learner-side request whose
 * consent was reset): guard 9 in full for this family first (so an account that passes only 9a learns
 * nothing about the learner's own switch), then the learner's own switch, the consent text, and the
 * sheet the guardian saw (`termsDigest`, section 4.11). A guardian never fills a class slot.
 */
async function approveLearnerSlot(c: Ctx, db: Db, account: Account, family: Space, loaded: StoredTransfer, body: TransferApproveBody, now: Date): Promise<Response> {
  if (body.slots.length !== 1 || body.slots[0] !== 'learner') return notFound(c);
  const party = await familyParty(db, account, family, loaded);
  if (!party) return notFound(c);
  const row = await approvableRow(c, db, party, loaded, now, (t) => t.learner.state === 'consented');
  if (row instanceof Response) return row;
  // Idempotent: a slot already in (another guardian answered first) answers 200 unchanged.
  if (row.learner.state !== 'pending') return ok(c, { request: await partyView(db, party, row, c.env, now) });

  const guardian = await guardianOf(db, account.id, row.learnerId, partiesOf(row), now, { familyId: family.id });
  if (!guardian.ok) {
    if (guardian.error === 'family_too_new') return fail(c, 'family_too_new', 'Moves open one day after a family is set up', 422);
    if (guardian.error === 'conflicted_guardian') return fail(c, 'conflicted_guardian', 'A teacher of either class cannot answer for the family', 409);
    return notFound(c);
  }
  if ((await db.getTransferPrefs(row.learnerId)).selfManaged) return fail(c, 'learner_manages_own', 'This learner manages their own classes', 409);
  // Checked with the body shape: the learner slot always carries a consent.
  const consent = body.consent as TransferConsent;
  if (!ACCEPTED_CONSENT_TEXT_VERSIONS.includes(consent.textVersion)) return fail(c, 'consent_text_stale', 'The consent text has changed', 422, { current: TRANSFER_CONSENT_TEXT_VERSION });
  if (!isTransferConsentLocale(consent.locale)) return fail(c, 'consent_locale_unavailable', 'This consent text is not available in that language yet', 422);

  const spaces = new Map((await db.getSpaces([row.sourceSpaceId, row.destSpaceId])).map((s) => [s.id, s]));
  const source = spaces.get(row.sourceSpaceId);
  const dest = spaces.get(row.destSpaceId);
  if (!source || !dest) return notFound(c);
  const shown = await consentSheet(db, row.learnerId, source, dest, now);
  if (consent.termsDigest !== undefined && consent.termsDigest !== shown.digest) return fail(c, 'terms_changed', 'Something about this move has changed. Please look at it again.', 409);
  const record = {
    basis: 'caregiver' as const,
    attest: null,
    evidence: account.id,
    role: guardian.role,
    textVersion: consent.textVersion,
    locale: consent.locale,
    shown: { lineIds: transferConsentLineIds({ initiator: row.initiator, ...shown.flags }), flags: shown.flags },
    terms: shown.terms,
  };
  const changed = await db.consentSlot(row.id, { kind: 'learner', record, introduce: body.introduce }, now, [consentedEvent(account.id, 'learner', { basis: 'caregiver' }, now)]);
  if (changed === 0) {
    // Lost a race: another guardian answered first (200 unchanged), or the request ended meanwhile.
    const after = await db.getTransfer(row.id);
    if (!after) return notFound(c);
    if (!isOpenTransfer(after)) return closed(c, after);
  }
  return settledView(c, db, party, row, now);
}

transferSpaceRoutes.post('/:id/transfer-requests/:tid/approve', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = await readBody(c, TransferApproveBodySchema);
  if (!body) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const [space, loaded] = await Promise.all([db.getSpace(c.req.param('id')), db.getTransfer(c.req.param('tid'))]);
  if (!space || !loaded) return notFound(c);
  return space.kind === 'family' ? approveLearnerSlot(c, db, account, space, loaded, body, now) : approveTeacherSlots(c, db, account, space, loaded, body, now);
});

/**
 * Try again: `settle` once more for an agreed move (section 4.4). The destination's manager, or a manager
 * of the source who also manages the destination. 200 `executed`, 200 `approved` (still in the cooling-off,
 * or waiting for room with its `blockReason`), 409 `consent_outdated` when the learner side must agree
 * again, 409 `not_approved` while a yes is missing, 409 `not_open` / `expired` once it ended.
 */
transferSpaceRoutes.post('/:id/transfer-requests/:tid/retry', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!(await readBody(c, TransferEmptyBodySchema))) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const [space, loaded] = await Promise.all([db.getSpace(c.req.param('id')), db.getTransfer(c.req.param('tid'))]);
  if (!space || !loaded) return notFound(c);
  const actor = await actorOf(db, account);
  let party: Party | null = null;
  if (space.id === loaded.destSpaceId) {
    party = await classParty(db, actor, space, loaded, 'destination');
  } else if (space.id === loaded.sourceSpaceId) {
    const dest = await db.getSpace(loaded.destSpaceId);
    const managesDest = dest !== null && teacherVia(actor, await spaceContext(db, dest)) !== null;
    party = managesDest ? await classParty(db, actor, space, loaded, 'source') : null;
  }
  if (!party) return notFound(c);

  const result = await settle(db, loaded, now, c.env);
  const after = result.request;
  if (!after) return notFound(c);
  // A reset by this call, or by an earlier read: both teachers said yes and the learner slot is empty again.
  const resetEarlier = after.status === 'requested' && after.learner.state === 'pending' && after.destination.state === 'consented';
  if (result.reset || resetEarlier) return fail(c, 'consent_outdated', 'The family needs to agree again', 409);
  if (after.status === 'requested') return fail(c, 'not_approved', 'Not everyone has agreed yet', 409);
  if (!isOpenTransfer(after) && after.status !== 'executed') return closed(c, after);
  return ok(c, { request: await partyView(db, party, after, c.env, now) });
});

// ---------------------------------------------------------------------------
// The guardian's switch (section 4.2 guard 13): only `blockTeacherRequests`; `selfManaged` belongs to the learner's device (T-5c).
// Switching teacher requests off is the safe direction (guard 9a, like a veto); switching them back on lets
// teacher requests in again, so it needs the whole of guard 9 with the learner's classes as the other parties.

transferSpaceRoutes.put('/:id/learners/:learnerId/transfer-prefs', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = await readBody(c, TransferFamilyPrefsBodySchema);
  if (!body) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const space = await db.getSpace(c.req.param('id'));
  const learnerId = c.req.param('learnerId');
  if (!space || space.kind !== 'family' || space.archivedAt || !(await familyGuardianRole(db, account.id, learnerId, space.id))) return notFound(c);
  if (!body.blockTeacherRequests) {
    const guardian = await guardianOfLearner(db, account.id, learnerId, now, { familyId: space.id });
    if (!guardian.ok && guardian.error === 'family_too_new') return fail(c, 'family_too_new', 'This can be changed one day after joining the family', 422);
    if (!guardian.ok) return fail(c, 'conflicted_guardian', 'A teacher of the learner cannot change this for the family', 409);
  }
  await db.setTransferPref(learnerId, 'blockTeacherRequests', body.blockTeacherRequests, now);
  const prefs = await db.getTransferPrefs(learnerId);
  return ok(c, { prefs: { blockTeacherRequests: prefs.blockTeacherRequests, selfManaged: prefs.selfManaged } });
});
