import { z } from 'zod';
import { ProfileSchema } from './profile';
import { ProgressSnapshotSchema } from './progress';
import { TierSourceSchema } from './entitlement';
import { InboxPlanSchema } from './plan';
import { LearnerMembershipSchema } from './space';
import { LearnerLevelIdSchema } from './learner-level';

/**
 * Sync contracts — F-SYNC-001. Shared by the Worker (validation) and the
 * apps (typing), so the wire format has exactly one definition.
 */

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
  planProgress: z.record(
    z.string(),
    z.object({
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      /** Items the device skipped because the learner has not unlocked them (F-PLAN-001 §3.3). */
      notReady: z.number().int().nonnegative().default(0),
    }),
  ),
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
export type SnapshotPut = z.infer<typeof SnapshotPutSchema>;

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
});
export type SyncInbox = z.infer<typeof SyncInboxSchema>;

/** Server-less restore path: a JSON file a parent can keep (F-SYNC-001 §3.6). */
export const BACKUP_FORMAT = 'hangul-route-backup' as const;
export const BACKUP_VERSION = 1 as const;

export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  profile: ProfileSchema,
  snapshot: ProgressSnapshotSchema,
});
export type BackupFile = z.infer<typeof BackupFileSchema>;

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
