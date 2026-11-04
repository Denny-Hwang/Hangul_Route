import { z } from 'zod';
import { addDays, daysBetween, isDateKey, weekdayOf } from '../curriculum/dates';
import { SourceSchema } from '../schemas/story';

/**
 * "This week in Korea" (F-CURR-002 §5.7, row CM-48): one micro-lesson a week, about 2 minutes and 5 items, keyed to
 * the calendar. A drop is one file, `content/weekly/<monday>.json`, named and keyed by the Monday of its ISO week on
 * the local day (Monday to Sunday in every locale, as `steadyWeeks`), so a UI-language switch or two devices on
 * different locales show one drop. Its topic is one of the 24 solar terms (dates from the Korea Astronomy and Space
 * Science Institute) or one of the seven holidays of §5.7. Drops are bundled and date-gated on the device, so they
 * work offline; their items enter review in the `week` memory shard (§4.8).
 *
 * The schema is build-time and lint-time (scripts/build-week-drops.mjs, the curriculum lint); the app reads the
 * compact chunk the build writes (`WeekDropEntry`), so nothing here is in the start bundle. Reached through
 * `@hangul-route/content-schema/week-drops`, never through the package barrel.
 */

/** The 24 solar terms in calendar order from the start of spring, by the F-CNT-002 romanization of their Korean names. */
export const SOLAR_TERMS = [
  'ipchun',
  'usu',
  'gyeongchip',
  'chunbun',
  'cheongmyeong',
  'gogu',
  'ipha',
  'soman',
  'mangjong',
  'haji',
  'soseo',
  'daeseo',
  'ipchu',
  'cheoseo',
  'baengno',
  'chubun',
  'hallo',
  'sanggang',
  'ipdong',
  'soseol',
  'daeseol',
  'dongji',
  'sohan',
  'daehan',
] as const;

/** The holidays of §5.7 (Dongji is both a solar term and a holiday; its key is the term's). */
export const WEEK_HOLIDAYS = ['seollal', 'daeboreum', 'dano', 'chilseok', 'chuseok', 'hangeul-day', 'dongji'] as const;

/** A drop's topic: a solar term, a holiday, or the 24 solar terms as a whole (`jeolgi`). */
export const WEEK_TOPICS: readonly string[] = [...new Set<string>([...SOLAR_TERMS, ...WEEK_HOLIDAYS, 'jeolgi'])];
export const WeekTopicSchema = z.string().refine((t) => WEEK_TOPICS.includes(t), { message: 'a solar term, a §5.7 holiday or jeolgi' });

/** `week:<monday>`: the drop's entity id (its overlay entries and its review items' cell). */
export const WEEK_DROP_ID_RE = /^week:(\d{4}-\d{2}-\d{2})$/;
/** The drop files, one per ISO week. */
export const WEEK_DROP_FILE_RE = /^content\/weekly\/(\d{4}-\d{2}-\d{2})\.json$/;
/** The overlay files of the drops (`content/i18n/<locale>/weekly-<first monday>.json`, one per batch of 13). */
export const WEEK_OVERLAY_NAME_RE = /^weekly-\d{4}-\d{2}-\d{2}\.json$/;

/** At most this many items a drop (§5.7: about 5; `lesson-new-load` caps new ones at 8). */
export const WEEK_DROP_MAX_ITEMS = 6;
/** The day a drop is about (the term or holiday) lies within this many days of its week. */
export const WEEK_DROP_DAY_WINDOW = 14;
/** Section 9.2: a ready drop has at least this many recorded MAR passes. */
export const WEEK_DROP_MIN_PASSES = 3;

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const DateSchema = z.string().refine(isDateKey, { message: 'a calendar date YYYY-MM-DD' });

/** A taught word or short phrase of the drop: its Korean, romanization (F-CNT-002) and English gloss. */
export const WeekDropItemSchema = z
  .object({
    /** Its overlay key (`items.<id>.gloss`): the romanization slug. */
    id: SlugSchema,
    ko: z.string().trim().min(1).max(20),
    romanization: z.string().trim().min(1).max(40),
    en: z.string().trim().min(1).max(60),
  })
  .strict();
export type WeekDropItem = z.infer<typeof WeekDropItemSchema>;

/** The multi-agent review record (§9.2): author, three parallel checkers, a reviser and a third pass. */
export const WeekDropReviewSchema = z
  .object({
    reviewedBy: z.literal('MAR'),
    reviewedAt: DateSchema,
    passes: z.number().int().min(0).max(9),
    notes: z.array(z.string().trim().min(1).max(1200)).max(12),
  })
  .strict();

