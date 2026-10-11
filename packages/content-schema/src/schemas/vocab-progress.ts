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

/** True when `YYYY-MM-DD` names a day that exists (no month 13, no 30 February). */
function isRealDay(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * A local calendar day, `YYYY-MM-DD` (F-VOC-005 P5), that exists: a `due` such
 * as `2026-13-45` would never come due and would win every max merge.
 */
const DaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealDay, 'not a calendar day');

/** ISO date-time, UTC (`Z`) or with an offset; the same shape the telemetry route accepts. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * The last-writer-wins key of the schedule. Bounded and parseable, so no
 * string can sort after every real time and pin a word's schedule for good.
 */
const AtSchema = z
  .string()
  .max(40)
  .regex(ISO_DATE_TIME)
  .refine((at) => isRealDay(at.slice(0, 10)) && Number.isFinite(Date.parse(at)), 'not a date-time');

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
    at: AtSchema,
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

/** Index of the first value seen before, or -1. */
function firstRepeat(values: readonly string[]): number {
  const seen = new Set<string>();
  for (const [i, value] of values.entries()) {
    if (seen.has(value)) return i;
    seen.add(value);
  }
  return -1;
}

export const VocabProgressSchema = z
  .object({
    v: z.literal(1),
    items: z.array(VocabItemStateSchema).max(1000),
    topics: z.array(VocabTopicProgressSchema).max(100),
  })
  .superRefine((slice, ctx) => {
    // One state per word and one row per topic: a copy would inflate the
    // caregiver counts and make an id-keyed merge depend on order.
    const item = firstRepeat(slice.items.map((s) => s.id));
    if (item >= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', item, 'id'], message: 'duplicate word id' });
    const topic = firstRepeat(slice.topics.map((t) => t.topic));
    if (topic >= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['topics', topic, 'topic'], message: 'duplicate topic' });
  });
export type VocabProgress = z.infer<typeof VocabProgressSchema>;
