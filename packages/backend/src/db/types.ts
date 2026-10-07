import type { Entitlement, EntitlementApply, MemberKind, Membership, Plan, RelinkRequest, Space } from '@hangul-route/content-schema';
import type { Account, Learner, LearnerDevice, SnapshotRecord } from '../store';

/** A re-link request as stored: `secret` is held until the device picks it up once. */
export type StoredRelink = RelinkRequest & { secret: string | null };

/**
 * Persistence for schema v2 — F-INFRA-003. Every route and rule talks to this
 * interface; `D1Db` is the Worker's binding, `MemoryDb` the test / dev stand-in.
 * Reads return copies: mutate, then `put` — nothing is saved by reference.
 */
export interface Db {
  // accounts (F-SPACE-001 §3.1)
  getAccount(id: string): Promise<Account | null>;
  putAccount(account: Account): Promise<void>;

  // learners + devices (F-SYNC-001)
  getLearner(id: string): Promise<Learner | null>;
  putLearner(learner: Learner): Promise<void>;
  learnerByRecoveryHash(hash: string): Promise<Learner | null>;
  /** Erase a learner everywhere (devices, snapshot, memberships, relink requests). */
  deleteLearner(id: string): Promise<boolean>;
  getDevice(learnerId: string, deviceId: string): Promise<LearnerDevice | null>;
  putDevice(device: LearnerDevice): Promise<void>;
  /** Whether any learner has this device id bound (mismatch vs. guess in device auth). */
  deviceExists(deviceId: string): Promise<boolean>;

  // snapshots (F-SYNC-001)
  getSnapshot(learnerId: string): Promise<SnapshotRecord | null>;
  putSnapshot(record: SnapshotRecord): Promise<void>;

  // spaces + memberships (F-SPACE-001)
  getSpace(id: string): Promise<Space | null>;
  putSpace(space: Space): Promise<void>;
  spaceByCode(code: string): Promise<Space | null>;
  childSpaces(parentSpaceId: string): Promise<Space[]>;
  spacesOwnedBy(accountId: string): Promise<Space[]>;
  membership(spaceId: string, kind: MemberKind, memberId: string): Promise<Membership | null>;
  addMembership(membership: Membership): Promise<void>;
  removeMembership(spaceId: string, kind: MemberKind, memberId: string): Promise<boolean>;
  membershipsOf(kind: MemberKind, memberId: string): Promise<Membership[]>;
  membersOf(spaceId: string): Promise<Membership[]>;

  // plans (F-PLAN-001)
  getPlan(id: string): Promise<Plan | null>;
  putPlan(plan: Plan): Promise<void>;
  plansOf(spaceId: string): Promise<Plan[]>;

  // re-link requests (F-TCH-001 §10.1)
  getRelink(id: string): Promise<StoredRelink | null>;
  putRelink(request: StoredRelink): Promise<void>;
  relinksOf(spaceId: string): Promise<StoredRelink[]>;

  // entitlements (F-ENT-001)
  entitlementsFor(subjectKind: Entitlement['subjectKind'], subjectId: string): Promise<Entitlement[]>;
  /** Upsert one row per (subject, plan), keeping refs unless replaced. */
  applyEntitlement(input: EntitlementApply, now: Date): Promise<Entitlement>;

  /** Tests only: wipe everything. */
  reset(): Promise<void>;
}

/** The upsert rule shared by both backends (F-ENT-001 §3.1). */
export function mergeEntitlement(existing: Entitlement | null, input: EntitlementApply, now: Date, newId: () => string): Entitlement {
  return {
    id: existing?.id ?? newId(),
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    planKey: input.planKey,
    status: input.status,
    provider: input.provider,
    providerRef: input.providerRef ?? existing?.providerRef ?? null,
    customerRef: input.customerRef ?? existing?.customerRef ?? null,
    seats: input.seats === undefined ? (existing?.seats ?? null) : input.seats,
    expiresAt: input.expiresAt === undefined ? (existing?.expiresAt ?? null) : input.expiresAt,
    promoCode: input.promoCode ?? existing?.promoCode ?? null,
    updatedAt: now.toISOString(),
  };
}
