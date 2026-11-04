import { WEEKDAYS, addDays, todayFor, weekdayOf, type ReportSummary, type Weekday } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { PlanSave, PlanView, TransferList } from './api';
import { classLineWords, type ClassLine } from './parent-home';
import { livePublished } from './plans';
import { readItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';

/*
 * Class days and practice days in the family views (AMENDMENTS-ROUTE-CLASS-BLEND sections 8 and 11, BL-OD-6 and
 * BL-OD-11, row BL-9; wireframe design/wireframes/parent/route-class-blend.md P1 and P2, mock
 * design/screens/route-blend/mock/parent.html). Pure: the family home and the report page draw what these say.
 *
 * - P1, the child card: GX-4's class line gains how the class meets ("In: {class} · class on {days}, practice {n} times a
 *   week"), on the same row; the class's own days, never the child's. With two or more classes the GX-4 line stays as
 *   it is (the wireframe's default). While a whole-family weekly plan reaches the child, the card names the class's
 *   practice days and offers **Pause the family weekly plan while class runs** (the plan's `targetLearnerIds` leave the
 *   child out, an existing field, no new server state); **Resume the family weekly plan** puts the child back. Plans made
 *   for some of the children are never touched (`familyPlanStep`).
 * - P2, the grown-up report: "Practiced on {n} days this week" with a 7-mark strip that only fills. Never drawn at 0,
 *   never with a denominator, never for a class viewer, never for a week other than the learner's current one.
 */

/** How a class with practice days meets (the Worker's `meeting` on a family's class option). */
export interface ClassMeeting {
  classDays: Weekday[];
  perWeek: number;
  practiceDays: Weekday[];
}

const isWeekdayList = (value: unknown, max: number): value is Weekday[] =>
  Array.isArray(value) && value.length >= 1 && value.length <= max && value.every((d) => (WEEKDAYS as readonly unknown[]).includes(d)) && new Set(value).size === value.length;

/** A meeting as sent, checked whole: anything else (an older Worker, a newer shape) reads as none. */
export function readMeeting(raw: unknown): ClassMeeting | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (!isWeekdayList(m.classDays, 5) || !isWeekdayList(m.practiceDays, 7)) return null;
  if (typeof m.perWeek !== 'number' || !Number.isInteger(m.perWeek) || m.perWeek < 1 || m.perWeek > 7) return null;
  return { classDays: m.classDays, perWeek: m.perWeek, practiceDays: m.practiceDays };
}

/** The meeting of the child's one class, or null (no class, two or more, a class without practice days, a skipped read). */
export function meetingOf(learnerId: string, transfers: TransferList | null): ClassMeeting | null {
  const option = transfers?.options?.find((o) => o.learnerId === learnerId);
  if (!option || option.classes.length !== 1) return null;
  return readMeeting(option.classes[0]?.meeting);
}

/** Monday first, as the console lists weekdays. */
const MONDAY_FIRST: readonly Weekday[] = [...WEEKDAYS.slice(1), WEEKDAYS[0]] as Weekday[];

/** A whole weekday name from a fixed week that starts on Sunday 11 October 2026. */
function weekdayName(day: Weekday, locale: UiLocale): string {
  return formatDate(locale, addDays('2026-10-11', WEEKDAYS.indexOf(day)), 'weekdayLong', { utc: true });
}

/**
 * Weekday names as one phrase for a weekly habit, in week order, by the locale's `weekdayList`: "Wednesday, Friday,
 * and Sunday"; "miércoles, viernes y domingos" (es takes the plural names after "los": only sábado and domingo change);
 * ko joins the names with a middle dot (see the unit test), BL-D README findings 2 and 11.
 */
export function weekdayHabit(days: readonly Weekday[], locale: UiLocale = DEFAULT_LOCALE): string {
  const names = MONDAY_FIRST.filter((d) => days.includes(d)).map((d) => weekdayName(d, locale));
  return getMessages(locale).console.curriculum.blend.family.weekdayList(names);
}

/**
 * The child card's class line (P1): GX-4's words, with the meeting appended for one class with practice days while
 * `enabled` (`routeBlendEnabled()`).
 */
export function classLineWithMeeting(line: ClassLine, meeting: ClassMeeting | null, enabled: boolean, locale: UiLocale = DEFAULT_LOCALE): string[] {
  if (!enabled || meeting === null || line.kind !== 'one') return classLineWords(line, locale);
  return [getMessages(locale).console.curriculum.blend.family.classLine(line.name, weekdayHabit(meeting.classDays, locale), meeting.perWeek)];
}

/** What the card offers about the family weekly plan while the child's class has practice days (BL-OD-6). */
export type FamilyPlanStep =
  /** The family's live whole-family plans that reach the child: Pause leaves the child out of each. */
  | { kind: 'pause'; plans: PlanView[] }
  /** The live plans paused for this child (every other family learner, not this one): Resume puts the child back. */
  | { kind: 'resume'; plans: PlanView[] };

/** The plan's targets that are still family learners (a learner who left the family since never blocks a match). */
const familyTargets = (targets: readonly string[], familyLearnerIds: readonly string[]): string[] => [...new Set(targets.filter((id) => familyLearnerIds.includes(id)))];

const sameLearners = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Pause or Resume, or nothing: only with a class with practice days, a live family weekly plan, the right to write plans
 * and the family's learners read (the shapes below are told apart by them).
 *
 * - **Pause** takes the whole-family plans only: those for everyone (`null`), or naming every family learner (and so
 *   this child) in a family of two or more. A plan made for some of the children, or for this child alone, is a grown-up's
 *   choice for that child and is never touched.
 * - **Resume** takes only plans of the shape Pause leaves: every other family learner and not this child. In a family of
 *   two that shape is also "a plan made for the sibling alone", so there Resume takes only the plans this browser paused
 *   for this child (`pausedHere`): a sibling's own plan is never pushed to this child. With no plan of that shape, no
 *   Resume is offered.
 */
