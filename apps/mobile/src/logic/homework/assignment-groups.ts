import type { HomeworkAssignment } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Grouping for the homework list (wireframe homework/list, F-HW-001 §3.4):
 * an assignment is "today" only when its targetDate is today or earlier and
 * it is not done; later targetDates are "upcoming"; completed ones are
 * "done", most recent first.
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
  today.sort(byAssigned);
  upcoming.sort((x, y) => x.targetDate.localeCompare(y.targetDate) || byAssigned(x, y));
  done.sort((x, y) => (y.completedAt ?? '').localeCompare(x.completedAt ?? ''));
  return { today, upcoming, done };
}

type Homework = Messages['learner']['homework'];

/** Child-readable relative label — never a raw ISO timestamp. The words come from `learner.homework.due`. */
export function dueLabel(targetDate: string, todayKey: string, m: Homework['due']): string {
  const diff = dayDiff(todayKey, targetDate);
  if (diff <= 0) return m.today;
  if (diff === 1) return m.tomorrow;
  return m.inDays(diff);
}

/** Caregiver source label for the pill — no role jargon. The words come from `learner.homework.from`. */
export function assignedByLabel(assignedBy: HomeworkAssignment['assignedBy'], m: Homework['from']): string {
  return m[assignedBy];
}
