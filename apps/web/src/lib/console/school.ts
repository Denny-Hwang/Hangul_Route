import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { FREE_CLASS_STUDENT_CAP } from '@hangul-route/content-schema';
import type { SchoolView } from './api';

/**
 * School admin view models — F-SCHOOL-001 §3.3 (wireframe console/school-admin). Aggregates only.
 * The words come from `console.school` in `locale` (F-I18N-001 PR 10c).
 */
export const NEAR_LIMIT_RATIO = 0.9;

export function usageLine(usage: SchoolView['usage'], limits: SchoolView['limits'], locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.school.licence.usage(usage.students, limits.students, usage.teachers, limits.teachers);
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

export function limitNote(state: LimitState, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const c = getMessages(locale).console;
  switch (state) {
    case 'unlicensed':
      return c.schoolNoLicence(FREE_CLASS_STUDENT_CAP);
    case 'near':
      return c.schoolNearLimit;
    case 'at':
      return c.schoolAtLimit;
    default:
      return null;
  }
}

export function weekLine(week: SchoolView['thisWeek'], locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.school.week.line(week.practiced, week.students, week.classesWithPlan, week.classes);
}

/** Teachers who joined the school and can be assigned to a class. */
export function assignableTeachers(members: ReadonlyArray<{ memberKind: string; memberId: string; role: string; name: string; isOwner: boolean }>): Array<{ accountId: string; name: string }> {
  return members.filter((m) => m.memberKind === 'account' && (m.role === 'teacher' || m.isOwner)).map((m) => ({ accountId: m.memberId, name: m.name }));
}
