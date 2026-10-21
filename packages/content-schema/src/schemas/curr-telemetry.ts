import { z } from 'zod';
import { StageKeySchema } from './heritage-card';
import { MinigameKindSchema } from './minigame';
import { QUEST_ID_RE } from './quest';
import type { TelemetryEventName } from './telemetry';

/**
 * Payload shapes of the F-CURR-002 telemetry names (section 11.3; TELEMETRY-NAMES-2 section R,
 * row CM-3) and the three optional `session.end` fields. Ids, codes, counts and buckets only:
 * no names, no free text, no learner input (Write Frame and My Story text is never sent), and no
 * profile id inside a payload, because `profileId` rides in the envelope (section 11.1). Every
 * object is strict, so an extra key fails. The emitting rows parse against these schemas before
 * sending, and the Worker stores a payload of these names only when it parses
 * (`keptEventFields`, packages/backend/src/lib/server-events.ts). Worker first: the app sends none
 * of these names before this list is deployed.
 */

/** The nineteen section R names, in the order they are appended to `TELEMETRY_EVENT_NAMES`. */
export const CURR_TELEMETRY_EVENT_NAMES = [
  'memory.daily',
  'items.seeded',
  'mastery.level_up',
  'stage.card_opened',
  'testout.finished',
  'quest.adapt',
  'goal.set',
  'goal.met',
  'week.goal_met',
  'decode.sprint.finished',
  'stamp.earned',
  'weekly_quest.complete',
  'pack.opened',
  'pack.level_complete',
  'family.goal_met',
  'space.goal.set',
  'space.goal.met',
  'lecture.game.finished',
  'exp.exposure',
] as const satisfies readonly TelemetryEventName[];
export type CurrTelemetryEventName = (typeof CURR_TELEMETRY_EVENT_NAMES)[number];

/**
 * Section R names stored without a profile id: `family.goal_met` is account level with no
 * profile breakdown (section 7.6), `space.goal.*` are recorded on the Worker side (row CM-62),
 * and a `lecture.*` event never carries one (F-TCH-004 section 3.14).
 */
export const CURR_TELEMETRY_NO_PROFILE: readonly CurrTelemetryEventName[] = ['family.goal_met', 'space.goal.set', 'space.goal.met', 'lecture.game.finished'];

/**
 * Section R names only the Worker records (row CM-62, through `recordServerEvent`): `POST
 * /api/telemetry` refuses them with 422, as it refuses `billing.*`, so no client can forge a class
 * goal (`isServerOnlyTelemetryName`).
 */
export const CURR_TELEMETRY_SERVER_ONLY: readonly CurrTelemetryEventName[] = ['space.goal.set', 'space.goal.met'];

/** A whole-number count. The bound keeps a count from carrying a timestamp or an id. */
const count = z.number().int().min(0).max(100_000);
const wholeUpTo = (max: number) => z.number().int().min(0).max(max);

/**
 * A bucket code: one number, a range or an open top, such as `0`, `10-19` or `31+`. The emitting
 * rows choose the edges; the shape alone keeps free text and raw values out.
 */
export const TelemetryBucketSchema = z.string().regex(/^\d{1,5}(?:-\d{1,5}|\+)?$/);

/** Review item kinds (section 4.2). */
export const REVIEW_ITEM_KINDS = ['sym', 'syl', 'lex', 'pat', 'exc', 'rea'] as const;
/** Modality rungs (section 4.3); production enters review without any speaking. */
export const REVIEW_RUNGS = ['recognize', 'read', 'produce'] as const;
/** Days since the item's last answer (section 11.3). */
export const LAG_BUCKETS = ['0-1', '2-3', '4-7', '8-14', '15-30', '31+'] as const;

/** Experiments of section 11.4. An arm is a code (`a` the current behaviour or holdback, `b` the variant), never the hash. */
export const EXPERIMENT_IDS = ['E1', 'E2', 'E3', 'E4'] as const;
export const ExperimentIdSchema = z.enum(EXPERIMENT_IDS);
export const ExperimentArmSchema = z.enum(['a', 'b']);

