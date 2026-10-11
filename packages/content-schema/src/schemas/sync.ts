import { z } from 'zod';
import { ProfileSchema } from './profile';
import { ProgressSnapshotSchema, type ProgressSnapshot } from './progress';
import { TierSourceSchema } from './entitlement';
import { InboxPlanSchema, type InboxPlan } from './plan';
import { LearnerMembershipSchema } from './space';
import { LearnerLevelIdSchema } from './learner-level';
import { PlacementSummarySchema } from './placement';
import { InboxTransferSchema, lenientArray } from './transfer';
import { VocabIdSchema } from './vocab';
import { VocabProgressSchema } from './vocab-progress';

/**
 * Sync contracts — F-SYNC-001. Shared by the Worker (validation) and the
 * apps (typing), so the wire format has exactly one definition.
 */

/**
 * Counts of the learner's self-route (F-PLAN-002 section 3.6 / 3.10): `total`
 * means "scheduled so far" (the device's one-week horizon), `weeks` and
 * `endsOn` give the full length. Read by the family space only.
 */
export const SelfRouteSummarySchema = z.object({
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  notReady: z.number().int().nonnegative(),
  weeks: z.number().int().min(1).max(52),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SelfRouteSummary = z.infer<typeof SelfRouteSummarySchema>;

/**
 * Word counts for caregivers and teachers (F-VOC-005 section 3.8): counts, a
 * first-try rate and up to three words to look at together. Never shown to the
 * learner; no response time and no per-question history.
 */
export const VocabSummarySchema = z.object({
  /** Words with a state, all topics. */
  collected: z.number().int().nonnegative(),
  /** `bestBox >= 3`. */
  strong: z.number().int().nonnegative(),
  topicsStarted: z.number().int().nonnegative(),
  /** Topics whose `last` is within the last 7 days (topics, not rounds). */
  topicsPracticed7d: z.number().int().nonnegative(),
  /** sum(right) / sum(seen), rounded to 2 decimals; null when nothing was answered. */
  firstTryRate: z.number().min(0).max(1).nullable(),
  needsPractice: z.array(VocabIdSchema).max(3),
});
export type VocabSummary = z.infer<typeof VocabSummarySchema>;

/** Client-computed aggregate; the only column caregivers/teachers read (roadmap §3.3). */
export const ProgressSummarySchema = z.object({
  schemaVersion: z.literal(1),
  lastActiveAt: z.string(),
  streakDays: z.number().int().nonnegative(),
  stage1: z.object({
    questsDone: z.number().int().nonnegative(),
    questsTotal: z.number().int().nonnegative(),
    anchorAccuracy: z.number().min(0).max(1).nullable(),
  }),
  cardsUnlocked: z.number().int().nonnegative(),
  minutesLast7d: z.number().int().nonnegative(),
  jamoRecognized: z.array(z.string()),
  needsPractice: z.array(z.string()).max(3),
  /** Verdict of the Hangul Check (F-QUEST-002 §3.9); `tricky` holds symbol keys. */
  stage1Anchor: z
    .object({
      met: z.boolean(),
      checkedAt: z.string(),
      tricky: z.array(z.string()),
    })
    .optional(),
  /** Level and strand statuses of the newest level check (F-PLC-001 section 3.8); no counts. */
  placement: PlacementSummarySchema.optional(),
  planProgress: z.record(
    z.string(),
    z.object({
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      /** Items the device skipped because the learner has not unlocked them (F-PLAN-001 §3.3). */
      notReady: z.number().int().nonnegative().default(0),
    }),
  ),
  /** Self-route counts (F-PLAN-002 section 3.5); removed from every roster but a family's. Malformed counts are dropped, never fatal. */
  selfRoute: SelfRouteSummarySchema.optional().catch(undefined),
  /**
   * Word counts (F-VOC-005 section 3.8); omitted when the learner has no
   * collected words. A derived display figure, so malformed counts are dropped,
   * never fatal (as `selfRoute`): a bad summary must not stop the slice and
   * everything else from syncing.
   */
  vocab: VocabSummarySchema.optional().catch(undefined),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;

/** PUT /api/sync/learners/:id/snapshot body. */
export const SnapshotPutSchema = z.object({
  baseRev: z.number().int().nonnegative(),
  snapshot: ProgressSnapshotSchema,
  summary: ProgressSummarySchema,
  schemaVer: z.number().int().positive(),
  contentVer: z.string().min(1),
});
/** `snapshot` keeps the legacy-tolerant `ProgressSnapshot` type (see progress.ts). */
export type SnapshotPut = Omit<z.infer<typeof SnapshotPutSchema>, 'snapshot'> & { snapshot: ProgressSnapshot };

/** POST /api/sync/learners body. */
export const LearnerRegisterSchema = z.object({
  deviceId: z.string().min(8).max(64),
  learner: z.object({
    id: z.string().regex(/^profile:[a-z0-9-]+$/).optional(),
    displayName: z.string().min(1).max(20),
    ageGroup: LearnerLevelIdSchema,
    avatar: z.string().min(1),
  }),
});
export type LearnerRegister = z.infer<typeof LearnerRegisterSchema>;

/** GET /api/sync/learners/:id/inbox response. */
export const SyncInboxSchema = z.object({
  rev: z.number().int().nonnegative(),
  plans: z.array(InboxPlanSchema),
  memberships: z.array(LearnerMembershipSchema),
  tier: z.enum(['free', 'premium']),
  /** Which space grants premium (F-ENT-001 §3.2); null when free. */
  tierSource: TierSourceSchema.nullable().default(null),
  /** Cached premium is honoured until this instant when offline (7-day grace). */
  tierValidUntil: z.string().nullable().default(null),
  serverTime: z.string(),
  /*
   * Class transfer (F-SPACE-002 §4.4, T15). Additive and lenient: an old Worker
   * omits them (defaults: off, empty) and one bad `transfers` element is
   * dropped instead of failing the whole inbox (plans and tier survive).
   */
  transfersEnabled: z.boolean().default(false),
  transferDeviceConsent: z.boolean().default(false),
  selfManaged: z.boolean().default(false),
  transfers: lenientArray(InboxTransferSchema).default([]),
});
/**
 * Plans are typed as `InboxPlan` (meta optional) so a parsed inbox and the
 * stored, unparsed copy have one shape and every reader handles a missing meta.
 */
export type SyncInbox = Omit<z.infer<typeof SyncInboxSchema>, 'plans'> & { plans: InboxPlan[] };

/** Server-less restore path: a JSON file a parent can keep (F-SYNC-001 §3.6). */
export const BACKUP_FORMAT = 'hangul-route-backup' as const;
export const BACKUP_VERSION = 1 as const;

export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  profile: ProfileSchema,
  /**
   * The word slice is lenient here only (F-VOC-005 section 3.10): a malformed
   * or newer-version slice is dropped so the file still restores quests, cards
   * and episodes. The sync contract stays strict (a 422 on the Worker).
   */
  snapshot: ProgressSnapshotSchema.extend({ vocab: VocabProgressSchema.optional().catch(undefined) }),
});
export type BackupFile = Omit<z.infer<typeof BackupFileSchema>, 'snapshot'> & { snapshot: ProgressSnapshot };

/**
 * Rescue Code shapes — F-RESTORE-001 §3.1. New codes are four list words and
 * six digits (`TIGER-MOON-RIVER-APPLE-482139`, ≈ 51.9 bits, SEC-5). Codes
 * issued before 2026-10 are two words and four digits (`TIGER-MOON-4821`) and
 * keep restoring until a parent rotates them.
 */
export const RESCUE_CODE_FORMATS = [
  { words: 4, digits: 6 },
  { words: 2, digits: 4 },
] as const;

/** A normalized Rescue Code of either shape, upper case, hyphen-separated. */
export const RESCUE_CODE_RE = /^(?:[A-Z]{3,10}(?:-[A-Z]{3,10}){3}-\d{6}|[A-Z]{3,10}-[A-Z]{3,10}-\d{4})$/;

const RESCUE_WORD_RE = /^[A-Z]{3,10}$/;

/**
 * Accepts what a parent might type — any case, spaces or hyphens, the number
 * split into groups or glued to the last word — and returns the canonical
 * `WORD-…-DIGITS` form, or null when it is not one of the shapes above.
 */
export function normalizeRescueCode(raw: string): string | null {
  const parts = raw
    .toUpperCase()
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .split(/[\s-]+/)
    .filter(Boolean);
  const firstNumber = parts.findIndex((p) => /^\d+$/.test(p));
  if (firstNumber < 0) return null;
  const words = parts.slice(0, firstNumber);
  const digits = parts.slice(firstNumber);
  if (!words.every((w) => RESCUE_WORD_RE.test(w)) || !digits.every((d) => /^\d+$/.test(d))) return null;
  const number = digits.join('');
  const known = RESCUE_CODE_FORMATS.some((f) => f.words === words.length && f.digits === number.length);
  return known ? [...words, number].join('-') : null;
}

export const RescueClaimSchema = z.object({
  code: z.string().transform((v, ctx) => {
    const n = normalizeRescueCode(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rescue code must look like WORD-WORD-WORD-WORD-123456' });
      return z.NEVER;
    }
    return n;
  }),
  deviceId: z.string().min(8).max(64),
});
export type RescueClaim = z.infer<typeof RescueClaimSchema>;
