// The blended generator and its re-pace (`regenerateFrom` shift with `classDay` / `params`) install themselves on import
// (rows BL-2, BL-3): only the console bundles that plan class days with practice days carry them.
import '@hangul-route/content-schema/blend-generator';
import { cyclesOf, practiceDaysFor } from '@hangul-route/content-schema/blend';
import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  WEEKDAYS,
  addDays,
  regenerateFrom,
  type Blend,
  type Catalog,
  type CurriculumDraft,
  type CurriculumMeta,
  type CurriculumParamsInput,
  type DaysOff,
  type PlanItem,
  type StoredCurriculumParams,
  type WeekKind,
  type WeekMeta,
  type Weekday,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, formatNumber, getMessages, type UiLocale } from '@hangul-route/i18n';
import { itemCategory, itemTitle } from '@/data/catalog';
import {
  PRACTICE_MINUTES_DEFAULT,
  blendOf,
  classDaysOf,
  classOnlyMinutes,
  dayText,
  meetingProblem,
  practiceCountOf,
  repaceResultOf,
  thisWeekOf,
  weekdayLabel,
  type RepaceInput,
  type RepaceResult,
  type WeekItem,
  type WizardState,
} from './curriculum';

/**
 * Class days and practice days on the console (AMENDMENTS-ROUTE-CLASS-BLEND sections 10.1, 10.2 and 14; wireframe
 * `console/curriculum-wizard.md` section "Meeting", M1 to M4; row BL-4). Pure: the meeting block's suggested practice
 * days, the preview header and its cycle table, the readout's class lines, and the three plan changes (**Move this
 * class day**, **Add practice days**, **Stop practice days**), each a `regenerateFrom` shift on the same plan id. Every
 * number comes from the generator's draft or the stored plan, never a constant; every word from
 * `console.curriculum.blend`. Counts are scheduled sessions and class totals: nothing here reads a learner.
 */

/** Monday-first week order: the console's weekday lists (section 10.1, "Practice on Wed, Fri, Sun"). */
const mondayFirst = (day: Weekday): number => (WEEKDAYS.indexOf(day) + 6) % 7;
const inWeekOrder = (days: readonly Weekday[]): Weekday[] => [...new Set(days)].sort((a, b) => mondayFirst(a) - mondayFirst(b));

/** A whole weekday name ("Tuesday") from a fixed week that starts on Sunday 11 October 2026. */
export function weekdayLong(day: Weekday, locale: UiLocale = DEFAULT_LOCALE): string {
  return formatDate(locale, addDays('2026-10-11', WEEKDAYS.indexOf(day)), 'weekdayLong', { utc: true });
}

/** "Tue, Nov 10": a date with its short weekday. */
export function classDateText(key: string, locale: UiLocale = DEFAULT_LOCALE): string {
  return `${formatDate(locale, key, 'weekday', { utc: true })}, ${dayText(key, locale)}`;
}

/** The practice weekdays of the meeting block: the teacher's own (Change days), else `practiceDaysFor`; none with 0. */
export function practiceDaysOfState(state: Pick<WizardState, 'lectureDays' | 'practicePerWeek' | 'practiceDays'>): Weekday[] {
  const perWeek = practiceCountOf(state);
  const classDays = classDaysOf(state);
  if (perWeek < 1) return [];
  if (state.practiceDays !== null && state.practiceDays !== undefined) return inWeekOrder(state.practiceDays);
  return classDays.length === 0 ? [] : inWeekOrder(practiceDaysFor(classDays, perWeek));
}

/**
 * The suggested-days line (section 10.1): "Practice on Wed, Fri, Sun"; "Practice every day" when practice covers every
 * day without a class; with class days that also hold practice, "Practice every day, also after class on Tuesday"
 * (BL-OD-19). Null with no practice day.
 */
export function practiceLine(classDays: readonly Weekday[], practiceDays: readonly Weekday[], locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (practiceDays.length === 0) return null;
  const words = getMessages(locale).console.curriculum.blend.practice;
  const free = WEEKDAYS.filter((day) => !classDays.includes(day));
  const everyFreeDay = free.length > 0 && free.every((day) => practiceDays.includes(day));
  if (!everyFreeDay) return words.suggested(inWeekOrder(practiceDays).map((day) => weekdayLabel(day, locale)).join(', '));
  const afterClass = inWeekOrder(practiceDays.filter((day) => classDays.includes(day)));
  return afterClass.length === 0 ? words.everyDay : `${words.everyDay}, ${words.afterClass(afterClass.map((day) => weekdayLong(day, locale)).join(', '))}`;
}

