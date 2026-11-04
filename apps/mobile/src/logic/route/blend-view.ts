import { requiredQuestIds, weekdayOf, type Episode, type PracticeDaysEntry, type Weekday } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { DeriveSource } from '../homework/plan-derivation';
import { leadingBlended } from './layer';
import { refreshFor, type RefreshStep } from './refresh';

/**
 * What the learner sees of a class plan with practice days (AMENDMENTS-ROUTE-CLASS-BLEND sections 7 and 8, row BL-7;
 * design/wireframes/journey/route-class-blend.md B1 to B6). Pure: the screens pass the sources, the plan day and the
 * words. Everything here reads the leading blended plan (`leadingBlended`, the newest in force); outside the Class
 * with practice layer every reader returns null or false, so the screens draw nothing new. The screens call these
 * only while `flags.routeBlendEnabled` is on.
 */

/** Week order from Monday, as the spec's tables and the line read (a sentence, not the Sunday-first chip control). */
export const WEEK_FROM_MONDAY: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const byWeek = (days: Iterable<Weekday>): Weekday[] => WEEK_FROM_MONDAY.filter((day) => new Set(days).has(day));

/** The class weekdays and the learner's practice weekdays of the leading blended plan, in week order. */
export interface BlendWeek {
  classDays: Weekday[];
  practiceDays: Weekday[];
}

/**
 * The leading blended plan's week, or null outside the Class with practice layer. The practice days are the learner's
 * own when they moved them (`snapshot.practiceDays`, BL-OD-7), else the plan's (`blend.personal.days`), else the days
 * the generator wrote (`plannedPracticeDays`); null when none of them names the days, so the line never guesses.
 */
export function blendWeekOf(sources: readonly DeriveSource[], today: string, own?: readonly PracticeDaysEntry[]): BlendWeek | null {
  const lead = leadingBlended(sources, today);
  const params = lead?.meta?.params;
  const blend = params?.blend;
  if (lead === null || params === undefined || blend === undefined) return null;
  const learner = own?.find((entry) => entry.planId === lead.id)?.days;
  const practice = learner !== undefined && learner.length > 0 ? learner : (blend.personal.days ?? plannedPracticeDays(blend.lecture.days, blend.personal.perWeek, params.sessionDays));
  return practice === null ? null : { classDays: byWeek(blend.lecture.days), practiceDays: byWeek(practice) };
}

/**
 * The practice weekdays of a plan that does not list them (section 6.3, BL-OD-19), read back from `sessionDays`, the
 * union of class and practice days the generator writes: the non-class days in it, then, when practice outnumbers
 * them, class days in week order (practice after class), as `practiceDaysFor` fills them. Null without `sessionDays`
 * (the shared rule stays in the content-schema `blend` subpath, out of the start bundle).
 */
export function plannedPracticeDays(classDays: readonly Weekday[], perWeek: number, sessionDays: readonly string[] | undefined): Weekday[] | null {
  if (sessionDays === undefined || sessionDays.length === 0) return null;
  const free = WEEK_FROM_MONDAY.filter((day) => sessionDays.includes(day) && !classDays.includes(day));
  if (free.length >= perWeek) return free.slice(0, perWeek);
  return [...free, ...WEEK_FROM_MONDAY.filter((day) => classDays.includes(day)).slice(0, perWeek - free.length)];
}

/** The practice part of the line (section 7; BL-D README finding 1). */
export type PracticePart = { kind: 'on'; days: Weekday[] } | { kind: 'every' } | { kind: 'all-but'; day: Weekday } | { kind: 'most' };

/**
 * 1 to 3 practice days by name. With 4 or more: "every day" when class and practice together cover the week (all 7
 * practice days, or every non-class day); "every day except {weekday}" for 6 practice days whose one free weekday has
 * no class either; else "most days". So no count above 3 is ever named.
 */
export function practicePartOf(week: BlendWeek): PracticePart {
  const practice = byWeek(week.practiceDays);
  if (practice.length <= 3) return { kind: 'on', days: practice };
  const covered = new Set<Weekday>([...week.classDays, ...practice]);
  if (covered.size === 7) return { kind: 'every' };
  if (practice.length === 6) return { kind: 'all-but', day: WEEK_FROM_MONDAY.find((day) => !covered.has(day)) as Weekday };
  return { kind: 'most' };
}

/** The words of the line (`learner.route.blend`). */
export interface BlendLineCopy {
  planLine: (classDays: string, practice: string) => string;
  practiceOn: (days: string) => string;
  practiceMost: string;
  practiceAllBut: (weekday: string) => string;
  practiceEvery: string;
  dayList: (names: readonly string[]) => string;
}

/**
 * "Your class's weekly plan: class on Tuesday, practice on Wednesday, Friday, and Sunday." One string, so the screen
 * draws one text node. `dayName` gives a weekday's long name in the UI locale. No date, no count, no countdown.
 */
export function weeklyPlanLine(week: BlendWeek, copy: BlendLineCopy, dayName: (day: Weekday) => string): string {
  const part = practicePartOf(week);
  const practice =
    part.kind === 'on'
      ? copy.practiceOn(copy.dayList(part.days.map(dayName)))
      : part.kind === 'every'
        ? copy.practiceEvery
        : part.kind === 'all-but'
          ? copy.practiceAllBut(dayName(part.day))
          : copy.practiceMost;
  return copy.planLine(copy.dayList(week.classDays.map(dayName)), practice);
}

