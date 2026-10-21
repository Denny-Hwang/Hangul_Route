import { z } from 'zod';
import { CurriculumMetaSchema } from '../curriculum/draft';
import { daysBetween, isDateKey } from '../curriculum/dates';
import { CURRICULUM_MAX_ITEMS } from '../curriculum/presets';
import { PlacementResultSchema } from './placement';
import { PlanItemSchema } from './plan-item';
import { lenientArray } from './transfer';
import { VocabProgressSchema } from './vocab-progress';

/**
 * Progress — per-profile snapshot of learning state.
 */
export const QuestProgressSchema = z.object({
  questId: z.string(),
  episodeId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  attempts: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const EpisodeProgressSchema = z.object({
  episodeId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  questsCompleted: z.number().int().nonnegative(),
  totalQuests: z.number().int().nonnegative(),
});
export type EpisodeProgress = z.infer<typeof EpisodeProgressSchema>;

export const CardCollectionEntrySchema = z.object({
  cardId: z.string(),
  unlockedAt: z.string(),
  newSinceLastView: z.boolean(),
});
export type CardCollectionEntry = z.infer<typeof CardCollectionEntrySchema>;

export const SessionLogSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  episodesTouched: z.array(z.string()),
  /**
   * The learner's local day when the session was logged (F-CURR-002 section
   * 4.8), so a later local-day count never depends on today's time zone.
   * Absent on sessions logged before it; a malformed value reads as absent.
   */
  localDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});
export type SessionLog = z.infer<typeof SessionLogSchema>;

/**
 * HomeworkAssignment — an explicit caregiver assignment (F-HW-001 §3.4).
 * `assignedAt` is the ordering key when several compete for the same day;
 * `targetDate` (YYYY-MM-DD) is the day the assignment is *for*, which is not
 * the day it was created.
 */
export const HomeworkAssignmentSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  questId: z.string(),
  episodeId: z.string(),
  assignedBy: z.enum(['parent', 'teacher', 'system']),
  assignedAt: z.string(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type HomeworkAssignment = z.infer<typeof HomeworkAssignmentSchema>;

/** `cell-check` and `warmup` are F-CURR-002 (section 4.8); every read path drops an entry of a kind it does not know. */
export const ReviewKindSchema = z.enum(['daily', 'feedback', 'stage-certificate', 'cell-check', 'warmup']);
export type ReviewKind = z.infer<typeof ReviewKindSchema>;

export const ReviewEntrySchema = z.object({
  id: z.string(),
  kind: ReviewKindSchema,
  generatedAt: z.string(),
  scope: z.string(),
  itemIds: z.array(z.string()),
  resultStars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  /** Items answered wrong on the first try (F-QUEST-002 §3.9); absent on older entries. */
  missedItemIds: z.array(z.string()).optional(),
});
export type ReviewEntry = z.infer<typeof ReviewEntrySchema>;

/** Review entries read one by one: an unknown kind or a malformed entry drops only itself (F-CURR-002 section 4.8). */
export const ReviewListSchema = lenientArray(ReviewEntrySchema);

/**
 * The reviews of a snapshot that came from somewhere else (the server, a
 * Rescue Code restore) without being parsed: entries this build cannot read
 * are dropped, the rest kept. Returns the snapshot itself when nothing drops.
 */
export function withKnownReviews<T extends { reviews: unknown }>(snapshot: T): T {
  const reviews = ReviewListSchema.parse(snapshot.reviews);
  const sent = snapshot.reviews;
  return Array.isArray(sent) && sent.length === reviews.length ? snapshot : { ...snapshot, reviews };
}

/** Bounds for the F-CURR-002 snapshot fields: ids and keys up to 64 characters, ISO values up to 40. */
const ID_MAX = 64;
const ISO_MAX = 40;
/** Entries kept per record (cells, packs, stages, stamps); far above the end state of about 300 cells and packs. */
export const PROGRESS_RECORD_MAX = 2000;
/** Days kept in `dayLog`, counted back from its newest day. */
export const DAY_LOG_DAYS = 70;
/** Install keys kept per day of `dayLog`. */
export const DAY_LOG_INSTALL_KEYS_MAX = 32;

const codePointOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The first `max` entries in code-point key order, as a record with sorted keys. */
export function capRecord<V>(entries: Iterable<[string, V]>, max: number): Record<string, V> {
  return Object.fromEntries([...entries].sort(([a], [b]) => codePointOrder(a, b)).slice(0, max));
}

/**
 * A record read entry by entry: an entry whose key or value does not parse is
 * dropped, and a value that is not an object reads as absent. At most `max`
 * entries are kept, in key order.
 */
function lenientRecord<V extends z.ZodTypeAny>(key: z.ZodType<string>, value: V, max: number) {
  type Out = Exclude<z.output<V>, undefined>;
  return z.unknown().transform((input): Record<string, Out> | undefined => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
    const kept: [string, Out][] = [];
    for (const [k, v] of Object.entries(input)) {
      const pk = key.safeParse(k);
      const pv = value.safeParse(v);
      if (pk.success && pv.success && pv.data !== undefined) kept.push([pk.data, pv.data as Out]);
    }
    return capRecord(kept, max);
  });
}

