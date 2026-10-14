import {
  CLASS_MOVE_LIST_MAX,
  CLASS_MOVE_NOTICE_MS,
  CLASS_MOVE_PURGE_AFTER_MS,
  CLASS_MOVE_WINDOW_MS,
  CLASS_SCOPE_TEXT_VERSION,
  ClassMoveCreateBodySchema,
  ClassMoveEmptyBodySchema,
  ClassMovePreviewBodySchema,
  ClassScopeAckBodySchema,
  LEARNER_CLASS_CAP,
  isFullScopeVersion,
  rosterAlias,
  type ClassMoveCreateBody,
  type ClassMoveVia,
  type InboxClassMove,
  type InboxClassScope,
  type Space,
  type TelemetryEventName,
} from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor, transferRateKey, type ClassMoveDecider, type Db, type StoredClassMove } from '../db';
import { finiteCap } from '../db/transfer-rules';
import { fail, ok } from '../envelope';
import { requireAccount, spaceContext } from '../lib/access';
import type { AccountActor } from '../lib/can';
import { recordClassScopeAck } from '../lib/class-scope';
import { authorizeDevice } from '../lib/device-auth';
import { classCap, schoolIsFull } from '../lib/entitlement';
import { isJoinCodeLive } from '../lib/join-code';
import { createRateLimiter } from '../lib/rate-limit';
import { classSeatCheck, type SeatBlock } from '../lib/seats';
import { recordServerEvent } from '../lib/server-events';
import { classTransferEnabled, settle, teacherVia, type TransferEnv } from '../lib/transfer';
import type { Account } from '../store';
import { rosterName } from './spaces';
import { DAY_MS, HOUR_MS, badRequest, codeBrake, locked, notFound, readBody, readCodeBody, tooMany, type Ctx } from './transfers';

/**
 * [TV] Teacher moves and the class-scope update — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3
 * (owner decisions 2026-10-14).
 *
 * Teacher moves (`/api/spaces/:id/class-moves…`), behind the same `CLASS_TRANSFER` lock as the
 * family-started moves of F-SPACE-002 (422 `transfers_locked` before anything is read):
 * - direct (TV-D7): the actor holds `learner.transfer` on both classes (the owner or teacher of both, or a
 *   school owner or admin over both); the learner moves in the same call, no consent from anyone;
 * - accept (TV-D8): the destination is named by its live join code and moves only when a manager of the
 *   destination accepts; until then the destination sees initials, picture and level (F-SPACE-002 T8).
 * The family is told once afterwards (TV-D10). Anything the caller may not act on answers 404, never 403.
 *
 * The class-scope update (`/api/spaces/:id/class-scope`, `…/learners/:learnerId/class-scope`, and the
 * device route `PUT /api/sync/learners/:id/class-scope`) is not behind the lock: what teachers see does
 * not depend on whether moves are on.
 */
export const classMoveRoutes = new Hono<{ Bindings: TransferEnv }>();
export const classScopeSyncRoutes = new Hono<{ Bindings: TransferEnv }>();

/** Rows read per role before the 30-day window and the list cap. */
const LIST_FETCH = 200;
/** Ended and executed rows stay on a class page this long (as the family-started moves). */
const HISTORY_MS = 30 * DAY_MS;
const PURGE_LIMIT = 50;

/** Per-account limiter on preview and create, in memory per isolate; the durable failed-code brake backs it. */
export const CLASS_MOVE_CLIENT_LIMIT = 30;
export const classMoveClientLimiter = createRateLimiter(CLASS_MOVE_CLIENT_LIMIT, HOUR_MS);

const newMoveId = (): string => `move:${crypto.randomUUID()}`;