/** The game presets of the lecture `game` block (section 8), none of them measuring speech. */
export const LECTURE_GAME_PRESETS = ['team-relay', 'yut-race', 'hidden-heritage-big', 'bingo'] as const;

/** Goal choices (section 7.4): Light, Steady, Strong points a day, and learning days a week. */
const DailyGoalSchema = z.union([z.literal(3), z.literal(6), z.literal(10)]);
const WeeklyDaysSchema = z.union([z.literal(3), z.literal(5), z.literal(7)]);

const THEMES = '(?:letters|life|rites|nature|crafts)';
/** A grid cell, named by its first-volume episode id (`episode:stage2-life`); a cell's level spans its volumes. */
const GRID_CELL_ID_RE = new RegExp(`^episode:stage[1-7]-${THEMES}$`);
/** A pack level, named by its episode id (`episode:pack-<key>-s<n>`, section 6.2). */
const PACK_LEVEL_ID_RE = /^episode:pack-[a-z0-9]+(?:-[a-z0-9]+)*-s[1-7]$/;
const GridCellIdSchema = z.string().regex(GRID_CELL_ID_RE);
const CellOrPackLevelIdSchema = z.string().refine((id) => GRID_CELL_ID_RE.test(id) || PACK_LEVEL_ID_RE.test(id));
const PackIdSchema = z.string().regex(/^pack:[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** The class goal metrics of section 7.6 (`space_goals.metric`). */
export const SPACE_GOAL_METRICS = ['stories', 'refreshed', 'quests'] as const;
const SpaceGoalSchema = z.object({ metric: z.enum(SPACE_GOAL_METRICS), target: z.number().int().min(1).max(10_000) }).strict();

/** A short code from a fixed table (a stamp id slug, a weekly quest kind): lowercase words joined by hyphens. */
const codeSlug = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(40);

const HistCellSchema = z
  .object({ kind: z.enum(REVIEW_ITEM_KINDS), rung: z.enum(REVIEW_RUNGS), lag: z.enum(LAG_BUCKETS), right: count, wrong: count })
  .strict();
const MAX_HIST_CELLS = REVIEW_ITEM_KINDS.length * REVIEW_RUNGS.length * LAG_BUCKETS.length;

const CalibBinSchema = z.object({ right: count, wrong: count }).strict();

const ArmsSchema = z.object(Object.fromEntries(EXPERIMENT_IDS.map((id) => [id, ExperimentArmSchema.optional()])) as Record<(typeof EXPERIMENT_IDS)[number], z.ZodOptional<typeof ExperimentArmSchema>>).strict();

/**
 * `memory.daily`, sent once a local day (row CM-12): answer counts by item kind x rung x lag
 * bucket, each cell at most once, so per-item data stays on the device. `calib` (10 calibration
 * bins) is sent by row CM-72 only, and `arms` (experiment id to arm code) only once row CM-71
 * runs an experiment, so a build before then may leave either out.
 */
const MemoryDailySchema = z
  .object({
    hist: z
      .array(HistCellSchema)
      .max(MAX_HIST_CELLS)
      .refine((cells) => new Set(cells.map((c) => `${c.kind}|${c.rung}|${c.lag}`)).size === cells.length, 'each kind x rung x lag cell at most once'),
    lapses: count,
    calib: z.array(CalibBinSchema).length(10).optional(),
    items: count,
    newHeld: count,
    minutes: wholeUpTo(1440),
    durableWeekBucket: TelemetryBucketSchema,
    dueVolumeBucket: TelemetryBucketSchema,
    arms: ArmsSchema.optional(),
  })
  .strict();

export const CURR_TELEMETRY_PAYLOADS = {
  'memory.daily': MemoryDailySchema,
  'items.seeded': z.object({ countBucket: TelemetryBucketSchema, spreadDaysBucket: TelemetryBucketSchema }).strict(),
  'mastery.level_up': z.object({ cellId: CellOrPackLevelIdSchema, level: z.number().int().min(1).max(3) }).strict(),
  'stage.card_opened': z.object({ stage: StageKeySchema }).strict(),
  'testout.finished': z
    .object({ cellId: GridCellIdSchema, passed: z.boolean(), items: wholeUpTo(50), firstTryCorrect: wholeUpTo(50) })
    .strict()
    .refine((p) => p.firstTryCorrect <= p.items, 'firstTryCorrect cannot exceed items'),
  'quest.adapt': z.object({ questId: z.string().regex(QUEST_ID_RE).max(64), dir: z.enum(['compact', 'scaffold']) }).strict(),
  'goal.set': z.object({ daily: DailyGoalSchema, weeklyDays: WeeklyDaysSchema }).strict(),
  'goal.met': z.object({ points: wholeUpTo(1000), target: DailyGoalSchema }).strict(),
  'week.goal_met': z.object({ days: wholeUpTo(7), target: WeeklyDaysSchema }).strict(),
  'decode.sprint.finished': z
    .object({ rateBucket: TelemetryBucketSchema, probeRateBucket: TelemetryBucketSchema, sprintIndexBucket: TelemetryBucketSchema })
    .strict(),
  'stamp.earned': z.object({ stampId: z.string().regex(/^stamp:[a-z0-9]+(?:-[a-z0-9]+)*$/).max(48) }).strict(),
  'weekly_quest.complete': z.object({ questKind: codeSlug }).strict(),
  'pack.opened': z.object({ packId: PackIdSchema }).strict(),
  'pack.level_complete': z.object({ packId: PackIdSchema, stage: StageKeySchema }).strict(),
  'family.goal_met': z.object({ weekTarget: z.number().int().min(1).max(10_000) }).strict(),
  // Server-only (row CM-62): metric and target codes, never a space, class, account or learner id.
  'space.goal.set': SpaceGoalSchema,
  'space.goal.met': SpaceGoalSchema,
  'lecture.game.finished': z.object({ preset: z.enum(LECTURE_GAME_PRESETS), rounds: wholeUpTo(200), teams: wholeUpTo(4) }).strict(),
  'exp.exposure': z.object({ experimentId: ExperimentIdSchema, arm: ExperimentArmSchema }).strict(),
} as const satisfies Record<CurrTelemetryEventName, z.ZodTypeAny>;

const CURR_NAMES: ReadonlySet<string> = new Set(CURR_TELEMETRY_EVENT_NAMES);

export function isCurrTelemetryName(name: unknown): name is CurrTelemetryEventName {
  return typeof name === 'string' && CURR_NAMES.has(name);
}

/**
 * The three optional `session.end` fields (row CM-3), additive: `questLeft` 1 when the session
 * ended inside a quest before its reward step; `leftAtKind` the game kind code of the round on
 * screen; `afterWrongStreak` the wrong first tries in a row just before the end, 2 meaning two or
 * more. An older build sends none of them, and a reader treats a missing field as unknown, never
 * as 0.
 */
export const SESSION_END_QUEST_FIELDS = {
  questLeft: z.union([z.literal(0), z.literal(1)]),
  leftAtKind: MinigameKindSchema,
  afterWrongStreak: z.union([z.literal(0), z.literal(1), z.literal(2)]),
} as const;

/**
 * `session.end` (TELEMETRY-NAMES-2 section A): `{ durationSeconds, streakDays }` plus the three
 * optional fields. This is the shape an app sends; it is strict for the app's own tests. The Worker
 * is lenient on purpose so older clients keep working: it stores other `session.end` keys as given,
 * as before CM-3, and drops only a CM-3 field whose value is off its codes.
 */
export const SessionEndPayloadSchema = z
  .object({
    durationSeconds: z.number().int().nonnegative(),
    streakDays: z.number().int().nonnegative(),
    questLeft: SESSION_END_QUEST_FIELDS.questLeft.optional(),
    leftAtKind: SESSION_END_QUEST_FIELDS.leftAtKind.optional(),
    afterWrongStreak: SESSION_END_QUEST_FIELDS.afterWrongStreak.optional(),
  })
  .strict();
export type SessionEndPayload = z.infer<typeof SessionEndPayloadSchema>;
