import { TRANSFER_COOLING_OFF_MS, type BillingEvent, type ClassMoveEndReason, type ClassMoveKind, type ClassMoveStatus, type ClassMoveVia, type ClassScopeBasis, type BillingEventKind, type Entitlement, type EntitlementApply, type MemberKind, type Membership, type Plan, type Space, type SpaceEvent, type TransferBlockReason, type TransferEndReason, type TransferSlot, SpaceEventKindSchema } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type LearnerProfileFields, type SnapshotRecord } from '../store';
import {
  learnerRateKeys,
  mergeEntitlement,
  type AddLearnerWithinCapsInput,
  type BillingEventInput,
  type EntitlementMerge,
  type ConsentResetReason,
  type Db,
  type ExecuteTransferInput,
  type ExecuteTransferResult,
  type NewTransferEvent,
  type StoredRelink,
  type StoredSummary,
  type StoredTransfer,
  type TransferEndActor,
  type TransferEvent,
  type TransferPrefKey,
  type TransferPrefs,
  type TransferSlotConsent,
  type NoteCursor,
  type TelemetryDailyRow,
  type WaitlistEntry,
} from './types';
import { assertBillingLimit, billingEventFields, REFUNDABLE_BILLING_KINDS } from './billing-rules';
import { assertNewTransfer, assertTransferPrefKey, assertTransferSlot, consentedLearnerSlot, finiteCap, teacherSlotsOf } from './transfer-rules';
import { ENDED_TRANSFER_STATUSES, OPEN_TRANSFER_STATUSES } from './transfer-types';
import {
  noteRetentionCuts,
  notePairPrefix,
  type DeliveredNote,
  type LearnerNotesInbox,
  type NewNote,
  type NoteActVia,
  type NoteDeviceScope,
  type NoteRecipientRow,
  type RateHitRow,
  type SpaceNoteListRow,
  type StoredNote,
  type StoredNotePrefs,
  type StoredNoteReport,
  type StoredSendGrant,
  type StoredSenderBlock,
  type StoredSenderHold,
} from './feedback-types';
import { assertOneSender, prefixUpperBound } from './feedback-rules';
import type { AcceptAdminInviteInput, CreateAdminInviteInput, EndAdminRoleInput, EndAdminRoleResult, RevokeAdminInviteInput, StoredAdminInvite } from './admin-types';
import { clampPct, readOn, type RemoteConfigRow } from './remote-config-types';
import { uniqueRollupKeys, type RollupKey, type RollupRow } from './rollup-types';
import type { MemoryShardWrite, MemoryShardWriteResult, StoredMemoryShard } from './memory-shard-types';
import { assertNewClassMove, type ClassMoveDecider, type ClassMoveEndStatus, type ExecuteClassMoveInput, type ExecuteClassMoveResult, type StoredClassMove, type StoredClassScopeAck } from './class-move-types';

/** What `run()` resolves to on D1 (`D1Result`): `meta.changes` is the row count the statement wrote. */
export interface D1RunResultLike {
  meta?: { changes?: number };
}

/** The slice of Cloudflare's D1 API this package uses (also what the SQLite test shim provides). */
export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResultLike>;
}
export interface D1Like {
  prepare(sql: string): D1PreparedLike;
  /**
   * Runs the statements as one transaction (D1's native `batch`): one result
   * per statement, in order, each with its own `meta.changes`. A statement
   * that changes 0 rows does not stop the batch, so every statement that must
   * depend on an earlier one carries its own guard (F-SPACE-002 section 4.6).
   * If any statement throws, the whole batch is rolled back and the promise
   * rejects.
   */
  batch(statements: D1PreparedLike[]): Promise<D1RunResultLike[]>;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** A `memory_shards` row (migration 0016); `states` stays text. */
const toMemoryShard = (r: Record<string, unknown>): StoredMemoryShard => ({ shard: str(r.shard), seq: Number(r.seq), states: str(r.states), updatedAt: str(r.updated_at) });
const nstr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const nnum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const json = (v: unknown): unknown => (typeof v === 'string' && v.length > 0 ? JSON.parse(v) : null);

const toAccount = (r: Row): Account => ({ id: str(r.id), email: nstr(r.email), displayName: nstr(r.display_name), consent: json(r.consent_json), createdAt: str(r.created_at) });
/** The profile fields a device may change and their columns (fixed names: never built from input). */
const LEARNER_PROFILE_COLUMNS: ReadonlyArray<readonly [keyof LearnerProfileFields, string]> = [
  ['displayName', 'display_name'],
  ['ageGroup', 'age_group'],
  ['avatar', 'avatar'],
];
const toLearner = (r: Row): Learner => ({ id: str(r.id), displayName: str(r.display_name), ageGroup: str(r.age_group) as Learner['ageGroup'], avatar: str(r.avatar), recoveryHash: nstr(r.recovery_hash), createdAt: str(r.created_at), lastActiveAt: str(r.last_active_at), profileUpdatedAt: nstr(r.profile_updated_at) });
const toDevice = (r: Row): LearnerDevice => ({ learnerId: str(r.learner_id), deviceId: str(r.device_id), secretHash: str(r.secret_hash), scope: r.scope === 'class' ? 'class' : 'full', createdAt: str(r.created_at), lastSeenAt: str(r.last_seen_at) });
const toSnapshot = (r: Row): SnapshotRecord => ({ learnerId: str(r.learner_id), rev: num(r.rev), schemaVer: num(r.schema_ver), contentVer: str(r.content_ver), deviceId: str(r.device_id), summary: json(r.summary_json), payload: json(r.payload_json), updatedAt: str(r.updated_at) });
const toStoredSummary = (r: Row): StoredSummary => ({ learnerId: str(r.learner_id), summary: json(r.summary_json), updatedAt: str(r.updated_at) });
const toSpace = (r: Row): Space => ({
  id: str(r.id),
  kind: str(r.kind) as Space['kind'],
  name: str(r.name),
  parentSpaceId: nstr(r.parent_space_id),
  ownerAccountId: str(r.owner_account_id),
  joinCode: nstr(r.join_code),
  joinCodeExpiresAt: nstr(r.join_code_expires_at),
  settings: { consentMode: 'parent', anonymizeRoster: false, ...(json(r.settings_json) as Partial<Space['settings']> | null) },
  archivedAt: nstr(r.archived_at),
  createdAt: str(r.created_at),
});
const toMembership = (r: Row): Membership => ({ spaceId: str(r.space_id), memberKind: str(r.member_kind) as MemberKind, memberId: str(r.member_id), role: str(r.role) as Membership['role'], joinedAt: str(r.joined_at) });
/** `meta_json` (migration 0006): NULL, or unreadable JSON, is a classic plan; a bad row never fails its space. */
const planMeta = (v: unknown): Plan['meta'] => {
  try {
    const parsed = json(v);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Plan['meta']) : null;
  } catch {
    return null;
  }
};
const toPlan = (r: Row): Plan => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  authorAccountId: str(r.author_account_id),
  title: str(r.title),
  items: (json(r.items_json) as Plan['items'] | null) ?? [],
  targetLearnerIds: json(r.target_learner_ids_json) as string[] | null,
  publishedAt: nstr(r.published_at),
  archivedAt: nstr(r.archived_at),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
  meta: planMeta(r.meta_json),
});
const toRelink = (r: Row): StoredRelink => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  learnerId: str(r.learner_id),
  deviceId: str(r.device_id),
  platform: nstr(r.platform),
  requestedAt: str(r.requested_at),
  expiresAt: str(r.expires_at),
  status: str(r.status) as StoredRelink['status'],
  decidedAt: nstr(r.decided_at),
  secret: nstr(r.secret),
});
const toWaitlist = (r: Row): WaitlistEntry => ({ email: str(r.email), createdAt: str(r.created_at), source: nstr(r.source), locale: nstr(r.locale), consentTextVersion: str(r.consent_text_version), unsubscribedAt: nstr(r.unsubscribed_at) });
const toEntitlement = (r: Row): Entitlement => ({
  id: str(r.id),
  subjectKind: str(r.subject_kind) as Entitlement['subjectKind'],
  subjectId: str(r.subject_id),
  planKey: str(r.plan_key) as Entitlement['planKey'],
  status: str(r.status) as Entitlement['status'],
  provider: str(r.provider) as Entitlement['provider'],
  providerRef: nstr(r.provider_ref),
  customerRef: nstr(r.customer_ref),
  seats: nnum(r.seats),
  expiresAt: nstr(r.expires_at),
  promoCode: nstr(r.promo_code),
  updatedAt: str(r.updated_at),
});

const bool = (v: unknown): boolean => v === 1 || v === true || v === '1';
/** Newest first; on an equal Stripe second the later recorded row (`newestBillingEvent` in memory). */
const NEWEST_BILLING_EVENT = 'occurred_at DESC, created_at DESC, id DESC';
/** A `billing_events` row (migration 0007). */
const toBillingEvent = (r: Row): BillingEvent => ({
  id: str(r.id),
  subjectKind: str(r.subject_kind) as BillingEvent['subjectKind'],
  subjectId: str(r.subject_id),
  planKey: str(r.plan_key) as BillingEvent['planKey'],
  kind: str(r.kind) as BillingEvent['kind'],
  amountCents: num(r.amount_cents),
  currency: str(r.currency),
  provider: str(r.provider) as BillingEvent['provider'],
  providerRef: str(r.provider_ref),
  paymentRef: nstr(r.payment_ref),
  livemode: bool(r.livemode),
  occurredAt: str(r.occurred_at),
  createdAt: str(r.created_at),
});
const toTransfer = (r: Row): StoredTransfer => ({
  id: str(r.id),
  learnerId: str(r.learner_id),
  sourceSpaceId: str(r.source_space_id),
  destSpaceId: str(r.dest_space_id),
  initiator: str(r.initiator) as StoredTransfer['initiator'],
  initiatorAccountId: nstr(r.initiator_account_id),
  status: str(r.status) as StoredTransfer['status'],
  endReason: nstr(r.end_reason) as StoredTransfer['endReason'],
  endActor: nstr(r.end_actor) as StoredTransfer['endActor'],
  blockReason: nstr(r.block_reason) as StoredTransfer['blockReason'],
  introduce: bool(r.introduce),
  rev: num(r.rev),
  learner: {
    state: str(r.l_state) as StoredTransfer['learner']['state'],
    at: nstr(r.l_at),
    basis: nstr(r.l_basis) as StoredTransfer['learner']['basis'],
    attest: nstr(r.l_attest) as StoredTransfer['learner']['attest'],
    evidence: nstr(r.l_evidence),
    role: nstr(r.l_role) as StoredTransfer['learner']['role'],
    textVersion: nstr(r.l_text_version),
    locale: nstr(r.l_locale),
    shown: json(r.l_shown_json) as StoredTransfer['learner']['shown'],
    terms:
      [r.l_dest_name_hash, r.l_dest_consent_mode, r.l_dest_anonymize, r.l_dest_owner_id, r.l_source_name_hash, r.l_premium_change].some((v) => v === null || v === undefined)
        ? null
        : {
            destNameHash: str(r.l_dest_name_hash),
            destConsentMode: str(r.l_dest_consent_mode) as Space['settings']['consentMode'],
            destAnonymize: bool(r.l_dest_anonymize),
            destOwnerId: str(r.l_dest_owner_id),
            sourceNameHash: str(r.l_source_name_hash),
            premiumChange: str(r.l_premium_change) as NonNullable<StoredTransfer['learner']['terms']>['premiumChange'],
          },
  },
  source: { state: str(r.s_state) as StoredTransfer['source']['state'], at: nstr(r.s_at), accountId: nstr(r.s_account_id), via: nstr(r.s_via) as StoredTransfer['source']['via'] },
  destination: { state: str(r.d_state) as StoredTransfer['destination']['state'], at: nstr(r.d_at), accountId: nstr(r.d_account_id), via: nstr(r.d_via) as StoredTransfer['destination']['via'] },
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
  expiresAt: str(r.expires_at),
  approvedAt: nstr(r.approved_at),
  executeAfter: nstr(r.execute_after),
  endedAt: nstr(r.ended_at),
  executedAt: nstr(r.executed_at),
});
const toTransferEvent = (r: Row): TransferEvent => ({
  id: num(r.id),
  transferId: str(r.transfer_id),
  at: str(r.at),
  actorKind: str(r.actor_kind) as TransferEvent['actorKind'],
  actorRef: nstr(r.actor_ref),
  event: str(r.event) as TransferEvent['event'],
  slot: nstr(r.slot) as TransferEvent['slot'],
  detail: json(r.detail_json) as TransferEvent['detail'],
});

/** The learner-slot record columns, in the order `learnerRecordValues` binds them. */
const LEARNER_RECORD_COLUMNS = ['l_at', 'l_basis', 'l_attest', 'l_evidence', 'l_role', 'l_text_version', 'l_locale', 'l_shown_json', 'l_dest_name_hash', 'l_dest_consent_mode', 'l_dest_anonymize', 'l_dest_owner_id', 'l_source_name_hash', 'l_premium_change'] as const;
const learnerRecordValues = (slot: StoredTransfer['learner']): unknown[] => [
  slot.at,
  slot.basis,
  slot.attest,
  slot.evidence,
  slot.role,
  slot.textVersion,
  slot.locale,
  slot.shown === null ? null : JSON.stringify(slot.shown),
  slot.terms?.destNameHash ?? null,
  slot.terms?.destConsentMode ?? null,
  slot.terms === null ? null : slot.terms.destAnonymize ? 1 : 0,
  slot.terms?.destOwnerId ?? null,
  slot.terms?.sourceNameHash ?? null,
  slot.terms?.premiumChange ?? null,
];
const TRANSFER_COLUMNS = [
  'id', 'learner_id', 'source_space_id', 'dest_space_id', 'initiator', 'initiator_account_id', 'status', 'end_reason', 'end_actor', 'block_reason', 'introduce', 'rev',
  'l_state', ...LEARNER_RECORD_COLUMNS,
  's_state', 's_at', 's_account_id', 's_via', 'd_state', 'd_at', 'd_account_id', 'd_via',
  'created_at', 'updated_at', 'expires_at', 'approved_at', 'execute_after', 'ended_at', 'executed_at',
] as const;
const transferValues = (t: StoredTransfer): unknown[] => [
  t.id, t.learnerId, t.sourceSpaceId, t.destSpaceId, t.initiator, t.initiatorAccountId, t.status, t.endReason, t.endActor, t.blockReason, t.introduce ? 1 : 0, t.rev,
  t.learner.state, ...learnerRecordValues(t.learner),
  t.source.state, t.source.at, t.source.accountId, t.source.via, t.destination.state, t.destination.at, t.destination.accountId, t.destination.via,
  t.createdAt, t.updatedAt, t.expiresAt, t.approvedAt, t.executeAfter, t.endedAt, t.executedAt,
];
/** Column of each slot's state; a fixed map, never caller text in SQL. */
const SLOT_STATE_COLUMN: Record<TransferSlot, string> = { learner: 'l_state', source: 's_state', destination: 'd_state' };
const PREF_COLUMN: Record<TransferPrefKey, string> = { selfManaged: 'self_managed', blockTeacherRequests: 'block_teacher_requests' };
const sqlList = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(',');
const OPEN = `status IN (${sqlList(OPEN_TRANSFER_STATUSES)})`;
const ENDED = `status IN (${sqlList(ENDED_TRANSFER_STATUSES)})`;
const ALL_SLOTS_IN = "l_state = 'consented' AND s_state IN ('consented','not_required') AND d_state = 'consented'";
/** The row count a write reports; a binding that does not say is an error, never zero. */
/** Lost races an entitlement write tolerates before it fails (and Stripe retries the delivery). */
const ENTITLEMENT_WRITE_ATTEMPTS = 5;