async function actorOf(db: Db, account: Account): Promise<AccountActor> {
  return { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
}

/** How the actor manages a live class (`owner`, `teacher`, `school_admin`), or null. */
async function managerVia(db: Db, actor: AccountActor, space: Space | null): Promise<ClassMoveVia | null> {
  if (!space || space.kind !== 'class' || space.archivedAt) return null;
  return teacherVia(actor, await spaceContext(db, space));
}

function event(name: TelemetryEventName, payload?: Record<string, unknown>): void {
  recordServerEvent(name, payload);
}

// ---------------------------------------------------------------------------
// Execution (section 4.2): advisory school check in JS, then the self-guarding batch.

type MoveOutcome = { executed: true } | { executed: false; reason: SeatBlock | null };

async function executeMove(db: Db, move: StoredClassMove, decider: ClassMoveDecider, now: Date): Promise<MoveOutcome> {
  const dest = await db.getSpace(move.destSpaceId);
  if (!dest) return { executed: false, reason: null };
  const alreadyIn = (await db.membership(dest.id, 'learner', move.learnerId)) !== null;
  if (!alreadyIn && (await schoolIsFull(db, dest, now, move.learnerId))) return { executed: false, reason: 'cap_school' };
  const result = await db.executeClassMove({
    id: move.id,
    learnerId: move.learnerId,
    sourceSpaceId: move.sourceSpaceId,
    destSpaceId: move.destSpaceId,
    decider,
    destCap: finiteCap(await classCap(db, dest, now)),
    learnerCap: LEARNER_CLASS_CAP,
    now,
  });
  if (result.executed) return { executed: true };
  return { executed: false, reason: await classSeatCheck(db, dest, move.learnerId, now, { excludeSpaceId: move.sourceSpaceId }) };
}

/**
 * Brings an open row up to date before it is shown or acted on (there is no scheduler): past its 14 days it
 * expires; a learner who left the source or a destination that was archived ends it. Answers the row as stored.
 */
async function settleMove(db: Db, move: StoredClassMove, now: Date): Promise<StoredClassMove> {
  if (move.status !== 'requested') return move;
  if (move.expiresAt <= now.toISOString()) {
    await db.endClassMove(move.id, 'expired', 'expired', null, now);
  } else if (!(await db.membership(move.sourceSpaceId, 'learner', move.learnerId))) {
    await db.endClassMove(move.id, 'cancelled', 'learner_left', null, now);
  } else {
    const dest = await db.getSpace(move.destSpaceId);
    if (!dest || dest.archivedAt) await db.endClassMove(move.id, 'cancelled', 'destination_archived', null, now);
    else return move;
  }
  return (await db.getClassMove(move.id)) ?? move;
}

const recentMove = (m: StoredClassMove, now: Date): boolean => {
  const since = new Date(now.getTime() - HISTORY_MS).toISOString();
  return m.status === 'requested' || (m.executedAt ?? '') >= since || (m.endedAt ?? '') >= since;
};
const listOrder = (a: StoredClassMove, b: StoredClassMove): number =>
  Number(b.status === 'requested') - Number(a.status === 'requested') || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------
// Views (ids and live names; ended rows carry no actor and no reason, anti-shame)

export type ClassMoveViewStatus = 'waiting' | 'moved' | 'ended';
const viewStatus = (m: StoredClassMove): ClassMoveViewStatus => (m.status === 'requested' ? 'waiting' : m.status === 'executed' ? 'moved' : 'ended');

export interface OutgoingMoveView {
  id: string;
  kind: StoredClassMove['kind'];
  status: ClassMoveViewStatus;
  to: { spaceId: string; name: string };
  /** The learner while still in this class (the roster's name); null once moved or ended. */
  learner: { name: string; avatar: string } | null;
  createdAt: string;
  expiresAt: string;
  at: string | null;
}

export interface IncomingMoveView {
  id: string;
  kind: StoredClassMove['kind'];
  status: ClassMoveViewStatus;
  from: { name: string };
  /** Before acceptance initials, picture and level only (T8); after the move, the roster's name. */
  learner: { alias: string; avatar: string; level: string } | { name: string; avatar: string } | null;
  createdAt: string;
  expiresAt: string;
  at: string | null;
}

interface Lookups {
  spaces: Map<string, Space>;
  learners: Map<string, { displayName: string; avatar: string; ageGroup: string }>;
}

async function lookups(db: Db, rows: readonly StoredClassMove[]): Promise<Lookups> {
  const spaceIds = [...new Set(rows.flatMap((m) => [m.sourceSpaceId, m.destSpaceId]))];
  const learnerIds = [...new Set(rows.map((m) => m.learnerId))];
  const [spaces, learners] = await Promise.all([db.getSpaces(spaceIds), db.getLearners(learnerIds)]);
  return { spaces: new Map(spaces.map((s) => [s.id, s])), learners: new Map(learners.map((l) => [l.id, l])) };
}

const at = (m: StoredClassMove): string | null => m.executedAt ?? m.endedAt;

function outgoingView(m: StoredClassMove, look: Lookups): OutgoingMoveView {
  const source = look.spaces.get(m.sourceSpaceId);
  const learner = look.learners.get(m.learnerId);
  return {
    id: m.id,
    kind: m.kind,
    status: viewStatus(m),
    to: { spaceId: m.destSpaceId, name: look.spaces.get(m.destSpaceId)?.name ?? '' },
    learner: m.status === 'requested' && learner && source ? { name: rosterName(source, learner.displayName), avatar: learner.avatar } : null,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    at: at(m),
  };
}

function incomingView(m: StoredClassMove, look: Lookups): IncomingMoveView {
  const dest = look.spaces.get(m.destSpaceId);
  const learner = look.learners.get(m.learnerId);
  let shown: IncomingMoveView['learner'] = null;
  if (learner && m.status === 'requested') shown = { alias: rosterAlias(learner.displayName), avatar: learner.avatar, level: learner.ageGroup };
  else if (learner && dest && m.status === 'executed') shown = { name: rosterName(dest, learner.displayName), avatar: learner.avatar };
  return {
    id: m.id,
    kind: m.kind,
    status: viewStatus(m),
    from: { name: look.spaces.get(m.sourceSpaceId)?.name ?? '' },
    learner: shown,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    at: at(m),
  };
}

// ---------------------------------------------------------------------------
// Destinations a teacher may move into directly (TV-D7)

classMoveRoutes.get('/:id/class-moves/destinations', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const source = await db.getSpace(c.req.param('id'));
  const actor = await actorOf(db, account);
  const learnerId = c.req.query('learnerId') ?? '';
  if (!(await managerVia(db, actor, source)) || !source || !(await db.membership(source.id, 'learner', learnerId))) return notFound(c);

  // The classes the account reaches: its own class memberships, and the classes of a school it runs.
  const own = await db.getSpaces(actor.memberships.filter((m) => m.memberKind === 'account').map((m) => m.spaceId));
  const schools = own.filter((s) => s.kind === 'school' && !s.archivedAt).map((s) => s.id);
  const children = schools.length ? await db.childSpacesOfSpaces(schools) : [];
  const learnerIn = new Set((await db.membershipsOf('learner', learnerId)).map((m) => m.spaceId));
  // Parents come from the spaces already read (a school the account runs), else one read per distinct parent, so the
  // statement count does not grow with the number of classes (G7 budget; a school admin may reach many classes).
  const known = new Map<string, Space | null>([...own, ...children].map((s) => [s.id, s]));
  const parentOf = async (space: Space): Promise<Space | null> => {
    const id = space.parentSpaceId;
    if (!id) return null;
    if (!known.has(id)) known.set(id, await db.getSpace(id));
    return known.get(id) ?? null;
  };
  const seen = new Set<string>();
  const destinations: Array<{ id: string; name: string }> = [];
  for (const space of [...own, ...children]) {
    if (seen.has(space.id) || space.id === source.id || space.kind !== 'class' || space.archivedAt || learnerIn.has(space.id)) continue;
    seen.add(space.id);
    if (teacherVia(actor, { space, parent: await parentOf(space) })) destinations.push({ id: space.id, name: space.name });
  }
  destinations.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return ok(c, { destinations });
});

