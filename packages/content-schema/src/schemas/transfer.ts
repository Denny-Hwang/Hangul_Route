import { z } from 'zod';
import { UiLocaleSchema } from './locale';
import { JoinCodeFieldSchema } from './space';

/**
 * Class transfer — F-SPACE-002. A learner's class membership moves from one
 * teacher's class (source) to another (destination) only after the learner
 * side, the source and the destination have all agreed and a cooling-off has
 * passed. Shared by the Worker (validation) and the console and app (typing).
 * "Move" is the user-facing word; `transfer` stays the internal name.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Request life; a request still open after this is `expired`. */
export const TRANSFER_WINDOW_MS = 14 * DAY_MS;
/** Learner-side consent -> earliest execution. */
export const TRANSFER_COOLING_OFF_MS = 48 * HOUR_MS;
/** A learner consent lapses this long after `approved` if the move is still blocked. */
export const TRANSFER_BLOCKED_VALID_MS = 72 * HOUR_MS;
/** Guardian and learner family memberships must be at least this old. */
export const TRANSFER_GUARDIAN_MIN_AGE_MS = 24 * HOUR_MS;
/** Same learner + destination after another side declined a learner-side request. */
export const TRANSFER_COOLDOWN_MS = 7 * DAY_MS;
/** No new source-started request after the learner side refused one. */
export const TRANSFER_REFUSAL_COOLDOWN_MS = 30 * DAY_MS;
export const TRANSFER_MAX_CREATED_PER_ACCOUNT_PER_DAY = 10;
export const TRANSFER_MAX_CREATED_PER_LEARNER_PER_DAY = 3;
export const TRANSFER_MAX_OPEN_PER_DESTINATION = 20;
export const TRANSFER_CODE_FAILS_PER_HOUR = 10;
export const TRANSFER_CODE_FAILS_PER_DAY = 30;
/** Declined / cancelled / expired rows only; executed rows are consent evidence (§4.1 retention). */
export const TRANSFER_PURGE_AFTER_MS = 90 * DAY_MS;
export const TRANSFER_LIST_MAX = 50;
/**
 * Bump when any consent line changes; a test pins a hash of the lines per locale.
 * `transfer-2026-10b`: the `activity` item names day-by-day practice (F-REPORT-001 RP-W2).
 * `transfer-2026-10c`: adds the `note_replies` item (F-FEEDBACK-001 section 7.7) to the 10b text.
 */
export const TRANSFER_CONSENT_TEXT_VERSION = 'transfer-2026-10c';
/** The current version plus any version legal has not retired. */
export const ACCEPTED_CONSENT_TEXT_VERSIONS: readonly string[] = ['transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10'];

export const TransferStatusSchema = z.enum(['requested', 'approved', 'executed', 'declined', 'expired', 'cancelled']);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const TransferSlotSchema = z.enum(['learner', 'source', 'destination']);
export type TransferSlot = z.infer<typeof TransferSlotSchema>;

/** Learner and destination slots. */
export const LearnerSlotStateSchema = z.enum(['pending', 'consented', 'declined']);
export type LearnerSlotState = z.infer<typeof LearnerSlotStateSchema>;

/** `not_required` only via the archived-source transition (§4.13), never at creation. */
export const SourceSlotStateSchema = z.enum(['pending', 'consented', 'declined', 'not_required']);
export type SourceSlotState = z.infer<typeof SourceSlotStateSchema>;

export const LearnerBasisSchema = z.enum(['caregiver', 'device_attested']);
export type LearnerBasis = z.infer<typeof LearnerBasisSchema>;

/** What the client says it checked; recorded, never trusted. */
export const DeviceAttestKindSchema = z.enum(['grown_up_pin', 'self']);
export type DeviceAttestKind = z.infer<typeof DeviceAttestKindSchema>;

export const TransferInitiatorSchema = z.enum(['learner_side', 'source']);
export type TransferInitiator = z.infer<typeof TransferInitiatorSchema>;

/** Destination slot only; a fixed set, no free text. */
export const TransferDeclineReasonSchema = z.enum(['not_now', 'no_room']);
export type TransferDeclineReason = z.infer<typeof TransferDeclineReasonSchema>;

/** Audit and the decider's own view only (§4.2 views). */
export const TransferEndReasonSchema = z.enum([
  'declined_learner',
  'declined_source',
  'declined_destination',
  'cancelled_initiator',
  'withdrawn_learner',
  'expired',
  'destination_archived',
  'learner_left_source',
]);
export type TransferEndReason = z.infer<typeof TransferEndReasonSchema>;

export const TransferBlockReasonSchema = z.enum(['cap_class', 'cap_school', 'cap_learner']);
export type TransferBlockReason = z.infer<typeof TransferBlockReasonSchema>;

