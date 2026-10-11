import type { Entitlement, EntitlementApply, MemberKind, Membership, Plan, RelinkRequest, Space } from '@hangul-route/content-schema';
import type { TransferBlockReason, TransferEndReason, TransferSlot } from '@hangul-route/content-schema';
import type { Account, Learner, LearnerDevice, SnapshotRecord } from '../store';
import type {
  ConsentResetReason,
  ExecuteTransferInput,
  ExecuteTransferResult,
  NewTransferEvent,
  StoredTransfer,
  TransferEndActor,
  TransferEvent,
  TransferPrefKey,
  TransferPrefs,
  TransferSlotConsent,
} from './transfer-types';

export * from './transfer-types';

/** One launch-invite signup (docs/launch/waitlist.md). `email` is stored trimmed and lower-case. */
export interface WaitlistEntry {
  email: string;
  createdAt: string;
  source: string | null;
  locale: string | null;
  /** Which consent line the visitor saw (routes/waitlist CONSENT_TEXT_VERSION). */
  consentTextVersion: string;
  unsubscribedAt: string | null;
}

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
  /** Erase a learner everywhere (devices, snapshot, memberships, relink requests, transfer requests + events, transfer prefs, learner rate counters). */
  deleteLearner(id: string): Promise<boolean>;
  getDevice(learnerId: string, deviceId: string): Promise<LearnerDevice | null>;
  putDevice(device: LearnerDevice): Promise<void>;
  /** Whether any learner has this device id bound (mismatch vs. guess in device auth). */
  deviceExists(deviceId: string): Promise<boolean>;

  // snapshots (F-SYNC-001)
  getSnapshot(learnerId: string): Promise<SnapshotRecord | null>;
  /**
   * Compare-and-set (SYNC-1): writes `record` only while the stored rev still
   * equals `baseRev` — `0` means "no row yet" (insert-if-absent). Returns
   * whether it wrote; `false` means another device got there first.
   */
  putSnapshot(record: SnapshotRecord, baseRev: number): Promise<boolean>;

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

  // waitlist (launch invites; no email is sent from here)
  /** Insert-if-absent by address: an existing row (and any unsubscribe on it) is left untouched. Says nothing about whether it existed. */
  addWaitlist(entry: Omit<WaitlistEntry, 'unsubscribedAt'>): Promise<void>;
  /** Oldest first. Tests and tooling only — no route reads the list. */
  waitlistEntries(): Promise<WaitlistEntry[]>;
  /** Marks an address as removed; true when it was on the list. */
  unsubscribeWaitlist(email: string, now: Date): Promise<boolean>;

  // class transfer (F-SPACE-002 section 4.7). No whole-row put: every write is
  // one compare-and-set statement answering the number of rows it changed
  // (0 = the row was not in the state the call expected: a lost race).
  /**
   * Insert a new `requested` row (starting slots of the initiator table, section 4.1) and its `created` event
   * together; `already_open` when the learner has an open request, which may be the caller's own earlier
   * attempt: a route that answers an idempotent retry (section 4.9) compares `openTransferOf(learnerId)` with
   * its own request before treating the answer as a conflict.
   */
  createTransfer(row: StoredTransfer, event: Omit<NewTransferEvent, 'transferId'>): Promise<'created' | 'already_open'>;
  /** Fill pending slot(s) of an open request. The destination slot needs the learner slot consented; a learner consent sets `executeAfter` = now + 48 h. */
  consentSlot(id: string, consent: TransferSlotConsent, now: Date): Promise<number>;
  /** End an open request as `declined` by one slot. */
  declineSlot(id: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number>;
  cancelTransfer(id: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number>;
  /** `expired` once `expiresAt <= now`. */
  expireTransfer(id: string, now: Date): Promise<number>;
  /** Archived source (section 4.13): a pending source slot becomes `not_required`. */
  markSourceNotRequired(id: string, now: Date): Promise<number>;
  /** `requested` -> `approved` when every slot is in. */
  promoteTransfer(id: string, now: Date): Promise<number>;
  /** Record why an `approved` request is waiting for room; 0 when that reason is already recorded (one `blocked` event per reason). */
  blockTransfer(id: string, reason: TransferBlockReason, now: Date): Promise<number>;
  /**
   * Consent outdated: learner slot back to pending, status back to `requested`, plus a `consent_reset` event.
   * With `expectedRev`, only the row version the caller decided on is reset (0 when anything wrote since,
   * such as a reset and a new consent), so a decision taken on an older read never wipes a newer consent.
   */
  resetLearnerConsent(id: string, why: ConsentResetReason, now: Date, expectedRev?: number): Promise<number>;
  /** The move (section 4.6): one gate statement, then self-guarded writes, all in one transaction. */
  executeTransfer(input: ExecuteTransferInput): Promise<ExecuteTransferResult>;
  getTransfer(id: string): Promise<StoredTransfer | null>;
  /** Requests where the space is the source or the destination, newest first. */
  transfersOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredTransfer[]>;
  /** Every request of a learner, newest first. */
  transfersOfLearner(learnerId: string): Promise<StoredTransfer[]>;
  openTransferOf(learnerId: string): Promise<StoredTransfer | null>;
  /**
   * The latest **source-started** request the learner side refused (declined, or withdrew) that ended at or
   * after `since` (section 4.9, the 30-day `cannot_send` rule). The learner side ending a request it started
   * itself is not a refusal and never counts.
   */
  lastLearnerRefusal(learnerId: string, since: Date): Promise<StoredTransfer | null>;
  /**
   * The latest **learner-side** request to this destination that another side declined (`declined_source` or
   * `declined_destination`) and that ended at or after `since` (section 4.9, the 7-day `cooldown` rule). The
   * initiator's own cancel, the learner side's own withdrawal, an expiry and any source-started request never
   * count, and a newer row of that kind never hides an earlier decline.
   */
  lastCooldownDecline(learnerId: string, destSpaceId: string, since: Date): Promise<StoredTransfer | null>;
  countTransfersCreatedBy(accountId: string, since: Date): Promise<number>;
  countTransfersCreatedForLearner(learnerId: string, since: Date): Promise<number>;
  countOpenTransfersTo(spaceId: string): Promise<number>;
  /** Oldest first. */
  transferEvents(transferId: string): Promise<TransferEvent[]>;
  addTransferEvent(event: NewTransferEvent): Promise<void>;
  /** Set-based reads for building views; unknown ids are skipped, order is not guaranteed. */
  getLearners(ids: readonly string[]): Promise<Learner[]>;
  getSpaces(ids: readonly string[]): Promise<Space[]>;
  /** Bounded retention purge (section 4.1): ended rows before `endedBefore`, executed rows before `executedBefore` whose learner left the destination. */
  purgeTransfers(endedBefore: Date, executedBefore: Date, limit: number): Promise<number>;
  recordRateHit(key: string, at: Date): Promise<void>;
  /** Hits of `key` at or after `since`. */
  countRateHits(key: string, since: Date): Promise<number>;
  /** Bounded purge of counter rows older than `before`. */
  purgeRateHits(before: Date, limit: number): Promise<number>;
  getTransferPrefs(learnerId: string): Promise<TransferPrefs>;
  /** Upsert touching only `which`. */
  setTransferPref(learnerId: string, which: TransferPrefKey, value: boolean, now: Date): Promise<void>;

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
