import type { Membership, PendingMoveStep, RosterPending, RosterPendingMove, Space, SpaceAttention, SpaceKind } from '@hangul-route/content-schema';
import type { Db, StoredClassMove, StoredRelink, StoredTransfer } from '../db';
import { isOpenTransfer } from '../db/transfer-rules';
import type { Action } from './can';
import { settleMove } from './moves';
import { liveRelinks } from './relinks';
import { classTransferEnabled, settle, type TransferEnv } from './transfer';

/*
 * [GX-W] What waits for a grown-up's answer — AMENDMENTS-GROWNUP-UX section 12 (Worker first, additive, no migration).
 *
 * - The roster (`GET /:id/roster`) gets `learners[].pending` and, on a class, `incoming`. It settles the rows it reads
 *   first (expiry, executed or ended moves) and only then reads the members, so a move executed on this read lists the
 *   learner as a member and never also as pending. Each field is gated on the action that can decide it.
 * - The spaces list (`GET /api/spaces`) gets `attention`, counts only. It never writes: every count filters what a
 *   list route's settle would end (past the window, learner left the source, destination archived), so a past-expiry
 *   row that no one has settled yet is not counted and the counts equal what the list routes show after their settle.
 *   Set-based over every space of the caller (a school counts its live classes), so a school admin with 60 classes
 *   stays inside the D1 statement budget.
 *
 * The counting rule is the console's (`pendingCount`, section 3.4): a class move counts where its own step waits; a
 * teacher move counts at the destination while it waits for its acceptance.
 */

/** Which roster fields this reader may see. */
export interface RosterGates {
  relink: boolean;
  move: boolean;
  incoming: boolean;
}

/**
 * Section 12 gates: `pending.relink` with `roster.manage`; `pending.move` with `learner.transfer` on a class or
 * `snapshot.read` on a family; `incoming` with `learner.transfer` on a class. Moves only while `CLASS_TRANSFER` is on.
 */
export function rosterGates(kind: SpaceKind, allowed: ReadonlySet<Action>, movesOn: boolean): RosterGates {
  const move = movesOn && ((kind === 'class' && allowed.has('learner.transfer')) || (kind === 'family' && allowed.has('snapshot.read')));
  return { relink: allowed.has('roster.manage'), move, incoming: movesOn && kind === 'class' && allowed.has('learner.transfer') };
}

/** A request whose own step waits at the destination: the learner side said yes (T8) and this class has not answered. */
const destinationStepWaits = (t: StoredTransfer): boolean => t.status === 'requested' && t.learner.state === 'consented' && t.destination.state === 'pending';

/** A teacher move that waits for the destination's acceptance (TV-D8). */
const asksDestination = (m: StoredClassMove): boolean => m.status === 'requested' && m.kind === 'accept';

/** Where an open request stands for `side` (the source class, or the learner's family). */
function transferStep(t: StoredTransfer, side: 'source' | 'learner'): PendingMoveStep {
  if (t.status === 'approved') return t.blockReason ? 'room' : 'scheduled';
  return (side === 'source' ? t.source.state : t.learner.state) === 'pending' ? 'yours' : 'others';
}

function transferPending(t: StoredTransfer, side: 'source' | 'learner', to: string | null): RosterPendingMove {
  const step = transferStep(t, side);
  return { source: 'transfer', id: t.id, step, to, on: step === 'scheduled' ? t.executeAfter : null, expiresAt: t.expiresAt };
}

async function settleTransfers(db: Db, rows: readonly StoredTransfer[], now: Date, env: TransferEnv | undefined): Promise<StoredTransfer[]> {
  const out: StoredTransfer[] = [];
  for (const row of rows) {
    const settled = (await settle(db, row, now, env)).request;
    if (settled && isOpenTransfer(settled)) out.push(settled);
  }
  return out;
}

async function settleMoves(db: Db, rows: readonly StoredClassMove[], now: Date): Promise<StoredClassMove[]> {
  const out: StoredClassMove[] = [];
  for (const row of rows) {
    const settled = await settleMove(db, row, now);
    if (settled.status === 'requested') out.push(settled);
  }
  return out;
}

export interface RosterAttention {
  members: Membership[];
  pending: Map<string, RosterPending>;
  /** Present on a class roster read with `learner.transfer` while moves are on. */
  incoming: number | null;
}

/**
 * The roster's members with what waits for each learner. `readMembers` is called after the class's rows are
 * settled; a family's moves are read after its members (they name the learners), which no move changes: a move takes
 * a learner from one class to another and leaves the family as it is.
 */
