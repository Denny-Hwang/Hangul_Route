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
  TransferCreateBodySchema,
  TransferDeclineBodySchema,
  TransferEmptyBodySchema,
  TransferFamilyPrefsBodySchema,
  TransferPreviewBodySchema,
  isTransferConsentLocale,
  transferConsentLineIds,
  type Space,
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
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { classSeatCheck } from '../lib/seats';
import {
  classTransferEnabled,
  consentTermsFor,
  familyGuardianRole,
  guardianOf,
  learnerSideCooldown,
  newRequest,
  newTransferId,
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
  type TransferSourceView,
  type ViewLookups,
} from '../lib/transfer-views';
import type { Account } from '../store';
import { rosterName } from './spaces';

/**
 * /api/spaces/:id/transfer-requests — F-SPACE-002 section 4.4, PR T-5a: the
 * console routes without execution (preview, create, list, decline, cancel)
 * and the guardian's `transfer-prefs` switch. `:id` is the acting space: the
 * source class (a manager holding `learner.transfer`), the family (a guardian,
 * guard 9) or, for the list only, a school (counts). Approve, retry and the
 * move itself come with T-5b; the device routes and the inbox with T-5c.
 *
 * Every handler checks the `CLASS_TRANSFER` lock first (T15): locked, it
 * answers 422 `transfers_locked` before it reads a header, a body or the
 * database. Every body is `.strict()`. Anything the caller may not act on
 * answers 404 `not_found`, never 403, so no route is an existence oracle.
 */
export const transferSpaceRoutes = new Hono<{ Bindings: TransferEnv }>();

type Ctx = Context<{ Bindings: TransferEnv }>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Ended and executed requests stay on a class or family page this long (wireframe: "Terminal cards stay 30 days"). */
const HISTORY_MS = 30 * DAY_MS;
/** Rows read per role before filtering; open requests are at most 14 days old and history 30, so this covers a page of 50. */
const LIST_FETCH = 200;
/** Bounded purge on create (section 4.1). */
const PURGE_TRANSFERS_LIMIT = 50;
const PURGE_RATE_HITS_LIMIT = 200;

/** Per-client limiter on preview + create, in memory per isolate (copied from the lookup limiter, section 4.2 guard 4). */
export const TRANSFER_CLIENT_LIMIT = 20;
export const transferClientLimiter = createRateLimiter(TRANSFER_CLIENT_LIMIT, HOUR_MS);

const locked = (c: Ctx): Response => fail(c, 'transfers_locked', 'Class moves are not available yet', 422);
const notFound = (c: Ctx): Response => fail(c, 'not_found', 'Not found', 404);
const badRequest = (c: Ctx): Response => fail(c, 'bad_request', 'Invalid move request', 422);
const tooMany = (c: Ctx, code: string, retryAfterSeconds: number, message = 'Too many attempts — try again later'): Response => fail(c, code, message, 429, { retryAfterSeconds });
const closed = (c: Ctx, row: StoredTransfer): Response => (row.status === 'expired' ? fail(c, 'expired', 'This request has expired', 409) : fail(c, 'not_open', 'This request is no longer open', 409));
/** One neutral answer for every reason a teacher may not start a request (section 4.9): no reason, no days, no hint that anyone said no. */
const cannotSend = (c: Ctx): Response => fail(c, 'cannot_send', 'This request cannot be sent right now', 422);

async function actorOf(db: Db, account: Account): Promise<AccountActor> {
  return { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
}

// ---------------------------------------------------------------------------
// Bodies

interface ParsedSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<string | number> }> } };
}

/** A well-formed code put in place of a malformed one, so the rest of the body still parses; never resolved. */
const PLACEHOLDER_CODE = 'AAAAAA';

/**
 * Parses a preview / create body. A malformed code alone is not a bad body
 * but a failed code attempt (`invalid_code`, counted after the caller is
 * authorized, guard 4); any other problem, unknown keys included, is null.
 */