export const ConsentResetReasonSchema = z.enum(['terms_changed', 'guardian_changed', 'lapsed']);
export type ConsentResetReason = z.infer<typeof ConsentResetReasonSchema>;

/**
 * Strict values of the inbox fields that travel as plain strings (§4.4).
 * Consumers narrow with `safeParse` and fall back to a neutral row.
 */
export const TransferStepStateSchema = z.enum(['waiting', 'yes']);
export type TransferStepState = z.infer<typeof TransferStepStateSchema>;

export const TransferLearnerRouteSchema = z.enum(['caregiver', 'device', 'none']);
export type TransferLearnerRoute = z.infer<typeof TransferLearnerRouteSchema>;

export const TransferEndedFromSchema = z.enum(['family', 'device']);
export type TransferEndedFrom = z.infer<typeof TransferEndedFromSchema>;

export const TransferPremiumChangeSchema = z.enum(['none', 'may_change']);
export type TransferPremiumChange = z.infer<typeof TransferPremiumChangeSchema>;

/** `transfer:<crypto.randomUUID()>`, addressed in API paths only (T14). */
export const TransferIdSchema = z.string().regex(/^transfer:[a-z0-9-]+$/);
export type TransferId = z.infer<typeof TransferIdSchema>;

const LearnerIdField = z.string().regex(/^profile:[a-z0-9-]+$/);
const SpaceIdField = z.string().regex(/^space:[a-z0-9-]+$/);

/*
 * Request bodies (§4.4). Every one is `.strict()`: an unknown key is a 422,
 * so version skew fails loudly instead of silently dropping a consent field.
 * Codes go through the join-code field (a malformed code is `invalid_code`).
 */

/**
 * The consent record a learner-side call sends. `locale` is any UI locale so
 * the Worker can answer `consent_locale_unavailable` for one without a
 * reviewed text, and any non-empty version so it can answer `consent_text_stale`.
 * `termsDigest` is the digest the preview returned for the sheet the guardian
 * saw (SHA-256 hex); a create whose live terms no longer match it answers
 * `409 terms_changed` (§4.11). Optional until the clients send it; required on
 * the family route before the flag flip.
 */
export const TransferConsentSchema = z
  .object({
    textVersion: z.string().min(1).max(64),
    locale: UiLocaleSchema,
    termsDigest: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
export type TransferConsent = z.infer<typeof TransferConsentSchema>;

/** Device route: the same record plus the client's attestation claim. */
export const DeviceTransferConsentSchema = TransferConsentSchema.extend({ attest: DeviceAttestKindSchema }).strict();
export type DeviceTransferConsent = z.infer<typeof DeviceTransferConsentSchema>;

/** POST /api/spaces/:id/transfer-requests/preview. `fromSpaceId` is sent by a family only. */
export const TransferPreviewBodySchema = z
  .object({
    learnerId: LearnerIdField,
    code: JoinCodeFieldSchema,
    fromSpaceId: SpaceIdField.optional(),
  })
  .strict();
export type TransferPreviewBody = z.infer<typeof TransferPreviewBodySchema>;

/** POST /api/spaces/:id/transfer-requests. `consent` is required on the family route (the Worker checks by space kind). */
export const TransferCreateBodySchema = z
  .object({
    learnerId: LearnerIdField,
    destinationSpaceId: SpaceIdField,
    code: JoinCodeFieldSchema,
    fromSpaceId: SpaceIdField.optional(),
    introduce: z.boolean().optional(),
    consent: TransferConsentSchema.optional(),
  })
  .strict();
export type TransferCreateBody = z.infer<typeof TransferCreateBodySchema>;

/** POST /api/spaces/:id/transfer-requests/:tid/approve. Approving the `learner` slot requires `consent`. */
export const TransferApproveBodySchema = z
  .object({
    slots: z
      .array(TransferSlotSchema)
      .min(1)
      .max(3)
      .refine((slots) => new Set(slots).size === slots.length, { message: 'Each slot at most once' }),
    consent: TransferConsentSchema.optional(),
    introduce: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.slots.includes('learner') && !body.consent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['consent'], message: 'The learner slot needs a consent record' });
    }
  });
export type TransferApproveBody = z.infer<typeof TransferApproveBodySchema>;

/** POST /api/spaces/:id/transfer-requests/:tid/decline. A reason is accepted on the destination slot only. */
export const TransferDeclineBodySchema = z
  .object({
    slot: TransferSlotSchema,
    reason: TransferDeclineReasonSchema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.reason !== undefined && body.slot !== 'destination') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Only the destination slot gives a reason' });
    }
  });