const KeySchema = z.string().min(1).max(ID_MAX);
const IsoSchema = z.string().min(1).max(ISO_MAX);
/** A `YYYY-MM-DD` local day that exists on the calendar. */
const LocalDaySchema = z.string().refine(isDateKey);

export const CellLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type CellLevel = z.infer<typeof CellLevelSchema>;
export const CellBestSchema = lenientRecord(KeySchema, CellLevelSchema, PROGRESS_RECORD_MAX);
/** Key -> ISO instant, the earliest wins on merge. */
export const LatchRecordSchema = lenientRecord(KeySchema, IsoSchema, PROGRESS_RECORD_MAX);

export const GoalsSchema = z
  .object({
    daily: z.union([z.literal(3), z.literal(6), z.literal(10)]),
    weeklyDays: z.union([z.literal(3), z.literal(5), z.literal(7)]),
    setAt: IsoSchema,
  })
  .optional()
  .catch(undefined);
export type Goals = NonNullable<z.infer<typeof GoalsSchema>>;

/** Points of one install key on one day; bounded so a tampered client cannot inflate a shared total without limit. */
const DayPointsSchema = z.number().int().nonnegative().max(10_000);
const InstallKeySchema = KeySchema;

/**
 * Keeps the newest `DAY_LOG_DAYS` calendar days, counted back from the newest
 * day present, and at most `DAY_LOG_INSTALL_KEYS_MAX` install keys a day.
 * Depends only on the log itself, never on today's date, so a merge that
 * applies it stays commutative, associative and idempotent.
 */
export function trimDayLog(log: Readonly<Record<string, Readonly<Record<string, number>>>>): Record<string, Record<string, number>> {
  const days = Object.entries(log);
  // `YYYY-MM-DD` keys sort in calendar order.
  const newest = days.reduce((m, [d]) => (d > m ? d : m), '');
  return capRecord(
    days.filter(([d]) => daysBetween(d, newest) < DAY_LOG_DAYS).map(([d, keys]): [string, Record<string, number>] => [d, capRecord(Object.entries(keys), DAY_LOG_INSTALL_KEYS_MAX)]),
    DAY_LOG_DAYS,
  );
}

const DayLogEntrySchema = lenientRecord(InstallKeySchema, DayPointsSchema, Number.MAX_SAFE_INTEGER);
/**
 * `installKey` is a random id made on the device. It never leaves the
 * snapshot: no summary, report or telemetry event carries it.
 */
export const DayLogSchema = z.unknown().transform((input): Record<string, Record<string, number>> | undefined => {
  const days = lenientRecord(LocalDaySchema, DayLogEntrySchema, Number.MAX_SAFE_INTEGER).parse(input);
  return days === undefined ? undefined : trimDayLog(days);
});
export type DayLog = NonNullable<z.infer<typeof DayLogSchema>>;

export const StreakLocalSchema = z
  .object({ run: z.number().int().nonnegative(), lastDay: LocalDaySchema })
  .optional()
  .catch(undefined);
export type StreakLocal = NonNullable<z.infer<typeof StreakLocalSchema>>;

/**
 * A self-route (F-PLAN-002 section 3.5 / 3.9): a curriculum kept on the
 * learner's device, inside the progress snapshot, so it rides sync, the backup
 * file and Rescue Code restore. A stopped route is archived (`archivedAt`),
 * never set to null, so the Worker's preserve rule can tell a stop from an old
 * client that does not know the field.
 */