// ---------------------------------------------------------------------------
// Preview by code, and create (direct or accept)

/** Resolves a typed code like `/join`, counting every failure durably (the transfer brake, F-SPACE-002 guard 4). */
async function resolveCode(c: Ctx, db: Db, accountId: string, code: string, codeInvalid: boolean, now: Date): Promise<Space | Response> {
  const key = transferRateKey.codeAccount(accountId);
  const brake = await codeBrake(db, key, now);
  if (brake !== null) return tooMany(c, 'too_many_attempts', brake);
  const failed = async (errorCode: string, message: string, status: 404 | 422): Promise<Response> => {
    await db.recordRateHit(key, now);
    return fail(c, errorCode, message, status);
  };
  if (codeInvalid) return failed('invalid_code', 'Join code must be 6 letters or digits', 422);
  const dest = await db.spaceByCode(code);
  if (!dest || dest.archivedAt) return failed('code_not_found', 'No class has this code', 404);
  if (!isJoinCodeLive(dest, now)) return failed('code_expired', 'This code has expired', 404);
  return dest;
}

classMoveRoutes.post('/:id/class-moves/preview', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const limit = classMoveClientLimiter.check(`acct:${account.id}`);
  if (!limit.allowed) return tooMany(c, 'too_many_attempts', limit.retryAfterSeconds);
  const parsed = await readCodeBody(c, ClassMovePreviewBodySchema);
  if (!parsed) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const source = await db.getSpace(c.req.param('id'));
  const actor = await actorOf(db, account);
  if (!(await managerVia(db, actor, source)) || !source || !(await db.membership(source.id, 'learner', parsed.data.learnerId))) return notFound(c);
  const dest = await resolveCode(c, db, account.id, parsed.data.code, parsed.codeInvalid, now);
  if (!('id' in dest)) return dest;
  if (dest.kind !== 'class') return fail(c, 'not_transferable', 'A learner can move into a class only', 422);
  if (dest.id === source.id) return fail(c, 'same_space', 'That is the class the learner is in', 409);
  if (await db.membership(dest.id, 'learner', parsed.data.learnerId)) return fail(c, 'already_member', 'The learner is already in that class', 409);
  return ok(c, { destination: { id: dest.id, name: dest.name }, direct: (await managerVia(db, actor, dest)) !== null });
});

