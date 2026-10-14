import { isStripeSubscriptionRef, type BillingEvent, type BillingEventKind, type Entitlement, type EntitlementApply, type MemberKind, type Membership, type Plan, type RelinkRequest, type Space } from '@hangul-route/content-schema';
import type { TransferBlockReason, TransferEndReason, TransferSlot } from '@hangul-route/content-schema';
import { isEntitlementActive } from '../lib/entitlement';
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
import type {
  LearnerNotesInbox,
  NewNote,
  NoteActVia,
  NoteDeviceScope,
  NoteRecipientRow,
  RateHitRow,
  SpaceNoteListRow,
  StoredNote,
  StoredNotePrefs,
  StoredNoteReport,
  StoredSendGrant,
  StoredSenderBlock,
  StoredSenderHold,
} from './feedback-types';
import type { ClassMoveDecider, ClassMoveEndStatus, ExecuteClassMoveInput, ExecuteClassMoveResult, StoredClassMove, StoredClassScopeAck } from './class-move-types';
import type { ClassMoveEndReason } from '@hangul-route/content-schema';

export * from './transfer-types';
export * from './class-move-types';
export * from './feedback-types';

/** A keyset position in a newest-first note list: rows strictly older than this (`createdAt`, then `id`). */
export interface NoteCursor {
  createdAt: string;
  id: string;
}

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

/** `recordBillingEvent` input (F-BILL-002 section 5.5): the row without its generated id and creation time. */
export type BillingEventInput = Omit<BillingEvent, 'id' | 'createdAt'>;

/** A re-link request as stored: `secret` is held until the device picks it up once. */
export type StoredRelink = RelinkRequest & { secret: string | null };

/**
 * A learner's stored summary without the rest of the snapshot row (F-REPORT-001
 * section 3.8): what a grown-up's report reads. `updatedAt` is the last sync.
 */
