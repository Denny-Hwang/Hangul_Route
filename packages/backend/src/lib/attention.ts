import type { ClassAttention, Membership, PendingMoveStep, RosterPending, RosterPendingMove, Space, SpaceAttention, SpaceKind, WaitingParty } from '@hangul-route/content-schema';
import type { Db, StoredClassMove, StoredRelink, StoredTransfer } from '../db';
import { allSlotsIn, isOpenTransfer } from '../db/transfer-rules';
import type { Action } from './can';
import { liveRelinks } from './relinks';
import { classTransferEnabled, settle, type TransferEnv } from './transfer';

/*
 * [GX-W] What waits for a grown-up's answer — AMENDMENTS-GROWNUP-UX section 12 (Worker first, additive, no migration).
 *
 * - The roster (`GET /:id/roster`) gets `learners[].pending` and, on a class, `incoming`. Before it reads the members
 *   it leaves out, without a write, every row a settle would end (past the window, learner left the source,
 *   destination archived) and settles only the rows about to promote or due to execute (at most `ROSTER_SETTLE_MAX`
 *   a read), so a move executed on this read lists the learner as a member and never also as pending, and the
 *   statements of a read do not grow with the open moves. Each field is gated on the action that can decide it.
 * - The spaces list (`GET /api/spaces`) gets `attention` on each space of the caller, and a school's
 *   `GET /:id/attention` gives the same for every live child class (a school admin acts on them through the cascade
 *   without being a member). Counts only, and they never write: every count filters what a list route's settle would
 *   end (past the window, learner left the source, destination archived), so a past-expiry row that no one has
 *   settled yet is not counted and the counts equal what the list routes show after their settle. Set-based, so a
 *   school admin with 60 classes stays inside the D1 statement budget.
 *
 * The counting rule is the console's (`pendingCount`, section 3.4): a class move counts where its own step waits; a
 * teacher move counts at the destination while it waits for its acceptance. T8: a destination counts a transfer only
 * once it may see it (the learner side said yes). A family counts a move only when it can answer it (the learner does
 * not manage their own classes: `learnerRoute === 'caregiver'`).
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

/** A request whose family step waits and that the family can answer (the learner does not manage their own classes). */
const familyStepWaits = (t: StoredTransfer, selfManaged: ReadonlySet<string>): boolean => t.status === 'requested' && t.learner.state === 'pending' && !selfManaged.has(t.learnerId);

/** Where an open request stands for `side` (the source class, or the learner's family); `answerable` is false for a self-managed learner's family. */
function transferStep(t: StoredTransfer, side: 'source' | 'learner', answerable: boolean): PendingMoveStep {
  if (t.status === 'approved') return t.blockReason ? 'room' : 'scheduled';
  return answerable && (side === 'source' ? t.source.state : t.learner.state) === 'pending' ? 'yours' : 'others';
}

/**
 * Who else an open request still waits on, for the reader at `side`, in step order (review V1-1): the source class,
 * the learner's side (the family, or a self-managed learner), the destination. The destination waits only once it may
 * see the request (T8: the learner side said yes). Never the reader's own answerable step; empty once agreed.
 */
function transferWaitingOn(t: StoredTransfer, side: 'source' | 'learner', answerable: boolean): WaitingParty[] {
  if (t.status !== 'requested') return [];
  const out: WaitingParty[] = [];
  if (side !== 'source' && t.source.state === 'pending') out.push('source');
  if ((side !== 'learner' || !answerable) && t.learner.state === 'pending') out.push('learner');
  if (destinationStepWaits(t)) out.push('destination');
  return out;
}

function transferPending(t: StoredTransfer, side: 'source' | 'learner', to: string | null, answerable = true): RosterPendingMove {
  const step = transferStep(t, side, answerable);
  return { source: 'transfer', id: t.id, step, to, on: step === 'scheduled' ? t.executeAfter : null, expiresAt: t.expiresAt, waitingOn: transferWaitingOn(t, side, answerable) };
}

/** An open transfer or class move: the fields that tell whether a settle would end it. */
interface OpenRow {
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  expiresAt: string;
}

/** The spaces and source memberships behind a set of open rows, in two set-based reads (one statement per 90 ids each). */
interface Liveness {
  spaces: Map<string, Space>;
  /** Whether a settle would leave the row open: inside its window, the destination live, the learner still in the source. */
  live: (r: OpenRow) => boolean;
}

async function liveness(db: Db, rows: readonly OpenRow[], now: Date): Promise<Liveness> {
  const at = now.toISOString();
  const [spaces, sourceMembers] = rows.length
    ? await Promise.all([db.getSpaces([...new Set(rows.flatMap((r) => [r.destSpaceId, r.sourceSpaceId]))]), db.membersOfSpaces([...new Set(rows.map((r) => r.sourceSpaceId))])])
    : [[], []];
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const inSource = new Set(sourceMembers.filter((m) => m.memberKind === 'learner').map((m) => `${m.spaceId}\n${m.memberId}`));
  const live = (r: OpenRow): boolean => {
    const dest = byId.get(r.destSpaceId);
    return r.expiresAt > at && !!dest && !dest.archivedAt && inSource.has(`${r.sourceSpaceId}\n${r.learnerId}`);
  };
  return { spaces: byId, live };
}