classMoveRoutes.post('/:id/class-moves', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const limit = classMoveClientLimiter.check(`acct:${account.id}`);
  if (!limit.allowed) return tooMany(c, 'too_many_attempts', limit.retryAfterSeconds);
  const parsed = await readCodeBody<ClassMoveCreateBody>(c, ClassMoveCreateBodySchema);
  if (!parsed) return badRequest(c);
  const body = parsed.data;
  const db = dbFor(c);
  const now = new Date();
  const env = c.env;

  // The caller manages the source and the learner is in it (404 otherwise, before anything about a destination).
  const source = await db.getSpace(c.req.param('id'));
  const actor = await actorOf(db, account);
  const sourceVia = await managerVia(db, actor, source);
  if (!sourceVia || !source || !(await db.membership(source.id, 'learner', body.learnerId))) return notFound(c);

  // Direct when the caller also manages the destination (TV-D7); otherwise the live code proves it (TV-D8).
  const named = await db.getSpace(body.destinationSpaceId);
  const destVia = await managerVia(db, actor, named);
  let dest: Space;
  if (destVia && named) {
    dest = named;
  } else {
    if (body.code === undefined) return fail(c, 'code_required', 'A class code is needed for this class', 422);
    const resolved = await resolveCode(c, db, account.id, body.code, parsed.codeInvalid, now);
    if (!('id' in resolved)) return resolved;
    if (resolved.id !== body.destinationSpaceId) return fail(c, 'destination_changed', 'This code now opens a different class', 409);
    dest = resolved;
  }
  if (dest.kind !== 'class' || dest.archivedAt) return fail(c, 'not_transferable', 'A learner can move into a live class only', 422);
  if (dest.id === source.id) return fail(c, 'same_space', 'That is the class the learner is in', 409);
  if (await db.membership(dest.id, 'learner', body.learnerId)) return fail(c, 'already_member', 'The learner is already in that class', 409);

  // One open move per learner, of either kind (each settled first, so an expired one never blocks).
  const openMove = await db.openClassMoveOf(body.learnerId);
  if (openMove && (await settleMove(db, openMove, now)).status === 'requested') return fail(c, 'already_open', 'A move is already waiting for this learner', 409);
  const openTransfer = await db.openTransferOf(body.learnerId);
  if (openTransfer) {
    const settled = (await settle(db, openTransfer, now, env)).request;
    if (settled && (settled.status === 'requested' || settled.status === 'approved')) return fail(c, 'already_open', 'A move is already waiting for this learner', 409);
  }

  const seat = await classSeatCheck(db, dest, body.learnerId, now, { excludeSpaceId: source.id });
  if (seat) return fail(c, seat, 'That class has no room right now', 409);

  const purgeBefore = new Date(now.getTime() - CLASS_MOVE_PURGE_AFTER_MS);
  await db.purgeClassMoves(purgeBefore, purgeBefore, PURGE_LIMIT);

  const iso = now.toISOString();
  const row: StoredClassMove = {
    id: newMoveId(),
    learnerId: body.learnerId,
    sourceSpaceId: source.id,
    destSpaceId: dest.id,
    kind: destVia ? 'direct' : 'accept',
    status: 'requested',
    actorAccountId: account.id,
    actorVia: sourceVia,
    decidedAccountId: null,
    decidedVia: null,
    endReason: null,
    createdAt: iso,
    updatedAt: iso,
    expiresAt: new Date(now.getTime() + CLASS_MOVE_WINDOW_MS).toISOString(),
    executedAt: null,
    endedAt: null,
    familySeenAt: null,
  };
  if ((await db.createClassMove(row)) === 'already_open') return fail(c, 'already_open', 'A move is already waiting for this learner', 409);

  if (row.kind === 'accept') {
    event('space.move.requested');
    const look = await lookups(db, [row]);
    return ok(c, { move: outgoingView((await db.getClassMove(row.id)) ?? row, look) }, 201);
  }

  const outcome = await executeMove(db, row, { accountId: account.id, via: destVia ?? sourceVia }, now);
  if (!outcome.executed) {
    // Lost a race for the last seat (or the learner left): the row ends, nothing moved, the learner keeps the source.
    await db.endClassMove(row.id, 'cancelled', 'no_room', null, now);
    return fail(c, 'move_blocked', 'That class has no room right now', 409, { reason: outcome.reason });
  }
  event('space.move.completed', { via: 'direct' });
  const done = (await db.getClassMove(row.id)) ?? row;
  return ok(c, { move: outgoingView(done, await lookups(db, [done])) });
});