export async function rosterAttention(db: Db, space: Space, gates: RosterGates, now: Date, env: TransferEnv | undefined, readMembers: () => Promise<Membership[]>): Promise<RosterAttention> {
  const relinks: StoredRelink[] = gates.relink ? (await liveRelinks(db, space.id, now)).filter((r) => r.status === 'pending') : [];
  let transfersOut: StoredTransfer[] = [];
  let transfersIn: StoredTransfer[] = [];
  let movesOut: StoredClassMove[] = [];
  let movesIn: StoredClassMove[] = [];
  if (space.kind === 'class' && (gates.move || gates.incoming)) {
    const [tOut, tIn, mOut, mIn] = await Promise.all([
      db.openTransfersOfSpaces([space.id], 'source'),
      db.openTransfersOfSpaces([space.id], 'destination'),
      db.openClassMovesOfSpaces([space.id], 'source'),
      db.openClassMovesOfSpaces([space.id], 'destination'),
    ]);
    transfersOut = await settleTransfers(db, tOut, now, env);
    transfersIn = await settleTransfers(db, tIn, now, env);
    movesOut = await settleMoves(db, mOut, now);
    movesIn = await settleMoves(db, mIn, now);
  }
  const members = await readMembers();
  const learnerIds = new Set(members.filter((m) => m.memberKind === 'learner').map((m) => m.memberId));
  let familyTransfers: StoredTransfer[] = [];
  if (space.kind === 'family' && gates.move && learnerIds.size > 0) familyTransfers = await settleTransfers(db, await db.openTransfersOfLearners([...learnerIds]), now, env);

  const destIds = [...new Set([...transfersOut, ...familyTransfers].map((t) => t.destSpaceId).concat(movesOut.map((m) => m.destSpaceId)))];
  const names = new Map((destIds.length ? await db.getSpaces(destIds) : []).map((s) => [s.id, s.name]));
  const pending = new Map<string, RosterPending>();
  const entry = (learnerId: string): RosterPending | null => {
    if (!learnerIds.has(learnerId)) return null;
    const known = pending.get(learnerId) ?? {};
    pending.set(learnerId, known);
    return known;
  };
  // The soonest re-link of each learner (a learner may ask from two devices).
  for (const r of [...relinks].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))) {
    const p = entry(r.learnerId);
    if (p && !p.relink) p.relink = { id: r.id, expiresAt: r.expiresAt };
  }
  if (gates.move) {
    // One open move per learner, of either kind; a transfer first should two ever meet.
    for (const t of transfersOut) {
      const p = entry(t.learnerId);
      // The source names the destination only where the source started it or the family introduced it (TV-D8).
      if (p && !p.move) p.move = transferPending(t, 'source', t.initiator === 'source' || t.introduce ? names.get(t.destSpaceId) ?? null : null);
    }
    for (const m of movesOut) {
      const p = entry(m.learnerId);
      if (p && !p.move) p.move = { source: 'teacher', id: m.id, step: 'others', to: names.get(m.destSpaceId) ?? null, on: null, expiresAt: m.expiresAt };
    }
    for (const t of familyTransfers) {
      const p = entry(t.learnerId);
      if (p && !p.move) p.move = transferPending(t, 'learner', names.get(t.destSpaceId) ?? null);
    }
  }
  for (const [learnerId, p] of pending) if (!p.relink && !p.move) pending.delete(learnerId);
  const incoming = gates.incoming ? transfersIn.filter(destinationStepWaits).length + movesIn.filter(asksDestination).length : null;
  return { members, pending, incoming };
}

/** A space of the caller and the actions it holds there. */
export interface AttentionItem {
  space: Space;
  allowed: ReadonlySet<Action>;
}

interface Counter {
  relinkSpaces: Set<string>;
  moveClasses: Set<string>;
  moveFamily: boolean;
}

/**
 * `attention` per space of the caller (section 12): `relinks` where it holds `roster.manage`, `moves` where it holds
 * `learner.transfer` (a class) or `snapshot.read` (a family) while moves are on, else 0; a school counts its live
 * classes for an owner or admin (the cascade gives both actions there). Archived spaces, and spaces where the caller
 * may decide nothing, get none. Read-only; a constant number of statements whatever the number of spaces.
 */
