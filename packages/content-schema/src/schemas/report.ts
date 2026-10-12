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
/** `YYYY-MM-DD` that names a real calendar day (no 2026-19-45). */
const isRealDay = (key: string): boolean => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay);
const MonthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const QuestIdSchema = z.string().min(1).max(64);
/**
 * A letter is a Hangul compatibility jamo (one or two, U+3131-U+318E), never
 * free text: what the device reads from the jamo catalogue (`questJamo`).
 */
export const ReportLetterSchema = z.string().regex(/^[\u3131-\u318E]{1,2}$/);
/** A stage key such as `stage1` (`stageDoneAt`), never free text. */
export const ReportStageKeySchema = z.string().regex(/^[a-z0-9-]{1,32}$/);
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
  j: z.array(ReportLetterSchema).max(REPORT_DAY_LETTERS_MAX),
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

/** Each key strictly after the one before it: ascending, no repeats. */
const ascendingUnique = (keys: readonly string[]): boolean => keys.every((key, i) => i === 0 || (keys[i - 1] as string) < key);

export const ActivitySummarySchema = z
  .object({
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
    milestones: z.array(z.object({ stage: ReportStageKeySchema, on: DayKeySchema })).max(REPORT_MILESTONES_MAX),
    /** Absent before F-ENT-003 E3-4 is on main, and at 'rest'. */
    next: ActivityNextSchema.optional(),
    /** The quest the "letters to revisit" line offers (section 3.3.4 step 9). */
    revisit: QuestIdSchema.optional(),
  })
  /*
   * Structure the class aggregates rely on: days and months ascending with no
   * repeats, nothing after `asOf`. A violation drops `activity` through the
   * summary's `.catch` (never a 422), so a buggy or tampered device cannot
   * double-count a day.
   */
  .superRefine((a, ctx) => {
    const days = a.days.map((x) => x.d);
    const months = a.months.map((x) => x.m);
    if (!ascendingUnique(days)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['days'], message: 'days must be ascending with no repeats' });
    if (days.some((d) => d > a.asOf)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['days'], message: 'no day after asOf' });
    if (!ascendingUnique(months)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['months'], message: 'months must be ascending with no repeats' });
    if (months.some((m) => m > a.asOf.slice(0, 7))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['months'], message: 'no month after asOf' });
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
const LetterCountSchema = z.object({ letter: ReportLetterSchema, learners: Total });
const CLASS_LETTERS_MAX = 5;

/** week: 0, 1-2, 3-4, 5-7 · month: 0, 1-4, 5-9, 10+ · day: practiced, not_yet · all: none. */
export const CLASS_DAY_BANDS = ['0', '1-2', '3-4', '5-7', '1-4', '5-9', '10+', 'practiced', 'not_yet'] as const;
export const ClassDayBandSchema = z.enum(CLASS_DAY_BANDS);
export type ClassDayBand = z.infer<typeof ClassDayBandSchema>;
/** The bands each period has (section 3.7); `all` has none. */
export const CLASS_DAY_BANDS_BY_PERIOD: Readonly<Record<ReportPeriod, readonly ClassDayBand[]>> = {
  day: ['practiced', 'not_yet'],
  week: ['0', '1-2', '3-4', '5-7'],
  month: ['0', '1-4', '5-9', '10+'],
  all: [],
};

export const ClassReportSchema = z
  .object({
    v: z.literal(1),
    period: ReportPeriodSchema,
    /**
     * "{practiced} of {learners} learners practiced {period}." `practiced` and
     * `up` here are also the Practice block's `practiced` and its up-only marker
     * (section 3.7): one figure, carried once.
     */
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
      milestones: z.array(z.object({ stage: ReportStageKeySchema, count: Total })).max(REPORT_MILESTONES_MAX),
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
          /** The plan's id, with `PlanSchema`'s own grammar and bound. */
          planId: z.string().regex(/^plan:[a-z0-9-]+$/),
          title: z.string().max(60),
          /** Learners with `total > 0`. */
          assigned: Total,
          started: Total,
          finished: Total,
          itemsDone: Total,
        }),
      )
      .max(3),
  })
  /** Each period carries only its own bands, and `all` carries none (section 3.7). */
  .superRefine((r, ctx) => {
    const allowed = CLASS_DAY_BANDS_BY_PERIOD[r.period];
    const bands = r.practice.dayBands;
    if (r.period === 'all' && bands !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['practice', 'dayBands'], message: 'the all period has no day bands' });
      return;
    }
    (bands ?? []).forEach((b, i) => {
      if (!allowed.includes(b.band)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['practice', 'dayBands', i, 'band'], message: `${b.band} is not a ${r.period} band` });
    });
  });
export type ClassReport = z.infer<typeof ClassReportSchema>;
