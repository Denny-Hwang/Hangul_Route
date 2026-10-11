import type { HomeworkAssignment } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { compareAssignments } from './assignment-merger';

/**
 * Grouping for the homework list (wireframe homework/list, F-HW-001 §3.4):
 * an assignment is "today" only when its targetDate is today or earlier and
 * it is not done, in precedence order (F-PLAN-002 section 3.10); later
 * targetDates are "upcoming"; completed ones are "done", most recent first.
 */
export interface AssignmentGroups {
  today: HomeworkAssignment[];
  upcoming: HomeworkAssignment[];
  done: HomeworkAssignment[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayDiff(fromKey: string, toKey: string): number {
  const from = Date.UTC(
    Number(fromKey.slice(0, 4)),
    Number(fromKey.slice(5, 7)) - 1,
    Number(fromKey.slice(8, 10)),
  );
  const to = Date.UTC(Number(toKey.slice(0, 4)), Number(toKey.slice(5, 7)) - 1, Number(toKey.slice(8, 10)));
  return Math.round((to - from) / DAY_MS);
}

export function groupAssignments(
  assignments: readonly HomeworkAssignment[],
  todayKey: string,
): AssignmentGroups {
  const today: HomeworkAssignment[] = [];
  const upcoming: HomeworkAssignment[] = [];
  const done: HomeworkAssignment[] = [];
  for (const a of assignments) {
    if (a.completedAt) done.push(a);
    else if (dayDiff(todayKey, a.targetDate) <= 0) today.push(a);
    else upcoming.push(a);
  }
  const byAssigned = (x: HomeworkAssignment, y: HomeworkAssignment): number =>
    x.assignedAt.localeCompare(y.assignedAt);
  today.sort(compareAssignments);
  upcoming.sort((x, y) => x.targetDate.localeCompare(y.targetDate) || byAssigned(x, y));
  done.sort((x, y) => (y.completedAt ?? '').localeCompare(x.completedAt ?? ''));
  return { today, upcoming, done };
}

/** Today rows shown before the neutral "more are waiting" line (F-PLAN-002 section 3.6). */
export const TODAY_LIST_MAX = 3;
/** Days of "Coming up" listed; anything later sits behind one collapsed row. */
export const UPCOMING_WINDOW_DAYS = 7;

export interface HomeworkWindow {
  /** At most `TODAY_LIST_MAX` rows, in precedence order. */
  today: HomeworkAssignment[];
  /** More rows are due today than are shown: the list says so once, with no number. */
  moreToday: boolean;
  /** Upcoming within the next `UPCOMING_WINDOW_DAYS` days. */
  comingUp: HomeworkAssignment[];
  /** Everything after that, behind the one collapsed row. */
  later: HomeworkAssignment[];
}

/** The week window of the Homework list, so a long plan never shows a list of 70 (F-PLAN-002 section 3.6). */
export function homeworkWindow(groups: AssignmentGroups, todayKey: string): HomeworkWindow {
  return {
    today: visibleToday(groups.today),
    moreToday: groups.today.length > TODAY_LIST_MAX,
    comingUp: groups.upcoming.filter((a) => dayDiff(todayKey, a.targetDate) <= UPCOMING_WINDOW_DAYS),
    later: groups.upcoming.filter((a) => dayDiff(todayKey, a.targetDate) > UPCOMING_WINDOW_DAYS),
  };
}

/**
 * The Today rows in view: the first class item and the first home item always
 * get a row (the F-TCH-001 section 3.5 stacking exception, honoured in this
 * list per F-PLAN-002 section 3.10), the rest fill up in precedence order;
 * shown in precedence order.
 */
function visibleToday(today: readonly HomeworkAssignment[]): HomeworkAssignment[] {
  if (today.length <= TODAY_LIST_MAX) return [...today];
  const keep = new Set<HomeworkAssignment>();
  const firstTeacher = today.find((a) => a.assignedBy === 'teacher');
  const firstParent = today.find((a) => a.assignedBy === 'parent');
  if (firstTeacher) keep.add(firstTeacher);
  if (firstParent) keep.add(firstParent);
  for (const a of today) {
    if (keep.size >= TODAY_LIST_MAX) break;
    keep.add(a);
  }
  return today.filter((a) => keep.has(a));
}

/**
 * Whether a Today count is shown as a number. Past the Today list cap the
 * Home line and the Hoya bubble use words with no number, so a backlog that
 * carried over never reads as a pile (F-PLAN-002 section 3.6).
 */
export function showsTodayCount(count: number): boolean {
  return count <= TODAY_LIST_MAX;
}

/**
 * How many assignments are on today's list (due today or earlier, not done):
 * the number Home shows, the same as the Homework list's Today group, so a
 * long plan never reads as "36 to do today" (F-PLAN-002 section 3.6).
 */
export function dueTodayCount(assignments: readonly HomeworkAssignment[] | undefined, todayKey: string): number {
  return groupAssignments(assignments ?? [], todayKey).today.length;
}

type Homework = Messages['learner']['homework'];

/** Child-readable relative label — never a raw ISO timestamp. The words come from `learner.homework.due`. */
export function dueLabel(targetDate: string, todayKey: string, m: Homework['due']): string {
  const diff = dayDiff(todayKey, targetDate);
  if (diff <= 0) return m.today;
  if (diff === 1) return m.tomorrow;
  return m.inDays(diff);
}

/**
 * Source label for the pill — no role jargon. The words come from `learner.homework.from`;
 * an item of the learner's own weekly plan (`route:` id, F-PLAN-002 section 3.6) reads "Your plan".
 */
export function assignedByLabel(assignment: Pick<HomeworkAssignment, 'id' | 'assignedBy'>, m: Homework['from']): string {
  return assignment.id.startsWith('route:') ? m.route : m[assignment.assignedBy];
}