const readChanges = (result: D1RunResultLike | undefined): number => {
  const changed = result?.meta?.changes;
  if (typeof changed !== 'number') throw new Error('D1 did not report meta.changes for a compare-and-set write');
  return changed;
};
const toNote = (r: Row): StoredNote => ({
  id: str(r.id),
  learnerId: str(r.learner_id),
  spaceId: str(r.space_id),
  senderAccountId: str(r.sender_account_id),
  senderRole: str(r.sender_role) as StoredNote['senderRole'],
  senderLabel: nstr(r.sender_label) as StoredNote['senderLabel'],
  batchId: str(r.batch_id),
  batchKind: str(r.batch_kind) as StoredNote['batchKind'],
  presetId: str(r.preset_id),
  body: nstr(r.body),
  bodyLocale: nstr(r.body_locale),
  suggest: r.suggest_kind === 'quest' ? { kind: 'quest', id: str(r.suggest_id) } : null,
  status: str(r.status) as StoredNote['status'],
  hiddenVia: nstr(r.hidden_via) as StoredNote['hiddenVia'],
  actedByAccountId: nstr(r.acted_by_account_id),
  createdAt: str(r.created_at),
  readAt: nstr(r.read_at),
  reaction: nstr(r.reaction),
  reactionAt: nstr(r.reaction_at),
  hiddenAt: nstr(r.hidden_at),
  withdrawnAt: nstr(r.withdrawn_at),
});
/** The learner-facing fields of an inbox row (section 8.1): no sender account, batch or moderation column. */
const toDeliveredNote = (r: Row): DeliveredNote => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  senderRole: str(r.sender_role) as DeliveredNote['senderRole'],
  senderLabel: nstr(r.sender_label) as DeliveredNote['senderLabel'],
  presetId: str(r.preset_id),
  body: nstr(r.body),
  bodyLocale: nstr(r.body_locale),
  suggest: r.suggest_kind === 'quest' ? { kind: 'quest', id: str(r.suggest_id) } : null,
  createdAt: str(r.created_at),
  readAt: nstr(r.read_at),
  reaction: nstr(r.reaction),
});
/** A prefs row; `p` is the column prefix the inbox query uses for the joined row. */
const toNotePrefs = (r: Row, p = ''): StoredNotePrefs => ({
  learnerId: str(r[`${p}learner_id`]),
  classes: str(r[`${p}classes`]) as StoredNotePrefs['classes'],
  acknowledgedAt: nstr(r[`${p}acknowledged_at`]),
  updatedAt: str(r[`${p}updated_at`]),
  updatedVia: str(r[`${p}updated_via`]) as StoredNotePrefs['updatedVia'],
  updatedByAccount: nstr(r[`${p}updated_by_account`]),
});
const toNoteReport = (r: Row): StoredNoteReport => ({
  id: str(r.id),
  noteId: str(r.note_id),
  learnerId: str(r.learner_id),
  senderAccountId: str(r.sender_account_id),
  reason: str(r.reason) as StoredNoteReport['reason'],
  via: str(r.via) as StoredNoteReport['via'],
  evidence: str(r.evidence),
  reporterKey: str(r.reporter_key),
  attest: nstr(r.attest) as StoredNoteReport['attest'],
  createdAt: str(r.created_at),
  reviewedAt: nstr(r.reviewed_at),
  outcome: nstr(r.outcome) as StoredNoteReport['outcome'],
});
const toSenderHold = (r: Row): StoredSenderHold => ({ accountId: str(r.account_id), reason: str(r.reason) as StoredSenderHold['reason'], createdAt: str(r.created_at), liftedAt: nstr(r.lifted_at) });
const toSenderBlock = (r: Row): StoredSenderBlock => ({ learnerId: str(r.learner_id), senderAccountId: str(r.sender_account_id), familySpaceId: str(r.family_space_id), createdByAccount: str(r.created_by_account), createdAt: str(r.created_at) });
const toSendGrant = (r: Row): StoredSendGrant => ({ spaceId: str(r.space_id), accountId: str(r.account_id), grantedBy: str(r.granted_by), grantedAt: str(r.granted_at) });

/** The note columns in table order, for the set-based insert (section 7.4). */
const NOTE_INSERT_COLUMNS = ['id', 'learner_id', 'space_id', 'sender_account_id', 'sender_role', 'sender_label', 'batch_id', 'batch_kind', 'preset_id', 'body', 'body_locale', 'suggest_kind', 'suggest_id', 'created_at'] as const;
const noteInsertJson = (n: NewNote): Record<(typeof NOTE_INSERT_COLUMNS)[number], string | null> => ({
  id: n.id,
  learner_id: n.learnerId,
  space_id: n.spaceId,
  sender_account_id: n.senderAccountId,
  sender_role: n.senderRole,
  sender_label: n.senderLabel,
  batch_id: n.batchId,
  batch_kind: n.batchKind,
  preset_id: n.presetId,
  body: n.body,
  body_locale: n.bodyLocale,
  suggest_kind: n.suggest?.kind ?? null,
  suggest_id: n.suggest?.id ?? null,
  created_at: n.createdAt,
});
/** No active hold on the sender (the hold re-check inside the send's transaction, section 8.4). */
const NOT_HELD = 'NOT EXISTS (SELECT 1 FROM feedback_sender_holds h WHERE h.account_id = ? AND h.lifted_at IS NULL)';
/**
 * Section 8.7 for every list: a live, hidden or withdrawn note of the last 180 days, or a reported note
 * with a report of the last 90 days. Binds (notesSince, reportsSince).
 */
const NOTE_VISIBLE = "((n.status <> 'reported' AND n.created_at >= ?) OR (n.status = 'reported' AND EXISTS (SELECT 1 FROM feedback_reports r WHERE r.note_id = n.id AND r.created_at >= ?)))";
/** A note no report row names (the end of a membership keeps a reviewed note with its reports, section 7.5). */
const NO_REPORT_ROW = 'NOT EXISTS (SELECT 1 FROM feedback_reports r WHERE r.note_id = feedback_notes.id)';
/** NOTE_VISIBLE for another note `b` of the same batch. Binds (notesSince, reportsSince). */
const BATCH_NOTE_VISIBLE = "((b.status <> 'reported' AND b.created_at >= ?) OR (b.status = 'reported' AND EXISTS (SELECT 1 FROM feedback_reports r WHERE r.note_id = b.id AND r.created_at >= ?)))";
/**
 * A space's sent list (section 7.2): each `everyone` batch is one row, its first note (the lowest rowid among
 * the batch's notes every list still shows, so the row's id and its page cursor never move when a note of it
 * is taken back), with the batch's size, live notes and taken-back notes in one JSON array.
 *
 * The cost is linear in the rows a page walks: the space index is read newest first, a note is a batch's
 * first note when no visible note of the batch has a lower rowid (one seek on `idx_feedback_notes_batch`,
 * whose entries end in the rowid), and the counts are read once per listed batch, never once per note.
 * Binds (notesSince, reportsSince, spaceId, notesSince, reportsSince, notesSince, reportsSince), then the
 * optional cursor and the limit.
 */
const SENT_LIST_SELECT = `SELECT n.*,
    CASE WHEN n.batch_kind = 'everyone' THEN (SELECT json_array(COUNT(*), COALESCE(SUM(b.status = 'live'), 0), COALESCE(SUM(b.withdrawn_at IS NOT NULL), 0))
      FROM feedback_notes b WHERE b.batch_id = n.batch_id AND ${BATCH_NOTE_VISIBLE}) END AS batch_counts
  FROM feedback_notes n
  WHERE n.space_id = ? AND ${NOTE_VISIBLE}
    AND (n.batch_kind <> 'everyone' OR NOT EXISTS (SELECT 1 FROM feedback_notes b WHERE b.batch_id = n.batch_id AND b.rowid < n.rowid AND ${BATCH_NOTE_VISIBLE}))`;
/** The `[size, live, withdrawn]` array of SENT_LIST_SELECT. */
function batchCounts(raw: string): { size: number; live: number; withdrawn: number } {
  const [size, live, withdrawn] = JSON.parse(raw) as [number, number, number];
  return { size: Number(size), live: Number(live), withdrawn: Number(withdrawn) };
}
/** Keyset paging, newest first: rows strictly older than the cursor. Binds (createdAt, createdAt, id). */
const NOTE_BEFORE = '(n.created_at < ? OR (n.created_at = ? AND n.id < ?))';
/**
 * The inbox query, section 6.8 rules 1-7, in one statement with the learner's prefs row. The outer
 * one-row select carries the prefs even when no note is delivered. It selects the learner-facing
 * columns only: the sender's account id is used by rules 5-6 and never returned (section 8.1). Binds (learnerId, learnerId,
 * notesSince, scope, limit).
 */
const INBOX_SQL = `SELECT p.learner_id AS p_learner_id, p.classes AS p_classes, p.acknowledged_at AS p_acknowledged_at, p.updated_at AS p_updated_at,
    p.updated_via AS p_updated_via, p.updated_by_account AS p_updated_by_account, d.*
  FROM (SELECT ? AS lid) x
  LEFT JOIN learner_note_prefs p ON p.learner_id = x.lid
  LEFT JOIN (
    SELECT n.id, n.space_id, n.sender_role, n.sender_label, n.preset_id,
      CASE WHEN n.sender_role = 'teacher' AND COALESCE(np.classes, 'all') = 'presets' THEN NULL ELSE n.body END AS body,
      n.body_locale, n.suggest_kind, n.suggest_id, n.created_at, n.read_at, n.reaction
    FROM feedback_notes n
    JOIN spaces s ON s.id = n.space_id
    JOIN memberships lm ON lm.space_id = n.space_id AND lm.member_kind = 'learner' AND lm.member_id = n.learner_id AND lm.role = 'student'
    JOIN memberships am ON am.space_id = n.space_id AND am.member_kind = 'account' AND am.member_id = n.sender_account_id
    LEFT JOIN learner_note_prefs np ON np.learner_id = n.learner_id
    WHERE n.learner_id = ?
      AND n.status = 'live' AND n.created_at >= ?
      AND s.archived_at IS NULL
      AND (? = 'full' OR s.kind = 'class')
      AND (n.sender_role = 'family' OR COALESCE(np.classes, 'all') <> 'off')
      AND NOT EXISTS (SELECT 1 FROM feedback_sender_blocks b WHERE b.learner_id = n.learner_id AND b.sender_account_id = n.sender_account_id)
      AND (
        (s.kind = 'class' AND n.sender_role = 'teacher' AND am.role IN ('teacher', 'owner'))
        OR (s.kind = 'family' AND n.sender_role = 'family' AND (am.role = 'owner'
          OR (am.role = 'caregiver' AND EXISTS (SELECT 1 FROM feedback_send_grants g WHERE g.space_id = n.space_id AND g.account_id = n.sender_account_id))))
      )
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT ?
  ) d ON 1
  ORDER BY d.created_at DESC, d.id DESC`;

/** D1 binds at most 100 parameters per statement. */
const IN_CHUNK = 90;

/** [TV] `class_moves` columns in insert order (migration 0009); `token` is written by the gate only. */
const CLASS_MOVE_COLUMNS = [
  'id', 'learner_id', 'source_space_id', 'dest_space_id', 'kind', 'status', 'actor_account_id', 'actor_via',
  'decided_account_id', 'decided_via', 'end_reason', 'created_at', 'updated_at', 'expires_at', 'executed_at', 'ended_at', 'family_seen_at',
] as const;
const classMoveValues = (m: StoredClassMove): unknown[] => [
  m.id, m.learnerId, m.sourceSpaceId, m.destSpaceId, m.kind, m.status, m.actorAccountId, m.actorVia,
  m.decidedAccountId, m.decidedVia, m.endReason, m.createdAt, m.updatedAt, m.expiresAt, m.executedAt, m.endedAt, m.familySeenAt,
];
const toClassMove = (r: Row): StoredClassMove => ({
  id: str(r.id),
  learnerId: str(r.learner_id),
  sourceSpaceId: str(r.source_space_id),
  destSpaceId: str(r.dest_space_id),
  kind: str(r.kind) as ClassMoveKind,
  status: str(r.status) as ClassMoveStatus,
  actorAccountId: str(r.actor_account_id),
  actorVia: str(r.actor_via) as ClassMoveVia,
  decidedAccountId: nstr(r.decided_account_id),
  decidedVia: nstr(r.decided_via) as ClassMoveVia | null,
  endReason: nstr(r.end_reason) as ClassMoveEndReason | null,
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
  expiresAt: str(r.expires_at),
  executedAt: nstr(r.executed_at),
  endedAt: nstr(r.ended_at),
  familySeenAt: nstr(r.family_seen_at),
});
const toClassScopeAck = (r: Row): StoredClassScopeAck => ({
  learnerId: str(r.learner_id),
  textVersion: str(r.text_version),
  basis: str(r.basis) as ClassScopeBasis,
  evidence: str(r.evidence),
  ackedAt: str(r.acked_at),
});
/**
 * The report reads' chunk (F-REPORT-001 section 3.8): their statements bind
 * nothing but the ids, so a chunk fills D1's limit of 100 bound parameters.
 */
export const REPORT_IN_CHUNK = 100;

/** `ids` without duplicates, in chunks of at most `REPORT_IN_CHUNK`. */
function reportChunks(ids: readonly string[]): string[][] {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += REPORT_IN_CHUNK) chunks.push(unique.slice(i, i + REPORT_IN_CHUNK));
  return chunks;
}
const placeholders = (chunk: readonly string[]): string => chunk.map(() => '?').join(', ');

/**
 * Every table `reset()` empties, children before parents. The class-transfer
 * tables come from migration 0005 (F-SPACE-002 PR T-3b).
 */
