import { z } from 'zod';
import { ProfileSchema } from './profile';
import { ProgressSnapshotSchema, type ProgressSnapshot } from './progress';
import { TierSourceSchema } from './entitlement';
import { InboxPlanSchema, type InboxPlan } from './plan';
import { LearnerMembershipSchema } from './space';
import { AvatarKindSchema } from './profile';
import { LegacyDisplayNameSchema } from './display-name';
import { LearnerLevelIdSchema } from './learner-level';
import { PlacementSummarySchema } from './placement';
import { InboxClassMoveSchema, InboxClassScopeSchema } from './class-scope';
import { InboxTransferSchema, lenientArray } from './transfer';
import { InboxNoteSchema, NOTE_PREFS_DEFAULT, NOTE_PREFS_UNREADABLE, NotePrefsSchema } from './feedback';
import { VocabIdSchema } from './vocab';
import { VocabProgressSchema } from './vocab-progress';
import { ActivitySummarySchema } from './report';

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
 * Stage-level counts of My route for the console strip (F-ROUTE-001 section
 * 3.12), about 300 bytes. `stage` and `state` stay plain strings on the wire
 * (the web strip validates them and ignores what it does not know); `total`
 * sizes a segment and is never shown as a goal. No per-quest detail.
 */
/*
 * Bounded so a tampered client cannot grow every roster that copies it: an
 * oversized journey fails here and `.catch(undefined)` drops it like any
 * malformed one (the PUT still answers 200).
 */
const JOURNEY_COUNT_MAX = 10_000;
export const JourneySummarySchema = z.object({
  v: z.literal(1),
  here: z.string().max(32).nullable(),
  stages: z
    .array(
      z.object({
        stage: z.string().max(32),
        /** 'complete' | 'known' | 'explored' | 'open' | 'later' */
        state: z.string().max(32),
        /** Done grid quests in that stage. */
        done: z.number().int().nonnegative().max(JOURNEY_COUNT_MAX),
        /** Placed out and not done. */
        known: z.number().int().nonnegative().max(JOURNEY_COUNT_MAX),
        /** Grid quests this build offers there. */
        total: z.number().int().nonnegative().max(JOURNEY_COUNT_MAX),
      }),
    )
    .max(16),
  /**
   * Set by builds that compute the journey from the stored level check
   * (F-ROUTE-001 R-7a follow-up). Absent on older builds, whose `known` is
   * always 0 and whose `here` ignores the start marker; the console strip uses
   * it to spot that skew. A bad value drops only the marker, never the journey.
   */
  seeded: z.literal(true).optional().catch(undefined),
});
export type JourneySummary = z.infer<typeof JourneySummarySchema>;

/**
 * The goal the learner's Learning Route shows (Learning Route section 9,
 * LR-OD-12): a stage and the code of the source that set it, no plan id, no
 * date and no name. `stage` stays a plain string on the wire (the reader
 * validates it as a `StageKey`, as `journey.stage`). Read by the family space
 * only: it is on `TEACHER_HIDDEN_SUMMARY_KEYS`, so a class or school never
 * receives it.
 */
export const ROUTE_GOAL_FROM = ['class', 'school', 'family', 'self', 'default'] as const;
export const RouteGoalSummarySchema = z.object({
  stage: z.string().max(32),
  from: z.enum(ROUTE_GOAL_FROM),
});
export type RouteGoalSummary = z.infer<typeof RouteGoalSummarySchema>;

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
  /** My route stage counts (F-ROUTE-001 R-8); class and family rosters read it. Malformed is dropped, never fatal. */
  journey: JourneySummarySchema.optional().catch(undefined),
  /** Learning Route goal (LR-W1, written by LR-6); removed from every roster but a family's. Malformed is dropped, never a 422. */
  routeGoal: RouteGoalSummarySchema.optional().catch(undefined),
  /**
   * Word counts (F-VOC-005 section 3.8); omitted when the learner has no
   * collected words. A derived display figure, so malformed counts are dropped,
   * never fatal (as `selfRoute`): a bad summary must not stop the slice and
   * everything else from syncing.
   */
  vocab: VocabSummarySchema.optional().catch(undefined),
  /**
   * Bounded day-by-day activity for progress reports (F-REPORT-001 section
   * 3.3.3); absent from builds before RP-4. Malformed or oversized is dropped,
   * never a 422 (the `journey` pattern). Hidden from every roster until RP-W2.
   */
  activity: ActivitySummarySchema.optional().catch(undefined),
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
    displayName: LegacyDisplayNameSchema,
    ageGroup: LearnerLevelIdSchema,
    avatar: z.string().min(1),
  }),
});
export type LearnerRegister = z.infer<typeof LearnerRegisterSchema>;

