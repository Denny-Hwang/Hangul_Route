import { z } from 'zod';
import { AssessmentQuestionSchema, AssessmentResponseSchema } from '../assessment/question';
import { GateResultSchema, PlacementFormSchema, PlacementGateSchema, StopReasonSchema } from '../schemas/placement';
import { PLACEMENT_MODES } from './rungs';

/**
 * The persisted run (`placement-run:<profileId>`, F-PLC-001 section 3.5): a plain
 * JSON value, versioned. It holds the built questions of the rungs not yet
 * asked, so a resumed run shows the same questions with the same option order
 * and needs neither the bank nor a picture resolver to continue.
 */
export const PlacementRunConfigSchema = z.object({
  mode: z.enum(PLACEMENT_MODES),
  /** A *Pictures first* learner: decoding items start from sound and take one tap, in every mode. */
  listenFirst: z.boolean(),
  revealMode: z.enum(['tap', 'always']),
  audio: z.boolean(),
  visual: z.boolean(),
  takeMyTime: z.boolean(),
  seed: z.number().int().nonnegative(),
  /** Template ids of the learner's previous result. */
  exclude: z.array(z.string()),
});

const CurrentRungSchema = z.object({
  gate: PlacementGateSchema,
  form: PlacementFormSchema,
  questions: z.array(AssessmentQuestionSchema).length(3),
  /** Index into `responses` of this rung's first answer. */
  start: z.number().int().nonnegative(),
});

export const PlacementRunStateSchema = z.object({
  version: z.literal(1),
  bankVersion: z.number().int().positive(),
  config: PlacementRunConfigSchema,
  startedAtMs: z.number(),
  /** The backstop clock; null with Take my time. */
  deadlineMs: z.number().nullable(),
  lastTouchMs: z.number(),
  /** When the open question appeared (for `ms`). */
  shownAtMs: z.number(),
  /** not-sure: three in a row (not in Short); idle: 45 s untouched; rest: Deep's halfway card; exit: the exit sheet is open. */
  pause: z.enum(['not-sure', 'idle', 'rest', 'exit']).nullable(),
  pausedAtMs: z.number().nullable(),
  /** The backstop ran out: the open question may still be answered, then the run ends. */
  timeUp: z.boolean(),
  /** Built questions of rungs not yet asked, keyed `<gate>:<form>`; only complete draws of three. */
  draws: z.record(z.string(), z.array(AssessmentQuestionSchema)),
  /** Finished rungs in asking order (including rungs recorded as not-run). */
  done: z.array(GateResultSchema),
  current: CurrentRungSchema.nullable(),
  responses: z.array(AssessmentResponseSchema),
  /** Tags of every question asked, for covered symbols and priority tokens. */
  tags: z.record(z.string(), z.array(z.string())),
  notSureStreak: z.number().int().nonnegative(),
  /** Deep's rest card has been shown (it shows once per run). */
  rested: z.boolean(),
  stop: StopReasonSchema.nullable(),
});
export type PlacementRunState = z.infer<typeof PlacementRunStateSchema>;
