import { z } from 'zod';
import { ClassScopeSchema } from './class-scope';
import { NOTES_MODES } from './feedback';
import { ClassReportSchema, ReportPeriodSchema } from './report';
import { SpaceSchema } from './space';
import { ProgressSummarySchema } from './sync';

/**
 * Bodies of the two report routes — F-REPORT-001 section 3.8. Kept apart from
 * `report.ts` because they read `sync.ts`, which reads the activity schema.
 */

/** The space as every console route returns it (`publicSpace`): never the join code or the owner. */
export const ReportSpaceSchema = SpaceSchema.pick({
  id: true,
  kind: true,
  name: true,
  parentSpaceId: true,
  settings: true,
  archivedAt: true,
  createdAt: true,
});
export type ReportSpace = z.infer<typeof ReportSpaceSchema>;

/**
 * The summary a report reads: the roster's projection (`rosterSummary`), so a
 * report never shows more than the roster's consent allows. Every key is
 * optional because a legacy summary may lack any of them; `selfRoute` reaches
 * family spaces only and `activity` only after RP-W2 moves it to the allow-list.
 * `schemaVersion` is not read and is stripped. [TV] `vocab` (with `firstTryRate`, the student's detail view of
 * F-VOC-005 section 3.8) and `stage1Anchor` arrive for a family and for a full-scope class
 * (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2); a base-scope class still never receives them.
 */
export const ReportSummarySchema = ProgressSummarySchema.pick({
  lastActiveAt: true,
  streakDays: true,
  stage1: true,
  cardsUnlocked: true,
  minutesLast7d: true,
  jamoRecognized: true,
  needsPractice: true,
  placement: true,
  planProgress: true,
  journey: true,
  selfRoute: true,
  activity: true,
  vocab: true,
  stage1Anchor: true,
}).partial();
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/** `GET /api/spaces/:id/learners/:learnerId/report`. No `ageGroup`: no report block uses it. */
export const LearnerReportResponseSchema = z.object({
  space: ReportSpaceSchema,
  learner: z.object({
    /** The opaque `profile:` id; never a name in a URL. */
    id: z.string(),
    /** The roster's name (initials when the class anonymizes). */
    displayName: z.string(),
    avatar: z.string(),
    joinedAt: z.string(),
    lastActiveAt: z.string(),
  }),
  /** Null when the server holds no summary (the `no_data` state). */
  summary: ReportSummarySchema.nullable(),
  lastSyncedAt: z.string().nullable(),
  serverTime: z.string(),
  /**
   * [TV] Which projection the viewer read (section 2 of the amendment): a family is always `full`; a class or
   * school is `full` once the family has read the class-scope update. Optional so a body from an older Worker parses.
   */
  scope: ClassScopeSchema.optional(),
  /** [TV] TV-D12: the learner's server-held settings, at full scope only (null otherwise). `classNotes` null: unreadable. */
  settings: z.object({ classNotes: z.enum(NOTES_MODES).nullable() }).nullable().optional(),
});
export type LearnerReportResponse = z.infer<typeof LearnerReportResponseSchema>;

/** `GET /api/spaces/:id/class-report`. Aggregates only: no learner id, name or avatar. */
export const ClassReportResponseSchema = z.object({
  space: ReportSpaceSchema,
  period: ReportPeriodSchema,
  /**
   * The window the figures read (RP-5b): `classAtOf(period, at, serverTime)`, the day the request asked for within
   * the class stepper's limits (a month window starts on the 1st), or null for the current window (no `at`, or one
   * that is malformed, after today, outside the limits, or on `all`). Optional so a console bundle cached before the
   * field still parses the body.
   */
  at: z.string().nullable().optional(),
  serverTime: z.string(),
  report: ClassReportSchema,
});
export type ClassReportResponse = z.infer<typeof ClassReportResponseSchema>;