export const SelfRouteSchema = z.object({
  id: z.string().regex(/^route:[a-z0-9-]+$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
  meta: CurriculumMetaSchema,
  items: z.array(PlanItemSchema).max(CURRICULUM_MAX_ITEMS),
});
export type SelfRoute = z.infer<typeof SelfRouteSchema>;

export const ProgressSnapshotSchema = z.object({
  profileId: z.string(),
  updatedAt: z.string(),
  episodes: z.array(EpisodeProgressSchema),
  quests: z.array(QuestProgressSchema),
  cards: z.array(CardCollectionEntrySchema),
  sessions: z.array(SessionLogSchema),
  homework: z.array(HomeworkAssignmentSchema),
  /**
   * Lenient per entry (F-CURR-002 section 4.8): an entry of a kind this build
   * does not know, or a malformed one, is dropped and the rest is kept, so a
   * newer build's review never fails a sync, a backup or a Rescue Code restore.
   */
  reviews: ReviewListSchema,
  streakDays: z.number().int().nonnegative(),
  /** Level checks, newest ten (F-PLC-001 section 3.8); absent in snapshots written before it. */
  placements: z.array(PlacementResultSchema).default([]),
  /**
   * Stage latch (F-ROUTE-001 section 3.15): stage key -> ISO time the stage was
   * first complete. A latched stage stays Complete whatever content ships later.
   * Absent in snapshots written before it; readers treat a missing value as `{}`.
   * Keys are not validated on the wire so a newer build's stage never fails a sync.
   * Writers store `new Date().toISOString()`; mergers compare instants, not strings.
   */
  stageDoneAt: z.record(z.string(), z.string()).optional(),
  /**
   * The learner's own weekly plan (F-PLAN-002 section 3.5); null when there is
   * none. Lenient: a malformed or newer-shaped route reads as null instead of
   * failing the whole upload or backup restore, and the Worker's preserve rule
   * then keeps the stored route.
   */
  selfRoute: SelfRouteSchema.nullable().catch(null).default(null),
  /**
   * Word progress (F-VOC-005 section 3.1). Optional, not defaulted: snapshots,
   * backups and server rows written before it parse unchanged, and readers go
   * through `vocabOf(snapshot)`. Strict on purpose: a malformed slice is a 422,
   * and the Worker's preserve rule keeps a stored slice when the key is absent.
   */
  vocab: VocabProgressSchema.optional(),
  /**
   * Quest latch (F-REPORT-001 section 3.3.1): quest id -> ISO time the quest was
   * first completed. Only ever gains keys; the earliest instant wins on merge.
   * Absent in snapshots written before it; readers treat a missing value as {}.
   * Builds from RP-3a on always write the key (an empty record when nothing is
   * latched), so "key absent" means "an older build". Keys are quest ids (at
   * most 64 characters) and values ISO instants (at most 40): bounded, and
   * strict rather than caught, since "absent" carries meaning for the
   * Worker's preserve rule.
   */
  questDoneAt: z.record(z.string().min(1).max(64), z.string().min(1).max(40)).optional(),
  /*
   * F-CURR-002 section 4.8: optional, additive and lenient on read. An absent
   * key means "an older build" and the Worker keeps the stored value; a bad
   * entry is dropped on its own and a bad value reads as absent, so none of
   * them can fail a sync, a backup or a Rescue Code restore. The merge rules
   * are in `progress-merge.ts`.
   */
  /** Best mastery level per cell or pack level, 0-3; merges by max, so the visible level never drops. */
  cellBest: CellBestSchema,
  /** Cell id -> first Cell Check; earliest wins. */
  cellCheckAt: LatchRecordSchema,
  /** Stage key -> first Stage Check; earliest wins. */
  stageCheckAt: LatchRecordSchema,
  /** Cell id -> first test-out; earliest wins. */
  testedOut: LatchRecordSchema,
  /** Daily and weekly goals; the later `setAt` wins. */
  goals: GoalsSchema,
  /** Local day -> install key -> points, the last 70 days; max per day and key, read as the sum over keys. */
  dayLog: DayLogSchema,
  /** The current run on the local day; the later `lastDay` wins, equal days take the higher run. */
  streakLocal: StreakLocalSchema,
  /** The best run ever; max. */
  streakBest: z.number().int().nonnegative().optional().catch(undefined),
  /** Passport stamp id -> when earned; earliest wins. */
  stamps: LatchRecordSchema,
  /** When the one-time memory seeding ran; earliest wins. */
  memSeededAt: z.string().min(1).max(ISO_MAX).optional().catch(undefined),
});
/**
 * `placements` is optional in the *type* although the schema defaults it to
 * `[]`: the apps read their own local copy without parsing (F-PLC-001
 * section 3.8), so every snapshot stored before the key existed lacks it at
 * runtime and every reader must treat a missing list as `[]`.
 */
export type ProgressSnapshot = Omit<z.infer<typeof ProgressSnapshotSchema>, 'placements' | 'selfRoute'> & {
  placements?: z.infer<typeof ProgressSnapshotSchema>['placements'];
  /** Optional for the same reason as `placements`: readers treat a missing value as null. */
  selfRoute?: SelfRoute | null;
};
