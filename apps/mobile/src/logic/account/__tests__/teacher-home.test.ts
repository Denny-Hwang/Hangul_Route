import { describe, expect, it } from 'vitest';
import type { AccountRoster, AccountSchoolPage, AccountSpaceItem } from '../account-data';
import { attentionOf, classCodeOf, classLearners, classesOf, opensSchool, refusedClass, schoolClassesOf, schoolsOf, teacherHomeView } from '../teacher-home';

/**
 * F-AUTH-004 sections 8.1, 8.3 and 8.4 (row NS-6; design `homes.md` boards 8 to 14; anti-shame): the Teacher and School
 * homes, the class page and the school page in rules. Class grouping, the school row's link by role, the school focus,
 * the attention line, and every list in its fixed order whatever the Worker sent.
 */

type Kind = AccountSpaceItem['space']['kind'];
const item = (id: string, kind: Kind, role: AccountSpaceItem['role'], over: { createdAt?: string; archivedAt?: string | null; attention?: number | null; learners?: number } = {}): AccountSpaceItem => ({
  space: { id, kind, name: id, createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z', archivedAt: over.archivedAt ?? null },
  role,
  counts: { learners: over.learners ?? 0 },
  joinCode: null,
  attention: over.attention ?? null,
});

/** The Worker's order: newest first, an archived class in the middle, every role the account can hold. */
const ITEMS: AccountSpaceItem[] = [
  item('space:lakeside', 'school', 'teacher', { createdAt: '2026-06-01T00:00:00.000Z' }),
  item('space:sunflower', 'class', 'teacher', { createdAt: '2026-05-01T00:00:00.000Z' }),
  item('space:spring', 'class', 'owner', { createdAt: '2025-03-01T00:00:00.000Z', archivedAt: '2026-01-01T00:00:00.000Z' }),
  item('space:maple', 'school', 'admin', { createdAt: '2026-02-01T00:00:00.000Z' }),
  item('space:saturday', 'class', 'owner', { createdAt: '2026-04-01T00:00:00.000Z', attention: 2 }),
  item('space:kim', 'family', 'owner'),
  item('space:guest', 'class', 'caregiver'),
  item('space:student', 'class', 'student'),
  item('space:own-school', 'school', 'owner', { createdAt: '2026-07-01T00:00:00.000Z' }),
  item('space:old-school', 'school', 'admin', { createdAt: '2024-01-01T00:00:00.000Z', archivedAt: '2025-01-01T00:00:00.000Z' }),
  item('space:caregiver-school', 'school', 'caregiver'),
];
const ids = (items: readonly { space: { id: string } }[]): string[] => items.map((i) => i.space.id);

describe('class grouping (section 8.3)', () => {
  it('classes where the account is owner or teacher: live first, then archived, each oldest first', () => {
    expect(ids(classesOf(ITEMS))).toEqual(['space:saturday', 'space:sunflower', 'space:spring']);
  });

  it('schools where the account is owner, admin or teacher, in the same order', () => {
    expect(ids(schoolsOf(ITEMS))).toEqual(['space:maple', 'space:lakeside', 'space:own-school', 'space:old-school']);
  });

  it('never a family, and never a class held as caregiver or student', () => {
    const all = [...ids(classesOf(ITEMS)), ...ids(schoolsOf(ITEMS))];
    expect(all).not.toContain('space:kim');
    expect(all).not.toContain('space:guest');
    expect(all).not.toContain('space:student');
    expect(all).not.toContain('space:caregiver-school');
  });
});

describe('the school row link by role (section 8.3, routes/school.ts)', () => {
  it('owner and admin open the school page; a teacher member gets plain text (the page would answer 403)', () => {
    expect(opensSchool(item('s', 'school', 'owner'))).toBe(true);
    expect(opensSchool(item('s', 'school', 'admin'))).toBe(true);
    expect(opensSchool(item('s', 'school', 'teacher'))).toBe(false);
    expect(opensSchool(item('s', 'school', 'caregiver'))).toBe(false);
    expect(opensSchool(item('c', 'class', 'owner'))).toBe(false);
  });
});

describe('the attention line (section 8.3)', () => {
  it('a live class with a count above 0', () => {
    expect(attentionOf(item('c', 'class', 'owner', { attention: 2 }))).toBe(2);
  });

  it('none for 0, an unreadable count, an archived class, or a space that is not a class', () => {
    expect(attentionOf(item('c', 'class', 'owner', { attention: 0 }))).toBeNull();
    expect(attentionOf(item('c', 'class', 'owner', { attention: null }))).toBeNull();
    expect(attentionOf(item('c', 'class', 'owner', { attention: 3, archivedAt: '2026-01-01T00:00:00.000Z' }))).toBeNull();
    expect(attentionOf(item('s', 'school', 'admin', { attention: 3 }))).toBeNull();
    expect(attentionOf(item('f', 'family', 'owner', { attention: 3 }))).toBeNull();
  });
});

describe('the Teacher home and the School use (sections 8.3, 8.4)', () => {
  it('teacher: classes and schools, no focus, no empty lines', () => {
    expect(teacherHomeView(ITEMS, 'teacher')).toMatchObject({ noSchool: false, noClass: false, focusId: null });
  });

  it('school focus: the same page with the screen reader focus on the first school row', () => {
    const view = teacherHomeView(ITEMS, 'school');
    expect(view.focusId).toBe('space:maple');
    expect(ids(view.classes)).toEqual(ids(classesOf(ITEMS)));
    expect(view.noSchool).toBe(false);
  });

  it('school use, stale record (no school any more): noSchool above the Teacher home, no focus', () => {
    const view = teacherHomeView(ITEMS.filter((i) => i.space.kind !== 'school'), 'school');
    expect(view).toMatchObject({ noSchool: true, noClass: false, focusId: null });
  });

  it('no class and no school: noClass (and noSchool too for the School use)', () => {
    const family = [item('space:kim', 'family', 'owner')];
    expect(teacherHomeView(family, 'teacher')).toMatchObject({ classes: [], schools: [], noClass: true, noSchool: false });
    expect(teacherHomeView([], 'school')).toMatchObject({ noClass: true, noSchool: true, focusId: null });
  });

  it('only schools: no noClass', () => {
    expect(teacherHomeView([item('s', 'school', 'teacher')], 'teacher').noClass).toBe(false);
  });

  it('the School use answers only a school the account owns or administers (usesFor): a teacher member\'s school is stale', () => {
    // Demoted from admin to teacher, the record still says School: noSchool, and no focus on a row it cannot open.
    expect(teacherHomeView([item('s', 'school', 'teacher')], 'school')).toMatchObject({ noSchool: true, focusId: null });
    // An older school where it teaches comes first in the list; the focus still goes to the school it administers.
    const both = [item('t', 'school', 'teacher', { createdAt: '2025-01-01T00:00:00.000Z' }), item('a', 'school', 'admin', { createdAt: '2026-01-01T00:00:00.000Z' })];
    expect(ids(teacherHomeView(both, 'school').schools)).toEqual(['t', 'a']);
    expect(teacherHomeView(both, 'school')).toMatchObject({ noSchool: false, focusId: 'a' });
  });
});

const learner = (id: string, joinedAt: string): AccountRoster['learners'][number] => ({ id, displayName: id.toUpperCase(), joinedAt, lastActiveAt: '2026-11-08T10:00:00.000Z', summary: null });

describe('the class page (section 8.3, boards 12 and 13)', () => {
  const roster = (over: Partial<AccountRoster> = {}): AccountRoster => ({
    space: { id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null },
    learners: [learner('ben', '2026-03-01T00:00:00.000Z'), learner('ana', '2026-02-01T00:00:00.000Z'), learner('cat', '2026-02-01T00:00:00.000Z')],
    joinCode: 'H3TRW9',
    ...over,
  });

  it('learners in the order they joined (then id), never by activity', () => {
    expect(classLearners(roster())).toEqual([
      { id: 'ana', name: 'ANA' },
      { id: 'cat', name: 'CAT' },
      { id: 'ben', name: 'BEN' },
    ]);
  });

  it('the class code only when the roster carries one; none on an archived class; no Make a code', () => {
    expect(classCodeOf(roster())).toBe('H3TRW9');
    expect(classCodeOf(roster({ joinCode: null }))).toBeNull();
    expect(classCodeOf(roster({ space: { id: 'space:c', kind: 'class', name: 'x', archivedAt: '2026-01-01T00:00:00.000Z' } }))).toBeNull();
    expect(classCodeOf(roster({ space: null }))).toBe('H3TRW9');
  });
});

describe('the school page (section 8.4, board 14)', () => {
  const row = (id: string, createdAt: string, archivedAt: string | null = null): AccountSchoolPage['classes'][number] => ({ space: { id, name: id, createdAt, archivedAt }, students: 1 });

  it('its classes live first, then archived, each oldest first, whatever the Worker sent (newest first)', () => {
    const page: AccountSchoolPage = {
      school: { id: 'space:s', kind: 'school', name: 'Maple', archivedAt: null },
      classes: [row('c3', '2026-03-01T00:00:00.000Z'), row('old', '2025-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'), row('c1', '2026-01-01T00:00:00.000Z')],
      teachers: 6,
    };
    expect(ids(schoolClassesOf(page))).toEqual(['c1', 'c3', 'old']);
  });

  it('a class reads cantLoad once its own page was refused (403 or 404); not for any other failure', () => {
    expect(refusedClass(['forbidden'])).toBe(true);
    expect(refusedClass([null, 'not_found'])).toBe(true);
    expect(refusedClass(['other', null])).toBe(false);
    expect(refusedClass([])).toBe(false);
  });
});
