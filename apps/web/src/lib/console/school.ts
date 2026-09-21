import type { SchoolView } from './api';
import { COPY } from './copy';

/** School admin view models — F-SCHOOL-001 §3.3 (wireframe console/school-admin). Aggregates only. */
export const NEAR_LIMIT_RATIO = 0.9;

export function usageLine(usage: SchoolView['usage'], limits: SchoolView['limits']): string {
  const students = limits.students === null ? `students ${usage.students}` : `students ${usage.students} / ${limits.students}`;
  const teachers = limits.teachers === null ? `teachers ${usage.teachers}` : `teachers ${usage.teachers} / ${limits.teachers}`;
  return `${students} · ${teachers}`;
}

export type LimitState = 'unlicensed' | 'ok' | 'near' | 'at';

export function limitState(usage: SchoolView['usage'], limits: SchoolView['limits']): LimitState {
  if (!limits.licensed) return 'unlicensed';
  const ratios = [limits.students === null ? 0 : usage.students / limits.students, limits.teachers === null ? 0 : usage.teachers / limits.teachers];
  const worst = Math.max(...ratios);
  if (worst >= 1) return 'at';
  if (worst >= NEAR_LIMIT_RATIO) return 'near';
  return 'ok';
}

export function limitNote(state: LimitState): string | null {
  switch (state) {
    case 'unlicensed':
      return COPY.schoolNoLicence;
    case 'near':
      return COPY.schoolNearLimit;
    case 'at':
      return COPY.schoolAtLimit;
    default:
      return null;
  }
}

export function weekLine(week: SchoolView['thisWeek']): string {
  return `${week.practiced} of ${week.students} students practiced · ${week.classesWithPlan} of ${week.classes} classes have a published plan`;
}

/** Teachers who joined the school and can be assigned to a class. */
export function assignableTeachers(members: ReadonlyArray<{ memberKind: string; memberId: string; role: string; name: string; isOwner: boolean }>): Array<{ accountId: string; name: string }> {
  return members.filter((m) => m.memberKind === 'account' && (m.role === 'teacher' || m.isOwner)).map((m) => ({ accountId: m.memberId, name: m.name }));
}
