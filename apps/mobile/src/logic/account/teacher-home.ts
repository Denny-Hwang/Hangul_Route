import type { AccountRoster, AccountSchoolPage, AccountSpaceItem } from './account-data';
import { orderLearners, orderSpaces } from './order';

/**
 * F-AUTH-004 sections 8.1, 8.3 and 8.4 (row NS-6; design `homes.md` boards 8 to 14, D13; anti-shame, CLAUDE.md
 * section 1): the Teacher and School homes, the class page and the school page, in rules. Pure: the screens
 * (`TeacherHome.native.tsx`, `AccountSpaceScreen.native.tsx`, `AccountSchoolScreen.native.tsx`) draw what these return.
 *
 * - **Classes**: every class space where the account is `owner` or `teacher`, live ones first, then archived ones, each
 *   oldest first (`orderSpaces`), whatever order the server sent. The count is the spaces item's `counts.learners`
 *   (no roster read on the home).
 * - **Schools**: every school space where the account is `owner`, `admin` or `teacher`, in the same order. Only an
 *   owner or an admin opens the school page (it needs `space.manage`, `routes/school.ts`); a school member with role
 *   `teacher` gets the school as plain text, never a link that would answer 403.
 * - **The attention line** (section 8.3): a live class whose item carries a count above 0 says how many wait for an
 *   OK, as plain text with no action (no place is named where the OK is given; NS-0b accepted it).
 * - **The school focus** (section 8.4): the School use opens this page with the screen reader's focus on the first
 *   school row; an account that holds no school any more (a stale uses record) reads `noSchool` above it.
 * - **Lists** keep join and creation order, never activity, minutes or progress (section 8.1).
 */

/** The classes of the Teacher home, in their fixed order. */
export function classesOf(items: readonly AccountSpaceItem[]): AccountSpaceItem[] {
  return orderSpaces(items.filter((item) => item.space.kind === 'class' && (item.role === 'owner' || item.role === 'teacher')));
}

/** The schools of the Teacher home, in their fixed order. */
export function schoolsOf(items: readonly AccountSpaceItem[]): AccountSpaceItem[] {
  return orderSpaces(items.filter((item) => item.space.kind === 'school' && (item.role === 'owner' || item.role === 'admin' || item.role === 'teacher')));
}

/** Whether a school row opens the school page: its owner and admins only (a teacher member's row is plain text). */
export function opensSchool(item: AccountSpaceItem): boolean {
  return item.space.kind === 'school' && (item.role === 'owner' || item.role === 'admin');
}

/** The attention line's count for a class row: a live class with a count above 0; else null (no line). */
export function attentionOf(item: AccountSpaceItem): number | null {
  if (item.space.kind !== 'class' || item.space.archivedAt !== null) return null;
  return item.attention !== null && item.attention > 0 ? item.attention : null;
}

/** What the Teacher home (and the School use of it) draws above and in place of its rows. */
export interface TeacherHomeView {
  classes: AccountSpaceItem[];
  schools: AccountSpaceItem[];
  /** Section 8.4: the School use on an account that owns or administers no school (a stale uses record): `noSchool` at the top. */
  noSchool: boolean;
  /** Section 8.3: no class and no school: `noClass` and the home's end. */
  noClass: boolean;
  /** Section 8.4: the School use moves the screen reader's focus to this school row (the first one it opens), once drawn. */
  focusId: string | null;
}

export function teacherHomeView(items: readonly AccountSpaceItem[], use: 'teacher' | 'school'): TeacherHomeView {
  const classes = classesOf(items);
  const schools = schoolsOf(items);
  return {
    classes,
    schools,
    // The School use comes from a school the account owns or administers (`usesFor`); a school where it only teaches
    // is the Teacher use's, so it neither answers the School use nor takes its focus (row NS-6 review).
    noSchool: use === 'school' && !schools.some(opensSchool),
    noClass: classes.length === 0 && schools.length === 0,
    focusId: use === 'school' ? (schools.find(opensSchool)?.space.id ?? null) : null,
  };
}

/**
 * The class page's code panel (section 8.3, board 13): the class code when the roster carries one (the Worker sends it
 * with `space.manage`, while live); otherwise nothing at all: no Make a code and no line (the console keeps those).
 * An archived class shows none.
 */
export function classCodeOf(roster: AccountRoster): string | null {
  if (roster.space?.archivedAt != null) return null;
  return roster.joinCode;
}

/** The class page's learners, in the order they joined, never by activity (section 8.1). */
export function classLearners(roster: AccountRoster): { id: string; name: string }[] {
  return orderLearners(roster.learners).map((learner) => ({ id: learner.id, name: learner.displayName }));
}

/** The school page's classes, live then archived, each oldest first (section 8.1), whatever order the Worker sent. */
export function schoolClassesOf(page: AccountSchoolPage): AccountSchoolPage['classes'] {
  return orderSpaces(page.classes);
}

/**
 * Section 8.4 (board 14): a school page's class row reads `cantLoad`, plain text with no link, once that class's own
 * page was refused (`403` or `404` on its roster or its class report, kept in memory with the session's queries).
 */
export function refusedClass(errors: readonly ('forbidden' | 'not_found' | 'other' | null)[]): boolean {
  return errors.some((error) => error === 'forbidden' || error === 'not_found');
}