/** A class plan's blend, read from stored params (absent on a solo or Class only plan). */
export const blendOfPlan = (meta: Pick<CurriculumMeta, 'params'>): Blend | null => meta.params.blend ?? null;

const isOff = (date: string, daysOff: readonly DaysOff[]): boolean => daysOff.some((range) => range.from <= date && date <= range.to);

/** A route's class cycle with what days off remove (section 6.1). */
interface HeldCycle {
  classDate: string;
  endDate: string;
  /** False on a plan day off or a class day off (`blend.classDaysOff`). */
  classHeld: boolean;
  practiceDates: string[];
}

function heldCycles(params: Pick<StoredCurriculumParams, 'startDate' | 'daysOff'> & { blend: Blend }, weekCount: number): HeldCycle[] {
  const { blend } = params;
  const practice = blend.personal.days ?? practiceDaysFor(blend.lecture.days, blend.personal.perWeek);
  const route = cyclesOf({ startDate: params.startDate, weeks: Math.max(1, weekCount), lectureDays: blend.lecture.days, practiceDays: practice });
  const off = params.daysOff ?? [];
  const classOff = new Set(blend.classDaysOff ?? []);
  return route.cycles.map((cycle) => ({
    classDate: cycle.classDate,
    endDate: cycle.endDate,
    classHeld: !isOff(cycle.classDate, off) && !classOff.has(cycle.classDate),
    practiceDates: cycle.practiceDates.filter((date) => !isOff(date, off)),
  }));
}

const weekItemOf = (item: PlanItem, index: number, source: Catalog, locale: UiLocale): WeekItem => ({
  kind: item.kind,
  id: item.id,
  category: itemCategory(item.kind, item.id, source),
  title: itemTitle(item.kind, item.id, source, locale),
  date: item.targetDate ?? null,
  index,
});

const mean = (counts: readonly number[]): number => (counts.length === 0 ? 0 : counts.reduce((sum, n) => sum + n, 0) / counts.length);

/** Items per date that holds any, by a date key of each item. */
function perDate(items: readonly PlanItem[], keyOf: (item: PlanItem) => string | undefined): number[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()];
}

/** The preview's header lines (section 10.2). */
export interface BlendPreviewText {
  header: string;
  perDay: string;
  average: string;
  start: string;
  /** With **Keep the average** and weeks added: the route's new last day. */
  endsOn: string | null;
}

/**
 * The preview header from the draft (section 10.2): sessions a week (`L + P`, "on all 7 days" when some class days also
 * hold practice), the lessons a class day teaches and a practice day plays (averaged over the days that hold any, from
 * the draft's items, never a constant), the totals and averages (`stats.sessionsPerTeachingWeek`, and
 * `stats.sessionsPerCalendarWeek` when it differs), the first class day, and the end date Keep the average moved.
 * Null for a draft without class days.
 */
export function blendPreviewText(draft: CurriculumDraft, locale: UiLocale = DEFAULT_LOCALE): BlendPreviewText | null {
  const blend = draft.params.blend;
  const first = draft.weeks[0];
  const last = draft.weeks[draft.weeks.length - 1];
  if (!blend || !draft.stats.byTrack || first === undefined || last === undefined) return null;
  const words = getMessages(locale).console.curriculum.blend.preview;
  const L = blend.lecture.days.length;
  const P = blend.personal.perWeek;
  const classItems = Math.max(1, Math.round(mean(perDate(draft.items, (item) => item.lectureDate))));
  const practiceItems = Math.max(1, Math.round(mean(perDate(draft.items, (item) => item.targetDate))));
  const teaching = draft.stats.sessionsPerTeachingWeek ?? L + P;
  const calendar = draft.stats.sessionsPerCalendarWeek ?? teaching;
  return {
    header: words.header(L + P, L, blend.lecture.minutes, P, blend.personal.minutes, L + P > 7),
    perDay: words.perDay(classItems, practiceItems),
    average: words.average(draft.stats.sessions, formatNumber(locale, teaching), calendar === teaching ? null : formatNumber(locale, calendar)),
    start: words.start(classDateText(first.startDate, locale)),
    endsOn: blend.keepAverage && draft.weeks.length > draft.params.weeks ? words.endsOn(classDateText(addDays(last.startDate, 6), locale)) : null,
  };
}