// ---------------------------------------------------------------------------
// Lists: a class (outgoing and incoming), a family (one-time notices)

classMoveRoutes.get('/:id/class-moves', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const now = new Date();
  const space = await db.getSpace(c.req.param('id'));
  if (!space) return notFound(c);
  const actor = await actorOf(db, account);

  if (space.kind === 'class') {
    if (!teacherVia(actor, await spaceContext(db, space))) return notFound(c);
    const [outRaw, inRaw] = await Promise.all([db.classMovesOfSpace(space.id, 'source', LIST_FETCH), db.classMovesOfSpace(space.id, 'destination', LIST_FETCH)]);
    const settle1 = async (rows: StoredClassMove[]): Promise<StoredClassMove[]> => {
      const out: StoredClassMove[] = [];
      for (const row of rows) out.push(await settleMove(db, row, now));
      return out;
    };
    const outgoing = (await settle1(outRaw)).filter((m) => recentMove(m, now)).sort(listOrder).slice(0, CLASS_MOVE_LIST_MAX);
    // The destination sees open asks, moves into it, and the asks it said not now to; other endings leave its page at once.
    const incoming = (await settle1(inRaw))
      .filter((m) => recentMove(m, now) && (m.status === 'requested' || m.status === 'executed' || (m.status === 'declined' && m.endReason === 'not_now')))
      .sort(listOrder)
      .slice(0, CLASS_MOVE_LIST_MAX);
    const look = await lookups(db, [...outgoing, ...incoming]);
    return ok(c, { outgoing: outgoing.map((m) => outgoingView(m, look)), incoming: incoming.map((m) => incomingView(m, look)) });
  }

  if (space.kind === 'family') {
    const role = (await db.membership(space.id, 'account', account.id))?.role;
    if (role !== 'owner' && role !== 'caregiver') return notFound(c);
    const learnerIds = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId);
    const moves = (await db.executedClassMovesOf(learnerIds, new Date(now.getTime() - CLASS_MOVE_NOTICE_MS))).filter((m) => m.familySeenAt === null);
    const look = await lookups(db, moves);
    const notices = moves.map((m) => ({
      id: m.id,
      learnerId: m.learnerId,
      learnerName: look.learners.get(m.learnerId)?.displayName ?? '',
      to: { spaceId: m.destSpaceId, name: look.spaces.get(m.destSpaceId)?.name ?? '' },
      executedAt: m.executedAt ?? m.updatedAt,
    }));
    return ok(c, { notices });
  }
  return notFound(c);
});

// ---------------------------------------------------------------------------
// Decisions: accept and not now (destination), cancel (source), seen (family)

async function loadForClass(c: Ctx, role: 'source' | 'destination'): Promise<{ db: Db; account: Account; space: Space; via: ClassMoveVia; move: StoredClassMove; now: Date } | Response> {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!(await readBody(c, ClassMoveEmptyBodySchema))) return badRequest(c);
  const db = dbFor(c);
  const now = new Date();
  const space = await db.getSpace(c.req.param('id') ?? '');
  const raw = await db.getClassMove(c.req.param('mid') ?? '');
  if (!space || !raw || (role === 'source' ? raw.sourceSpaceId : raw.destSpaceId) !== space.id) return notFound(c);
  const via = teacherVia(await actorOf(db, account), await spaceContext(db, space));
  if (!via) return notFound(c);
  return { db, account, space, via, move: await settleMove(db, raw, now), now };
}