async function readCodeBody<T>(c: Ctx, schema: ParsedSchema<T>): Promise<{ data: T; codeInvalid: boolean } | null> {
  const raw: unknown = await c.req.json().catch(() => null);
  const first = schema.safeParse(raw);
  if (first.success) return { data: first.data, codeInvalid: false };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !first.error.issues.every((issue) => issue.path[0] === 'code')) return null;
  const second = schema.safeParse({ ...(raw as Record<string, unknown>), code: PLACEHOLDER_CODE });
  return second.success ? { data: second.data, codeInvalid: true } : null;
}

async function readBody<T>(c: Ctx, schema: ParsedSchema<T>): Promise<T | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Preview and create (sections 4.2, 4.4, 4.9)

/** Who is starting the move, after guard 2 (entitled to the learner and the source). */
type StartingSide = { kind: 'class'; source: Space; via: TransferVia } | { kind: 'family'; family: Space; source: Space; role: TransferGuardianRole };

/** Seconds until the failed-code brake opens, or null while it is open (D1-backed, whatever the isolate). */
async function codeBrake(db: Db, key: string, now: Date): Promise<number | null> {
  if ((await db.countRateHits(key, new Date(now.getTime() - HOUR_MS))) >= TRANSFER_CODE_FAILS_PER_HOUR) return HOUR_MS / 1000;
  if ((await db.countRateHits(key, new Date(now.getTime() - DAY_MS))) >= TRANSFER_CODE_FAILS_PER_DAY) return DAY_MS / 1000;
  return null;
}

/** The learner-side view needs the learner's switches; a family page always has a caregiver route (the viewer is one). */
async function familyViewContext(db: Db, family: Space, learnerId: string, env: TransferEnv | undefined, now: Date) {
  const prefs = await db.getTransferPrefs(learnerId);
  return { family, selfManaged: prefs.selfManaged, caregiverRoute: true, deviceConsent: transferDeviceConsentEnabled(env), now };
}

async function startedView(db: Db, side: StartingSide, row: StoredTransfer, env: TransferEnv | undefined, now: Date): Promise<TransferSourceView | TransferLearnerSideView> {
  const look = await viewLookups(db, [row]);
  return side.kind === 'class' ? sourceView(row, look) : learnerSideView(db, row, look, await familyViewContext(db, side.family, row.learnerId, env, now));
}

type MoveBody = (TransferPreviewBody & { destinationSpaceId?: undefined; introduce?: undefined; consent?: undefined }) | TransferCreateBody;

/**
 * Preview and create share one sequence of guards (section 4.2), in this order:
 * lock; per-client limiter; account; the acting space and the caller's right
 * to the learner and the source (404 otherwise, guard 2); body shape per
 * route; learner-level rules that say nothing about any destination; the
 * failed-code brake and the code (guard 3 and 4); the destination; guard 9
 * for a guardian; an open request (idempotent for the same caller on create);
 * already a member; the 7-day cooldown; advisory capacity; a busy
 * destination; then, on create only, the daily create limits.
 */