/** One practice date of a cycle row: its lessons (practice-only ones flagged) and whether it holds a Refresh. */
export interface PracticeCell {
  date: string;
  items: (WeekItem & { practiceOnly: boolean })[];
  refresh: boolean;
}

/** One class cycle of the cycle table (section 10.2; wireframe M3). */
export interface CycleRow {
  /** The route week that holds the class date (the row header). */
  week: number;
  kind: WeekKind;
  classDate: string;
  endDate: string;
  classHeld: boolean;
  classItems: WeekItem[];
  practice: PracticeCell[];
}

/**
 * The cycle table of a blended draft or plan: one row per class cycle, a **Class** cell (the class date and the lessons
 * whose `lectureDate` it is) and a **Practice** cell (each practice date, its lessons, practice-only ones flagged, and
 * Refresh where the plan lists one). Days off leave a date out; a class day off keeps its row.
 */
export function cycleRows(
  plan: { params: Pick<StoredCurriculumParams, 'startDate' | 'daysOff' | 'blend'>; weeks: readonly WeekMeta[]; items: readonly PlanItem[]; refresh?: readonly { date: string }[] | undefined },
  locale: UiLocale = DEFAULT_LOCALE,
  source: Catalog = CATALOG,
): CycleRow[] {
  const blend = plan.params.blend;
  if (!blend) return [];
  const refresh = new Set((plan.refresh ?? []).map((entry) => entry.date));
  const weekOf = (date: string): WeekMeta | undefined => plan.weeks.find((week) => week.startDate <= date && date <= addDays(week.startDate, 6));
  const entries = plan.items.map((item, index) => ({ item, entry: weekItemOf(item, index, source, locale) }));
  return heldCycles({ ...plan.params, blend }, plan.weeks.length).map((cycle) => {
    const week = weekOf(cycle.classDate);
    return {
      week: week?.index ?? 0,
      kind: week?.kind ?? 'learn',
      classDate: cycle.classDate,
      endDate: cycle.endDate,
      classHeld: cycle.classHeld,
      classItems: entries.filter(({ item }) => item.lectureDate === cycle.classDate).map(({ entry }) => entry),
      practice: cycle.practiceDates.map((date) => ({
        date,
        items: entries.filter(({ item }) => item.targetDate === date).map(({ item, entry }) => ({ ...entry, practiceOnly: item.lectureDate === undefined })),
        refresh: refresh.has(date),
      })),
    };
  });
}

/** The scheduled class dates of a stored blended plan: every class date of the route, less days off and class days off. */
export function scheduledClassDates(meta: CurriculumMeta): string[] {
  const blend = blendOfPlan(meta);
  if (!blend) return [];
  return heldCycles({ ...meta.params, blend }, meta.weeks.length)
    .filter((cycle) => cycle.classHeld)
    .map((cycle) => cycle.classDate);
}

/** "Class days so far: {n} of {N}" (section 10.2): scheduled class dates up to today against all of them. Never attendance. */
export function classDaysSoFar(meta: CurriculumMeta, today: string): { n: number; total: number } | null {
  const dates = scheduledClassDates(meta);
  return dates.length === 0 ? null : { n: dates.filter((date) => date <= today).length, total: dates.length };
}

/** The class day **Move this class day** moves: the next scheduled class date on or after today, or null after the last. */
export function nextClassDay(meta: CurriculumMeta, today: string): string | null {
  return scheduledClassDates(meta).find((date) => date >= today) ?? null;
}

/** This week's class days with their lessons, for the readout's This week block (section 10.2: class lessons first). */
export function thisWeekClasses(meta: CurriculumMeta, items: readonly PlanItem[], today: string, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): { date: string; items: WeekItem[] }[] {
  const where = thisWeekOf(meta.weeks, today);
  if (where.status !== 'in') return [];
  const end = addDays(where.week.startDate, 6);
  return scheduledClassDates(meta)
    .filter((date) => where.week.startDate <= date && date <= end)
    .map((date) => ({ date, items: items.flatMap((item, index) => (item.lectureDate === date ? [weekItemOf(item, index, source, locale)] : [])) }));
}