/** The tables of migration 0005 (F-SPACE-002 PR T-3b), children first. */
const TRANSFER_TABLES = ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'] as const;
/** The tables of migration 0008 (F-FEEDBACK-001 FB-2), children first. */
const FEEDBACK_TABLES = ['feedback_reports', 'feedback_notes', 'learner_note_prefs', 'feedback_sender_blocks', 'feedback_send_grants', 'feedback_sender_holds'] as const;
/** [TV] The tables of migration 0009 (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.1). */
const CLASS_MOVE_TABLES = ['class_moves', 'class_scope_acks'] as const;
/** [SA] The table of migration 0011 (AMENDMENTS-SEATS-ADMINS section 6.2). */
const SPACE_EVENT_TABLES = ['space_events'] as const;
/** [SA] The table of migration 0012 (AMENDMENTS-SEATS-ADMINS section 6.2). */
const ADMIN_INVITE_TABLES = ['admin_invites'] as const;
/** [OA] The table of migration 0015 (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1). */
const TELEMETRY_DAILY_TABLES = ['telemetry_daily'] as const;
/** [OA] Rows per `telemetry_daily` upsert: four bound values each, at most 100 per D1 statement. */
export const TELEMETRY_DAILY_ROWS_PER_STATEMENT = 25;
/** F-CURR-002 row CM-70a: the table of migration 0014 (section 11.2). */
const ROLLUP_TABLES = ['learning_rollups'] as const;
/** F-CURR-002 row CM-11: the table of migration 0016 (section 4.8), a child of `learners`. */
const MEMORY_SHARD_TABLES = ['memory_shards'] as const;
const RESET_TABLES = [
  ...MEMORY_SHARD_TABLES,
  ...TELEMETRY_DAILY_TABLES,
  'remote_config', // migration 0013 (F-CURR-002 CM-2), no foreign keys
  ...ROLLUP_TABLES,
  ...ADMIN_INVITE_TABLES,
  ...SPACE_EVENT_TABLES,
  ...CLASS_MOVE_TABLES,
  ...FEEDBACK_TABLES,
  ...TRANSFER_TABLES,
  'billing_events',
  'waitlist',
  'entitlements',
  'relink_requests',
  'plans',
  'memberships',
  'spaces',
  'snapshots',
  'learner_devices',
  'learners',
  'accounts',
] as const;

/**
 * [SA] The school seat test of a learner join, transfer or move (AMENDMENTS-SEATS-ADMINS section 3.3), as one SQL
 * condition and its parameters: no school or no cap; or the learner is already in a live class of the school (it
 * holds its seat; for a move, the source membership still exists when the gate runs); or the school's distinct
 * learners across its live classes are below the cap.
 */
function schoolSeatCondition(schoolId: string | null, schoolCap: number | null, learnerId: string): [string, unknown[]] {
  return [
    `(? IS NULL OR ? IS NULL
      OR EXISTS (SELECT 1 FROM memberships m JOIN spaces s ON s.id = m.space_id
                 WHERE s.parent_space_id = ? AND s.kind = 'class' AND s.archived_at IS NULL AND m.member_kind = 'learner' AND m.member_id = ?)
      OR (SELECT COUNT(DISTINCT m.member_id) FROM memberships m JOIN spaces s ON s.id = m.space_id
          WHERE s.parent_space_id = ? AND s.kind = 'class' AND s.archived_at IS NULL AND m.member_kind = 'learner') < ?)`,
    [schoolId, schoolCap, schoolId, learnerId, schoolId, schoolCap],
  ];
}

/**
 * [SA] section 6.2: `kind` has no CHECK so later kinds stay additive; a reader that meets a kind it does not know (a
 * row a newer Worker wrote, read after a rollback) skips that row instead of throwing. Inserts stay strict.
 */
const toSpaceEvent = (r: Row): SpaceEvent | null => {
  const kind = SpaceEventKindSchema.safeParse(r.kind);
  return kind.success ? { ...spaceEventRow(r), kind: kind.data } : null;
};
const spaceEventRow = (r: Row): Omit<SpaceEvent, 'kind'> => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  actorAccountId: str(r.actor_account_id),
  subjectAccountId: r.subject_account_id === null || r.subject_account_id === undefined ? null : str(r.subject_account_id),
  subjectSpaceId: r.subject_space_id === null || r.subject_space_id === undefined ? null : str(r.subject_space_id),
  inviteId: r.invite_id === null || r.invite_id === undefined ? null : str(r.invite_id),
  createdAt: str(r.created_at),
});

const toAdminInvite = (r: Row): StoredAdminInvite => ({
  id: str(r.id),
  spaceId: str(r.space_id),
  tokenHash: str(r.token_hash),
  createdBy: str(r.created_by),
  createdAt: str(r.created_at),
  expiresAt: str(r.expires_at),
  acceptedBy: nstr(r.accepted_by),
  acceptedAt: nstr(r.accepted_at),
  revokedAt: nstr(r.revoked_at),
});

/** [SA] `INSERT INTO space_events ... SELECT` with the row's eight values; the caller appends `WHERE <guard>`. */
const SPACE_EVENT_INSERT_SELECT = 'INSERT INTO space_events (id, space_id, kind, actor_account_id, subject_account_id, subject_space_id, invite_id, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?';

/**
 * [SA] Whether the account owns or is a teacher member of a live class of the school (section 6.1): with
 * `promoted_from = 'teacher'`, the test that keeps an ending admin a teacher of the school. Binds (school, account, account).
 */
const TEACHES_LIVE_CLASS = `EXISTS (SELECT 1 FROM spaces s WHERE s.parent_space_id = ? AND s.kind = 'class' AND s.archived_at IS NULL
  AND (s.owner_account_id = ? OR EXISTS (SELECT 1 FROM memberships cm WHERE cm.space_id = s.id AND cm.member_kind = 'account' AND cm.member_id = ? AND cm.role IN ('owner', 'teacher'))))`;
/** [SA] The account's admin row of the school. Binds (school, account). */
const ADMIN_ROW = "space_id = ? AND member_kind = 'account' AND member_id = ? AND role = 'admin'";

/** `Db` over a D1 binding — F-INFRA-003. Schema: apps/api/migrations. */
export class D1Db implements Db {
  constructor(private readonly d1: D1Like) {}

  private async one<T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T | null> {
    const row = await this.d1.prepare(sql).bind(...params).first<Row>();
    return row ? map(row) : null;
  }
  private async many<T>(sql: string, params: unknown[], map: (r: Row) => T): Promise<T[]> {
    const { results } = await this.d1.prepare(sql).bind(...params).all<Row>();
    return results.map(map);
  }
  private async run(sql: string, params: unknown[]): Promise<void> {
    await this.d1.prepare(sql).bind(...params).run();
  }
  /**
   * Runs a write and reports how many rows it changed. A binding that does not
   * say is an error, never zero: a compare-and-set read as "lost the race"
   * every time would answer 409 to every upload without a trace.
   */
  private async changes(sql: string, params: unknown[]): Promise<number> {
    return readChanges(await this.d1.prepare(sql).bind(...params).run());
  }

  getAccount(accountId: string): Promise<Account | null> {
    return this.one('SELECT * FROM accounts WHERE id = ?', [accountId], toAccount);
  }
  putAccount(a: Account): Promise<void> {
    return this.run(
      'INSERT INTO accounts (id, email, display_name, consent_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, consent_json = excluded.consent_json',
      [a.id, a.email, a.displayName, a.consent === null || a.consent === undefined ? null : JSON.stringify(a.consent), a.createdAt],
    );
  }