/** At most this many open transfers are settled on one roster read (each settle may promote or execute). */
export const ROSTER_SETTLE_MAX = 2;

/**
 * The open transfers that stay open, read without a write where that is enough (review V1-2): a row a settle would end
 * (past its window, destination archived, learner left the source) is left out, as the attention counts do, and the
 * list routes write the end. Only a row whose settle changes what the roster shows is settled: about to promote (all
 * slots in), due to execute, or its source archived while the source step waits. At most `ROSTER_SETTLE_MAX` of them
 * per read, so the statements of a read do not grow with the open moves; the rest settle on a later read.
 */
async function openTransfers(db: Db, rows: readonly StoredTransfer[], look: Liveness, now: Date, env: TransferEnv | undefined, budget: { left: number }): Promise<StoredTransfer[]> {
  const at = now.toISOString();
  const out: StoredTransfer[] = [];
  const toSettle: StoredTransfer[] = [];
  for (const row of rows) {
    if (!isOpenTransfer(row) || !look.live(row)) continue;
    const sourceArchived = !!look.spaces.get(row.sourceSpaceId)?.archivedAt && row.source.state === 'pending';
    const due = row.status === 'approved' && row.executeAfter !== null && at >= row.executeAfter;
    const promotes = row.status === 'requested' && allSlotsIn(row);
    (due || promotes || sourceArchived ? toSettle : out).push(row);
  }
  // A row waiting for a seat retries on every settle; the others go first so a waiting seat never holds them back.
  toSettle.sort((a, b) => Number(a.blockReason !== null) - Number(b.blockReason !== null));
  for (const row of toSettle) {
    if (budget.left <= 0) {
      out.push(row);
      continue;
    }
    budget.left -= 1;
    const settled = (await settle(db, row, now, env)).request;
    if (settled && isOpenTransfer(settled)) out.push(settled);
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
 * a learner from one class to another and leaves the family as it is. Set-based: a fixed number of reads whatever the
 * number of open moves, plus at most `ROSTER_SETTLE_MAX` settles.
 */
export async function rosterAttention(db: Db, space: Space, gates: RosterGates, now: Date, env: TransferEnv | undefined, readMembers: () => Promise<Membership[]>): Promise<RosterAttention> {
  const relinks: StoredRelink[] = gates.relink ? (await liveRelinks(db, space.id, now)).filter((r) => r.status === 'pending') : [];
  const budget = { left: ROSTER_SETTLE_MAX };
  const names = new Map<string, string>();
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
    const look = await liveness(db, [...tOut, ...tIn, ...mOut, ...mIn], now);
    for (const s of look.spaces.values()) names.set(s.id, s.name);
    transfersOut = await openTransfers(db, tOut, look, now, env, budget);
    transfersIn = await openTransfers(db, tIn, look, now, env, budget);
    // A class move's settle only ends it, so a read-only filter is the whole settle here.
    movesOut = mOut.filter((m) => m.status === 'requested' && look.live(m));
    movesIn = mIn.filter((m) => m.status === 'requested' && look.live(m));
  }
  const members = await readMembers();
  const learnerIds = new Set(members.filter((m) => m.memberKind === 'learner').map((m) => m.memberId));
  let familyTransfers: StoredTransfer[] = [];
  let selfManaged = new Set<string>();
  if (space.kind === 'family' && gates.move && learnerIds.size > 0) {
    const rows = await db.openTransfersOfLearners([...learnerIds]);
    const look = await liveness(db, rows, now);
    for (const s of look.spaces.values()) names.set(s.id, s.name);
    familyTransfers = await openTransfers(db, rows, look, now, env, budget);
    if (familyTransfers.length > 0) selfManaged = new Set(await db.selfManagedLearners(familyTransfers.map((t) => t.learnerId)));
  }

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
      if (p && !p.move) p.move = { source: 'teacher', id: m.id, step: 'others', to: names.get(m.destSpaceId) ?? null, on: null, expiresAt: m.expiresAt, waitingOn: asksDestination(m) ? ['destination'] : [] };
    }
    for (const t of familyTransfers) {
      const p = entry(t.learnerId);
      // A self-managed learner answers for themselves: the family's own step does not wait on the family.
      if (p && !p.move) p.move = transferPending(t, 'learner', names.get(t.destSpaceId) ?? null, !selfManaged.has(t.learnerId));
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

/** One space to count, and what this caller may count there. */
interface Target {
  id: string;
  relinks: boolean;
  classMoves: boolean;
  familyMoves: boolean;
}

/**
 * The counts of every target in a constant number of statements (each read covers all targets): re-links pending and
 * inside their window; class moves by the console's rule with T8; a family's moves it can answer. Read-only.
 */
async function attentionCounts(db: Db, targets: readonly Target[], now: Date): Promise<Map<string, SpaceAttention>> {
  const relinkIds = targets.filter((t) => t.relinks).map((t) => t.id);
  const classIds = targets.filter((t) => t.classMoves).map((t) => t.id);
  const familyIds = targets.filter((t) => t.familyMoves).map((t) => t.id);
  const [relinks, outT, inT, inM, familyMembers] = await Promise.all([
    relinkIds.length ? db.pendingRelinksOfSpaces(relinkIds, now) : Promise.resolve([]),
    classIds.length ? db.openTransfersOfSpaces(classIds, 'source') : Promise.resolve([]),
    classIds.length ? db.openTransfersOfSpaces(classIds, 'destination') : Promise.resolve([]),
    classIds.length ? db.openClassMovesOfSpaces(classIds, 'destination') : Promise.resolve([]),
    familyIds.length ? db.membersOfSpaces(familyIds) : Promise.resolve([]),
  ]);
  const familyLearners = familyMembers.filter((m) => m.memberKind === 'learner');
  const familyT = familyLearners.length ? await db.openTransfersOfLearners([...new Set(familyLearners.map((m) => m.memberId))]) : [];
  const selfManaged = new Set(familyT.length ? await db.selfManagedLearners(familyT.map((t) => t.learnerId)) : []);

  // What a settle would end, read without writing: past the window, the destination archived or gone, the learner gone from the source.
  const { live } = await liveness(db, [...outT, ...inT, ...inM, ...familyT], now);

  const waitingAt = new Map<string, number>();
  const bump = (spaceId: string): void => {
    waitingAt.set(spaceId, (waitingAt.get(spaceId) ?? 0) + 1);
  };
  for (const t of outT) if (t.status === 'requested' && t.source.state === 'pending' && live(t)) bump(t.sourceSpaceId);
  for (const t of inT) if (destinationStepWaits(t) && live(t)) bump(t.destSpaceId);
  for (const m of inM) if (asksDestination(m) && live(m)) bump(m.destSpaceId);
  for (const familyId of familyIds) {
    const ids = new Set(familyLearners.filter((m) => m.spaceId === familyId).map((m) => m.memberId));
    for (const t of familyT) if (ids.has(t.learnerId) && familyStepWaits(t, selfManaged) && live(t)) bump(familyId);
  }

  const out = new Map<string, SpaceAttention>();
  for (const target of targets) {
    const mine = target.relinks ? relinks.filter((r) => r.spaceId === target.id) : [];
    const moves = target.classMoves || target.familyMoves ? waitingAt.get(target.id) ?? 0 : 0;
    out.set(target.id, { relinks: mine.length, moves, relinkExpiresAt: mine.map((r) => r.expiresAt).sort()[0] ?? null });
  }
  return out;
}

/**
 * `spaces[].attention` (section 12): on each live space of the caller, `relinks` where it holds `roster.manage`,
 * `moves` where it holds `learner.transfer` (a class) or `snapshot.read` (a family) while moves are on, else 0.
 * Absent on an archived space and where the caller may decide nothing (a school `teacher`). A school's row counts the
 * school space itself; its classes come from `schoolAttention`, so a persona total counts each class once.
 */
export async function spacesAttention(db: Db, items: readonly AttentionItem[], now: Date, env: TransferEnv | undefined): Promise<Map<string, SpaceAttention>> {
  const movesOn = classTransferEnabled(env);
  const targets: Target[] = [];
  for (const { space, allowed } of items) {
    if (space.archivedAt) continue;
    const target: Target = {
      id: space.id,
      relinks: allowed.has('roster.manage'),
      classMoves: movesOn && space.kind === 'class' && allowed.has('learner.transfer'),
      familyMoves: movesOn && space.kind === 'family' && allowed.has('snapshot.read'),
    };
    if (target.relinks || target.classMoves || target.familyMoves) targets.push(target);
  }
  return attentionCounts(db, targets, now);
}

/**
 * A school's `GET /:id/attention` (section 12): the counts of every live child class, in the order the school lists
 * them, for a caller whose school role cascades `roster.manage` and `learner.transfer` to its classes.
 */
export async function schoolAttention(db: Db, school: Space, now: Date, env: TransferEnv | undefined): Promise<ClassAttention[]> {
  const movesOn = classTransferEnabled(env);
  const classes = (await db.childSpaces(school.id)).filter((s) => s.kind === 'class' && !s.archivedAt);
  const counts = await attentionCounts(
    db,
    classes.map((s) => ({ id: s.id, relinks: true, classMoves: movesOn, familyMoves: false })),
    now,
  );
  return classes.map((s) => ({ spaceId: s.id, ...(counts.get(s.id) as SpaceAttention) }));
}