const closedMove = (c: Ctx, m: StoredClassMove): Response => (m.status === 'expired' ? fail(c, 'expired', 'This move has expired', 409) : fail(c, 'not_open', 'This move is no longer open', 409));

classMoveRoutes.post('/:id/class-moves/:mid/accept', async (c) => {
  const loaded = await loadForClass(c, 'destination');
  if (!('db' in loaded)) return loaded;
  const { db, account, via, move, now } = loaded;
  if (move.status === 'executed') return ok(c, { move: incomingView(move, await lookups(db, [move])) });
  if (move.status !== 'requested') return closedMove(c, move);
  const outcome = await executeMove(db, move, { accountId: account.id, via }, now);
  if (!outcome.executed) {
    if (outcome.reason) return fail(c, 'move_blocked', 'This class has no room right now', 409, { reason: outcome.reason });
    const after = await settleMove(db, (await db.getClassMove(move.id)) ?? move, now);
    if (after.status === 'executed') return ok(c, { move: incomingView(after, await lookups(db, [after])) });
    return closedMove(c, after);
  }
  event('space.move.completed', { via: 'accepted' });
  const done = (await db.getClassMove(move.id)) ?? move;
  return ok(c, { move: incomingView(done, await lookups(db, [done])) });
});

classMoveRoutes.post('/:id/class-moves/:mid/decline', async (c) => {
  const loaded = await loadForClass(c, 'destination');
  if (!('db' in loaded)) return loaded;
  const { db, account, via, move, now } = loaded;
  if (move.status !== 'requested') return closedMove(c, move);
  if ((await db.endClassMove(move.id, 'declined', 'not_now', { accountId: account.id, via }, now)) === 0) return closedMove(c, (await db.getClassMove(move.id)) ?? move);
  event('space.move.declined');
  const done = (await db.getClassMove(move.id)) ?? move;
  return ok(c, { move: incomingView(done, await lookups(db, [done])) });
});

classMoveRoutes.post('/:id/class-moves/:mid/cancel', async (c) => {
  const loaded = await loadForClass(c, 'source');
  if (!('db' in loaded)) return loaded;
  const { db, move, now } = loaded;
  if (move.status !== 'requested') return closedMove(c, move);
  if ((await db.endClassMove(move.id, 'cancelled', 'cancelled', null, now)) === 0) return closedMove(c, (await db.getClassMove(move.id)) ?? move);
  event('space.move.cancelled');
  const done = (await db.getClassMove(move.id)) ?? move;
  return ok(c, { move: outgoingView(done, await lookups(db, [done])) });
});

classMoveRoutes.post('/:id/class-moves/:mid/seen', async (c) => {
  if (!classTransferEnabled(c.env)) return locked(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  if (!(await readBody(c, ClassMoveEmptyBodySchema))) return badRequest(c);
  const db = dbFor(c);
  const family = await db.getSpace(c.req.param('id'));
  const move = await db.getClassMove(c.req.param('mid'));
  if (!family || family.kind !== 'family' || !move || move.status !== 'executed') return notFound(c);
  const role = (await db.membership(family.id, 'account', account.id))?.role;
  if ((role !== 'owner' && role !== 'caregiver') || !(await db.membership(family.id, 'learner', move.learnerId))) return notFound(c);
  if ((await db.markClassMoveSeen(move.id, new Date())) === 1) event('space.move.notice_seen', { seenOn: 'console' });
  return ok(c, { seen: true });
});

// ---------------------------------------------------------------------------
// The class-scope update (TV-D4, TV-D5): not behind the move lock

/** Whether the learner is in at least one live class (the update concerns classes only). */
async function inLiveClass(db: Db, learnerId: string): Promise<boolean> {
  const spaces = await db.getSpaces((await db.membershipsOf('learner', learnerId)).map((m) => m.spaceId));
  return spaces.some((s) => s.kind === 'class' && !s.archivedAt);
}

classMoveRoutes.get('/:id/class-scope', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const family = await db.getSpace(c.req.param('id'));
  if (!family || family.kind !== 'family' || family.archivedAt) return notFound(c);
  const role = (await db.membership(family.id, 'account', account.id))?.role;
  if (role !== 'owner' && role !== 'caregiver') return notFound(c);
  const learnerIds = (await db.membersOf(family.id)).filter((m) => m.memberKind === 'learner').map((m) => m.memberId);
  const [learners, acks] = await Promise.all([db.getLearners(learnerIds), db.classScopeAcksOf(learnerIds)]);
  const ackOf = new Map(acks.map((a) => [a.learnerId, a]));
  const rows: Array<{ learnerId: string; name: string; needed: boolean }> = [];
  for (const learner of learners) {
    if (!(await inLiveClass(db, learner.id))) continue;
    rows.push({ learnerId: learner.id, name: learner.displayName, needed: !isFullScopeVersion(ackOf.get(learner.id)?.textVersion) });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.learnerId.localeCompare(b.learnerId));
  return ok(c, { current: CLASS_SCOPE_TEXT_VERSION, learners: rows });
});