export function familyPlanStep(
  learnerId: string,
  meeting: ClassMeeting | null,
  plans: readonly PlanView[] | undefined,
  canWrite: boolean,
  familyLearnerIds: readonly string[],
  pausedHere: readonly string[] = [],
): FamilyPlanStep | null {
  if (meeting === null || plans === undefined || !canWrite || !familyLearnerIds.includes(learnerId)) return null;
  const live = livePublished(plans);
  const others = familyLearnerIds.filter((id) => id !== learnerId);
  const wholeFamily = live.filter((p) => p.targetLearnerIds === null || (others.length > 0 && familyLearnerIds.every((id) => p.targetLearnerIds?.includes(id))));
  if (wholeFamily.length > 0) return { kind: 'pause', plans: wholeFamily };
  const paused = live.filter(
    (p) =>
      p.targetLearnerIds !== null &&
      !p.targetLearnerIds.includes(learnerId) &&
      sameLearners(familyTargets(p.targetLearnerIds, familyLearnerIds), others) &&
      (others.length !== 1 || pausedHere.includes(p.id)),
  );
  return paused.length > 0 ? { kind: 'resume', plans: paused } : null;
}

/**
 * The save of one plan for a step: the same plan, items and meta (absent meta keeps the stored one), with the child left
 * out (`pause`) or put back (`resume`). Resume only ever meets the shape Pause left (every other family learner), so
 * putting the child back covers the whole family and targets everyone again (`null`), as a family weekly plan is made.
 */
export function familyPlanSave(plan: PlanView, learnerId: string, familyLearnerIds: readonly string[], kind: FamilyPlanStep['kind']): PlanSave {
  const current = plan.targetLearnerIds ?? [...familyLearnerIds];
  let targets: string[] | null;
  if (kind === 'pause') targets = current.filter((id) => id !== learnerId);
  else {
    const back = current.includes(learnerId) ? [...current] : [...current, learnerId];
    targets = familyLearnerIds.length > 0 && familyLearnerIds.every((id) => back.includes(id)) ? null : back;
  }
  return { id: plan.id, title: plan.title, items: plan.items, targetLearnerIds: targets, publish: true };
}

/**
 * The plans this browser paused for one child, by family (the family-of-two case of `familyPlanStep`). Kept in local
 * storage under one key, plan ids only (no names); unreadable storage reads as none, so Resume then simply is not offered
 * in a family of two and the plan stays editable on its own page.
 */
const PAUSED_KEY = 'hr.console.familyPlanPaused';

type PausedMap = Record<string, string[]>;

const pausedKey = (familyId: string, learnerId: string): string => `${familyId}|${learnerId}`;

function readPausedMap(storage: KeyValueStorage | null): PausedMap {
  const raw = readItem(storage, PAUSED_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: PausedMap = {};
    for (const [key, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) out[key] = ids as string[];
    }
    return out;
  } catch {
    return {};
  }
}

export function pausedPlanIds(storage: KeyValueStorage | null, familyId: string, learnerId: string): string[] {
  return readPausedMap(storage)[pausedKey(familyId, learnerId)] ?? [];
}

/** Adds (`pause`) or drops (`resume`) plan ids for one child; false when the storage refused. */
export function rememberPausedPlans(storage: KeyValueStorage | null, familyId: string, learnerId: string, planIds: readonly string[], kind: FamilyPlanStep['kind']): boolean {
  const map = readPausedMap(storage);
  const key = pausedKey(familyId, learnerId);
  const current = map[key] ?? [];
  const next = kind === 'pause' ? [...new Set([...current, ...planIds])] : current.filter((id) => !planIds.includes(id));
  if (next.length > 0) map[key] = next;
  else delete map[key];
  return writeItem(storage, PAUSED_KEY, JSON.stringify(map));
}

/** The card's line naming the class's practice days ("Mina's class has practice days on Wednesday, Friday, and Sunday."). */
export function classHasPracticeLine(name: string, meeting: ClassMeeting, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.curriculum.blend.family.classHasPractice(name, weekdayHabit(meeting.practiceDays, locale));
}

/** The report's practice-week line and its strip (P2): `filled` of 7 marks fill from the start. */
export interface PracticeWeekView {
  line: string;
  filled: number;
}

const mondayOf = (day: string): string => addDays(day, -MONDAY_FIRST.indexOf(weekdayOf(day)));

/**
 * The practice-week line for the report (P2), or null: a family viewer only, the week tab at the current week only, a
 * count of 1 or more only, and only while the summary was made in the learner's current week (Monday to Sunday on the
 * learner's own days), so a count from an earlier week never reads as this week's.
 */
export function practiceWeekView(
  input: { summary: ReportSummary | null; viewer: 'family' | 'class'; period: string; at: string | null; now: Date },
  locale: UiLocale = DEFAULT_LOCALE,
): PracticeWeekView | null {
  const { summary } = input;
  if (input.viewer !== 'family' || input.period !== 'week' || input.at !== null || !summary) return null;
  const n = summary.practiceWeek?.practicedDays;
  const activity = summary.activity;
  if (n === undefined || n < 1 || n > 7 || !activity) return null;
  if (mondayOf(activity.asOf) !== mondayOf(todayFor(input.now, activity.tz))) return null;
  return { line: getMessages(locale).console.curriculum.blend.report.practiceWeek(n), filled: n };
}