async function startMove(c: Ctx, mode: 'preview' | 'create'): Promise<Response> {
  if (!classTransferEnabled(c.env)) return locked(c);
  const limit = transferClientLimiter.check(clientKey((n) => c.req.header(n)));
  if (!limit.allowed) return tooMany(c, 'too_many_attempts', limit.retryAfterSeconds);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
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
    if (body.fromSpaceId === undefined || (mode === 'create' && body.consent === undefined)) return badRequest(c);
    const source = await db.getSpace(body.fromSpaceId);
    if (!source || !(await db.membership(source.id, 'learner', body.learnerId))) return notFound(c);
    if (source.kind !== 'class' || source.archivedAt) return fail(c, 'not_transferable', 'Only a live class can be moved from', 422);
    side = { kind: 'family', family: acting, source, role };
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
  let guardianRole: TransferGuardianRole | null = null;
  if (side.kind === 'family') {
    const guardian = await guardianOf(db, account.id, learnerId, { sourceSpaceId: source.id, destSpaceId: dest.id, initiator: 'learner_side', initiatorAccountId: account.id }, now, { familyId: side.family.id });
    if (!guardian.ok) {
      if (guardian.error === 'family_too_new') return fail(c, 'family_too_new', 'Moves open one day after a family is set up', 422);
      if (guardian.error === 'conflicted_guardian') return fail(c, 'conflicted_guardian', 'A teacher of either class cannot answer for the family', 409);
      return notFound(c);
    }
    guardianRole = guardian.role;
  }

  // One open request per learner; the same caller's own request comes back on a repeated create (section 4.9).
  const initiator: TransferInitiator = side.kind === 'class' ? 'source' : 'learner_side';
  const open = await db.openTransferOf(learnerId);
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
  if ((await db.countOpenTransfersTo(dest.id)) >= TRANSFER_MAX_OPEN_PER_DESTINATION) return fail(c, 'destination_busy', 'That class has too many moves waiting', 409);

  if (mode === 'preview') {
    if (side.kind === 'class') return ok(c, { destination: { id: dest.id, kind: dest.kind, name: dest.name } });
    const [facts, terms] = await Promise.all([destinationFacts(db, dest, now), learnerSideTerms(db, learnerId, source, dest, now)]);
    return ok(c, { destination: { id: dest.id, kind: dest.kind, name: dest.name, ...facts }, ...terms });
  }

  // Create only: the daily limits, the bounded purge, then the insert.
  const dayAgo = new Date(now.getTime() - DAY_MS);
  if ((await db.countTransfersCreatedBy(account.id, dayAgo)) >= TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY) return tooMany(c, 'too_many_requests', DAY_MS / 1000, 'Too many requests today — try again tomorrow');
  if ((await db.countTransfersCreatedForLearner(learnerId, dayAgo)) >= TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY) return tooMany(c, 'too_many_requests', DAY_MS / 1000, 'Too many requests today — try again tomorrow');
  const purgeBefore = new Date(now.getTime() - TRANSFER_PURGE_AFTER_MS);
  await db.purgeTransfers(purgeBefore, purgeBefore, PURGE_TRANSFERS_LIMIT);
  await db.purgeRateHits(dayAgo, PURGE_RATE_HITS_LIMIT);

  const common = { id: newTransferId(), learnerId, sourceSpaceId: source.id, destSpaceId: dest.id, introduce: body.introduce ?? false, now };
  let row: StoredTransfer;
  if (side.kind === 'class') {
    row = newRequest({ ...common, initiator: 'source', initiatorAccountId: account.id, via: side.via });
  } else {
    const consent = body.consent;
    if (!consent || guardianRole === null) return badRequest(c);
    const [terms, sheet] = await Promise.all([consentTermsFor(db, learnerId, source, dest, now), learnerSideTerms(db, learnerId, source, dest, now)]);
    const flags = { premiumChange: sheet.premiumChange, destinationConsentMode: sheet.destinationConsentMode, relinkAffected: sheet.relinkAffected, sourcePlansAffected: sheet.sourcePlansAffected };
    row = newRequest({
      ...common,
      initiator: 'learner_side',
      initiatorAccountId: account.id,
      consent: {
        basis: 'caregiver',
        attest: null,
        evidence: account.id,
        role: guardianRole,
        textVersion: consent.textVersion,
        locale: consent.locale,
        shown: { lineIds: transferConsentLineIds({ initiator: 'learner_side', ...flags }), flags },
        terms,
      },
    });
  }
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
// List (section 4.4): settles each open row first, then builds views set-based

/** Brings open rows up to date (expiry, archived destination, learner left). There is no scheduler; reads do it. */
async function settleAll(db: Db, rows: readonly StoredTransfer[], now: Date, env: TransferEnv | undefined): Promise<StoredTransfer[]> {
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

const recent = (t: StoredTransfer, now: Date): boolean => {
  const since = new Date(now.getTime() - HISTORY_MS).toISOString();
  return isOpenTransfer(t) || (t.status === 'executed' && (t.executedAt ?? '') >= since) || (isEndedTransfer(t) && (t.endedAt ?? '') >= since);
};

/** Open first, then newest first; stable within a refresh. */
const listOrder = (a: StoredTransfer, b: StoredTransfer): number => Number(isOpenTransfer(b)) - Number(isOpenTransfer(a)) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/**
 * What a class sees as the destination (T8): only requests whose learner slot
 * is consented; of the ended ones, only those this class ended itself (other
 * endings disappear for the destination at once, section 4.9).
 */
const destinationSees = (t: StoredTransfer): boolean => t.learner.state === 'consented' && (!isEndedTransfer(t) || t.endActor === 'destination');

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
    const [asSource, asDest] = await Promise.all([db.transfersOfSpace(space.id, 'source', LIST_FETCH), db.transfersOfSpace(space.id, 'destination', LIST_FETCH)]);
    const src = (await settleAll(db, asSource, now, c.env)).filter((t) => recent(t, now));
    const dst = (await settleAll(db, asDest, now, c.env)).filter((t) => recent(t, now) && destinationSees(t));
    const rows = [...src, ...dst].sort(listOrder).slice(0, TRANSFER_LIST_MAX);
    const look = await viewLookups(db, rows);
    const requests: Array<TransferSourceView | TransferDestinationView> = rows.map((t) => (t.sourceSpaceId === space.id ? sourceView(t, look) : destinationView(t, look)));
    return ok(c, { requests });
  }

  if (space.kind === 'family') {
    if (space.archivedAt || !can(actor, 'snapshot.read', { kind: 'space', ctx })) return notFound(c);
    const learnerIds = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId);
    const all: StoredTransfer[] = [];
    for (const learnerId of learnerIds) all.push(...(await db.transfersOfLearner(learnerId)));
    const rows = (await settleAll(db, all, now, c.env)).filter((t) => recent(t, now)).sort(listOrder).slice(0, TRANSFER_LIST_MAX);
    const look = await viewLookups(db, rows);
    const learners = new Map((await db.getLearners(learnerIds)).map((l) => [l.id, l]));
    const contexts = new Map<string, Awaited<ReturnType<typeof familyViewContext>>>();
    const options = [];
    for (const learnerId of learnerIds) {
      const learner = learners.get(learnerId);
      if (!learner) continue;
      const prefs = await db.getTransferPrefs(learnerId);
      contexts.set(learnerId, { family: space, selfManaged: prefs.selfManaged, caregiverRoute: true, deviceConsent: transferDeviceConsentEnabled(c.env), now });
      const classes: Array<{ spaceId: string; name: string }> = [];
      for (const m of await db.membershipsOf('learner', learnerId)) {
        const s = await db.getSpace(m.spaceId);
        if (s && s.kind === 'class' && !s.archivedAt) classes.push({ spaceId: s.id, name: s.name });
      }
      options.push({ learnerId, name: rosterName(space, learner.displayName), classes, selfManaged: prefs.selfManaged, blockTeacherRequests: prefs.blockTeacherRequests });
    }
    const requests: TransferLearnerSideView[] = [];
    for (const t of rows) requests.push(await learnerSideView(db, t, look, contexts.get(t.learnerId) ?? (await familyViewContext(db, space, t.learnerId, c.env, now))));
    return ok(c, { requests, options });
  }

  // A school sees how many moves wait per child class, nothing else (TransferSchoolCountView).
  if (space.archivedAt || !can(actor, 'roster.manage', { kind: 'space', ctx })) return notFound(c);
  const counts = [];
  for (const cls of await db.childSpaces(space.id)) {
    if (cls.kind !== 'class' || cls.archivedAt) continue;
    const [asSource, asDest] = await Promise.all([db.transfersOfSpace(cls.id, 'source', LIST_FETCH), db.transfersOfSpace(cls.id, 'destination', LIST_FETCH)]);
    const src = (await settleAll(db, asSource.filter(isOpenTransfer), now, c.env)).filter(isOpenTransfer);
    const dst = (await settleAll(db, asDest.filter(isOpenTransfer), now, c.env)).filter((t) => isOpenTransfer(t) && destinationSees(t));
    counts.push({ spaceId: cls.id, waiting: src.length + dst.length });
  }
  return ok(c, { requests: [], counts });
});