  getLearner(learnerId: string): Promise<Learner | null> {
    return this.one('SELECT * FROM learners WHERE id = ?', [learnerId], toLearner);
  }
  putLearner(l: Learner): Promise<void> {
    return this.run(
      'INSERT INTO learners (id, display_name, age_group, avatar, recovery_hash, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, age_group = excluded.age_group, avatar = excluded.avatar, recovery_hash = excluded.recovery_hash, last_active_at = excluded.last_active_at',
      [l.id, l.displayName, l.ageGroup, l.avatar, l.recoveryHash, l.createdAt, l.lastActiveAt],
    );
  }
  touchLearner(learnerId: string, lastActiveAt: string): Promise<void> {
    return this.run('UPDATE learners SET last_active_at = ? WHERE id = ?', [lastActiveAt, learnerId]);
  }
  async updateLearnerProfile(learnerId: string, fields: LearnerProfileFields, at: string): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of LEARNER_PROFILE_COLUMNS) {
      const value = fields[key];
      if (value === undefined) continue;
      sets.push(`${column} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return false;
    const sql = `UPDATE learners SET ${sets.join(', ')}, profile_updated_at = ? WHERE id = ? AND (profile_updated_at IS NULL OR profile_updated_at <= ?)`;
    return (await this.changes(sql, [...params, at, learnerId, at])) > 0;
  }
  async setDisplayNameIfUnedited(learnerId: string, displayName: string): Promise<boolean> {
    return (await this.changes('UPDATE learners SET display_name = ? WHERE id = ? AND profile_updated_at IS NULL', [displayName, learnerId])) > 0;
  }
  setRecoveryHash(learnerId: string, hash: string): Promise<void> {
    return this.run('UPDATE learners SET recovery_hash = ? WHERE id = ?', [hash, learnerId]);
  }
  learnerByRecoveryHash(hash: string): Promise<Learner | null> {
    return this.one('SELECT * FROM learners WHERE recovery_hash = ?', [hash], toLearner);
  }
  async deleteLearner(learnerId: string): Promise<boolean> {
    const existed = !!(await this.getLearner(learnerId));
    // learner_devices, snapshots, relink_requests, the transfer tables and the notes tables cascade from
    // learners; memberships and rate_hits hold a plain id. Each is deleted explicitly anyway, children first, in
    // one transaction (F-SPACE-002 section 4.7, F-FEEDBACK-001 section 7.4). A table of migration 0005 or 0008
    // is named only once that migration has created it: an erase is the live caregiver route, and "no such
    // table" would roll the whole batch back if this Worker ever ran before the migration.
    const present = await this.presentTables([...MEMORY_SHARD_TABLES, ...CLASS_MOVE_TABLES, ...FEEDBACK_TABLES, ...TRANSFER_TABLES]);
    const rateKeys = learnerRateKeys(learnerId);
    const pairPrefix = notePairPrefix(learnerId);
    const guarded: Array<[string, string, unknown[]]> = [
      // F-CURR-002 row CM-11 (migration 0016): the learner's memory store.
      ['memory_shards', 'DELETE FROM memory_shards WHERE learner_id = ?', [learnerId]],
      ['class_moves', 'DELETE FROM class_moves WHERE learner_id = ?', [learnerId]],
      ['class_scope_acks', 'DELETE FROM class_scope_acks WHERE learner_id = ?', [learnerId]],
      ['feedback_reports', 'DELETE FROM feedback_reports WHERE learner_id = ?', [learnerId]],
      ['feedback_notes', 'DELETE FROM feedback_notes WHERE learner_id = ?', [learnerId]],
      ['learner_note_prefs', 'DELETE FROM learner_note_prefs WHERE learner_id = ?', [learnerId]],
      ['feedback_sender_blocks', 'DELETE FROM feedback_sender_blocks WHERE learner_id = ?', [learnerId]],
      ['transfer_events', 'DELETE FROM transfer_events WHERE transfer_id IN (SELECT id FROM transfer_requests WHERE learner_id = ?)', [learnerId]],
      ['transfer_requests', 'DELETE FROM transfer_requests WHERE learner_id = ?', [learnerId]],
      ['learner_transfer_prefs', 'DELETE FROM learner_transfer_prefs WHERE learner_id = ?', [learnerId]],
      // the learner's own keys, and every `note:pair:<learnerId>:<account>` key by its prefix (a range, so no wildcard applies)
      ['rate_hits', `DELETE FROM rate_hits WHERE key IN (${rateKeys.map(() => '?').join(', ')}) OR (key >= ? AND key < ?)`, [...rateKeys, pairPrefix, prefixUpperBound(pairPrefix)]],
    ];
    const statements: Array<[string, unknown[]]> = [
      ...guarded.filter(([table]) => present.has(table)).map(([, sql, params]): [string, unknown[]] => [sql, params]),
      ["DELETE FROM memberships WHERE member_kind = 'learner' AND member_id = ?", [learnerId]],
      ['DELETE FROM relink_requests WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM learner_devices WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM snapshots WHERE learner_id = ?', [learnerId]],
      ['DELETE FROM learners WHERE id = ?', [learnerId]],
    ];
    await this.d1.batch(statements.map(([sql, params]) => this.d1.prepare(sql).bind(...params)));
    return existed;
  }
  /** Which of `tables` exist (migration order is not guaranteed relative to the Worker upload). */
  private async presentTables(tables: readonly string[]): Promise<Set<string>> {
    const names = await this.many(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${tables.map(() => '?').join(', ')})`, [...tables], (r) => str(r.name));
    return new Set(names);
  }
  getDevice(learnerId: string, deviceId: string): Promise<LearnerDevice | null> {
    return this.one('SELECT * FROM learner_devices WHERE learner_id = ? AND device_id = ?', [learnerId, deviceId], toDevice);
  }
  putDevice(d: LearnerDevice): Promise<void> {
    return this.run(
      'INSERT INTO learner_devices (learner_id, device_id, secret_hash, scope, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(learner_id, device_id) DO UPDATE SET secret_hash = excluded.secret_hash, scope = excluded.scope, last_seen_at = excluded.last_seen_at',
      [d.learnerId, d.deviceId, d.secretHash, d.scope, d.createdAt, d.lastSeenAt],
    );
  }
  async deviceExists(deviceId: string): Promise<boolean> {
    return !!(await this.one('SELECT device_id FROM learner_devices WHERE device_id = ? LIMIT 1', [deviceId], (r) => r));
  }

  getSnapshot(learnerId: string): Promise<SnapshotRecord | null> {
    return this.one('SELECT * FROM snapshots WHERE learner_id = ?', [learnerId], toSnapshot);
  }
  /** Three columns, never `payload_json` (F-REPORT-001 section 3.8): `getSnapshot` is `SELECT *`. */
  summaryOf(learnerId: string): Promise<StoredSummary | null> {
    return this.one('SELECT learner_id, summary_json, updated_at FROM snapshots WHERE learner_id = ?', [learnerId], toStoredSummary);
  }
  /** The chunks are issued concurrently: ceil(n / 100) statements, each its own D1 query (no shared snapshot). */
  async summariesOf(learnerIds: readonly string[]): Promise<StoredSummary[]> {
    const reads = reportChunks(learnerIds).map((chunk) =>
      this.many(`SELECT learner_id, summary_json, updated_at FROM snapshots WHERE learner_id IN (${placeholders(chunk)})`, chunk, toStoredSummary),
    );
    return (await Promise.all(reads)).flat();
  }
  async learnersOf(learnerIds: readonly string[]): Promise<string[]> {
    const reads = reportChunks(learnerIds).map((chunk) => this.many(`SELECT id FROM learners WHERE id IN (${placeholders(chunk)})`, chunk, (r) => str(r.id)));
    return (await Promise.all(reads)).flat();
  }
  async putSnapshot(s: SnapshotRecord, baseRev: number): Promise<boolean> {
    // One statement each, so the rev check and the write cannot interleave with another isolate (SYNC-1).
    const summary = JSON.stringify(s.summary ?? null);
    const payload = JSON.stringify(s.payload ?? null);
    const written =
      baseRev === 0
        ? await this.changes(
            'INSERT INTO snapshots (learner_id, rev, schema_ver, content_ver, device_id, summary_json, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(learner_id) DO NOTHING',
            [s.learnerId, s.rev, s.schemaVer, s.contentVer, s.deviceId, summary, payload, s.updatedAt],
          )
        : await this.changes(
            'UPDATE snapshots SET rev = ?, schema_ver = ?, content_ver = ?, device_id = ?, summary_json = ?, payload_json = ?, updated_at = ? WHERE learner_id = ? AND rev = ?',
            [s.rev, s.schemaVer, s.contentVer, s.deviceId, summary, payload, s.updatedAt, s.learnerId, baseRev],
          );
    return written === 1;
  }

  getSpace(spaceId: string): Promise<Space | null> {
    return this.one('SELECT * FROM spaces WHERE id = ?', [spaceId], toSpace);
  }
  putSpace(s: Space): Promise<void> {
    // [SA] section 5.2: the name is written at insert only (and by `renameSpace`), so a writer holding a copy read
    // before a rename (settings, archive, unarchive, a new code) can never put the old name back.
    return this.run(
      'INSERT INTO spaces (id, kind, name, parent_space_id, owner_account_id, join_code, join_code_expires_at, settings_json, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, parent_space_id = excluded.parent_space_id, owner_account_id = excluded.owner_account_id, join_code = excluded.join_code, join_code_expires_at = excluded.join_code_expires_at, settings_json = excluded.settings_json, archived_at = excluded.archived_at',
      [s.id, s.kind, s.name, s.parentSpaceId, s.ownerAccountId, s.joinCode, s.joinCodeExpiresAt, JSON.stringify(s.settings), s.archivedAt, s.createdAt],
    );
  }
  spaceByCode(code: string): Promise<Space | null> {
    return this.one('SELECT * FROM spaces WHERE join_code = ?', [code], toSpace);
  }
  childSpaces(parentSpaceId: string): Promise<Space[]> {
    return this.many('SELECT * FROM spaces WHERE parent_space_id = ? ORDER BY created_at', [parentSpaceId], toSpace);
  }
  spacesOwnedBy(accountId: string): Promise<Space[]> {
    return this.many('SELECT * FROM spaces WHERE owner_account_id = ? ORDER BY created_at', [accountId], toSpace);
  }
  membership(spaceId: string, kind: MemberKind, memberId: string): Promise<Membership | null> {
    return this.one('SELECT * FROM memberships WHERE space_id = ? AND member_kind = ? AND member_id = ?', [spaceId, kind, memberId], toMembership);
  }
  addMembership(m: Membership): Promise<void> {
    return this.run(
      'INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(space_id, member_kind, member_id) DO UPDATE SET role = excluded.role, joined_at = excluded.joined_at',
      [m.spaceId, m.memberKind, m.memberId, m.role, m.joinedAt],
    );
  }
  async removeMembership(spaceId: string, kind: MemberKind, memberId: string): Promise<boolean> {
    const existed = !!(await this.membership(spaceId, kind, memberId));
    if (existed) await this.run('DELETE FROM memberships WHERE space_id = ? AND member_kind = ? AND member_id = ?', [spaceId, kind, memberId]);
    return existed;
  }
  async removeMembershipIfRole(spaceId: string, kind: MemberKind, memberId: string, role: Membership['role']): Promise<boolean> {
    return (await this.changes('DELETE FROM memberships WHERE space_id = ? AND member_kind = ? AND member_id = ? AND role = ?', [spaceId, kind, memberId, role])) === 1;
  }
  membershipsOf(kind: MemberKind, memberId: string): Promise<Membership[]> {
    return this.many('SELECT * FROM memberships WHERE member_kind = ? AND member_id = ? ORDER BY joined_at', [kind, memberId], toMembership);
  }
  membersOf(spaceId: string): Promise<Membership[]> {
    return this.many('SELECT * FROM memberships WHERE space_id = ? ORDER BY joined_at', [spaceId], toMembership);
  }
  async addLearnerWithinCaps(input: AddLearnerWithinCapsInput): Promise<'added' | 'already' | 'refused'> {
    const { spaceId, learnerId } = input;
    const [school, schoolParams] = schoolSeatCondition(input.schoolId, input.schoolCap, learnerId);
    // One statement (section 3.3): D1 runs one statement at a time per database, so the counts inside it see every
    // committed join and two devices can never both take the last seat. The SELECT carries a WHERE, so SQLite reads
    // ON CONFLICT as the upsert clause.
    const added = await this.changes(
      `INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at)
       SELECT ?, 'learner', ?, 'student', ?
       WHERE (? IS NULL OR (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'learner') < ?)
         AND (? IS NULL OR (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id = m.space_id
                            WHERE m.member_kind = 'learner' AND m.member_id = ? AND s.kind = 'class' AND s.archived_at IS NULL) < ?)
         AND ${school}
       ON CONFLICT(space_id, member_kind, member_id) DO NOTHING`,
      [spaceId, learnerId, input.joinedAt, input.spaceCap, spaceId, input.spaceCap, input.learnerClassCap, learnerId, input.learnerClassCap, ...schoolParams],
    );
    if (added === 1) return 'added';
    return (await this.membership(spaceId, 'learner', learnerId)) ? 'already' : 'refused';
  }
  renameSpace(spaceId: string, name: string): Promise<number> {
    return this.changes('UPDATE spaces SET name = ? WHERE id = ? AND archived_at IS NULL', [name, spaceId]);
  }
  async addSpaceEvent(e: SpaceEvent): Promise<void> {
    await this.run(
      'INSERT INTO space_events (id, space_id, kind, actor_account_id, subject_account_id, subject_space_id, invite_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [e.id, e.spaceId, SpaceEventKindSchema.parse(e.kind), e.actorAccountId, e.subjectAccountId, e.subjectSpaceId, e.inviteId, e.createdAt],
    );
  }
  spaceEventsOf(spaceId: string, limit: number): Promise<SpaceEvent[]> {
    return this.many('SELECT * FROM space_events WHERE space_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', [spaceId, limit], toSpaceEvent).then((rows) =>
      rows.filter((e): e is SpaceEvent => e !== null),
    );
  }
  purgeSpaceEvents(before: Date, limit: number): Promise<number> {
    return this.changes('DELETE FROM space_events WHERE id IN (SELECT id FROM space_events WHERE created_at < ? LIMIT ?)', [before.toISOString(), limit]);
  }
  latestSpaceEvent(spaceId: string, kind: SpaceEvent['kind'], subjectAccountId: string): Promise<SpaceEvent | null> {
    return this.one('SELECT * FROM space_events WHERE space_id = ? AND kind = ? AND subject_account_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [spaceId, kind, subjectAccountId], toSpaceEvent);
  }
  async addMembershipIfAbsent(m: Membership): Promise<boolean> {
    const inserted = await this.changes('INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(space_id, member_kind, member_id) DO NOTHING', [m.spaceId, m.memberKind, m.memberId, m.role, m.joinedAt]);
    return inserted === 1;
  }

  // ---- school administrators ([SA] migration 0012) ----

  async createAdminInvite({ invite: i, cap, eventId }: CreateAdminInviteInput): Promise<boolean> {
    // One guarded INSERT ... SELECT (section 6.3): the admins and the open invites are counted inside the statement
    // that writes, with the cap bound, so two tabs can never both take the last place. The event follows the row.
    const [inserted] = await this.batchChanges([
      [
        `INSERT INTO admin_invites (id, space_id, token_hash, created_by, created_at, expires_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'school' AND archived_at IS NULL)
           AND (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'account' AND role = 'admin')
             + (SELECT COUNT(*) FROM admin_invites WHERE space_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?) < ?`,
        [i.id, i.spaceId, i.tokenHash, i.createdBy, i.createdAt, i.expiresAt, i.spaceId, i.spaceId, i.spaceId, i.createdAt, cap],
      ],
      [`${SPACE_EVENT_INSERT_SELECT} WHERE EXISTS (SELECT 1 FROM admin_invites WHERE id = ?)`, [eventId, i.spaceId, SpaceEventKindSchema.parse('admin_invite_created'), i.createdBy, null, null, i.id, i.createdAt, i.id]],
    ]);
    return inserted === 1;
  }
  getAdminInvite(inviteId: string): Promise<StoredAdminInvite | null> {
    return this.one('SELECT * FROM admin_invites WHERE id = ?', [inviteId], toAdminInvite);
  }
  adminInviteByHash(tokenHash: string): Promise<StoredAdminInvite | null> {
    return this.one('SELECT * FROM admin_invites WHERE token_hash = ?', [tokenHash], toAdminInvite);
  }
  openAdminInvites(spaceId: string, now: Date): Promise<StoredAdminInvite[]> {
    return this.many('SELECT * FROM admin_invites WHERE space_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at, id', [spaceId, now.toISOString()], toAdminInvite);
  }
  async revokeAdminInvite({ inviteId, spaceId, actorAccountId, now, eventId }: RevokeAdminInviteInput): Promise<number> {
    const at = now.toISOString();
    const [changed] = await this.batchChanges([
      ['UPDATE admin_invites SET revoked_at = ? WHERE id = ? AND space_id = ? AND accepted_at IS NULL AND revoked_at IS NULL', [at, inviteId, spaceId]],
      [`${SPACE_EVENT_INSERT_SELECT} WHERE EXISTS (SELECT 1 FROM admin_invites WHERE id = ? AND space_id = ? AND revoked_at = ? AND accepted_at IS NULL)`, [eventId, spaceId, SpaceEventKindSchema.parse('admin_invite_revoked'), actorAccountId, null, null, inviteId, at, inviteId, spaceId, at]],
    ]);
    return changed ?? 0;
  }
  async acceptAdminInvite({ inviteId, spaceId, accountId, now, cap, eventId }: AcceptAdminInviteInput): Promise<boolean> {
    const at = now.toISOString();
    // The gate-then-guarded-writes batch (F-SPACE-002 section 4.6): every later statement runs only when the gate
    // stamped this account and this time on the invite.
    const accepted = 'EXISTS (SELECT 1 FROM admin_invites WHERE id = ? AND accepted_by = ? AND accepted_at = ?)';
    const [gate] = await this.batchChanges([
      [
        `UPDATE admin_invites SET accepted_by = ?, accepted_at = ?
         WHERE id = ? AND space_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'school' AND archived_at IS NULL AND owner_account_id <> ?)
           AND NOT EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'account' AND member_id = ? AND role <> 'teacher')
           AND (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'account' AND role = 'admin') < ?`,
        [accountId, at, inviteId, spaceId, at, spaceId, accountId, spaceId, accountId, spaceId, cap],
      ],
      // Only a teacher row is promoted (and records it); an owner row is never demoted.
      [
        `INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at)
         SELECT ?, 'account', ?, 'admin', ? WHERE ${accepted}
         ON CONFLICT(space_id, member_kind, member_id) DO UPDATE SET role = 'admin', promoted_from = 'teacher' WHERE memberships.role = 'teacher'`,
        [spaceId, accountId, at, inviteId, accountId, at],
      ],
      [`${SPACE_EVENT_INSERT_SELECT} WHERE ${accepted}`, [eventId, spaceId, SpaceEventKindSchema.parse('admin_joined'), accountId, accountId, null, inviteId, at, inviteId, accountId, at]],
    ]);
    return gate === 1;
  }
  async endAdminRole({ spaceId, accountId, actorAccountId, kind, now, eventId }: EndAdminRoleInput): Promise<EndAdminRoleResult> {
    // One batch: the event while the admin row still exists, then back to teacher when the test holds, else out.
    // Exactly one of the two writes can match, because the update leaves no admin row for the delete.
    const [, toTeacher, removed] = await this.batchChanges([
      [`${SPACE_EVENT_INSERT_SELECT} WHERE EXISTS (SELECT 1 FROM memberships WHERE ${ADMIN_ROW})`, [eventId, spaceId, SpaceEventKindSchema.parse(kind), actorAccountId, accountId, null, null, now.toISOString(), spaceId, accountId]],
      [`UPDATE memberships SET role = 'teacher', promoted_from = NULL WHERE ${ADMIN_ROW} AND (promoted_from = 'teacher' OR ${TEACHES_LIVE_CLASS})`, [spaceId, accountId, spaceId, accountId, accountId]],
      [`DELETE FROM memberships WHERE ${ADMIN_ROW}`, [spaceId, accountId]],
    ]);
    if (toTeacher === 1) return 'teacher';
    return removed === 1 ? 'none' : null;
  }
  async adminStaysTeacher(spaceId: string, accountId: string): Promise<boolean> {
    return !!(await this.one(`SELECT 1 AS x FROM memberships WHERE ${ADMIN_ROW} AND (promoted_from = 'teacher' OR ${TEACHES_LIVE_CLASS})`, [spaceId, accountId, spaceId, accountId, accountId], (r) => r));
  }
  purgeAdminInvites(before: Date, limit: number): Promise<number> {
    const cut = before.toISOString();
    return this.changes('DELETE FROM admin_invites WHERE id IN (SELECT id FROM admin_invites WHERE expires_at < ? OR accepted_at < ? OR revoked_at < ? LIMIT ?)', [cut, cut, cut, limit]);
  }

  getPlan(planId: string): Promise<Plan | null> {
    return this.one('SELECT * FROM plans WHERE id = ?', [planId], toPlan);
  }
  putPlan(p: Plan): Promise<void> {
    return this.run(
      'INSERT INTO plans (id, space_id, author_account_id, title, items_json, target_learner_ids_json, published_at, archived_at, created_at, updated_at, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, items_json = excluded.items_json, target_learner_ids_json = excluded.target_learner_ids_json, published_at = excluded.published_at, archived_at = excluded.archived_at, updated_at = excluded.updated_at, meta_json = excluded.meta_json',
      [p.id, p.spaceId, p.authorAccountId, p.title, JSON.stringify(p.items), p.targetLearnerIds === null ? null : JSON.stringify(p.targetLearnerIds), p.publishedAt, p.archivedAt, p.createdAt, p.updatedAt, p.meta === null ? null : JSON.stringify(p.meta)],
    );
  }
  plansOf(spaceId: string): Promise<Plan[]> {
    return this.many('SELECT * FROM plans WHERE space_id = ? ORDER BY created_at', [spaceId], toPlan);
  }

  getRelink(relinkId: string): Promise<StoredRelink | null> {
    return this.one('SELECT * FROM relink_requests WHERE id = ?', [relinkId], toRelink);
  }
  putRelink(r: StoredRelink): Promise<void> {
    return this.run(
      'INSERT INTO relink_requests (id, space_id, learner_id, device_id, platform, requested_at, expires_at, status, decided_at, secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, decided_at = excluded.decided_at, secret = excluded.secret, expires_at = excluded.expires_at',
      [r.id, r.spaceId, r.learnerId, r.deviceId, r.platform, r.requestedAt, r.expiresAt, r.status, r.decidedAt, r.secret],
    );
  }
  relinksOf(spaceId: string): Promise<StoredRelink[]> {
    return this.many('SELECT * FROM relink_requests WHERE space_id = ? ORDER BY requested_at', [spaceId], toRelink);
  }

  entitlementsFor(subjectKind: Entitlement['subjectKind'], subjectId: string): Promise<Entitlement[]> {
    return this.many('SELECT * FROM entitlements WHERE subject_kind = ? AND subject_id = ? ORDER BY plan_key', [subjectKind, subjectId], toEntitlement);
  }
  /**
   * A compare-and-set (BY-D5): read, merge in code, then write only if the row is still
   * what was read (`INSERT … DO NOTHING` for none, `UPDATE … WHERE` every column for one).
   * Stripe sends a subscription's events and its checkout completion together; a write that
   * lost the race reads again and merges onto the winner instead of overwriting it.
   */
  async applyEntitlement(input: EntitlementApply, now: Date, merge: EntitlementMerge = 'set'): Promise<Entitlement> {
    for (let attempt = 0; attempt < ENTITLEMENT_WRITE_ATTEMPTS; attempt += 1) {
      const existing = await this.one('SELECT * FROM entitlements WHERE subject_kind = ? AND subject_id = ? AND plan_key = ?', [input.subjectKind, input.subjectId, input.planKey], toEntitlement);
      const e = mergeEntitlement(existing, input, now, () => id('ent'), merge);
      if (existing && e === existing) return e;
      const won = existing
        ? await this.changes(
            'UPDATE entitlements SET status = ?, provider = ?, provider_ref = ?, customer_ref = ?, seats = ?, expires_at = ?, promo_code = ?, updated_at = ? WHERE id = ? AND status = ? AND provider = ? AND provider_ref IS ? AND customer_ref IS ? AND seats IS ? AND expires_at IS ? AND promo_code IS ? AND updated_at = ?',
            [e.status, e.provider, e.providerRef, e.customerRef, e.seats, e.expiresAt, e.promoCode, e.updatedAt, existing.id, existing.status, existing.provider, existing.providerRef, existing.customerRef, existing.seats, existing.expiresAt, existing.promoCode, existing.updatedAt],
          )
        : await this.changes(
            'INSERT INTO entitlements (id, subject_kind, subject_id, plan_key, status, provider, provider_ref, customer_ref, seats, expires_at, promo_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(subject_kind, subject_id, plan_key) DO NOTHING',
            [e.id, e.subjectKind, e.subjectId, e.planKey, e.status, e.provider, e.providerRef, e.customerRef, e.seats, e.expiresAt, e.promoCode, e.updatedAt],
          );
      if (won > 0) return e;
    }
    // Stripe retries a failed delivery, and the retry merges onto whatever is stored then.
    throw new Error('entitlement_write_conflict');
  }

  // ---- billing history (F-BILL-002 section 5.5, migration 0007) ----

  async recordBillingEvent(input: BillingEventInput, now: Date): Promise<BillingEvent> {
    const row = billingEventFields(input);
    const key = [row.provider, row.providerRef, row.kind];
    // One transaction: insert-or-keep on the unique key, then fill a missing payment_ref (never overwrite one).
    await this.d1.batch([
      this.d1
        .prepare(
          'INSERT INTO billing_events (id, subject_kind, subject_id, plan_key, kind, amount_cents, currency, provider, provider_ref, payment_ref, livemode, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, provider_ref, kind) DO NOTHING',
        )
        .bind(id('bev'), row.subjectKind, row.subjectId, row.planKey, row.kind, row.amountCents, row.currency, row.provider, row.providerRef, row.paymentRef, row.livemode ? 1 : 0, row.occurredAt, now.toISOString()),
      this.d1.prepare('UPDATE billing_events SET payment_ref = ? WHERE provider = ? AND provider_ref = ? AND kind = ? AND payment_ref IS NULL AND ? IS NOT NULL').bind(row.paymentRef, ...key, row.paymentRef),
    ]);
    const stored = await this.one('SELECT * FROM billing_events WHERE provider = ? AND provider_ref = ? AND kind = ?', key, toBillingEvent);
    if (!stored) throw new Error('billing_events: row missing after insert');
    return stored;
  }
  async billingEventsFor(subjectKind: BillingEvent['subjectKind'], subjectId: string, limit: number): Promise<BillingEvent[]> {
    assertBillingLimit(limit);
    return this.many(`SELECT * FROM billing_events WHERE subject_kind = ? AND subject_id = ? ORDER BY ${NEWEST_BILLING_EVENT} LIMIT ?`, [subjectKind, subjectId, limit], toBillingEvent);
  }
  billingEventById(eventId: string): Promise<BillingEvent | null> {
    return this.one('SELECT * FROM billing_events WHERE id = ?', [eventId], toBillingEvent);
  }
  billingEventByRef(provider: BillingEvent['provider'], providerRef: string, kind?: BillingEventKind): Promise<BillingEvent | null> {
    return kind === undefined
      ? this.one(`SELECT * FROM billing_events WHERE provider = ? AND provider_ref = ? ORDER BY ${NEWEST_BILLING_EVENT} LIMIT 1`, [provider, providerRef], toBillingEvent)
      : this.one('SELECT * FROM billing_events WHERE provider = ? AND provider_ref = ? AND kind = ?', [provider, providerRef, kind], toBillingEvent);
  }
  billingEventByPaymentRef(paymentRef: string): Promise<BillingEvent | null> {
    return this.one(
      `SELECT * FROM billing_events WHERE payment_ref = ? AND kind IN (${REFUNDABLE_BILLING_KINDS.map(() => '?').join(', ')}) ORDER BY ${NEWEST_BILLING_EVENT} LIMIT 1`,
      [paymentRef, ...REFUNDABLE_BILLING_KINDS],
      toBillingEvent,
    );
  }
  entitlementByProviderRef(provider: Entitlement['provider'], providerRef: string): Promise<Entitlement | null> {
    return this.one('SELECT * FROM entitlements WHERE provider = ? AND provider_ref = ? ORDER BY updated_at DESC, id DESC LIMIT 1', [provider, providerRef], toEntitlement);
  }
  // Set-based reads for the billing summary: one statement per list, whatever its length (json_each).
  entitlementsForSpaces(spaceIds: readonly string[]): Promise<Entitlement[]> {
    if (spaceIds.length === 0) return Promise.resolve([]);
    return this.many("SELECT * FROM entitlements WHERE subject_kind = 'space' AND subject_id IN (SELECT value FROM json_each(?))", [JSON.stringify(spaceIds)], toEntitlement);
  }
  membersOfSpaces(spaceIds: readonly string[]): Promise<Membership[]> {
    if (spaceIds.length === 0) return Promise.resolve([]);
    return this.many('SELECT * FROM memberships WHERE space_id IN (SELECT value FROM json_each(?)) ORDER BY joined_at', [JSON.stringify(spaceIds)], toMembership);
  }
  childSpacesOfSpaces(parentSpaceIds: readonly string[]): Promise<Space[]> {
    if (parentSpaceIds.length === 0) return Promise.resolve([]);
    return this.many('SELECT * FROM spaces WHERE parent_space_id IN (SELECT value FROM json_each(?)) ORDER BY created_at', [JSON.stringify(parentSpaceIds)], toSpace);
  }
  async billingEventsForSpaces(spaceIds: readonly string[], limitPerSpace: number): Promise<BillingEvent[]> {
    assertBillingLimit(limitPerSpace);
    if (spaceIds.length === 0 || limitPerSpace === 0) return [];
    return this.many(
      `SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY ${NEWEST_BILLING_EVENT}) AS rn FROM billing_events WHERE subject_kind = 'space' AND subject_id IN (SELECT value FROM json_each(?))) WHERE rn <= ? ORDER BY subject_id, ${NEWEST_BILLING_EVENT}`,
      [JSON.stringify(spaceIds), limitPerSpace],
      toBillingEvent,
    );
  }

  addWaitlist(e: Omit<WaitlistEntry, 'unsubscribedAt'>): Promise<void> {
    return this.run('INSERT INTO waitlist (email, created_at, source, locale, consent_text_version) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING', [e.email, e.createdAt, e.source, e.locale, e.consentTextVersion]);
  }
  waitlistEntries(): Promise<WaitlistEntry[]> {
    return this.many('SELECT * FROM waitlist ORDER BY created_at, id', [], toWaitlist);
  }
  async unsubscribeWaitlist(email: string, now: Date): Promise<boolean> {
    return (await this.changes('UPDATE waitlist SET unsubscribed_at = ? WHERE email = ?', [now.toISOString(), email])) > 0;
  }

  // ---- class transfer (F-SPACE-002 section 4.7) ----

  /** One batch's results as row counts; a binding that does not report `meta.changes` is an error, never zero. */
  private async batchChanges(statements: Array<[string, unknown[]]>): Promise<number[]> {
    const results = await this.d1.batch(statements.map(([sql, params]) => this.d1.prepare(sql).bind(...params)));
    return results.map(readChanges);
  }

  async createTransfer(row: StoredTransfer, event: Omit<NewTransferEvent, 'transferId'>): Promise<'created' | 'already_open'> {
    assertNewTransfer(row);
    // Insert only while the learner has no open request (the partial unique index is the backstop);
    // the event needs its row and is written once per row; both run in one transaction.
    const [inserted] = await this.batchChanges([
      [
        `INSERT INTO transfer_requests (${TRANSFER_COLUMNS.join(', ')}) SELECT ${TRANSFER_COLUMNS.map(() => '?').join(', ')} WHERE NOT EXISTS (SELECT 1 FROM transfer_requests WHERE learner_id = ? AND ${OPEN})`,
        [...transferValues(row), row.learnerId],
      ],
      [
        'INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM transfer_events WHERE transfer_id = ?)',
        [row.id, event.at, event.actorKind, event.actorRef, event.event, event.slot, event.detail === null ? null : JSON.stringify(event.detail), row.id, row.id],
      ],
    ]);
    return inserted === 1 ? 'created' : 'already_open';
  }

  async consentSlot(transferId: string, consent: TransferSlotConsent, now: Date, events: ReadonlyArray<Omit<NewTransferEvent, 'transferId'>> = []): Promise<number> {
    const at = now.toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    const where: string[] = [];
    if (consent.kind === 'learner') {
      const record = consentedLearnerSlot(consent.record, at);
      sets.push(`l_state = 'consented', ${LEARNER_RECORD_COLUMNS.map((c) => `${c} = ?`).join(', ')}, introduce = COALESCE(?, introduce), execute_after = ?`);
      params.push(...learnerRecordValues(record), consent.introduce === undefined ? null : consent.introduce ? 1 : 0, new Date(now.getTime() + TRANSFER_COOLING_OFF_MS).toISOString());
      where.push("l_state = 'pending'");
    } else {
      const slots = teacherSlotsOf(consent);
      if (slots.source) {
        sets.push("s_state = 'consented', s_at = ?, s_account_id = ?, s_via = ?");
        params.push(at, consent.accountId, consent.via);
        where.push("s_state = 'pending'");
      }
      if (slots.destination) {
        sets.push("d_state = 'consented', d_at = ?, d_account_id = ?, d_via = ?");
        params.push(at, consent.accountId, consent.via);
        where.push("d_state = 'pending'", "l_state = 'consented'");
      }
    }
    const update = (extraSet: string, extraParams: unknown[]): [string, unknown[]] => [
      `UPDATE transfer_requests SET ${sets.join(', ')}${extraSet}, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND ${where.join(' AND ')}`,
      [...params, ...extraParams, at, transferId],
    ];
    if (events.length === 0) {
      const [sql, values] = update('', []);
      return this.changes(sql, values);
    }
    // The consent and its audit rows in one transaction, written only by the call whose CAS changed the row:
    // the UPDATE marks it with a one-off token in `block_reason`, each event is guarded by the token, and the
    // last statement clears it (the pattern of resetLearnerConsent). A slot can be filled only while the
    // request is `requested` (an `approved` row has every slot in), and a `requested` row never carries a
    // block reason (`blockTransfer` needs `approved`, a reset clears it), so the token overwrites nothing.
    const token = `consenting:${crypto.randomUUID()}`;
    const [changed] = await this.batchChanges([
      update(', block_reason = ?', [token]),
      ...events.map((e): [string, unknown[]] => [
        'INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND block_reason = ?)',
        [transferId, e.at, e.actorKind, e.actorRef, e.event, e.slot, e.detail === null ? null : JSON.stringify(e.detail), transferId, token],
      ]),
      ['UPDATE transfer_requests SET block_reason = NULL WHERE id = ? AND block_reason = ?', [transferId, token]],
    ]);
    return changed ?? 0;
  }

  async declineSlot(transferId: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    assertTransferSlot(slot);
    const at = now.toISOString();
    return this.endTransfer(
      [
        `UPDATE transfer_requests SET ${SLOT_STATE_COLUMN[slot]} = 'declined', status = 'declined', end_reason = ?, end_actor = ?, ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN}`,
        [endReason, endActor, at, at, transferId],
      ],
      { transferId, status: 'declined', endReason, at },
      event,
    );
  }

  cancelTransfer(transferId: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    const at = now.toISOString();
    return this.endTransfer(
      [`UPDATE transfer_requests SET status = 'cancelled', end_reason = ?, end_actor = ?, ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN}`, [endReason, endActor, at, at, transferId]],
      { transferId, status: 'cancelled', endReason, at },
      event,
    );
  }

  /**
   * The ending CAS alone, or with its audit row in one transaction. The event is guarded by the ending this
   * CAS wrote (status, reason and `ended_at` = now) and by the absence of an earlier event of its kind: a
   * request ends once, so a call that lost the race in the same millisecond inserts nothing.
   */
  private async endTransfer(update: [string, unknown[]], ended: { transferId: string; status: 'declined' | 'cancelled' | 'expired'; endReason: TransferEndReason; at: string }, event: Omit<NewTransferEvent, 'transferId'> | undefined): Promise<number> {
    if (!event) return this.changes(update[0], update[1]);
    const { transferId } = ended;
    const [changed] = await this.batchChanges([
      update,
      [
        'INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND status = ? AND end_reason = ? AND ended_at = ?) AND NOT EXISTS (SELECT 1 FROM transfer_events WHERE transfer_id = ? AND event = ?)',
        [transferId, event.at, event.actorKind, event.actorRef, event.event, event.slot, event.detail === null ? null : JSON.stringify(event.detail), transferId, ended.status, ended.endReason, ended.at, transferId, event.event],
      ],
    ]);
    return changed ?? 0;
  }

  expireTransfer(transferId: string, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    const at = now.toISOString();
    return this.endTransfer(
      [
        `UPDATE transfer_requests SET status = 'expired', end_reason = 'expired', end_actor = 'system', ended_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND expires_at <= ?`,
        [at, at, transferId, at],
      ],
      { transferId, status: 'expired', endReason: 'expired', at },
      event,
    );
  }

  markSourceNotRequired(transferId: string, now: Date): Promise<number> {
    return this.changes(`UPDATE transfer_requests SET s_state = 'not_required', updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND s_state = 'pending'`, [now.toISOString(), transferId]);
  }

  promoteTransfer(transferId: string, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.changes(`UPDATE transfer_requests SET status = 'approved', approved_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'requested' AND ${ALL_SLOTS_IN}`, [at, at, transferId]);
  }

  blockTransfer(transferId: string, reason: TransferBlockReason, now: Date): Promise<number> {
    return this.changes("UPDATE transfer_requests SET block_reason = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'approved' AND (block_reason IS NULL OR block_reason <> ?)", [
      reason,
      now.toISOString(),
      transferId,
      reason,
    ]);
  }

  async resetLearnerConsent(transferId: string, why: ConsentResetReason, now: Date, expectedRev?: number): Promise<number> {
    const at = now.toISOString();
    // The reset and its audit row in one transaction: the UPDATE marks the row it changed with a one-off
    // token in `block_reason` (which the reset clears anyway), the event is guarded by it, and the last
    // statement clears it (the same pattern as executeTransfer).
    const token = `resetting:${crypto.randomUUID()}`;
    const [changed] = await this.batchChanges([
      [
        `UPDATE transfer_requests SET l_state = 'pending', ${LEARNER_RECORD_COLUMNS.map((c) => `${c} = NULL`).join(', ')}, status = 'requested', approved_at = NULL, execute_after = NULL, block_reason = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND ${OPEN} AND l_state = 'consented'${expectedRev === undefined ? '' : ' AND rev = ?'}`,
        expectedRev === undefined ? [token, at, transferId] : [token, at, transferId, expectedRev],
      ],
      [
        "INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, 'system', NULL, 'consent_reset', 'learner', ? WHERE EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND block_reason = ?)",
        [transferId, at, JSON.stringify({ why }), transferId, token],
      ],
      ['UPDATE transfer_requests SET block_reason = NULL WHERE id = ? AND block_reason = ?', [transferId, token]],
    ]);
    return changed ?? 0;
  }

  async executeTransfer(input: ExecuteTransferInput): Promise<ExecuteTransferResult> {
    const at = input.now.toISOString();
    const { id: transferId, learnerId, sourceSpaceId: source, destSpaceId: dest } = input;
    // [SA] section 3.3: the destination school's distinct-student cap is part of the gate.
    const [school, schoolParams] = schoolSeatCondition(input.destSchoolId ?? null, input.destSchoolCap ?? null, learnerId);
    // The gate marks the row it changed with a one-off token in `block_reason` (which the move clears
    // anyway) and the last statement clears it, so no reader outside the transaction ever sees it.
    // G = "this call's gate executed the row". Matching on `executed_at = now` alone (the spec's
    // sketch) would let a second execute in the same millisecond run every later statement again.
    const token = `executing:${crypto.randomUUID()}`;
    const guard = "EXISTS (SELECT 1 FROM transfer_requests WHERE id = ? AND status = 'executed' AND block_reason = ?)";
    const g = [transferId, token];
    const [gate, , , relinksClosed, devicesRevoked] = await this.batchChanges([
      [
        `UPDATE transfer_requests SET status = 'executed', executed_at = ?, block_reason = ?, updated_at = ?, rev = rev + 1
         WHERE id = ? AND learner_id = ? AND source_space_id = ? AND dest_space_id = ?
           AND source_space_id <> dest_space_id
           AND status = 'approved' AND expires_at > ? AND execute_after <= ? AND ${ALL_SLOTS_IN}
           AND EXISTS (SELECT 1 FROM learners WHERE id = ?)
           AND EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class')
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class' AND archived_at IS NULL)
           AND ( EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
                 OR ( (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'learner') < ?
                      AND (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id = m.space_id
                           WHERE m.member_kind = 'learner' AND m.member_id = ? AND s.kind = 'class' AND s.archived_at IS NULL AND m.space_id <> ?) < ?
                      AND ${school} ) )`,
        [at, token, at, transferId, learnerId, source, dest, at, at, learnerId, source, learnerId, source, dest, dest, learnerId, dest, finiteCap(input.destCap), learnerId, source, finiteCap(input.learnerCap), ...schoolParams],
      ],
      [`INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) SELECT ?, 'learner', ?, 'student', ? WHERE ${guard} ON CONFLICT(space_id, member_kind, member_id) DO NOTHING`, [dest, learnerId, at, ...g]],
      [`DELETE FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ? AND ${guard}`, [source, learnerId, ...g]],
      [`UPDATE relink_requests SET status = 'denied', decided_at = ? WHERE space_id = ? AND learner_id = ? AND status = 'pending' AND ${guard}`, [at, source, learnerId, ...g]],
      [
        `DELETE FROM learner_devices WHERE learner_id = ? AND scope = 'class' AND ${guard}
           AND device_id IN (SELECT device_id FROM relink_requests WHERE space_id = ? AND learner_id = ? AND status = 'approved')
           AND device_id NOT IN (SELECT r.device_id FROM relink_requests r JOIN memberships m ON m.space_id = r.space_id AND m.member_kind = 'learner' AND m.member_id = r.learner_id
                                 WHERE r.learner_id = ? AND r.status = 'approved' AND r.space_id <> ?)`,
        [learnerId, ...g, source, learnerId, learnerId, source],
      ],
      // F-FEEDBACK-001 section 7.5: the source membership ends, so its live, hidden and withdrawn notes go (reported ones, and any note a report row names, stay)
      [`DELETE FROM feedback_notes WHERE learner_id = ? AND space_id = ? AND status <> 'reported' AND ${NO_REPORT_ROW} AND ${guard}`, [learnerId, source, ...g]],
      [`INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) SELECT ?, ?, 'system', NULL, 'executed', NULL, NULL WHERE ${guard}`, [transferId, at, ...g]],
      ['UPDATE transfer_requests SET block_reason = NULL WHERE id = ? AND block_reason = ?', g],
    ]);
    return gate === 1 ? { executed: true, devicesRevoked: devicesRevoked ?? 0, relinksClosed: relinksClosed ?? 0 } : { executed: false, devicesRevoked: 0, relinksClosed: 0 };
  }

  getTransfer(transferId: string): Promise<StoredTransfer | null> {
    return this.one('SELECT * FROM transfer_requests WHERE id = ?', [transferId], toTransfer);
  }
  transfersOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredTransfer[]> {
    const column = role === 'source' ? 'source_space_id' : 'dest_space_id';
    return this.many(`SELECT * FROM transfer_requests WHERE ${column} = ? ORDER BY created_at DESC, id DESC LIMIT ?`, [spaceId, limit], toTransfer);
  }
  async openTransfersOfSpaces(spaceIds: readonly string[], role: 'source' | 'destination'): Promise<StoredTransfer[]> {
    const column = role === 'source' ? 'source_space_id' : 'dest_space_id';
    const unique = [...new Set(spaceIds)];
    const out: StoredTransfer[] = [];
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const chunk = unique.slice(i, i + IN_CHUNK);
      out.push(...(await this.many(`SELECT * FROM transfer_requests WHERE ${column} IN (${chunk.map(() => '?').join(', ')}) AND ${OPEN}`, chunk, toTransfer)));
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
  transfersOfLearner(learnerId: string): Promise<StoredTransfer[]> {
    return this.many('SELECT * FROM transfer_requests WHERE learner_id = ? ORDER BY created_at DESC, id DESC', [learnerId], toTransfer);
  }
  openTransferOf(learnerId: string): Promise<StoredTransfer | null> {
    return this.one(`SELECT * FROM transfer_requests WHERE learner_id = ? AND ${OPEN} LIMIT 1`, [learnerId], toTransfer);
  }
  lastLearnerRefusal(learnerId: string, since: Date): Promise<StoredTransfer | null> {
    return this.one(
      "SELECT * FROM transfer_requests WHERE learner_id = ? AND initiator = 'source' AND end_reason IN ('declined_learner','withdrawn_learner') AND ended_at >= ? ORDER BY ended_at DESC, id DESC LIMIT 1",
      [learnerId, since.toISOString()],
      toTransfer,
    );
  }
  lastCooldownDecline(learnerId: string, destSpaceId: string, since: Date): Promise<StoredTransfer | null> {
    return this.one(
      "SELECT * FROM transfer_requests WHERE learner_id = ? AND dest_space_id = ? AND initiator = 'learner_side' AND end_reason IN ('declined_source','declined_destination') AND ended_at >= ? ORDER BY ended_at DESC, id DESC LIMIT 1",
      [learnerId, destSpaceId, since.toISOString()],
      toTransfer,
    );
  }
  private async count(sql: string, params: unknown[]): Promise<number> {
    return (await this.one(sql, params, (r) => num(r.n))) ?? 0;
  }
  countTransfersCreatedBy(accountId: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM transfer_requests WHERE initiator_account_id = ? AND created_at >= ?', [accountId, since.toISOString()]);
  }
  countTransfersCreatedForLearner(learnerId: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM transfer_requests WHERE learner_id = ? AND created_at >= ?', [learnerId, since.toISOString()]);
  }
  countOpenTransfersTo(spaceId: string, now?: Date): Promise<number> {
    if (now) return this.count(`SELECT COUNT(*) AS n FROM transfer_requests WHERE dest_space_id = ? AND ${OPEN} AND expires_at > ?`, [spaceId, now.toISOString()]);
    return this.count(`SELECT COUNT(*) AS n FROM transfer_requests WHERE dest_space_id = ? AND ${OPEN}`, [spaceId]);
  }
  transferEvents(transferId: string): Promise<TransferEvent[]> {
    return this.many('SELECT * FROM transfer_events WHERE transfer_id = ? ORDER BY id', [transferId], toTransferEvent);
  }
  addTransferEvent(e: NewTransferEvent): Promise<void> {
    return this.run('INSERT INTO transfer_events (transfer_id, at, actor_kind, actor_ref, event, slot, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      e.transferId,
      e.at,
      e.actorKind,
      e.actorRef,
      e.event,
      e.slot,
      e.detail === null ? null : JSON.stringify(e.detail),
    ]);
  }
  private async byIds<T>(table: 'learners' | 'spaces' | 'accounts', ids: readonly string[], map: (r: Row) => T): Promise<T[]> {
    const unique = [...new Set(ids)];
    const out: T[] = [];
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const chunk = unique.slice(i, i + IN_CHUNK);
      out.push(...(await this.many(`SELECT * FROM ${table} WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk, map)));
    }
    return out;
  }
  getLearners(ids: readonly string[]): Promise<Learner[]> {
    return this.byIds('learners', ids, toLearner);
  }
  getSpaces(ids: readonly string[]): Promise<Space[]> {
    return this.byIds('spaces', ids, toSpace);
  }
  getAccounts(ids: readonly string[]): Promise<Account[]> {
    return this.byIds('accounts', ids, toAccount);
  }
  purgeTransfers(endedBefore: Date, executedBefore: Date, limit: number): Promise<number> {
    // One bounded statement (section 4.1); the events go with their rows through ON DELETE CASCADE.
    return this.changes(
      `DELETE FROM transfer_requests WHERE id IN (SELECT t.id FROM transfer_requests t
         WHERE (t.${ENDED} AND t.ended_at < ?)
            OR (t.status = 'executed' AND t.executed_at < ? AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.space_id = t.dest_space_id AND m.member_kind = 'learner' AND m.member_id = t.learner_id))
         ORDER BY t.id LIMIT ?)`,
      [endedBefore.toISOString(), executedBefore.toISOString(), limit],
    );
  }
  recordRateHit(key: string, at: Date): Promise<void> {
    return this.run('INSERT INTO rate_hits (key, at) VALUES (?, ?)', [key, at.toISOString()]);
  }
  countRateHits(key: string, since: Date): Promise<number> {
    return this.count('SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at >= ?', [key, since.toISOString()]);
  }
  purgeRateHits(before: Date, limit: number): Promise<number> {
    return this.changes('DELETE FROM rate_hits WHERE id IN (SELECT id FROM rate_hits WHERE at < ? ORDER BY id LIMIT ?)', [before.toISOString(), limit]);
  }
  async getTransferPrefs(learnerId: string): Promise<TransferPrefs> {
    const prefs = await this.one('SELECT * FROM learner_transfer_prefs WHERE learner_id = ?', [learnerId], (r): TransferPrefs => ({ selfManaged: bool(r.self_managed), blockTeacherRequests: bool(r.block_teacher_requests), updatedAt: nstr(r.updated_at) }));
    return prefs ?? { selfManaged: false, blockTeacherRequests: false, updatedAt: null };
  }
  async setTransferPref(learnerId: string, which: TransferPrefKey, value: boolean, now: Date): Promise<void> {
    assertTransferPrefKey(which);
    const column = PREF_COLUMN[which];
    return this.run(`INSERT INTO learner_transfer_prefs (learner_id, ${column}, updated_at) VALUES (?, ?, ?) ON CONFLICT(learner_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`, [
      learnerId,
      value ? 1 : 0,
      now.toISOString(),
    ]);
  }

  // ---- notes from grown-ups (F-FEEDBACK-001 section 7.4, migration 0008) ----
  // Lists are bound as one JSON array and read with json_each: one statement whatever their length (D11).

  studentsOf(spaceId: string, learnerIds: readonly string[]): Promise<string[]> {
    if (learnerIds.length === 0) return Promise.resolve([]);
    return this.many(
      "SELECT member_id FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND role = 'student' AND member_id IN (SELECT value FROM json_each(?))",
      [spaceId, JSON.stringify(learnerIds)],
      (r) => str(r.member_id),
    );
  }
  notePrefsFor(learnerIds: readonly string[]): Promise<StoredNotePrefs[]> {
    if (learnerIds.length === 0) return Promise.resolve([]);
    return this.many('SELECT * FROM learner_note_prefs WHERE learner_id IN (SELECT value FROM json_each(?))', [JSON.stringify(learnerIds)], (r) => toNotePrefs(r));
  }
  noteRecipients(spaceId: string, senderAccountId: string): Promise<NoteRecipientRow[]> {
    return this.many(
      `SELECT m.member_id AS learner_id, l.display_name AS display_name, COALESCE(p.classes, 'all') AS classes,
         EXISTS (SELECT 1 FROM feedback_sender_blocks b WHERE b.learner_id = m.member_id AND b.sender_account_id = ?) AS blocked
       FROM memberships m
       JOIN learners l ON l.id = m.member_id
       LEFT JOIN learner_note_prefs p ON p.learner_id = m.member_id
       WHERE m.space_id = ? AND m.member_kind = 'learner' AND m.role = 'student'
       ORDER BY m.joined_at, m.member_id`,
      [senderAccountId, spaceId],
      (r): NoteRecipientRow => ({ learnerId: str(r.learner_id), displayName: str(r.display_name), classes: str(r.classes) as NoteRecipientRow['classes'], blocked: bool(r.blocked) }),
    );
  }
  blocksFor(learnerIds: readonly string[], senderAccountId: string): Promise<string[]> {
    if (learnerIds.length === 0) return Promise.resolve([]);
    return this.many('SELECT learner_id FROM feedback_sender_blocks WHERE sender_account_id = ? AND learner_id IN (SELECT value FROM json_each(?))', [senderAccountId, JSON.stringify(learnerIds)], (r) => str(r.learner_id));
  }
  async countRateHitsByKeys(keys: readonly string[], since: Date): Promise<Map<string, number>> {
    if (keys.length === 0) return new Map();
    const rows = await this.many('SELECT key, COUNT(*) AS n FROM rate_hits WHERE key IN (SELECT value FROM json_each(?)) AND at >= ? GROUP BY key', [JSON.stringify(keys), since.toISOString()], (r): [string, number] => [str(r.key), num(r.n)]);
    return new Map(rows);
  }
  async addRateHits(rows: readonly RateHitRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.run("INSERT INTO rate_hits (key, at) SELECT json_extract(value, '$.key'), json_extract(value, '$.at') FROM json_each(?)", [JSON.stringify(rows)]);
  }
  async insertNotes(rows: readonly NewNote[], rateHits: readonly RateHitRow[]): Promise<number> {
    const sender = assertOneSender(rows);
    if (sender === null) return 0;
    const columns = NOTE_INSERT_COLUMNS.join(', ');
    const values = NOTE_INSERT_COLUMNS.map((c) => `json_extract(value, '$.${c}')`).join(', ');
    // Both inserts carry the hold re-check, so a hold placed after the route's own check writes nothing at all.
    const statements = [this.d1.prepare(`INSERT INTO feedback_notes (${columns}) SELECT ${values} FROM json_each(?) WHERE ${NOT_HELD}`).bind(JSON.stringify(rows.map(noteInsertJson)), sender)];
    if (rateHits.length > 0) {
      statements.push(this.d1.prepare(`INSERT INTO rate_hits (key, at) SELECT json_extract(value, '$.key'), json_extract(value, '$.at') FROM json_each(?) WHERE ${NOT_HELD}`).bind(JSON.stringify(rateHits), sender));
    }
    const results = await this.d1.batch(statements);
    return readChanges(results[0]);
  }
  async notesForLearner(learnerId: string, scope: NoteDeviceScope, now: Date, limit: number): Promise<LearnerNotesInbox> {
    const { notesSince } = noteRetentionCuts(now);
    const rows = await this.many(INBOX_SQL, [learnerId, learnerId, notesSince, scope, limit], (r) => r);
    const first = rows[0];
    return {
      prefs: first && first.p_learner_id !== null && first.p_learner_id !== undefined ? toNotePrefs(first, 'p_') : null,
      notes: rows.filter((r) => r.id !== null && r.id !== undefined).map(toDeliveredNote),
    };
  }
  notesForSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date; learnerId?: string }): Promise<StoredNote[]> {
    const cuts = noteRetentionCuts(options.now);
    const where = ['n.space_id = ?', NOTE_VISIBLE];
    const params: unknown[] = [spaceId, cuts.notesSince, cuts.reportsSince];
    if (options.learnerId !== undefined) {
      where.push('n.learner_id = ?');
      params.push(options.learnerId);
    }
    if (options.before) {
      where.push(NOTE_BEFORE);
      params.push(options.before.createdAt, options.before.createdAt, options.before.id);
    }
    return this.many(`SELECT n.* FROM feedback_notes n WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT ?`, [...params, options.limit], toNote);
  }
  sentListOfSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<SpaceNoteListRow[]> {
    const { notesSince, reportsSince } = noteRetentionCuts(options.now);
    const params: unknown[] = [notesSince, reportsSince, spaceId, notesSince, reportsSince, notesSince, reportsSince];
    let sql = SENT_LIST_SELECT;
    if (options.before) {
      sql += ` AND ${NOTE_BEFORE}`;
      params.push(options.before.createdAt, options.before.createdAt, options.before.id);
    }
    return this.many(`${sql} ORDER BY n.created_at DESC, n.id DESC LIMIT ?`, [...params, options.limit], (r) => ({
      note: toNote(r),
      batch: typeof r.batch_counts === 'string' ? batchCounts(r.batch_counts) : null,
    }));
  }
  notesForOversight(learnerId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<StoredNote[]> {
    const cuts = noteRetentionCuts(options.now);
    const where = ['n.learner_id = ?', NOTE_VISIBLE];
    const params: unknown[] = [learnerId, cuts.notesSince, cuts.reportsSince];
    if (options.before) {
      where.push(NOTE_BEFORE);
      params.push(options.before.createdAt, options.before.createdAt, options.before.id);
    }
    return this.many(`SELECT n.* FROM feedback_notes n WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT ?`, [...params, options.limit], toNote);
  }
  getNote(noteId: string): Promise<StoredNote | null> {
    return this.one('SELECT * FROM feedback_notes WHERE id = ?', [noteId], toNote);
  }
  setNoteRead(noteId: string, at: Date): Promise<number> {
    return this.changes("UPDATE feedback_notes SET read_at = ? WHERE id = ? AND status = 'live' AND read_at IS NULL", [at.toISOString(), noteId]);
  }
  setNoteReaction(noteId: string, reaction: string, at: Date): Promise<number> {
    return this.changes("UPDATE feedback_notes SET reaction = ?, reaction_at = ? WHERE id = ? AND status = 'live'", [reaction, at.toISOString(), noteId]);
  }
  hideNote(noteId: string, via: NoteActVia, at: Date, actedBy?: string): Promise<number> {
    return this.changes("UPDATE feedback_notes SET status = 'hidden', hidden_via = ?, hidden_at = ?, acted_by_account_id = ? WHERE id = ? AND status = 'live'", [
      via,
      at.toISOString(),
      via === 'family' ? (actedBy ?? null) : null,
      noteId,
    ]);
  }
  withdrawNote(noteId: string, at: Date): Promise<number> {
    return this.changes("UPDATE feedback_notes SET status = 'withdrawn', withdrawn_at = ? WHERE id = ? AND status = 'live'", [at.toISOString(), noteId]);
  }
  withdrawBatch(batchId: string, senderAccountId: string, at: Date): Promise<number> {
    return this.changes("UPDATE feedback_notes SET status = 'withdrawn', withdrawn_at = ? WHERE batch_id = ? AND sender_account_id = ? AND status = 'live'", [at.toISOString(), batchId, senderAccountId]);
  }
  async insertNoteReport(r: StoredNoteReport): Promise<boolean> {
    // Only while the note is still within retention at the report time (section 8.7): a report never brings
    // back a note that every list already hides. The status follows only the row this batch inserted.
    const cuts = noteRetentionCuts(new Date(r.createdAt));
    const results = await this.d1.batch([
      this.d1
        .prepare(
          `INSERT INTO feedback_reports (id, note_id, learner_id, sender_account_id, reason, via, evidence, reporter_key, attest, created_at, reviewed_at, outcome) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM feedback_notes n WHERE n.id = ? AND ${NOTE_VISIBLE})`,
        )
        .bind(r.id, r.noteId, r.learnerId, r.senderAccountId, r.reason, r.via, r.evidence, r.reporterKey, r.attest, r.createdAt, r.reviewedAt, r.outcome, r.noteId, cuts.notesSince, cuts.reportsSince),
      this.d1.prepare("UPDATE feedback_notes SET status = 'reported' WHERE id = ? AND EXISTS (SELECT 1 FROM feedback_reports WHERE id = ? AND note_id = ?)").bind(r.noteId, r.id, r.noteId),
    ]);
    return readChanges(results[0]) === 1;
  }
  async reportsForNotes(noteIds: readonly string[]): Promise<StoredNoteReport[]> {
    if (noteIds.length === 0) return [];
    return this.many('SELECT * FROM feedback_reports WHERE note_id IN (SELECT value FROM json_each(?)) ORDER BY created_at, id', [JSON.stringify([...new Set(noteIds)])], toNoteReport);
  }
  countReportersAgainst(accountId: string, since: Date): Promise<number> {
    return this.count("SELECT COUNT(DISTINCT reporter_key) AS n FROM feedback_reports WHERE sender_account_id = ? AND created_at >= ? AND (outcome IS NULL OR outcome <> 'restored')", [accountId, since.toISOString()]);
  }
  getSenderHold(accountId: string): Promise<StoredSenderHold | null> {
    return this.one('SELECT * FROM feedback_sender_holds WHERE account_id = ?', [accountId], toSenderHold);
  }
  async putSenderHold(h: StoredSenderHold): Promise<boolean> {
    const written = await this.changes(
      'INSERT INTO feedback_sender_holds (account_id, reason, created_at, lifted_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at, lifted_at = excluded.lifted_at WHERE feedback_sender_holds.lifted_at IS NOT NULL',
      [h.accountId, h.reason, h.createdAt, h.liftedAt],
    );
    return written === 1;
  }
  getNotePrefs(learnerId: string): Promise<StoredNotePrefs | null> {
    return this.one('SELECT * FROM learner_note_prefs WHERE learner_id = ?', [learnerId], (r) => toNotePrefs(r));
  }
  putNotePrefs(p: StoredNotePrefs): Promise<void> {
    return this.run(
      'INSERT INTO learner_note_prefs (learner_id, classes, acknowledged_at, updated_at, updated_via, updated_by_account) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(learner_id) DO UPDATE SET classes = excluded.classes, acknowledged_at = COALESCE(excluded.acknowledged_at, learner_note_prefs.acknowledged_at), updated_at = excluded.updated_at, updated_via = excluded.updated_via, updated_by_account = excluded.updated_by_account',
      [p.learnerId, p.classes, p.acknowledgedAt, p.updatedAt, p.updatedVia, p.updatedByAccount],
    );
  }
  putBlock(b: StoredSenderBlock): Promise<void> {
    return this.run('INSERT INTO feedback_sender_blocks (learner_id, sender_account_id, family_space_id, created_by_account, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(learner_id, sender_account_id) DO NOTHING', [
      b.learnerId,
      b.senderAccountId,
      b.familySpaceId,
      b.createdByAccount,
      b.createdAt,
    ]);
  }
  async deleteBlock(learnerId: string, senderAccountId: string): Promise<boolean> {
    return (await this.changes('DELETE FROM feedback_sender_blocks WHERE learner_id = ? AND sender_account_id = ?', [learnerId, senderAccountId])) > 0;
  }
  listBlocks(learnerId: string): Promise<StoredSenderBlock[]> {
    return this.many('SELECT * FROM feedback_sender_blocks WHERE learner_id = ? ORDER BY created_at DESC, sender_account_id DESC', [learnerId], toSenderBlock);
  }
  getSendGrant(spaceId: string, accountId: string): Promise<StoredSendGrant | null> {
    return this.one('SELECT * FROM feedback_send_grants WHERE space_id = ? AND account_id = ?', [spaceId, accountId], toSendGrant);
  }
  putSendGrant(g: StoredSendGrant): Promise<void> {
    return this.run('INSERT INTO feedback_send_grants (space_id, account_id, granted_by, granted_at) VALUES (?, ?, ?, ?) ON CONFLICT(space_id, account_id) DO UPDATE SET granted_by = excluded.granted_by, granted_at = excluded.granted_at', [
      g.spaceId,
      g.accountId,
      g.grantedBy,
      g.grantedAt,
    ]);
  }
  async deleteSendGrant(spaceId: string, accountId: string): Promise<boolean> {
    return (await this.changes('DELETE FROM feedback_send_grants WHERE space_id = ? AND account_id = ?', [spaceId, accountId])) > 0;
  }
  deleteNotesForMembership(learnerId: string, spaceId: string): Promise<number> {
    return this.changes(`DELETE FROM feedback_notes WHERE learner_id = ? AND space_id = ? AND status <> 'reported' AND ${NO_REPORT_ROW}`, [learnerId, spaceId]);
  }
  async purgeNotes(before: Date, reportedBefore: Date, liftedBefore: Date, limit: number): Promise<number> {
    const results = await this.d1.batch([
      this.d1.prepare("DELETE FROM feedback_notes WHERE id IN (SELECT id FROM feedback_notes WHERE status <> 'reported' AND created_at < ? ORDER BY created_at, id LIMIT ?)").bind(before.toISOString(), limit),
      // a reported note goes with its reports (ON DELETE CASCADE) once no report is newer than the cut
      this.d1
        .prepare("DELETE FROM feedback_notes WHERE id IN (SELECT n.id FROM feedback_notes n WHERE n.status = 'reported' AND NOT EXISTS (SELECT 1 FROM feedback_reports r WHERE r.note_id = n.id AND r.created_at >= ?) ORDER BY n.created_at, n.id LIMIT ?)")
        .bind(reportedBefore.toISOString(), limit),
      // report rows past the cut of a note that is no longer under review (the owner restored or hid it); a note
      // still reported keeps every report, older ones included, until it goes with them
      this.d1
        .prepare(
          "DELETE FROM feedback_reports WHERE id IN (SELECT r.id FROM feedback_reports r JOIN feedback_notes n ON n.id = r.note_id WHERE r.created_at < ? AND n.status <> 'reported' ORDER BY r.created_at, r.id LIMIT ?)",
        )
        .bind(reportedBefore.toISOString(), limit),
      this.d1.prepare('DELETE FROM feedback_sender_holds WHERE account_id IN (SELECT account_id FROM feedback_sender_holds WHERE lifted_at IS NOT NULL AND lifted_at < ? ORDER BY lifted_at, account_id LIMIT ?)').bind(liftedBefore.toISOString(), limit),
    ]);
    return results.reduce((sum, r) => sum + readChanges(r), 0);
  }

  // ---- [TV] class-scope acknowledgements and teacher moves (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.2) ----

  getClassScopeAck(learnerId: string): Promise<StoredClassScopeAck | null> {
    return this.one('SELECT * FROM class_scope_acks WHERE learner_id = ?', [learnerId], toClassScopeAck);
  }
  async classScopeAcksOf(learnerIds: readonly string[]): Promise<StoredClassScopeAck[]> {
    // The report chunks (at most 100 ids a statement), so a class report adds one statement per 100 members.
    const out: StoredClassScopeAck[] = [];
    for (const chunk of reportChunks(learnerIds)) out.push(...(await this.many(`SELECT * FROM class_scope_acks WHERE learner_id IN (${placeholders(chunk)})`, chunk, toClassScopeAck)));
    return out;
  }
  putClassScopeAck(ack: StoredClassScopeAck): Promise<void> {
    return this.run(
      'INSERT INTO class_scope_acks (learner_id, text_version, basis, evidence, acked_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(learner_id) DO UPDATE SET text_version = excluded.text_version, basis = excluded.basis, evidence = excluded.evidence, acked_at = excluded.acked_at',
      [ack.learnerId, ack.textVersion, ack.basis, ack.evidence, ack.ackedAt],
    );
  }
  async createClassMove(row: StoredClassMove): Promise<'created' | 'already_open'> {
    assertNewClassMove(row);
    const inserted = await this.changes(
      `INSERT INTO class_moves (${CLASS_MOVE_COLUMNS.join(', ')}) SELECT ${CLASS_MOVE_COLUMNS.map(() => '?').join(', ')} WHERE NOT EXISTS (SELECT 1 FROM class_moves WHERE learner_id = ? AND status = 'requested')`,
      [...classMoveValues(row), row.learnerId],
    );
    return inserted === 1 ? 'created' : 'already_open';
  }
  getClassMove(id: string): Promise<StoredClassMove | null> {
    return this.one('SELECT * FROM class_moves WHERE id = ?', [id], toClassMove);
  }
  classMovesOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredClassMove[]> {
    const column = role === 'source' ? 'source_space_id' : 'dest_space_id';
    return this.many(`SELECT * FROM class_moves WHERE ${column} = ? ORDER BY created_at DESC, id DESC LIMIT ?`, [spaceId, limit], toClassMove);
  }
  openClassMoveOf(learnerId: string): Promise<StoredClassMove | null> {
    return this.one("SELECT * FROM class_moves WHERE learner_id = ? AND status = 'requested' LIMIT 1", [learnerId], toClassMove);
  }
  async executedClassMovesOf(learnerIds: readonly string[], since: Date): Promise<StoredClassMove[]> {
    const unique = [...new Set(learnerIds)];
    const out: StoredClassMove[] = [];
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const chunk = unique.slice(i, i + IN_CHUNK);
      out.push(
        ...(await this.many(
          `SELECT * FROM class_moves WHERE learner_id IN (${chunk.map(() => '?').join(', ')}) AND status = 'executed' AND executed_at >= ?`,
          [...chunk, since.toISOString()],
          toClassMove,
        )),
      );
    }
    return out.sort((a, b) => ((a.executedAt ?? '') === (b.executedAt ?? '') ? (a.id < b.id ? 1 : -1) : (a.executedAt ?? '') < (b.executedAt ?? '') ? 1 : -1));
  }
  endClassMove(id: string, status: ClassMoveEndStatus, reason: ClassMoveEndReason, decider: ClassMoveDecider | null, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.changes(
      `UPDATE class_moves SET status = ?, end_reason = ?, ended_at = ?, updated_at = ?,
         decided_account_id = COALESCE(?, decided_account_id), decided_via = COALESCE(?, decided_via)
       WHERE id = ? AND status = 'requested'${status === 'expired' ? ' AND expires_at <= ?' : ''}`,
      [status, reason, at, at, decider?.accountId ?? null, decider?.via ?? null, id, ...(status === 'expired' ? [at] : [])],
    );
  }
  markClassMoveSeen(id: string, now: Date): Promise<number> {
    return this.changes("UPDATE class_moves SET family_seen_at = ? WHERE id = ? AND status = 'executed' AND family_seen_at IS NULL", [now.toISOString(), id]);
  }
  async executeClassMove(input: ExecuteClassMoveInput): Promise<ExecuteClassMoveResult> {
    const at = input.now.toISOString();
    const { id, learnerId, sourceSpaceId: source, destSpaceId: dest } = input;
    const [school, schoolParams] = schoolSeatCondition(input.destSchoolId ?? null, input.destSchoolCap ?? null, learnerId);
    // The same gate-then-guarded-writes batch as executeTransfer (F-SPACE-002 section 4.6): the gate marks the row
    // with a one-off token and the last statement clears it, so no reader outside the transaction sees it.
    const token = `executing:${crypto.randomUUID()}`;
    const guard = "EXISTS (SELECT 1 FROM class_moves WHERE id = ? AND status = 'executed' AND token = ?)";
    const g = [id, token];
    const [gate, , , relinksClosed, devicesRevoked] = await this.batchChanges([
      [
        `UPDATE class_moves SET status = 'executed', executed_at = ?, token = ?, updated_at = ?, decided_account_id = ?, decided_via = ?
         WHERE id = ? AND learner_id = ? AND source_space_id = ? AND dest_space_id = ?
           AND source_space_id <> dest_space_id AND status = 'requested' AND expires_at > ?
           AND EXISTS (SELECT 1 FROM learners WHERE id = ?)
           AND EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class')
           AND EXISTS (SELECT 1 FROM spaces WHERE id = ? AND kind = 'class' AND archived_at IS NULL)
           AND ( EXISTS (SELECT 1 FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ?)
                 OR ( (SELECT COUNT(*) FROM memberships WHERE space_id = ? AND member_kind = 'learner') < ?
                      AND (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id = m.space_id
                           WHERE m.member_kind = 'learner' AND m.member_id = ? AND s.kind = 'class' AND s.archived_at IS NULL AND m.space_id <> ?) < ?
                      AND ${school} ) )`,
        [at, token, at, input.decider.accountId, input.decider.via, id, learnerId, source, dest, at, learnerId, source, learnerId, source, dest, dest, learnerId, dest, finiteCap(input.destCap), learnerId, source, finiteCap(input.learnerCap), ...schoolParams],
      ],
      [`INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) SELECT ?, 'learner', ?, 'student', ? WHERE ${guard} ON CONFLICT(space_id, member_kind, member_id) DO NOTHING`, [dest, learnerId, at, ...g]],
      [`DELETE FROM memberships WHERE space_id = ? AND member_kind = 'learner' AND member_id = ? AND ${guard}`, [source, learnerId, ...g]],
      [`UPDATE relink_requests SET status = 'denied', decided_at = ? WHERE space_id = ? AND learner_id = ? AND status = 'pending' AND ${guard}`, [at, source, learnerId, ...g]],
      [
        `DELETE FROM learner_devices WHERE learner_id = ? AND scope = 'class' AND ${guard}
           AND device_id IN (SELECT device_id FROM relink_requests WHERE space_id = ? AND learner_id = ? AND status = 'approved')
           AND device_id NOT IN (SELECT r.device_id FROM relink_requests r JOIN memberships m ON m.space_id = r.space_id AND m.member_kind = 'learner' AND m.member_id = r.learner_id
                                 WHERE r.learner_id = ? AND r.status = 'approved' AND r.space_id <> ?)`,
        [learnerId, ...g, source, learnerId, learnerId, source],
      ],
      // F-FEEDBACK-001 section 7.5: the source membership ends, so its live, hidden and withdrawn notes go (reported ones, and any note a report row names, stay)
      [`DELETE FROM feedback_notes WHERE learner_id = ? AND space_id = ? AND status <> 'reported' AND ${NO_REPORT_ROW} AND ${guard}`, [learnerId, source, ...g]],
      ['UPDATE class_moves SET token = NULL WHERE id = ? AND token = ?', g],
    ]);
    return gate === 1 ? { executed: true, devicesRevoked: devicesRevoked ?? 0, relinksClosed: relinksClosed ?? 0 } : { executed: false, devicesRevoked: 0, relinksClosed: 0 };
  }
  purgeClassMoves(endedBefore: Date, executedBefore: Date, limit: number): Promise<number> {
    return this.changes(
      "DELETE FROM class_moves WHERE id IN (SELECT id FROM class_moves WHERE (ended_at IS NOT NULL AND ended_at < ?) OR (status = 'executed' AND executed_at < ?) OR (status = 'requested' AND expires_at < ?) LIMIT ?)",
      [endedBefore.toISOString(), executedBefore.toISOString(), endedBefore.toISOString(), limit],
    );
  }

  // ---- [OA] anonymous daily counters (migration 0015) ----

  /**
   * One batch of multi-row upserts, `TELEMETRY_DAILY_ROWS_PER_STATEMENT` rows (100 bound values, the D1 limit) per
   * statement: 600 rows are 24 statements, under the 50 a Free-plan invocation allows.
   */
  async addTelemetryDaily(rows: readonly TelemetryDailyRow[]): Promise<void> {
    const statements: D1PreparedLike[] = [];
    for (let i = 0; i < rows.length; i += TELEMETRY_DAILY_ROWS_PER_STATEMENT) {
      const chunk = rows.slice(i, i + TELEMETRY_DAILY_ROWS_PER_STATEMENT);
      statements.push(
        this.d1
          .prepare(`INSERT INTO telemetry_daily (day, name, dims, n) VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')} ON CONFLICT (day, name, dims) DO UPDATE SET n = n + excluded.n`)
          .bind(...chunk.flatMap((r) => [r.day, r.name, r.dims, r.n])),
      );
    }
    if (statements.length > 0) await this.d1.batch(statements);
  }
  purgeTelemetryDaily(beforeDay: string, limit: number): Promise<number> {
    return this.changes('DELETE FROM telemetry_daily WHERE (day, name, dims) IN (SELECT day, name, dims FROM telemetry_daily WHERE day < ? LIMIT ?)', [beforeDay, limit]);
  }
  telemetryDailyOf(day: string): Promise<TelemetryDailyRow[]> {
    return this.many('SELECT day, name, dims, n FROM telemetry_daily WHERE day = ? ORDER BY name, dims', [day], (r): TelemetryDailyRow => ({ day: str(r.day), name: str(r.name), dims: str(r.dims), n: Number(r.n) }));
  }

  remoteConfig(): Promise<RemoteConfigRow[]> {
    return this.many('SELECT flag, "on", pct, updated_at, reason FROM remote_config ORDER BY flag', [], (r) => ({
      flag: str(r.flag),
      on: readOn(r.on),
      pct: clampPct(r.pct),
      updatedAt: str(r.updated_at),
      reason: nstr(r.reason),
    }));
  }
  putRemoteConfig(row: RemoteConfigRow): Promise<void> {
    return this.run(
      'INSERT INTO remote_config (flag, "on", pct, updated_at, reason) VALUES (?, ?, ?, ?, ?) ON CONFLICT(flag) DO UPDATE SET "on" = excluded."on", pct = excluded.pct, updated_at = excluded.updated_at, reason = excluded.reason',
      [row.flag, row.on ? 1 : 0, row.pct, row.updatedAt, row.reason],
    );
  }
  /** F-CURR-002 section 11.2: one upsert per cell and one for the counter, all in one batch, so an event lands whole or not at all. */
  async addRollups(day: string, keys: readonly RollupKey[], counter?: string): Promise<number> {
    const unique = uniqueRollupKeys(keys);
    if (unique.length === 0) return 0;
    const statements = unique.map((k) =>
      this.d1
        .prepare('INSERT INTO learning_rollups (day, metric, dim, bucket, events) VALUES (?, ?, ?, ?, 1) ON CONFLICT(day, metric, dim, bucket) DO UPDATE SET events = events + 1')
        .bind(day, k.metric, k.dim, k.bucket),
    );
    if (counter !== undefined) {
      statements.push(
        this.d1
          .prepare("INSERT INTO learning_rollups (day, metric, dim, bucket, events) VALUES (?, ?, '', '', ?) ON CONFLICT(day, metric, dim, bucket) DO UPDATE SET events = events + excluded.events")
          .bind(day, counter, unique.length + 1),
      );
    }
    await this.d1.batch(statements);
    if (counter === undefined) return 0;
    // A read, not a row written; a concurrent write between the two can only make the total larger.
    return (await this.one("SELECT events FROM learning_rollups WHERE day = ? AND metric = ? AND dim = '' AND bucket = ''", [day, counter], (r) => Number(r.events))) ?? 0;
  }
  rollupRows(fromDay: string, toDay: string, metric: string | undefined, limit: number): Promise<RollupRow[]> {
    const [where, params] = metric === undefined ? ['day >= ? AND day <= ?', [fromDay, toDay]] : ['day >= ? AND day <= ? AND metric = ?', [fromDay, toDay, metric]];
    return this.many(`SELECT day, metric, dim, bucket, events FROM learning_rollups WHERE ${where} ORDER BY day, metric, dim, bucket LIMIT ?`, [...params, limit], (r) => ({
      day: str(r.day),
      metric: str(r.metric),
      dim: str(r.dim),
      bucket: str(r.bucket),
      events: Number(r.events),
    }));
  }

  rollupRowsOf(fromDay: string, toDay: string, metrics: readonly string[], limit: number): Promise<RollupRow[]> {
    if (metrics.length === 0) return Promise.resolve([]);
    return this.many(
      `SELECT day, metric, dim, bucket, events FROM learning_rollups WHERE day >= ? AND day <= ? AND metric IN (${metrics.map(() => '?').join(', ')}) ORDER BY day, metric, dim, bucket LIMIT ?`,
      [fromDay, toDay, ...metrics, limit],
      (r) => ({ day: str(r.day), metric: str(r.metric), dim: str(r.dim), bucket: str(r.bucket), events: Number(r.events) }),
    );
  }
  async lowerRemoteConfigPct(flag: string, fromPct: number, fromUpdatedAt: string, toPct: number, updatedAt: string, reason: string): Promise<boolean> {
    // CAST: a console edit can store 25.5 (INTEGER affinity keeps a REAL); the evaluator read it as 25 (clampPct).
    return (
      (await this.changes('UPDATE remote_config SET pct = ?, updated_at = ?, reason = ? WHERE flag = ? AND "on" = 1 AND CAST(pct AS INTEGER) = ? AND updated_at = ? AND pct > ?', [
        toPct,
        updatedAt,
        reason,
        flag,
        fromPct,
        fromUpdatedAt,
        toPct,
      ])) > 0
    );
  }

  // F-CURR-002 section 4.8 (row CM-11): the memory shards of migration 0016.
  memoryShardsOf(learnerId: string, shards: readonly string[]): Promise<StoredMemoryShard[]> {
    if (shards.length === 0) return Promise.resolve([]);
    return this.many(`SELECT shard, seq, states, updated_at FROM memory_shards WHERE learner_id = ? AND shard IN (${placeholders(shards)}) ORDER BY shard`, [learnerId, ...shards], toMemoryShard);
  }
  memoryShardsSince(learnerId: string, since: number): Promise<StoredMemoryShard[]> {
    return this.many('SELECT shard, seq, states, updated_at FROM memory_shards WHERE learner_id = ? AND seq > ? ORDER BY seq, shard', [learnerId, since], toMemoryShard);
  }
  async memoryHighestSeq(learnerId: string): Promise<number> {
    return (await this.one('SELECT COALESCE(MAX(seq), 0) AS seq FROM memory_shards WHERE learner_id = ?', [learnerId], (r) => Number(r.seq))) ?? 0;
  }
  /**
   * One batch, one statement per shard. The new `seq` is read inside each statement, so in D1's single writer every
   * committed row has a higher `seq` than any row committed before it, and a reader's cursor never skips a later write.
   * An update applies only at the `seq` the merge read; an insert only while the shard has no row.
   */
  async writeMemoryShards(learnerId: string, writes: readonly MemoryShardWrite[], updatedAt: string): Promise<MemoryShardWriteResult> {
    if (writes.length === 0) return { written: [], conflicts: [] };
    const next = '(SELECT COALESCE(MAX(seq), 0) + 1 FROM memory_shards WHERE learner_id = ?)';
    const changes = await this.batchChanges(
      writes.map((w): [string, unknown[]] =>
        w.baseSeq === null
          ? [
              // WHERE before ON CONFLICT: an upsert on INSERT ... SELECT needs one to parse.
              `INSERT INTO memory_shards (learner_id, shard, seq, states, updated_at) SELECT ?, ?, ${next}, ?, ? WHERE true ON CONFLICT (learner_id, shard) DO NOTHING`,
              [learnerId, w.shard, learnerId, w.states, updatedAt],
            ]
          : [`UPDATE memory_shards SET states = ?, updated_at = ?, seq = ${next} WHERE learner_id = ? AND shard = ? AND seq = ?`, [w.states, updatedAt, learnerId, learnerId, w.shard, w.baseSeq]],
      ),
    );
    const written: string[] = [];
    const conflicts: string[] = [];
    writes.forEach((w, i) => (changes[i] === 1 ? written : conflicts).push(w.shard));
    return { written, conflicts };
  }

  /** Tests only. Child tables first; a table whose migration has not landed yet is skipped. */
  async reset(): Promise<void> {
    const present = new Set(await this.many("SELECT name FROM sqlite_master WHERE type = 'table'", [], (r) => str(r.name)));
    for (const table of RESET_TABLES) {
      if (present.has(table)) await this.run(`DELETE FROM ${table}`, []);
    }
  }
}