/** The class's default practice weekdays of a stored plan (the readout never shows a learner's own, section 10.2). */
export function planPracticeDays(meta: CurriculumMeta): Weekday[] {
  const blend = blendOfPlan(meta);
  if (!blend) return [];
  return inWeekOrder(blend.personal.days ?? practiceDaysFor(blend.lecture.days, blend.personal.perWeek));
}

/**
 * **Move this class day** (section 10.2, BL-OD-8): `regenerateFrom(plan, today, catalog, { mode: 'shift', classDay })`
 * (row BL-3). That class day's lessons and every later class day's move to the following class days; practice dates
 * follow; nothing done is moved. Throws on a plan the generator cannot read (the caller says so).
 */
export function moveClassDay(plan: RepaceInput, classDay: string, today: string, nowIso: string, source: Catalog = CATALOG): RepaceResult {
  const draft = regenerateFrom({ meta: plan.meta, items: plan.items }, today, source, { mode: 'shift', classDay });
  return repaceResultOf(plan, draft, today, nowIso);
}

type ShiftParams = Omit<CurriculumParamsInput, 'completedQuestIds'>;

const withoutCadence = (params: StoredCurriculumParams): ShiftParams => {
  const { sessionDays: _days, blend: _blend, ...rest } = params;
  return rest;
};

/** The params of **Add practice days to this plan** (section 14) from the meeting block's state, or null while it is not ready. */
export function addPracticeParams(params: StoredCurriculumParams, state: WizardState): ShiftParams | null {
  const blend = blendOf({ ...state, audience: 'class' });
  if (!blend || meetingProblem(state) !== null) return null;
  return { ...withoutCadence(params), sessionsPerWeek: Math.min(7, blend.lecture.days.length + blend.personal.perWeek), minutesPerSession: blend.personal.minutes, blend };
}

/** Whether the meeting block's sessions fit the plan's weeks (section 6.6: at most 260). */
export function practiceFits(params: Pick<StoredCurriculumParams, 'weeks'>, state: WizardState): boolean {
  return params.weeks * (classDaysOf(state).length + practiceCountOf(state)) <= CURRICULUM_MAX_ITEMS;
}

/** The params of **Stop practice days** (section 14): the class days become the plan's session days, without `blend`. */
export function stopPracticeParams(params: StoredCurriculumParams): ShiftParams | null {
  const blend = params.blend;
  if (!blend) return null;
  const days = WEEKDAYS.filter((day) => blend.lecture.days.includes(day));
  return { ...withoutCadence(params), sessionsPerWeek: days.length, sessionDays: days, minutesPerSession: classOnlyMinutes(blend.lecture.minutes) };
}

/** Add or Stop practice days: the future laid again under `params` on the same plan id (`regenerateFrom` shift, BL-3). */
export function changePractice(plan: RepaceInput, params: ShiftParams, today: string, nowIso: string, source: Catalog = CATALOG): RepaceResult {
  const draft = regenerateFrom({ meta: plan.meta, items: plan.items }, today, source, { mode: 'shift', params });
  return repaceResultOf(plan, draft, today, nowIso);
}

/**
 * The meeting block prefilled for **Add practice days** (section 14): the class day is the plan's one session day when
 * it has exactly one; with more, which one was the homework day is not recoverable, so the class days start empty and
 * the teacher picks. One practice day (the old homework day maps onto it, section 10.1), overlap, 10 minutes.
 */
export function addPracticePrefill(params: Pick<StoredCurriculumParams, 'sessionDays'>): Partial<WizardState> {
  const days = params.sessionDays ?? [];
  return {
    audience: 'class',
    lectureDays: days.length === 1 ? [...days] : [],
    lectureMinutes: 30,
    practicePerWeek: 1,
    practiceMinutes: PRACTICE_MINUTES_DEFAULT,
    practiceDays: null,
    blendMode: 'overlap',
    keepAverage: false,
  };
}
