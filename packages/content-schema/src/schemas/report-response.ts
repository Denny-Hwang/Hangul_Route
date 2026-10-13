import { z } from 'zod';
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
 * `schemaVersion`, `stage1Anchor` and `vocab` are not read and are stripped.
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
