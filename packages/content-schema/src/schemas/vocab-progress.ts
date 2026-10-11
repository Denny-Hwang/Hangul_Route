import { z } from 'zod';
import { VocabIdSchema } from './vocab';

/**
 * Word progress — F-VOC-005 section 3.1. An optional `vocab` slice of the
 * progress snapshot: it travels with the snapshot, syncs, backs up and
 * restores with no new route.
 *
 * Every learner-visible field only grows and merges by max (or min for
 * `first`); the schedule (`box`, `due`, `at`) is the one part that can go down
 * and merges last-writer-wins on `at`. Days are the device's local calendar
 * day, stored as plain `YYYY-MM-DD` strings so nothing converts on sync.
 *
 * Server first: the Worker parses this schema and must be deployed before any
 * app build writes the slice (a zod object drops unknown keys).
 */

/** A local calendar day, `YYYY-MM-DD` (F-VOC-005 P5). */
const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Leitner box: 0 = not met, 1-5 scheduled (F-VOC-005 section 3.4). */
const BoxSchema = z.number().int().min(0).max(5);

export const VocabItemStateSchema = z
  .object({
    id: VocabIdSchema,
    /** The day the word was first collected. Merge: min. */
    first: DaySchema,
    /** Answers recorded (first answers only). Merge: max. */
    seen: z.number().int().nonnegative(),
    /** Right first-try answers, not hinted. Merge: max. */
    right: z.number().int().nonnegative(),
    /** Highest box ever reached; never drops. Merge: max. */
    bestBox: BoxSchema,
    /** Last day the word was practised. Merge: max. */
    last: DaySchema,
    /** The schedule (the only part that can go down). Merge: last writer wins on `at`. */
    box: BoxSchema,
    /** Null = not scheduled. */
    due: DaySchema.nullable(),
    /** ISO timestamp of the last schedule change. */
    at: z.string(),
  })
  .refine((s) => s.right <= s.seen && s.bestBox >= s.box, 'right <= seen and bestBox >= box');
export type VocabItemState = z.infer<typeof VocabItemStateSchema>;

export const VocabTopicProgressSchema = z.object({
  /** A topic key (`VocabTopicKey` shape); not the enum, so a newer build's topic still parses. */
  topic: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** 0 = no round yet. Merge: max. */
  bestStars: z.number().int().min(0).max(3),
  /** Cards, speed and match sessions. Merge: max. */
  sessions: z.number().int().nonnegative(),
  /** Merge: max. */
  last: DaySchema,
  /** Challenge personal best, private to the learner. Merge: max. */
  bestCaught: z.number().int().nonnegative(),
});
export type VocabTopicProgress = z.infer<typeof VocabTopicProgressSchema>;

export const VocabProgressSchema = z.object({
  v: z.literal(1),
  items: z.array(VocabItemStateSchema).max(1000),
  topics: z.array(VocabTopicProgressSchema).max(100),
});
export type VocabProgress = z.infer<typeof VocabProgressSchema>;
