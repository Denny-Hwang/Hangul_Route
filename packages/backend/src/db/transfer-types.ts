import type {
  ConsentResetReason,
  DeviceAttestKind,
  LearnerBasis,
  LearnerSlotState,
  SourceSlotState,
  SpaceSettings,
  TransferBlockReason,
  TransferEndReason,
  TransferInitiator,
  TransferPremiumChange,
  TransferSlot,
  TransferStatus,
} from '@hangul-route/content-schema';

/*
 * Class transfer rows as the Worker sees them — F-SPACE-002 section 4.1 / 4.7
 * (PR T-3b). Table `transfer_requests` of migration 0005. A request stores ids
 * and hashes only: no nickname, class name or teacher name is ever copied.
 */

/** Statuses in which a request can still change (the partial unique index covers these). */
export const OPEN_TRANSFER_STATUSES = ['requested', 'approved'] as const satisfies readonly TransferStatus[];
/** Statuses that end a request without a move; only these carry `endedAt` and are purged after 90 days. */
export const ENDED_TRANSFER_STATUSES = ['declined', 'cancelled', 'expired'] as const satisfies readonly TransferStatus[];

/** Who ended a request, for the audit only; never shown to a party that did not decide. */
export type TransferEndActor = 'family' | 'device' | 'source' | 'destination' | 'system';
/** Which role filled a teacher slot. */
export type TransferVia = 'owner' | 'teacher' | 'school_admin';
/** Which role a guardian held when they consented (caregiver basis). */
export type TransferGuardianRole = 'owner' | 'caregiver';
export type TransferActorKind = 'account' | 'device' | 'system';
export type TransferEventName =
  | 'created'
  | 'consented'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'blocked'
  | 'consent_reset'
  | 'executed'
  | 'devices_revoked'
  | 'relinks_closed'
  | 'old_space_still_has_access';

/** The consent-time terms `settle` compares with live values before a move (section 4.11). */
export interface TransferConsentTerms {
  /** SHA-256 hex of the destination name at consent time. */
  destNameHash: string;
  destConsentMode: SpaceSettings['consentMode'];
  destAnonymize: boolean;
  destOwnerId: string;
  /** SHA-256 hex of the source name at consent time. */
  sourceNameHash: string;
  premiumChange: TransferPremiumChange;
}

/** What the consent sheet showed: the line ids in order and the conditional flags. */
export interface TransferConsentShown {
  lineIds: string[];
  flags: Record<string, string | boolean>;
}

/** The learner-side consent record a `consentSlot` (or a learner-side create) writes. */
export interface LearnerConsentRecord {
  basis: LearnerBasis;
  /** The client's claim; device basis only. */
  attest: DeviceAttestKind | null;
  /** Account id (caregiver basis) or device id (device basis); never a name. */
  evidence: string;
  role: TransferGuardianRole | null;
  textVersion: string;
  locale: string;
  shown: TransferConsentShown;
  terms: TransferConsentTerms;
}

/** The learner slot as stored; the record fields are null while the slot is not consented. */
export interface StoredLearnerSlot {
  state: LearnerSlotState;
  at: string | null;
  basis: LearnerBasis | null;
  attest: DeviceAttestKind | null;
  evidence: string | null;
  role: TransferGuardianRole | null;
  textVersion: string | null;
  locale: string | null;
  shown: TransferConsentShown | null;
  terms: TransferConsentTerms | null;
}

export interface StoredTeacherSlot<S extends string> {
  state: S;
  at: string | null;
  accountId: string | null;
  via: TransferVia | null;
}

/** One `transfer_requests` row. Changed only through the single-statement CAS methods of `Db`. */
export interface StoredTransfer {
  id: string;
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  initiator: TransferInitiator;
  /** Null when a device started it. */
  initiatorAccountId: string | null;
  status: TransferStatus;
  endReason: TransferEndReason | null;
  endActor: TransferEndActor | null;
  blockReason: TransferBlockReason | null;
  introduce: boolean;
  /** +1 on every write. */
  rev: number;
  learner: StoredLearnerSlot;
  source: StoredTeacherSlot<SourceSlotState>;
  destination: StoredTeacherSlot<LearnerSlotState>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  approvedAt: string | null;
  executeAfter: string | null;
  endedAt: string | null;
  executedAt: string | null;
}

/** One audit row. `detail` holds codes and counts only; never a name or free text. */
export interface TransferEvent {
  id: number;
  transferId: string;
  at: string;
  actorKind: TransferActorKind;
  actorRef: string | null;
  event: TransferEventName;
  slot: TransferSlot | null;
  detail: Record<string, string | number | boolean> | null;
}
export type NewTransferEvent = Omit<TransferEvent, 'id'>;

/**
 * A consent for one or more slots. The learner slot is always alone; the two
 * teacher slots may come together (T11: one account answering for both
 * classes), which is one UPDATE that sets both or neither. Name only slots
 * that are still pending: a slot that is already consented makes the whole
 * call change nothing, so the caller strips it first (approve is idempotent
 * at the route, section 4.4).
 */
export type TransferSlotConsent =
  | {
      kind: 'learner';
      record: LearnerConsentRecord;
      /** The learner side's "Tell {destination} where {learner} is coming from" option (section 4.11); left out keeps the stored value. */
      introduce?: boolean;
    }
  | { kind: 'teacher'; slots: ReadonlyArray<'source' | 'destination'>; accountId: string; via: TransferVia };

/** What `executeTransfer` needs besides the row: the caps the SQL cannot compute (section 4.6). */
export interface ExecuteTransferInput {
  id: string;
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  now: Date;
  /** The destination's class cap; `Number.POSITIVE_INFINITY` (unlimited) is compared as 1e9. */
  destCap: number;
  /**
   * LEARNER_CLASS_CAP itself (not CAP - 1): the learner's live classes other
   * than the source must be below this. `Number.POSITIVE_INFINITY` is compared as 1e9.
   */
  learnerCap: number;
}

export interface ExecuteTransferResult {
  /** The gate changed the row: the move happened. False: nothing at all was written. */
  executed: boolean;
  /** Class-scoped devices of the source re-link that lost their binding. */
  devicesRevoked: number;
  /** Pending source re-links closed as `denied`. */
  relinksClosed: number;
}

/** Per-learner switches (`learner_transfer_prefs`); a learner without a row has both off. */
export interface TransferPrefs {
  selfManaged: boolean;
  blockTeacherRequests: boolean;
  updatedAt: string | null;
}
export type TransferPrefKey = 'selfManaged' | 'blockTeacherRequests';

/** The durable counter keys (`rate_hits.key`) of section 4.9. */
export const transferRateKey = {
  /** Failed codes on the console route, per account. */
  codeAccount: (accountId: string): string => `tcode:acct:${accountId}`,
  /** Failed codes on the device route, per learner. */
  codeLearner: (learnerId: string): string => `tcode:learner:${learnerId}`,
  /** Device-started creates, per learner. */
  createLearner: (learnerId: string): string => `tcreate:learner:${learnerId}`,
};

/** Every counter key that names a learner: erased with the learner. */
export function learnerRateKeys(learnerId: string): string[] {
  return [transferRateKey.codeLearner(learnerId), transferRateKey.createLearner(learnerId)];
}

/** Why a learner consent is reset (`consent_reset` event detail). Re-exported for the Db signature. */
export type { ConsentResetReason };