classMoveRoutes.post('/:id/learners/:learnerId/class-scope', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = await readBody(c, ClassScopeAckBodySchema);
  const db = dbFor(c);
  const family = await db.getSpace(c.req.param('id'));
  const learnerId = c.req.param('learnerId');
  if (!family || family.kind !== 'family' || family.archivedAt) return notFound(c);
  const role = (await db.membership(family.id, 'account', account.id))?.role;
  if ((role !== 'owner' && role !== 'caregiver') || !(await db.membership(family.id, 'learner', learnerId))) return notFound(c);
  if (!body) return badRequest(c);
  if (body.version !== CLASS_SCOPE_TEXT_VERSION) return fail(c, 'class_scope_stale', 'The update has changed', 422, { current: CLASS_SCOPE_TEXT_VERSION });
  const ack = await recordClassScopeAck(db, { learnerId, textVersion: body.version, basis: 'caregiver', evidence: account.id }, new Date());
  event('space.scope.acknowledged', { basis: 'caregiver' });
  return ok(c, { version: ack.textVersion, ackedAt: ack.ackedAt });
});

classScopeSyncRoutes.put('/learners/:id/class-scope', async (c) => {
  const learnerId = c.req.param('id');
  // A full-scope device only (a class-scoped tablet answers 403 scope_limited): the family's own device.
  const deviceId = await authorizeDevice(c, learnerId);
  if (typeof deviceId !== 'string') return deviceId;
  const body = await readBody(c, ClassScopeAckBodySchema);
  if (!body) return badRequest(c);
  if (body.version !== CLASS_SCOPE_TEXT_VERSION) return fail(c, 'class_scope_stale', 'The update has changed', 422, { current: CLASS_SCOPE_TEXT_VERSION });
  const ack = await recordClassScopeAck(dbFor(c), { learnerId, textVersion: body.version, basis: 'device', evidence: deviceId }, new Date());
  event('space.scope.acknowledged', { basis: 'device' });
  return ok(c, { version: ack.textVersion, ackedAt: ack.ackedAt });
});

// ---------------------------------------------------------------------------
// Inbox fields (section 4.3): lenient on the client, never a failed inbox

export async function inboxClassFields(
  db: Db,
  learnerId: string,
  scope: 'full' | 'class',
  inClass: boolean,
  env: TransferEnv | undefined,
  now: Date,
): Promise<{ classScope: InboxClassScope | null; classMoves: InboxClassMove[] }> {
  if (scope === 'class') return { classScope: null, classMoves: [] };
  try {
    const ack = inClass ? await db.getClassScopeAck(learnerId) : null;
    const classScope = inClass ? { needed: !isFullScopeVersion(ack?.textVersion), current: CLASS_SCOPE_TEXT_VERSION } : null;
    if (!classTransferEnabled(env)) return { classScope, classMoves: [] };
    const moves = await db.executedClassMovesOf([learnerId], new Date(now.getTime() - CLASS_MOVE_NOTICE_MS));
    const spaces = new Map((await db.getSpaces(moves.map((m) => m.destSpaceId))).map((s) => [s.id, s]));
    return {
      classScope,
      classMoves: moves.map((m) => ({ id: m.id, to: { spaceId: m.destSpaceId, name: spaces.get(m.destSpaceId)?.name ?? '' }, executedAt: m.executedAt ?? m.updatedAt })),
    };
  } catch {
    // A failure here never costs the inbox its plans, memberships or tier (F-SPACE-002 section 4.4 rule).
    return { classScope: null, classMoves: [] };
  }
}