export type TransferDeclineBody = z.infer<typeof TransferDeclineBodySchema>;

/** Console cancel / retry and device decline / cancel: no fields. */
export const TransferEmptyBodySchema = z.object({}).strict();
export type TransferEmptyBody = z.infer<typeof TransferEmptyBodySchema>;

/** PUT /api/spaces/:id/learners/:learnerId/transfer-prefs (a guardian; never touches `selfManaged`). */
export const TransferFamilyPrefsBodySchema = z.object({ blockTeacherRequests: z.boolean() }).strict();
export type TransferFamilyPrefsBody = z.infer<typeof TransferFamilyPrefsBodySchema>;

/** POST /api/sync/learners/:id/transfer-requests/preview. */
export const DeviceTransferPreviewBodySchema = z
  .object({
    fromSpaceId: SpaceIdField,
    code: JoinCodeFieldSchema,
  })
  .strict();
export type DeviceTransferPreviewBody = z.infer<typeof DeviceTransferPreviewBodySchema>;

/** POST /api/sync/learners/:id/transfer-requests (behind CLASS_TRANSFER_DEVICE_CONSENT). */
export const DeviceTransferCreateBodySchema = z
  .object({
    fromSpaceId: SpaceIdField,
    destinationSpaceId: SpaceIdField,
    code: JoinCodeFieldSchema,
    introduce: z.boolean().optional(),
    consent: DeviceTransferConsentSchema,
  })
  .strict();
export type DeviceTransferCreateBody = z.infer<typeof DeviceTransferCreateBodySchema>;

/** POST /api/sync/learners/:id/transfer-requests/:tid/approve. */
export const DeviceTransferApproveBodySchema = z.object({ consent: DeviceTransferConsentSchema }).strict();
export type DeviceTransferApproveBody = z.infer<typeof DeviceTransferApproveBodySchema>;

/** PUT /api/sync/learners/:id/transfer-prefs (the learner's device; never touches `blockTeacherRequests`). */
export const DeviceTransferPrefsBodySchema = z.object({ selfManaged: z.boolean() }).strict();
export type DeviceTransferPrefsBody = z.infer<typeof DeviceTransferPrefsBodySchema>;

/**
 * An array that never fails: elements that parse are kept, the rest are
 * dropped, and a missing or non-array value reads as empty. Used where one
 * bad element must not cost an installed app the rest of its payload (§2,
 * all-or-nothing inbox parsing).
 */
export function lenientArray<T extends z.ZodTypeAny>(element: T) {
  return z.unknown().transform((value): z.output<T>[] => {
    if (!Array.isArray(value)) return [];
    const kept: z.output<T>[] = [];
    for (const item of value) {
      const parsed = element.safeParse(item);
      if (parsed.success) kept.push(parsed.data);
    }
    return kept;
  });
}

/** A space the learner is in today, as the learner side sees it (`visibleToday`). */
export const InboxVisibleSpaceSchema = z.object({
  kind: z.string(),
  name: z.string(),
  ownerName: z.string().nullable(),
});
export type InboxVisibleSpace = z.infer<typeof InboxVisibleSpaceSchema>;

/**
 * One transfer row in the sync inbox (learner-side view, §4.2 / §4.4). Lenient
 * on the wire: enum-like fields are plain strings (narrow them with the strict
 * schemas above) and unknown keys are dropped.
 */
export const InboxTransferSchema = z.object({
  id: TransferIdSchema,
  status: z.string(),
  initiator: z.string(),
  from: z.object({ spaceId: z.string(), name: z.string() }),
  to: z.object({
    spaceId: z.string(),
    name: z.string(),
    ownerName: z.string().nullable(),
    schoolName: z.string().nullable(),
    ageBucket: z.string().nullable(),
  }),
  learnerState: z.string(),
  sourceState: z.string(),
  destinationState: z.string(),
  introduce: z.boolean(),
  premiumChange: z.string(),
  destinationConsentMode: z.string(),
  relinkAffected: z.boolean(),
  sourcePlansAffected: z.boolean(),
  visibleToday: lenientArray(InboxVisibleSpaceSchema),
  blockReason: z.string().nullable(),
  executeAfter: z.string().nullable(),
  expiresAt: z.string(),
  learnerRoute: z.string(),
  canVeto: z.boolean(),
  endedFrom: z.string().nullable(),
  /**
   * The learner-side sheet's digest (section 4.11) while the learner slot is pending, else null. A device
   * approve sends it back so the record is tied to what was shown. Lenient: an older Worker omits it and a
   * malformed value reads as null, never dropping the row.
   */
  termsDigest: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .catch(null),
});
export type InboxTransfer = z.infer<typeof InboxTransferSchema>;
