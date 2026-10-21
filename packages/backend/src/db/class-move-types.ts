import type { ClassMoveEndReason, ClassMoveKind, ClassMoveStatus, ClassMoveVia, ClassScopeBasis } from '@hangul-route/content-schema';

/**
 * [TV] Rows of migration 0009 (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.1). Ids and times only:
 * names are read live when a view is built.
 */

/** One learner's class-scope acknowledgement (TV-D4): the newest one wins. */
export interface StoredClassScopeAck {
  learnerId: string;
  textVersion: string;
  basis: ClassScopeBasis;
  /** The guardian's account id or the device id; never a name. */
  evidence: string;
  ackedAt: string;
}

/** One teacher move (TV-D7, TV-D8). */
export interface StoredClassMove {
  id: string;
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  kind: ClassMoveKind;
  status: ClassMoveStatus;
  actorAccountId: string;
  actorVia: ClassMoveVia;
  decidedAccountId: string | null;
  decidedVia: ClassMoveVia | null;
  endReason: ClassMoveEndReason | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  executedAt: string | null;
  endedAt: string | null;
  familySeenAt: string | null;
}

/** Who decided an accept-type move, or who moved a learner directly (the executor). */
export interface ClassMoveDecider {
  accountId: string;
  via: ClassMoveVia;
}

export interface ExecuteClassMoveInput {
  id: string;
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  decider: ClassMoveDecider;
  /** The destination's learner cap (`classCap`); an unlimited cap is compared as 1e9. */
  destCap: number;
  /** `LEARNER_CLASS_CAP`: live classes the learner may be in besides the source. */
  learnerCap: number;
  /** [SA] The destination's live school and its distinct-student cap (as `ExecuteTransferInput`); null = none. */
  destSchoolId?: string | null;
  destSchoolCap?: number | null;
  now: Date;
}

export interface ExecuteClassMoveResult {
  executed: boolean;
  devicesRevoked: number;
  relinksClosed: number;
}

/** The ended states a CAS can write from `requested`. */
export type ClassMoveEndStatus = Extract<ClassMoveStatus, 'declined' | 'cancelled' | 'expired'>;

const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A fresh row only: `requested`, no decision, no end, canonical ISO times (they are compared as text). */
export function assertNewClassMove(row: StoredClassMove): void {
  const fresh =
    row.status === 'requested' &&
    row.decidedAccountId === null &&
    row.decidedVia === null &&
    row.endReason === null &&
    row.executedAt === null &&
    row.endedAt === null &&
    row.familySeenAt === null &&
    row.sourceSpaceId !== row.destSpaceId &&
    /^move:[a-z0-9-]+$/.test(row.id) &&
    [row.createdAt, row.updatedAt, row.expiresAt].every((t) => CANONICAL_ISO.test(t));
  if (!fresh) throw new Error('createClassMove: not a fresh requested row');
}
