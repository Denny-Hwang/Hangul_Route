import { z } from 'zod';
import { ProfileSchema } from './profile';
import { ProgressSnapshotSchema } from './progress';

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
  planProgress: z.record(
    z.string(),
    z.object({ done: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
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
    ageGroup: z.enum(['5-7', '8-9', '10-11']),
    avatar: z.string().min(1),
  }),
});
export type LearnerRegister = z.infer<typeof LearnerRegisterSchema>;

/** GET /api/sync/learners/:id/inbox response (plans / memberships fill in later stages). */
export const SyncInboxSchema = z.object({
  rev: z.number().int().nonnegative(),
  plans: z.array(z.unknown()),
  memberships: z.array(z.unknown()),
  tier: z.enum(['free', 'premium']),
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

/** Rescue Code — F-RESTORE-001 §3.1. `WORD-WORD-1234`, upper case. */
export const RESCUE_CODE_RE = /^[A-Z]{3,10}-[A-Z]{3,10}-\d{4}$/;

/** Accepts what a parent might type (spaces, lower case) and normalizes it. */
export function normalizeRescueCode(raw: string): string | null {
  const parts = raw
    .trim()
    .toUpperCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length !== 3) return null;
  const code = parts.join('-');
  return RESCUE_CODE_RE.test(code) ? code : null;
}

export const RescueClaimSchema = z.object({
  code: z.string().transform((v, ctx) => {
    const n = normalizeRescueCode(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rescue code must look like WORD-WORD-1234' });
      return z.NEVER;
    }
    return n;
  }),
  deviceId: z.string().min(8).max(64),
});
export type RescueClaim = z.infer<typeof RescueClaimSchema>;
