import { z } from 'zod';
import { PlacementStrandSchema } from './placement';

/**
 * Progress reports — F-REPORT-001. The bounded activity summary a device adds
 * to the summary it already uploads (section 3.3.3), the report periods and
 * the aggregate-only class report (section 3.7). The route bodies that carry
 * them live in `report-response.ts` (they read `sync.ts`, which reads this
 * file).
 *
 * Every field is a count, a day key, a stage key, a letter key or a quest id:
 * no per-question history, no response time, no free text (section 3.10).
 */

/** This week + last week + the calendar month to date. */
export const REPORT_DAYS_MAX = 35;
export const REPORT_MONTHS_MAX = 24;
export const REPORT_MILESTONES_MAX = 16;
export const REPORT_DAY_LETTERS_MAX = 12;
/** A tampered client cannot grow every roster that copies the summary. */
const COUNT_MAX = 100_000;
const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MonthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);
const QuestIdSchema = z.string().min(1).max(64);
const Count = z.number().int().nonnegative().max(COUNT_MAX);

/** One learner-local day with activity. */
export const ActivityDaySchema = z.object({
  d: DayKeySchema,
  /** Minutes: round(sum of counted session seconds started that day / 60). */
  min: Count,
  /** Quests finished for the first time that day (`questDoneAt`). */
  q: Count,
  /** Cards collected that day (`cards[].unlockedAt`). */
  c: Count,
  /** Words met for the first time that day; 0 until F-VOC-005 writes the slice. */
  w: Count,
  /** Letters that first showed as strong that day (section 3.3.4 step 5). */
  j: z.array(z.string().max(16)).max(REPORT_DAY_LETTERS_MAX),
});
export type ActivityDay = z.infer<typeof ActivityDaySchema>;

export const ActivityMonthSchema = z.object({
  m: MonthKeySchema,
  min: Count,
  q: Count,
  c: Count,
  w: Count,
  /** Practice days in that month. */
  days: z.number().int().nonnegative().max(31),
});
export type ActivityMonth = z.infer<typeof ActivityMonthSchema>;

/** The app's own next (F-ENT-003 `routeNext`), so a report never disagrees with the learner's Home. */
export const ActivityNextSchema = z.union([
  /** `plan`: the quest came from the active plan. */
  z.object({ q: QuestIdSchema, plan: z.boolean() }).strict(),
  /** F-ENT-003 'free-end'. */
  z.object({ end: z.literal(true) }).strict(),
]);
export type ActivityNext = z.infer<typeof ActivityNextSchema>;

export const ActivitySummarySchema = z.object({
  v: z.literal(1),
  /** Minutes east of UTC when computed (`-new Date().getTimezoneOffset()`). */
  tz: z.number().int().min(-840).max(840),
  /** The device's local today when computed; days after it are "not saved yet". */
  asOf: DayKeySchema,
  /** Only days with activity, ascending, the newest 35 ending at `asOf`. */
  days: z.array(ActivityDaySchema).max(REPORT_DAYS_MAX),
  /** Only months with activity, ascending, the newest 24. */
  months: z.array(ActivityMonthSchema).max(REPORT_MONTHS_MAX),
  /** Exact and monotonic: computed from the whole snapshot, not from the bounded arrays. */
  total: z.object({ since: DayKeySchema.nullable(), min: Count, q: Count, c: Count, w: Count, days: Count }),
  milestones: z.array(z.object({ stage: z.string().max(32), on: DayKeySchema })).max(REPORT_MILESTONES_MAX),
  /** Absent before F-ENT-003 E3-4 is on main, and at 'rest'. */
  next: ActivityNextSchema.optional(),
  /** The quest the "letters to revisit" line offers (section 3.3.4 step 9). */
  revisit: QuestIdSchema.optional(),
});
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

/** Report periods (section 3.2); `week` is the default. */
export const REPORT_PERIODS = ['day', 'week', 'month', 'all'] as const;
export const ReportPeriodSchema = z.enum(REPORT_PERIODS);
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

/** A query or payload value as a period: anything else reads as `week` (section 3.1). */
export function reportPeriodOf(raw: unknown): ReportPeriod {
  const parsed = ReportPeriodSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'week';
}

/*
 * Class statistics (section 3.7): every number is an aggregate. Objects strip
 * unknown keys, so a learner id, a name or a ranking field never survives a
 * parse; the shape itself has none (a test scans every key).
 */
const Total = z.number().int().nonnegative();
/** A figure that may carry the up-only marker; it never says "down". */
const UpCountSchema = z.object({ count: Total, up: z.literal(true).optional() });
/** A letter is content, not a person: the number of learners for whom it applies. */
const LetterCountSchema = z.object({ letter: z.string().max(16), learners: Total });
const CLASS_LETTERS_MAX = 5;

/** week: 0, 1-2, 3-4, 5-7 · month: 0, 1-4, 5-9, 10+ · day: practiced, not_yet · all: none. */
export const CLASS_DAY_BANDS = ['0', '1-2', '3-4', '5-7', '1-4', '5-9', '10+', 'practiced', 'not_yet'] as const;
export const ClassDayBandSchema = z.enum(CLASS_DAY_BANDS);
export type ClassDayBand = z.infer<typeof ClassDayBandSchema>;

export const ClassReportSchema = z.object({
  v: z.literal(1),
  period: ReportPeriodSchema,
  /** "{practiced} of {learners} learners practiced {period}." */
  headline: z.object({
    code: z.literal('class_practiced'),
    practiced: Total,
    learners: Total,
    up: z.literal(true).optional(),
  }),
  class: z.object({
    /** Learner members. */
    learners: Total,
    /** Summaries with `activity`. */
    withActivity: Total,
    /** Summaries without it (an older app). */
    olderApp: Total,
    /** Last saved more than 7 days ago, by sync or by `asOf`. */
    notSaved7d: Total,
  }),
  wentWell: z.object({
    /** Letters the class got strong on, ordered by count then by letter order. */
    lettersNew: z.array(LetterCountSchema).max(CLASS_LETTERS_MAX),
    questsNew: UpCountSchema,
    cardsNew: Total,
    /** Stage milestone events in the window (OD-4): never a distribution by stage. */
    milestones: z.array(z.object({ stage: z.string().max(32), count: Total })).max(REPORT_MILESTONES_MAX),
  }),
  /** Letters to revisit together. */
  revisit: z.array(LetterCountSchema).max(CLASS_LETTERS_MAX),
  /** Omitted for `all`; the `0` band is "Not yet" and never highlighted. */
  practice: z.object({
    dayBands: z.array(z.object({ band: ClassDayBandSchema, learners: Total })).max(4).optional(),
  }),
  /** No mean per learner, no maximum, no minimum; the median is null when fewer than 3 practiced. */
  time: z.object({ minutesTotal: UpCountSchema, minutesMedian: Total.nullable() }),
  /** Per strand, counts among learners with a check (OD-5); no level distribution. */
  levelCheck: z
    .array(
      z.object({
        strand: PlacementStrandSchema,
        secure: Total,
        gettingThere: Total,
        notYet: Total,
        notTested: Total,
      }),
    )
    .max(PlacementStrandSchema.options.length),
  /** Up to 3 non-archived plans, newest first; no per-learner rows. */
  plans: z
    .array(
      z.object({
        planId: z.string().max(64),
        title: z.string().max(60),
        /** Learners with `total > 0`. */
        assigned: Total,
        started: Total,
        finished: Total,
        itemsDone: Total,
      }),
    )
    .max(3),
});
export type ClassReport = z.infer<typeof ClassReportSchema>;
