import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP } from '@hangul-route/content-schema';
import type { SchoolView } from './api';

/**
 * School admin view models — F-SCHOOL-001 §3.3 (wireframe console/school-admin). Aggregates only.
 * The words come from `console.school` in `locale` (F-I18N-001 PR 10c).
 */
export const NEAR_LIMIT_RATIO = 0.9;

export function usageLine(usage: SchoolView['usage'], limits: SchoolView['limits'], locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.school.licence.usage(usage.students, limits.students, usage.teachers, limits.teachers);
}

export type LimitState = 'unlicensed' | 'unlicensedAt' | 'ok' | 'near' | 'at' | 'over';

/**
 * How full the school is ([SA] AMENDMENTS-SEATS-ADMINS section 3.4). Every school holds up to `limits.students`
 * distinct students (50 unlicensed or licensed, a contract's seats; SA-1), so an unlicensed school can be at its
 * cap too (`unlicensedAt`). More students than the cap, kept from before the limit, is `over` (SA-D7). A Worker older
 * than SA-1 sends no student cap for an unlicensed school: it reads `unlicensed`, as before.
 */
export function limitState(usage: SchoolView['usage'], limits: SchoolView['limits']): LimitState {
  const cap = limits.students;
  if (cap !== null && usage.students > cap) return 'over';
  if (!limits.licensed) return cap !== null && usage.students >= cap ? 'unlicensedAt' : 'unlicensed';
  const ratios = [cap === null ? 0 : usage.students / cap, limits.teachers === null ? 0 : usage.teachers / limits.teachers];
  const worst = Math.max(...ratios);
  if (worst >= 1) return 'at';
  if (worst >= NEAR_LIMIT_RATIO) return 'near';
  return 'ok';
}

/**
 * The note under the school's seats: no licence (`schoolNoLicenceCaps`, the free class cap and the school cap),
 * an unlicensed school at its cap (`seats.school.at`), a covered school at its cap (`schoolAtLimit`), or over it
 * (`seats.school.over`). `seats` gives the numbers; without it the content-schema caps stand in.
 */
export function limitNote(state: LimitState, locale: UiLocale = DEFAULT_LOCALE, seats: { students: number; cap: number | null } | null = null): string | null {
  const c = getMessages(locale).console;
  const cap = seats?.cap ?? SCHOOL_LEARNER_CAP;
  switch (state) {
    case 'unlicensed':
      return c.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, cap);
    case 'unlicensedAt':
      return c.seats.school.at(cap);
    case 'over':
      return c.seats.school.over(seats?.students ?? cap, cap);
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

/**
 * Grown-ups of the school who can be assigned to a class: its teachers, its owner and ([SA] AMENDMENTS-SEATS-ADMINS
 * section 6.1) its administrators, whom the Worker's `POST /:id/members` accepts as a class's teacher too.
 */
export function assignableTeachers(members: ReadonlyArray<{ memberKind: string; memberId: string; role: string; name: string; isOwner: boolean }>): Array<{ accountId: string; name: string }> {
  return members.filter((m) => m.memberKind === 'account' && (m.role === 'teacher' || m.role === 'admin' || m.isOwner)).map((m) => ({ accountId: m.memberId, name: m.name }));
}