export async function spacesAttention(db: Db, items: readonly AttentionItem[], now: Date, env: TransferEnv | undefined): Promise<Map<string, SpaceAttention>> {
  const movesOn = classTransferEnabled(env);
  const at = now.toISOString();
  const counters = new Map<string, Counter>();
  const schools = items.filter((i) => i.space.kind === 'school' && !i.space.archivedAt && i.allowed.has('roster.manage')).map((i) => i.space.id);
  const children = schools.length ? (await db.childSpacesOfSpaces(schools)).filter((s) => s.kind === 'class' && !s.archivedAt) : [];
  for (const { space, allowed } of items) {
    if (space.archivedAt) continue;
    if (space.kind === 'school') {
      if (!allowed.has('roster.manage')) continue;
      const own = children.filter((s) => s.parentSpaceId === space.id).map((s) => s.id);
      counters.set(space.id, { relinkSpaces: new Set(own), moveClasses: new Set(movesOn ? own : []), moveFamily: false });
      continue;
    }
    const relink = allowed.has('roster.manage');
    const moves = movesOn && allowed.has(space.kind === 'class' ? 'learner.transfer' : 'snapshot.read');
    if (!relink && !moves) continue;
    counters.set(space.id, {
      relinkSpaces: new Set(relink ? [space.id] : []),
      moveClasses: new Set(moves && space.kind === 'class' ? [space.id] : []),
      moveFamily: moves && space.kind === 'family',
    });
  }
  const all = [...counters.values()];
  const relinkIds = [...new Set(all.flatMap((c) => [...c.relinkSpaces]))];
  const classIds = [...new Set(all.flatMap((c) => [...c.moveClasses]))];
  const familyIds = [...counters.entries()].filter(([, c]) => c.moveFamily).map(([id]) => id);

  const [relinks, outT, inT, inM, familyMembers] = await Promise.all([
    relinkIds.length ? db.pendingRelinksOfSpaces(relinkIds, now) : Promise.resolve([]),
    classIds.length ? db.openTransfersOfSpaces(classIds, 'source') : Promise.resolve([]),
    classIds.length ? db.openTransfersOfSpaces(classIds, 'destination') : Promise.resolve([]),
    classIds.length ? db.openClassMovesOfSpaces(classIds, 'destination') : Promise.resolve([]),
    familyIds.length ? db.membersOfSpaces(familyIds) : Promise.resolve([]),
  ]);
  const familyLearners = familyMembers.filter((m) => m.memberKind === 'learner');
  const familyT = familyLearners.length ? await db.openTransfersOfLearners([...new Set(familyLearners.map((m) => m.memberId))]) : [];

  // What a settle would end, read without writing: the destination archived or gone, the learner gone from the source.
  const rows: Array<{ learnerId: string; sourceSpaceId: string; destSpaceId: string }> = [...outT, ...inT, ...inM, ...familyT];
  const sourceIds = [...new Set(rows.map((r) => r.sourceSpaceId))];
  const [spaces, sourceMembers] = rows.length
    ? await Promise.all([db.getSpaces([...new Set(rows.map((r) => r.destSpaceId))]), db.membersOfSpaces(sourceIds)])
    : [[], []];
  const liveDest = new Set(spaces.filter((s) => !s.archivedAt).map((s) => s.id));
  const inSource = new Set(sourceMembers.filter((m) => m.memberKind === 'learner').map((m) => `${m.spaceId}\n${m.memberId}`));
  const live = (r: { learnerId: string; sourceSpaceId: string; destSpaceId: string; expiresAt: string }): boolean => r.expiresAt > at && liveDest.has(r.destSpaceId) && inSource.has(`${r.sourceSpaceId}\n${r.learnerId}`);

  const waitingAt = new Map<string, number>();
  const bump = (spaceId: string): void => {
    waitingAt.set(spaceId, (waitingAt.get(spaceId) ?? 0) + 1);
  };
  for (const t of outT) if (t.status === 'requested' && t.source.state === 'pending' && live(t)) bump(t.sourceSpaceId);
  for (const t of inT) if (destinationStepWaits(t) && live(t)) bump(t.destSpaceId);
  for (const m of inM) if (asksDestination(m) && live(m)) bump(m.destSpaceId);
  const familyWaiting = (familyId: string): number => {
    const ids = new Set(familyLearners.filter((m) => m.spaceId === familyId).map((m) => m.memberId));
    return familyT.filter((t) => ids.has(t.learnerId) && t.status === 'requested' && t.learner.state === 'pending' && live(t)).length;
  };

  const out = new Map<string, SpaceAttention>();
  for (const [spaceId, c] of counters) {
    const mine = relinks.filter((r) => c.relinkSpaces.has(r.spaceId));
    const moves = [...c.moveClasses].reduce((n, id) => n + (waitingAt.get(id) ?? 0), 0) + (c.moveFamily ? familyWaiting(spaceId) : 0);
    const soonest = mine.map((r) => r.expiresAt).sort()[0] ?? null;
    out.set(spaceId, { relinks: mine.length, moves, relinkExpiresAt: soonest });
  }
  return out;
}