export interface StoredSummary {
  learnerId: string;
  summary: unknown;
  updatedAt: string;
}

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
  /** Erase a learner everywhere (devices, snapshot, memberships, relink requests, transfer requests + events, transfer prefs, notes, note reports, note prefs, sender blocks, learner rate counters, class-scope acknowledgement, teacher moves). */
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
  /**
   * The summary and its sync time only (F-REPORT-001 section 3.8): selects
   * `learner_id, summary_json, updated_at`, never `payload_json`, so a report
   * route never loads a learner's device state. Null when no row exists.
   */
  summaryOf(learnerId: string): Promise<StoredSummary | null>;
  /**
   * `summaryOf` for many learners (F-REPORT-001 section 3.8, RP-5b): the same
   * three columns, never `payload_json`, read as `IN (...)` lists of at most
   * `REPORT_IN_CHUNK` ids per statement (D1's bound-parameter limit), so a
   * class of n members costs ceil(n / 100) statements. Duplicate ids are read
   * once; ids with no row are skipped; order is not guaranteed.
   */
  summariesOf(learnerIds: readonly string[]): Promise<StoredSummary[]>;
  /**
   * The ids among these that have a learner row (RP-5b), chunked like
   * `summariesOf`. Selects `id` only: the class report never loads a name, an
   * avatar or anything else of a learner. Duplicates read once; order is not
   * guaranteed.
   */
  learnersOf(learnerIds: readonly string[]): Promise<string[]>;

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
  /**
   * Upsert one row per (subject, plan), keeping refs unless replaced, by the rules of
   * `mergeEntitlement` (`merge` defaults to 'set'). The write never replaces a row it
   * did not read: a lost race reads again and merges onto the winner (BY-D5).
   */
  applyEntitlement(input: EntitlementApply, now: Date, merge?: EntitlementMerge): Promise<Entitlement>;

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
  /**
   * Fill pending slot(s) of an open request. The destination slot needs the learner slot consented; a learner consent sets `executeAfter` = now + 48 h.
   * With `events` (the consenting account and its `via` / basis, one per slot), the audit rows are written in the same transaction, only by the call
   * whose CAS filled the slot(s): a lost race writes no event, and an event that cannot be written undoes the consent.
   */
  consentSlot(id: string, consent: TransferSlotConsent, now: Date, events?: ReadonlyArray<Omit<NewTransferEvent, 'transferId'>>): Promise<number>;
  /**
   * End an open request as `declined` by one slot. With `event` (the deciding account and its `via` / reason,
   * which the row does not store), the audit row is written in the same transaction, only by the call whose
   * CAS ended the request: a lost race writes no event, and an event that cannot be written undoes the end.
   */
  declineSlot(id: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number>;
  /** End an open request as `cancelled`; `event` as for `declineSlot`. */
  cancelTransfer(id: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number>;
  /** `expired` once `expiresAt <= now`; `event` (the system's `expired` row) as for `declineSlot`. */
  expireTransfer(id: string, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number>;
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
  /**
   * Every open request where one of the spaces is the source (or the destination), newest first. No window:
   * open rows are bounded by the rules (one per learner, `TRANSFER_MAX_OPEN_PER_DESTINATION`), so a list
   * reads them apart from its history and newer ended rows can never push one out.
   */
  openTransfersOfSpaces(spaceIds: readonly string[], role: 'source' | 'destination'): Promise<StoredTransfer[]>;
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
  /** Open requests to the destination; with `now`, only those whose `expiresAt` is still ahead (an unsettled expired row is not waiting). */
  countOpenTransfersTo(spaceId: string, now?: Date): Promise<number>;
  /** Oldest first. */
  transferEvents(transferId: string): Promise<TransferEvent[]>;
  addTransferEvent(event: NewTransferEvent): Promise<void>;
  /** Set-based reads for building views; unknown ids are skipped, order is not guaranteed. */
  getLearners(ids: readonly string[]): Promise<Learner[]>;
  getSpaces(ids: readonly string[]): Promise<Space[]>;
  getAccounts(ids: readonly string[]): Promise<Account[]>;
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

  // billing history (F-BILL-002 section 5.5, migration 0007)
  /**
   * Insert-or-keep by (provider, providerRef, kind), so a webhook retry writes nothing new; then fill
   * `paymentRef` when the stored row has none and `input` carries one. Answers the stored row.
   * Refuses (throws) what `BillingEventSchema` refuses and an `occurredAt` that is not canonical ISO;
   * an empty `paymentRef` is stored as null (`billing-rules.ts`).
   */
  recordBillingEvent(input: BillingEventInput, now: Date): Promise<BillingEvent>;
  /** A subject's rows, newest first (`occurredAt`, then `createdAt`, then id), at most `limit` (a non-negative integer). */
  billingEventsFor(subjectKind: BillingEvent['subjectKind'], subjectId: string, limit: number): Promise<BillingEvent[]>;
  billingEventById(id: string): Promise<BillingEvent | null>;
  /** The row on a provider reference; without `kind`, the newest row on it. */
  billingEventByRef(provider: BillingEvent['provider'], providerRef: string, kind?: BillingEventKind): Promise<BillingEvent | null>;
  /** The newest `purchase` or `renewal` row whose `paymentRef` is this payment intent: the row a refund belongs to (section 5.4). */
  billingEventByPaymentRef(paymentRef: string): Promise<BillingEvent | null>;
  /** The entitlement a provider reference (a Stripe subscription id) points at; the most recently updated when several do. */
  entitlementByProviderRef(provider: Entitlement['provider'], providerRef: string): Promise<Entitlement | null>;
  // set-based reads for the billing summary (F-BILL-002 B-4): each list is bound as one JSON array and read
  // with `json_each`, so one statement answers any number of spaces (D1 caps statements per invocation).
  /** Every space-subject entitlement row of these spaces; order not guaranteed. */
  entitlementsForSpaces(spaceIds: readonly string[]): Promise<Entitlement[]>;
  /** Every membership of these spaces; order not guaranteed. */
  membersOfSpaces(spaceIds: readonly string[]): Promise<Membership[]>;
  /** Every space whose parent is one of these; order not guaranteed. */
  childSpacesOfSpaces(parentSpaceIds: readonly string[]): Promise<Space[]>;
  /** Each space's newest `limitPerSpace` rows (the order of `billingEventsFor`), grouped by space in no set order. */
  billingEventsForSpaces(spaceIds: readonly string[], limitPerSpace: number): Promise<BillingEvent[]>;

  // notes from grown-ups (F-FEEDBACK-001 section 7.4, migration 0008). Every method that takes a list is
  // set-based: the list is bound as one JSON array and read with `json_each`, so the statement count does
  // not grow with it and the 100-parameter cap never applies. Every list and the inbox apply the retention
  // cut-offs of section 8.7 (`now`), and a report never revives a row past them, so a row past them is never
  // seen before the purge removes it (`getNote` alone reads the stored row, for the routes' checks).
  /** The ids among `learnerIds` that are current `student` members of the space; order not guaranteed. */
  studentsOf(spaceId: string, learnerIds: readonly string[]): Promise<string[]>;
  /** The prefs rows of these learners; a learner without a row is left out (class notes `all`, OD-3). */
  notePrefsFor(learnerIds: readonly string[]): Promise<StoredNotePrefs[]>;
  /**
   * The space's current students with their name, class-notes mode and whether their family stopped this
   * sender, in one statement (GET recipients, section 7.2); oldest membership first.
   */
  noteRecipients(spaceId: string, senderAccountId: string): Promise<NoteRecipientRow[]>;
  /** The ids among `learnerIds` whose family stopped this sender (section 8.5). */
  blocksFor(learnerIds: readonly string[], senderAccountId: string): Promise<string[]>;
  /** Hits per key at or after `since`; a key without hits is absent from the map. */
  countRateHitsByKeys(keys: readonly string[], since: Date): Promise<Map<string, number>>;
  addRateHits(rows: readonly RateHitRow[]): Promise<void>;
  /**
   * One send (section 7.4): the notes and their counter hits in one transaction, written only while the
   * sender (every row's `senderAccountId`, which must be one account) has no active hold. Answers the
   * number of notes written: 0 for a non-empty send means a hold landed in the meantime and nothing was written.
   */
  insertNotes(rows: readonly NewNote[], rateHits: readonly RateHitRow[]): Promise<number>;
  /**
   * The inbox query (section 6.8, rules 1-7) and the learner's prefs row, in one statement: live notes of the
   * last 180 days, of spaces the learner is still a student of and that are not archived, class spaces only on
   * a class-scoped device, class notes only while the mode is not `off` (text null in `presets`), no block of
   * the sender, and only while the sender still holds `feedback.send` in the space; newest first, at most `limit`.
   */
  notesForLearner(learnerId: string, scope: NoteDeviceScope, now: Date, limit: number): Promise<LearnerNotesInbox>;
  /** Notes sent in a space (optionally to one learner), newest first, older than `before` when given, at most `limit`. */
  notesForSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date; learnerId?: string }): Promise<StoredNote[]>;
  /**
   * A space's sent list without a learner filter (section 7.2, PR FB-3b), in one statement: every note to
   * chosen learners, and each `everyone` batch as one row (its first note, its size, live and taken-back
   * notes), newest first by the row's note, older than `before` when given, at most `limit` rows. The work
   * is linear in the notes the page walks (a batch's counts are read once, never once per note).
   */
  sentListOfSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<SpaceNoteListRow[]>;
  /** Every note to a learner from any space, every status, newest first (the family view). */
  notesForOversight(learnerId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<StoredNote[]>;
  /**
   * The stored row whatever its age (the routes' ownership and status checks). A row past the cut-offs of
   * section 8.7 is never listed, and `insertNoteReport` refuses it, so acting on it changes nothing visible.
   */
  getNote(id: string): Promise<StoredNote | null>;
  /** Sets `readAt` once, on a live note; answers rows changed (0 when already read or not live). */
  setNoteRead(id: string, at: Date): Promise<number>;
  /** The learner's pick on a live note; the last one wins. Answers rows changed. */
  setNoteReaction(id: string, reaction: string, at: Date): Promise<number>;
  /** Live -> `hidden`; `actedBy` is the caregiver for `family`, never set for `device`. Answers rows changed. */
  hideNote(id: string, via: NoteActVia, at: Date, actedBy?: string): Promise<number>;
  /** Live -> `withdrawn` (soft, OD-18: the row stays for the family). Answers rows changed. */
  withdrawNote(id: string, at: Date): Promise<number>;
  /** Every live note of a batch sent by this account -> `withdrawn`. Answers rows changed. */
  withdrawBatch(batchId: string, senderAccountId: string, at: Date): Promise<number>;
  /**
   * The report row and the note's status `reported`, together in one transaction, only while the note is
   * within the retention of section 8.7 at `row.createdAt` (any status otherwise). Answers whether it recorded:
   * false for a missing note or one every list already hides, which a report never brings back.
   */
  insertNoteReport(row: StoredNoteReport): Promise<boolean>;
  /** Distinct reporting families (`reporter_key`) with a report against this sender at or after `since`, a report the owner restored left out (section 8.4). */
  countReportersAgainst(accountId: string, since: Date): Promise<number>;
  /** The report rows of these notes, oldest first, in one statement (the family view's "reported by", PR FB-4b-family). */
  reportsForNotes(noteIds: readonly string[]): Promise<StoredNoteReport[]>;
  getSenderHold(accountId: string): Promise<StoredSenderHold | null>;
  /** Places a hold; an active hold is never rewritten, a lifted one is replaced. Answers whether it wrote. */
  putSenderHold(row: StoredSenderHold): Promise<boolean>;
  getNotePrefs(learnerId: string): Promise<StoredNotePrefs | null>;
  /** Upsert. An acknowledgement once given is kept when `acknowledgedAt` is null (the card never returns). */
  putNotePrefs(row: StoredNotePrefs): Promise<void>;
  /** Insert-if-absent: an existing block keeps its first author and time. */
  putBlock(row: StoredSenderBlock): Promise<void>;
  deleteBlock(learnerId: string, senderAccountId: string): Promise<boolean>;
  /** Newest first. */
  listBlocks(learnerId: string): Promise<StoredSenderBlock[]>;
  getSendGrant(spaceId: string, accountId: string): Promise<StoredSendGrant | null>;
  putSendGrant(row: StoredSendGrant): Promise<void>;
  deleteSendGrant(spaceId: string, accountId: string): Promise<boolean>;
  /**
   * The learner left the space from its device (section 7.5): its live, hidden and withdrawn notes go. A
   * reported note, and any note a report row names (one the owner reviewed), stays for its retention.
   */
  deleteNotesForMembership(learnerId: string, spaceId: string): Promise<number>;
  /**
   * Bounded retention purge (section 8.7), at most `limit` rows per step: live, hidden and withdrawn notes
   * created before `before` (and their reports); reported notes with no report at or after `reportedBefore`
   * (and their reports); report rows before `reportedBefore` of a note no longer reported (a note under review
   * keeps every report); holds lifted before `liftedBefore`. Each step reads an index (migration 0008).
   * Answers the rows removed.
   */
  purgeNotes(before: Date, reportedBefore: Date, liftedBefore: Date, limit: number): Promise<number>;

  // [TV] class-scope acknowledgements and teacher moves (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.2, migration 0009)
  getClassScopeAck(learnerId: string): Promise<StoredClassScopeAck | null>;
  /** Set-based (`IN` chunks): the acknowledgement of each learner that has one. */
  classScopeAcksOf(learnerIds: readonly string[]): Promise<StoredClassScopeAck[]>;
  /** Upsert by learner: the newest acknowledgement replaces the earlier one. */
  putClassScopeAck(ack: StoredClassScopeAck): Promise<void>;
  /** Inserts a fresh `requested` row unless the learner already has one open (the partial unique index is the backstop). */
  createClassMove(row: StoredClassMove): Promise<'created' | 'already_open'>;
  getClassMove(id: string): Promise<StoredClassMove | null>;
  /** Newest first, at most `limit`: moves out of (`source`) or into (`destination`) the space. */
  classMovesOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredClassMove[]>;
  openClassMoveOf(learnerId: string): Promise<StoredClassMove | null>;
  /** Executed at or after `since`, newest first, for the given learners (the family notices). */
  executedClassMovesOf(learnerIds: readonly string[], since: Date): Promise<StoredClassMove[]>;
  /**
   * Compare-and-set from `requested` to an ended status with its reason; `expired` also needs `expires_at <= now`.
   * `decider` is recorded for a destination's decline. Answers the changed-row count.
   */
  endClassMove(id: string, status: ClassMoveEndStatus, reason: ClassMoveEndReason, decider: ClassMoveDecider | null, now: Date): Promise<number>;
  /** Sets `family_seen_at` once (an executed row only). Answers the changed-row count. */
  markClassMoveSeen(id: string, now: Date): Promise<number>;
  /** The self-guarding swap of section 4.2: one batch whose first statement is the gate. */
  executeClassMove(input: ExecuteClassMoveInput): Promise<ExecuteClassMoveResult>;
  /** Bounded purge: ended rows before `endedBefore`, executed rows before `executedBefore`, still-requested rows whose `expiresAt` is before `endedBefore` (an ask nobody settled). */
  purgeClassMoves(endedBefore: Date, executedBefore: Date, limit: number): Promise<number>;

  /** Tests only: wipe everything. */
  reset(): Promise<void>;
}

/**
 * How an input lands on the stored row (AMENDMENTS-BILLING-FAMILY-YEARLY BY-D5):
 * - 'set': every provider path and every subscription event. The input's status applies;
 *   a field it leaves out keeps the stored value.
 * - 'checkout': a subscription checkout's completion. Its subscription's own events own
 *   status and end, and Stripe may deliver them first.
 */
export type EntitlementMerge = 'set' | 'checkout';

/**
 * A Stripe subscription event for a different subscription than the one the row carries,
 * that would take a covering row out of cover (a duplicate's deletion, BY-D5).
 */
function isSupersededSubscription(existing: Entitlement, next: Entitlement, now: Date): boolean {
  return (
    existing.provider === 'stripe' &&
    isStripeSubscriptionRef(existing.providerRef) &&
    isStripeSubscriptionRef(next.providerRef) &&
    existing.providerRef !== next.providerRef &&
    isEntitlementActive(existing, now) &&
    !isEntitlementActive(next, now)
  );
}

/**
 * The upsert rule shared by both backends (F-ENT-001 §3.1, BY-D5). Returns `existing`
 * itself when the input changes nothing that may change, so callers can skip the write.
 */
export function mergeEntitlement(existing: Entitlement | null, input: EntitlementApply, now: Date, newId: () => string, merge: EntitlementMerge = 'set'): Entitlement {
  if (merge === 'checkout') {
    if (existing && input.providerRef && existing.providerRef === input.providerRef) {
      // The subscription's events landed first: only fill what the completion knows.
      const customerRef = input.customerRef ?? existing.customerRef;
      const promoCode = input.promoCode ?? existing.promoCode;
      if (customerRef === existing.customerRef && promoCode === existing.promoCode) return existing;
      return { ...existing, customerRef, promoCode, updatedAt: now.toISOString() };
    }
    // A new row, or a new subscription replacing a lapsed one or a legacy payment: covered
    // at once with no end until the subscription's own event sets it.
    return applied(existing, { ...input, expiresAt: null }, now, newId);
  }
  const next = applied(existing, input, now, newId);
  return existing && isSupersededSubscription(existing, next, now) ? existing : next;
}

function applied(existing: Entitlement | null, input: EntitlementApply, now: Date, newId: () => string): Entitlement {
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
