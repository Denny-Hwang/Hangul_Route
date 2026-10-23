import { CLASS_MOVE_PURGE_AFTER_MS, TRANSFER_PURGE_AFTER_MS, type MoveSpaceRef } from '@hangul-route/content-schema';
import type { Db, StoredClassMove } from '../db';
import { isOpenTransfer } from '../db/transfer-rules';
import { settle, type TransferEnv } from './transfer';

/**
 * Moves seen from a learner's side (owner report 2026-10-23: a learner moved from class A to class B showed up in
 * both). A move takes the learner out of the source and into the destination in one guarded batch; these readers let
 * `/join` and `/lookup` keep the learner from ending up in both afterwards, by the source's code (a move that still
 * stands) or by the destination's code (a move still waiting). Both kinds count: the teacher moves (`class_moves`,
 * AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3) and the family-started transfers (F-SPACE-002). Pure over `Db`,
 * so the D1 and the memory store answer alike; no new SQL.
 */

/**
 * Brings an open teacher move up to date before it is shown or acted on (there is no scheduler): past its 14 days it
 * expires; a learner who left the source or a destination that was archived ends it. Answers the row as stored.
 */
export async function settleMove(db: Db, move: StoredClassMove, now: Date): Promise<StoredClassMove> {
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

interface ExecutedEdge {
  source: string;
  dest: string;
  at: string;
}

/** The learner's executed moves of both kinds still on record (each kind's 90-day purge window). */
async function executedEdges(db: Db, learnerId: string, now: Date): Promise<ExecutedEdge[]> {
  const [classMoves, transfers] = await Promise.all([db.executedClassMovesOf([learnerId], new Date(now.getTime() - CLASS_MOVE_PURGE_AFTER_MS)), db.transfersOfLearner(learnerId)]);
  const transferSince = new Date(now.getTime() - TRANSFER_PURGE_AFTER_MS).toISOString();
  const edges: ExecutedEdge[] = [
    ...classMoves.map((m) => ({ source: m.sourceSpaceId, dest: m.destSpaceId, at: m.executedAt ?? m.updatedAt })),
    ...transfers.filter((t) => t.status === 'executed' && t.executedAt !== null && t.executedAt >= transferSince).map((t) => ({ source: t.sourceSpaceId, dest: t.destSpaceId, at: t.executedAt ?? t.updatedAt })),
  ];
  return edges;
}

/** Newest first; at the same instant a move into `spaceId` reads as the later one (the guard then lets the join through). */
function newestFirstFor(edges: ExecutedEdge[], spaceId: string): ExecutedEdge[] {
  return [...edges].sort((a, b) => b.at.localeCompare(a.at) || Number(b.dest === spaceId) - Number(a.dest === spaceId));
}

async function spaceRef(db: Db, spaceId: string): Promise<MoveSpaceRef> {
  return { spaceId, name: (await db.getSpace(spaceId))?.name ?? '' };
}

/**
 * The class a move OUT of `sourceSpaceId` still holds the learner in: the latest executed move out of it whose line
 * the learner is still on. The line follows later executed moves on from that destination (A -> B, then B -> C: the
 * move out of A stands while the learner is in C), and it stands only while the class the learner ends in holds them
 * and is a live class. Null when there is none, and when a later executed move brought the learner back INTO the
 * source (what happened before that no longer stands). A learner who left that class, or whose class there was
 * archived, may join the source again with its code.
 */
export async function standingMoveOut(db: Db, learnerId: string, sourceSpaceId: string, now: Date): Promise<MoveSpaceRef | null> {
  const edges = await executedEdges(db, learnerId, now);
  for (const edge of newestFirstFor(edges, sourceSpaceId)) {
    if (edge.dest === sourceSpaceId) return null;
    if (edge.source !== sourceSpaceId) continue;
    const held = await classAtEndOfLine(db, learnerId, edge, edges);
    if (held) return held;
  }
  return null;
}

/**
 * Follows the learner from `first.dest` along later executed moves out of each class they left, and answers the live
 * class at the end that still holds them, or null. Each edge is taken at most once, so a loop in the records ends.
 */
async function classAtEndOfLine(db: Db, learnerId: string, first: ExecutedEdge, edges: ExecutedEdge[]): Promise<MoveSpaceRef | null> {
  const unused = new Set(edges);
  unused.delete(first);
  let at = first;
  for (;;) {
    if (await db.membership(at.dest, 'learner', learnerId)) {
      const dest = await db.getSpace(at.dest);
      return dest && dest.kind === 'class' && !dest.archivedAt ? { spaceId: dest.id, name: dest.name } : null;
    }
    const from = at;
    const next = [...unused].filter((e) => e.source === from.dest && e.at >= from.at).sort((a, b) => a.at.localeCompare(b.at))[0];
    if (!next) return null;
    unused.delete(next);
    at = next;
  }
}

/**
 * The source of a move into `destSpaceId` that is still waiting for the learner: an open teacher ask, or an open
 * (requested or approved) family transfer. Each is settled first, so an expired or ended one never answers, and a
 * transfer whose cooling-off has passed may execute here (the caller then finds the learner already a member).
 */
export async function waitingMoveInto(db: Db, learnerId: string, destSpaceId: string, now: Date, env: TransferEnv | undefined): Promise<MoveSpaceRef | null> {
  const openMove = await db.openClassMoveOf(learnerId);
  if (openMove) {
    const settled = await settleMove(db, openMove, now);
    if (settled.status === 'requested' && settled.destSpaceId === destSpaceId) return spaceRef(db, settled.sourceSpaceId);
  }
  const openTransfer = await db.openTransferOf(learnerId);
  if (openTransfer) {
    const settled = (await settle(db, openTransfer, now, env)).request;
    if (settled && isOpenTransfer(settled) && settled.destSpaceId === destSpaceId) return spaceRef(db, settled.sourceSpaceId);
  }
  return null;
}