// ---------------------------------------------------------------------------
// Decline and cancel (sections 4.2, 4.4)

/** The acting party on a `:tid` route, after the ownership rules of section 4.4. */
type Party = { kind: 'source' | 'destination'; space: Space } | { kind: 'family'; family: Space };

/** A class party: `:id` is this request's source or destination, live, and the caller holds `learner.transfer` there. */
async function classParty(db: Db, actor: AccountActor, space: Space, row: StoredTransfer, slot: 'source' | 'destination'): Promise<Party | null> {
  if (space.kind !== 'class' || space.archivedAt) return null;
  if (space.id !== (slot === 'source' ? row.sourceSpaceId : row.destSpaceId)) return null;
  if (!teacherVia(actor, await spaceContext(db, space))) return null;
  // The destination cannot see a request before the learner side said yes (T8).
  if (slot === 'destination' && row.learner.state !== 'consented') return null;
  return { kind: slot, space };
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

/** Loads the request, settles it, and refuses one that is no longer open. */
async function openRow(c: Ctx, db: Db, row: StoredTransfer, now: Date): Promise<StoredTransfer | Response> {
  const settled = (await settle(db, row, now, c.env)).request;
  if (!settled) return notFound(c);
  return isOpenTransfer(settled) ? settled : closed(c, settled);
}

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
  const changed = await db.declineSlot(row.id, body.slot, end.reason, end.actor, now);
  const after = await db.getTransfer(row.id);
  if (!after) return notFound(c);
  if (changed === 0) return closed(c, after);
  await db.addTransferEvent({ transferId: row.id, at: now.toISOString(), actorKind: 'account', actorRef: account.id, event: 'declined', slot: body.slot, detail: body.reason ? { reason: body.reason } : null });
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
  const changed = await db.cancelTransfer(row.id, byFamily ? 'withdrawn_learner' : 'cancelled_initiator', byFamily ? 'family' : 'source', now);
  const after = await db.getTransfer(row.id);
  if (!after) return notFound(c);
  if (changed === 0) return closed(c, after);
  await db.addTransferEvent({ transferId: row.id, at: now.toISOString(), actorKind: 'account', actorRef: account.id, event: 'cancelled', slot: byFamily ? 'learner' : 'source', detail: null });
  return ok(c, { request: await partyView(db, party, after, c.env, now) });
});

// ---------------------------------------------------------------------------
// The guardian's switch (section 4.2 guard 13): only `blockTeacherRequests`; `selfManaged` belongs to the learner's device (T-5c)

transferSpaceRoutes.put('/:id/learners/:learnerId/transfer-prefs', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = await readBody(c, TransferFamilyPrefsBodySchema);
  if (!body) return badRequest(c);
  const db = dbFor(c);
  const space = await db.getSpace(c.req.param('id'));
  const learnerId = c.req.param('learnerId');
  if (!space || space.kind !== 'family' || space.archivedAt || !(await familyGuardianRole(db, account.id, learnerId, space.id))) return notFound(c);
  await db.setTransferPref(learnerId, 'blockTeacherRequests', body.blockTeacherRequests, new Date());
  const prefs = await db.getTransferPrefs(learnerId);
  return ok(c, { prefs: { blockTeacherRequests: prefs.blockTeacherRequests, selfManaged: prefs.selfManaged } });
});
