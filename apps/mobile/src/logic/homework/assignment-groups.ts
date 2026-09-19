import type { HomeworkAssignment } from '@hangul-route/content-schema';

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

/** Child-readable relative label — never a raw ISO timestamp. */
export function dueLabel(targetDate: string, todayKey: string): string {
  const diff = dayDiff(todayKey, targetDate);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

/** Caregiver source label for the pill — English, no role jargon. */
export function assignedByLabel(assignedBy: HomeworkAssignment['assignedBy']): string {
  switch (assignedBy) {
    case 'parent':
      return 'From home';
    case 'teacher':
      return 'From class';
    default:
      return 'From Hoya';
  }
}
