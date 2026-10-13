import { APP_ROUTES } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';
import { FAMILY_HOME_LIVE, heldPersonas } from './personas';
import { groupSpaces } from './routing';

/**
 * What the teacher home draws (F-APP-001 A-5a, section 3.8; design/screens/app-shell/teacher-home.md).
 * Pure: the page reads the spaces list and renders this view. Families live under the Family
 * persona, so the Family group leaves this page once `/parent` is the real family home; until then
 * (`FAMILY_HOME_LIVE` false) it stays here, so a family account keeps reaching its spaces.
 */

/** `/start` with a persona hint: the role card it preselects (sections 3.5, 3.7). */
export const START_CLASS = `${APP_ROUTES.start}?persona=teacher`;
export const START_FAMILY = `${APP_ROUTES.start}?persona=parent`;

export interface TeacherHomeView {
  /** `noClass`: the account holds no teacher persona and the page has nothing else to list. */
  state: 'noClass' | 'list';
  classRows: SpaceListItem[];
  schoolRows: SpaceListItem[];
  /** The Family group, drawn only while `/parent` is still the demo. */
  familyRows: SpaceListItem[];
  /** + New class is the primary action when every teacher row is archived. */
  newClassPrimary: boolean;
  /** The quiet cross-link at the bottom: set up a family, or switch to it. */
  cross: 'addFamily' | 'toFamily' | null;
  /** Go to Family in the no-class state. */
  goFamily: boolean;
}

export function teacherHomeView(items: readonly SpaceListItem[], live: boolean = FAMILY_HOME_LIVE): TeacherHomeView {
  const groups = groupSpaces(items);
  const held = heldPersonas(items);
  const holdsTeacher = held.includes('teacher');
  const holdsFamily = held.includes('parent');
  const familyRows = live ? [] : groups.family;
  const teacherRows = [...groups.class, ...groups.school];
  const cross = !holdsFamily ? 'addFamily' : live ? 'toFamily' : null;
  if (!holdsTeacher && teacherRows.length === 0 && familyRows.length === 0) {
    return { state: 'noClass', classRows: [], schoolRows: [], familyRows: [], newClassPrimary: true, cross: holdsFamily ? null : 'addFamily', goFamily: holdsFamily };
  }
  return {
    state: 'list',
    classRows: groups.class,
    schoolRows: groups.school,
    familyRows,
    newClassPrimary: teacherRows.length > 0 && teacherRows.every((row) => !!row.space.archivedAt),
    cross,
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