/** A plan day (YYYY-MM-DD) for each weekday, so `formatDate(locale, day, 'weekdayLong', { utc: true })` names it. */
export const WEEKDAY_DATE: Readonly<Record<Weekday, string>> = {
  mon: '2026-11-02',
  tue: '2026-11-03',
  wed: '2026-11-04',
  thu: '2026-11-05',
  fri: '2026-11-06',
  sat: '2026-11-07',
  sun: '2026-11-08',
};

/**
 * "Class today." (section 7, B2): today is a class weekday of the leading blended plan and not one of its class days
 * off. Nothing is assigned for the class and nothing asks whether the learner went.
 */
export function classTodayOf(sources: readonly DeriveSource[], today: string): boolean {
  const blend = leadingBlended(sources, today)?.meta?.params.blend;
  if (blend === undefined) return false;
  return blend.lecture.days.includes(weekdayOf(today)) && !blend.classDaysOff.includes(today);
}

/**
 * Refresh takes card (2) (section 7, B3) when today has a Refresh step and the day's lessons are done or there are
 * none: no lesson left today. It is never a to-do and has no count.
 */
export function refreshShows(step: RefreshStep | null, lessonsLeftToday: number): step is RefreshStep {
  return step !== null && lessonsLeftToday === 0;
}

/** `route.refresh_started { via }` (section 18, TELEMETRY-NAMES-2 section T): a code only, no id, cell or date. */
export function refreshStartedEvent(step: RefreshStep): TelemetryEvent {
  return { name: 'route.refresh_started', payload: { via: step.kind } };
}

/** What Profile's weekly plan row says (sections 7 and 8, B5 and B6). */
export type PlanRowBlend = 'resting' | 'instead' | null;

/**
 * `resting`: the own plan rests while the class plan has practice days ("Your own weekly plan is resting ..." with
 * See it). `instead`: no own plan, and the proposal is not offered ("Your class's weekly plan has practice days for
 * you." above Make a weekly plan, which stays reachable). Null outside the layer.
 */
export function planRowBlendOf(i: { layerWithPractice: boolean; hasOwnPlan: boolean }): PlanRowBlend {
  if (!i.layerWithPractice) return null;
  return i.hasOwnPlan ? 'resting' : 'instead';
}

/** What `cellCheckOpener` reads: the Check's switch, the cells, and the learner's done quests, test-outs and access. */
export interface CellCheckOpenInput {
  /** `cellCheck` with `memoryRecord` on for this learner (F-CURR-002 section 12.2). */
  checkOn: boolean;
  episodes: readonly Pick<Episode, 'id' | 'questIds' | 'optionalQuestIds'>[];
  doneQuestIds: ReadonlySet<string>;
  testedOut: Readonly<Record<string, string>> | undefined;
  /** F-ENT-003 access (`useQuestAccess`): a cell the learner cannot open is skipped. */
  isQuestOpen: (questId: string) => boolean;
}

/**
 * `refreshFor`'s `isCellCheckOpen` (section 6.4): the Check is on, every quest of the cell is open to the learner,
 * and its first volume is done (every required quest played) or it was tested out (F-CURR-002 row CM-21).
 */
export function cellCheckOpener(i: CellCheckOpenInput): (cellId: string) => boolean {
  return (cellId) => {
    if (!i.checkOn) return false;
    const episode = i.episodes.find((e) => e.id === cellId);
    if (episode === undefined) return false;
    const quests = requiredQuestIds(episode);
    if (quests.length === 0 || !quests.every(i.isQuestOpen)) return false;
    return i.testedOut?.[cellId] !== undefined || quests.every((q) => i.doneQuestIds.has(q));
  };
}

/**
 * The From class pill of a homework row (section 7, B2): its words are always the existing `from.teacher` value
 * (`assignedByLabel`); a lesson met in class (`fromClass`) adds the `class` glyph and the accessible name "From
 * class. You met this in class." while the switch is on. Never a second tag, so a row never shows two labels with
 * the same words.
 */
export function fromClassPillOf(i: { enabled: boolean; fromClass: boolean | undefined; label: string; metLabel: string }): {
  label: string;
  icon?: 'class';
  accessibilityLabel?: string;
} {
  if (!i.enabled || i.fromClass !== true) return { label: i.label };
  return { label: i.label, icon: 'class', accessibilityLabel: i.metLabel };
}

/** What Home draws of the class plan with practice days: "Class today." and today's Refresh step. */
export interface BlendHome {
  classToday: boolean;
  refresh: RefreshStep | null;
}

export const NO_BLEND_HOME: BlendHome = { classToday: false, refresh: null };

/** Home's pieces (B2, B3); nothing at all while the switch is off. */
export function blendHomeOf(i: { enabled: boolean; sources: readonly DeriveSource[]; today: string; isCellCheckOpen: (cellId: string) => boolean }): BlendHome {
  if (!i.enabled) return NO_BLEND_HOME;
  return { classToday: classTodayOf(i.sources, i.today), refresh: refreshFor(i.sources, i.today, { isCellCheckOpen: i.isCellCheckOpen }) };
}

/** Where a Refresh tap goes (section 6.4): the cell's Cell Check, else Daily Review (with Keep going after it). */
export type RefreshRoute = { name: 'CellCheck'; params: { cellId: string; mode: 'check' } } | { name: 'DailyReview' };

export function refreshRouteOf(step: RefreshStep): RefreshRoute {
  return step.kind === 'cell-check' ? { name: 'CellCheck', params: { cellId: step.cellId, mode: 'check' } } : { name: 'DailyReview' };
}