export const WeekDropSchema = z
  .object({
    id: z.string().regex(WEEK_DROP_ID_RE),
    /** The Monday of the drop's ISO week. */
    weekOf: DateSchema,
    status: z.enum(['draft', 'ready']),
    kind: z.enum(['solar-term', 'holiday', 'solar-terms']),
    topic: WeekTopicSchema,
    /** The day the term or holiday falls on (KASI), within two weeks of the drop's week. */
    day: DateSchema,
    /** The stage the drop is written for (its items' stage when no grid cell teaches them). */
    stage: z.number().int().min(2).max(4),
    minutes: z.number().int().min(1).max(3),
    titleEn: z.string().trim().min(1).max(28),
    /** UI-language text; Korean only inside `{ko:}` tokens (rendered as taught Korean with its romanization). */
    noteEn: z.string().trim().min(1).max(280),
    items: z.array(WeekDropItemSchema).min(3).max(WEEK_DROP_MAX_ITEMS),
    sources: z.array(SourceSchema).min(1).max(8),
    review: WeekDropReviewSchema,
  })
  .strict()
  .superRefine((drop, ctx) => {
    const issue = (path: (string | number)[], message: string): void => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (drop.id !== `week:${drop.weekOf}`) issue(['id'], `the id of the week of ${drop.weekOf} is week:${drop.weekOf}`);
    if (weekdayOf(drop.weekOf) !== 'mon') issue(['weekOf'], 'a drop is keyed by the Monday of its ISO week');
    if (Math.abs(daysBetween(drop.weekOf, drop.day)) > WEEK_DROP_DAY_WINDOW) {
      issue(['day'], `the day a drop is about lies within ${WEEK_DROP_DAY_WINDOW} days of its week`);
    }
    if ((drop.kind === 'solar-terms') !== (drop.topic === 'jeolgi')) issue(['topic'], 'the 24 solar terms as a whole (jeolgi) are the solar-terms kind, and only they');
    if (drop.kind === 'holiday' && !(WEEK_HOLIDAYS as readonly string[]).includes(drop.topic)) issue(['topic'], 'a holiday drop names one of the §5.7 holidays');
    if (drop.kind === 'solar-term' && !(SOLAR_TERMS as readonly string[]).includes(drop.topic)) issue(['topic'], 'a solar-term drop names one of the 24 solar terms');
    const seen = new Set<string>();
    drop.items.forEach((item, i) => {
      for (const key of [`id:${item.id}`, `ko:${item.ko}`]) {
        if (seen.has(key)) issue(['items', i], `an item is listed once (${key})`);
        seen.add(key);
      }
    });
    if (drop.status === 'ready' && drop.review.passes < WEEK_DROP_MIN_PASSES) {
      issue(['review', 'passes'], `a ready drop records at least ${WEEK_DROP_MIN_PASSES} MAR passes (§9.2)`);
    }
  });
export type WeekDrop = z.infer<typeof WeekDropSchema>;

/** The Monday that starts the ISO week holding `day` (Monday to Sunday in every locale), on UTC day keys. */
export function weekMondayOf(day: string): string {
  const back = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }[weekdayOf(day)];
  return addDays(day, -back);
}

// ---- the chunk the app reads -------------------------------------------------------------------------------

/** A piece of a note as the app draws it: UI text, or taught Korean with its romanization. */
export type WeekNotePart = { text: string } | { ko: string; romanization: string };

/** Text in each UI locale; an absent es or ko shows the English. */
export interface WeekText<T> {
  en: T;
  es?: T;
  ko?: T;
}

/** One drop as the chunk holds it, with its es and ko text. */
export interface WeekDropEntry {
  id: string;
  weekOf: string;
  day: string;
  topic: string;
  minutes: number;
  title: WeekText<string>;
  note: WeekText<readonly WeekNotePart[]>;
  /** The first source, as the card back's citation prints it, and how many more there are. */
  source: { publisher: string; title: string; more: number };
  items: readonly { id: string; ko: string; romanization: string; gloss: WeekText<string> }[];
}

/** The module of the week-drop chunk (`__generated__/week-drop-chunks/week-drops.ts`). */
export interface WeekDropsChunk {
  CHUNK_HASH: string;
  WEEK_DROPS: readonly WeekDropEntry[];
}
