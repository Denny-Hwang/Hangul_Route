import { APP_ROUTES, SCHOOL_FOCUS, SCHOOL_FOCUS_QUERY } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';
import { lectureCardView, type LectureCardView } from './lecture-entry';
import { heldPersonas } from './personas';
import { groupSpaces } from './routing';

/**
 * What the teacher home draws (F-APP-001 A-5a, section 3.8; design/screens/app-shell/teacher-home.md).
 * Pure: the page reads the spaces list and renders this view. Families live under the Family
 * persona (`/parent`, A-5b), so this page lists classes and schools only.
 */

/** `/start` with a persona hint: the role card it preselects (sections 3.5, 3.7). */
export const START_CLASS = `${APP_ROUTES.start}?persona=teacher`;
export const START_FAMILY = `${APP_ROUTES.start}?persona=parent`;

export interface TeacherHomeView {
  /** `noClass`: the account holds no teacher persona. */
  state: 'noClass' | 'list';
  classRows: SpaceListItem[];
  schoolRows: SpaceListItem[];
  /** + New class is the primary action when every teacher row is archived. */
  newClassPrimary: boolean;
  /** The quiet cross-link at the bottom: set up a family, or switch to it. */
  cross: 'addFamily' | 'toFamily' | null;
  /** Go to Family in the no-class state. */
  goFamily: boolean;
}

export function teacherHomeView(items: readonly SpaceListItem[]): TeacherHomeView {
  const groups = groupSpaces(items);
  const held = heldPersonas(items);
  const holdsFamily = held.includes('parent');
  const teacherRows = [...groups.class, ...groups.school];
  if (!held.includes('teacher')) {
    return { state: 'noClass', classRows: [], schoolRows: [], newClassPrimary: true, cross: holdsFamily ? null : 'addFamily', goFamily: holdsFamily };
  }
  return {
    state: 'list',
    classRows: groups.class,
    schoolRows: groups.school,
    newClassPrimary: teacherRows.length > 0 && teacherRows.every((row) => !!row.space.archivedAt),
    cross: holdsFamily ? 'toFamily' : 'addFamily',
    goFamily: false,
  };
}

/** The link line of a class row (section 3.8, design pass D8): Class report and Notes by flag; an archived class keeps Class report and has no Notes. */
export function classRowLinks(item: SpaceListItem, flags: { reports: boolean; notes: boolean }): Array<'classReport' | 'notes'> {
  if (item.space.kind !== 'class') return [];
  const links: Array<'classReport' | 'notes'> = [];
  if (flags.reports) links.push('classReport');
  if (flags.notes && !item.space.archivedAt) links.push('notes');
  return links;
}

/**
 * The Lecture mode card at the top of the teacher home (AMENDMENTS-LECTURE-V2 E1, LV-5): the classes the account
 * teaches (`composesIn`, live, most recent first) give one, several or no space; a school admin with no teacher or
 * owner role in any class gets the no-space path (the presenter, with no class). Null while `lectureModeEnabled()` is
 * off: the card is not drawn at all.
 */
export function teacherLectureCard(items: readonly SpaceListItem[] | 'failed' | null, opts: { enabled: boolean; appUrl: string }): LectureCardView | null {
  return opts.enabled ? lectureCardView(items, 'teacher', opts.appUrl) : null;
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 5.3 (row OA-4b): the chooser's School row opens `/teach?focus=school`.
 * Whether a query asks for the School group (exactly `focus=school`; any other value is ignored).
 */
export function wantsSchoolFocus(params: { get(name: string): string | null }): boolean {
  return params.get(SCHOOL_FOCUS.param) === SCHOOL_FOCUS.value;
}

/**
 * [OA] The `/teach` router's destination with the School focus carried on: only the teacher home takes it (a
 * `/start` set-up or any other page never does), and it is added once.
 */
export function withSchoolFocus(href: string, focus: boolean): string {
  return focus && href === APP_ROUTES.teacherHome ? `${href}?${SCHOOL_FOCUS_QUERY}` : href;
}

/**
 * [OA] The teacher home's address once the School focus is spent: `focus` removed, every other pair kept in its
 * order, the hash kept. `null` when there is nothing to remove.
 */
export function withoutSchoolFocus(search: string, pathname: string, hash = ''): string | null {
  const params = new URLSearchParams(search);
  if (!params.has(SCHOOL_FOCUS.param)) return null;
  params.delete(SCHOOL_FOCUS.param);
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`;
}