/**
 * PATCH /api/sync/learners/:id body: the learner's name, level or picture,
 * changed on the learner's own device after registration. Strict, so the
 * fields that stay on the device (who is learning, the grown-up PIN, consent;
 * F-LEARN-001 decision L2) are refused, never stored. `at` is when the device
 * made the change: the server keeps the newest edit, so a queued older edit
 * that arrives late does not undo a newer one. The name takes the lenient
 * server rule (`LegacyDisplayNameSchema`, trim, 1-20), so the app's one-time
 * push of a legacy name it already holds is never refused on every retry; the
 * strict rule applies to a newly typed name in the app's edit screen.
 */
export const LearnerProfilePatchSchema = z
  .object({
    displayName: LegacyDisplayNameSchema.optional(),
    ageGroup: LearnerLevelIdSchema.optional(),
    avatar: AvatarKindSchema.optional(),
    at: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((p) => p.displayName !== undefined || p.ageGroup !== undefined || p.avatar !== undefined, {
    message: 'Send at least one of displayName, ageGroup or avatar',
  });
export type LearnerProfilePatch = z.infer<typeof LearnerProfilePatchSchema>;

/**
 * The learner row as the server holds it, on the inbox of a full-scope device
 * (the learner's own). Lenient per field: a stale level or picture on a legacy
 * row reads as null or empty and never hides the name; only a missing name
 * drops the block (never the inbox). `profileUpdatedAt` is null until the
 * first edit after registration.
 */
export const InboxLearnerSchema = z.object({
  displayName: z.string(),
  ageGroup: LearnerLevelIdSchema.nullable().catch(null),
  avatar: z.string().catch(''),
  profileUpdatedAt: z.string().nullable().catch(null),
});
export type InboxLearner = z.infer<typeof InboxLearnerSchema>;

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
  /** The calling device's scope (F-SPACE-002 section 4.12). Null when an older Worker omits it or sends a value the app does not know: unknown, never a guess. */
  deviceScope: z.enum(['full', 'class']).nullable().default(null).catch(null),
  /*
   * Notes from grown-ups (F-FEEDBACK-001 section 7.1). Additive and lenient: an
   * old Worker omits both (defaults: none, all class notes, not acknowledged),
   * one bad note is dropped, and unreadable prefs fall back field by field
   * (`NotePrefsSchema`), so neither ever costs the plans, memberships or tier.
   * Each parse returns its own prefs object, never the shared constant.
   */
  notes: lenientArray(InboxNoteSchema).default([]),
  notePrefs: NotePrefsSchema.default(NOTE_PREFS_DEFAULT).catch(() => ({ ...NOTE_PREFS_UNREADABLE })),
  /*
   * [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3. Additive and lenient: an old Worker omits both
   * (no update to read, no notice), a malformed `classScope` reads as null and one bad notice is dropped.
   */
  classScope: InboxClassScopeSchema.nullable().default(null).catch(null),
  classMoves: lenientArray(InboxClassMoveSchema).default([]),
  /** The server's learner row (full-scope devices only). Absent from an older Worker and on a class tablet; malformed reads as absent. */
  learner: InboxLearnerSchema.optional().catch(undefined),
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
