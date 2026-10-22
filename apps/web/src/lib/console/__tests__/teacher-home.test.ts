import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { START_CLASS, START_FAMILY, classRowLinks, teacherHomeView, teacherLectureCard, wantsSchoolFocus, withSchoolFocus, withoutSchoolFocus } from '../teacher-home';

/** F-APP-001 A-5a, section 3.8: the teacher home's rows, its no-class state and its cross-links. */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], over: { archivedAt?: string | null; createdAt?: string } = {}): SpaceListItem {
  return {
    space: {
      id,
      kind,
      name: id,
      parentSpaceId: null,
      settings: { consentMode: 'parent', anonymizeRoster: false },
      archivedAt: over.archivedAt ?? null,
      createdAt: over.createdAt ?? '2026-10-01T00:00:00Z',
    },
    role,
    counts: { learners: 3, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const family = item('sp_f', 'family', 'owner');
const classA = item('sp_a', 'class', 'owner', { createdAt: '2026-10-02T00:00:00Z' });
const classB = item('sp_b', 'class', 'teacher', { createdAt: '2026-10-05T00:00:00Z' });
const archived = item('sp_old', 'class', 'owner', { archivedAt: '2026-09-01T00:00:00Z', createdAt: '2026-10-09T00:00:00Z' });
const school = item('sp_s', 'school', 'admin');

const ids = (rows: SpaceListItem[]): string[] => rows.map((row) => row.space.id);

describe('teacherHomeView', () => {
  it('lists classes (most recent first, archived last) and schools, and drops the Family group', () => {
    const view = teacherHomeView([family, classA, archived, classB, school]);
    expect(view.state).toBe('list');
    expect(ids(view.classRows)).toEqual(['sp_b', 'sp_a', 'sp_old']);
    expect(ids(view.schoolRows)).toEqual(['sp_s']);
    expect(JSON.stringify(view)).not.toContain('sp_f');
    expect(view.newClassPrimary).toBe(false);
  });

  it('cross-links: set up a family without the Family persona; switch to Family with it', () => {
    expect(teacherHomeView([classA]).cross).toBe('addFamily');
    expect(teacherHomeView([classA, family]).cross).toBe('toFamily');
  });

  it('no class yet: a Family-only account gets the no-class state with Go to Family', () => {
    const view = teacherHomeView([family]);
    expect(view).toMatchObject({ state: 'noClass', goFamily: true, cross: null, classRows: [], schoolRows: [] });
  });

  it('no space at all: the no-class state, no Go to Family, the cross-link to set up a family', () => {
    expect(teacherHomeView([])).toMatchObject({ state: 'noClass', goFamily: false, cross: 'addFamily' });
  });

  it('teacher persona only through archived spaces: the archived rows, + New class as the primary action', () => {
    const view = teacherHomeView([archived]);
    expect(view.state).toBe('list');
    expect(ids(view.classRows)).toEqual(['sp_old']);
    expect(view.newClassPrimary).toBe(true);
  });
});

describe('classRowLinks', () => {
  it('shows Class report and Notes by flag on a class row', () => {
    expect(classRowLinks(classA, { reports: true, notes: true })).toEqual(['classReport', 'notes']);
    expect(classRowLinks(classA, { reports: false, notes: true })).toEqual(['notes']);
    expect(classRowLinks(classA, { reports: true, notes: false })).toEqual(['classReport']);
    expect(classRowLinks(classA, { reports: false, notes: false })).toEqual([]);
  });

  it('an archived class keeps Class report and has no Notes (design pass D8); a school row has neither', () => {
    expect(classRowLinks(archived, { reports: true, notes: true })).toEqual(['classReport']);
    expect(classRowLinks(school, { reports: true, notes: true })).toEqual([]);
  });
});

describe('start links', () => {
  it('preselect the role card of the persona', () => {
    expect(START_CLASS).toBe('/start?persona=teacher');
    expect(START_FAMILY).toBe('/start?persona=parent');
  });
});

describe('teacherLectureCard (AMENDMENTS-LECTURE-V2 E1, LV-5)', () => {
  const on = { enabled: true, appUrl: 'https://app.hangulroute.com' };

  it('one class: Start opens that class\'s lecture setup page', () => {
    expect(teacherLectureCard([classA, family], on)).toEqual({ state: 'one', href: '/teach/space/lecture?id=sp_a' });
    expect(teacherLectureCard([classB], on)).toEqual({ state: 'one', href: '/teach/space/lecture?id=sp_b' });
  });

  it('several classes: the choice by class name, most recent first, each opening its own setup page', () => {
    expect(teacherLectureCard([classA, classB, family, school], on)).toEqual({
      state: 'several',
      choices: [
        { id: 'sp_b', name: 'sp_b', href: '/teach/space/lecture?id=sp_b' },
        { id: 'sp_a', name: 'sp_a', href: '/teach/space/lecture?id=sp_a' },
      ],
    });
  });

  it('no class: Start opens the presenter with no class (presets work with none)', () => {
    expect(teacherLectureCard([], on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
    expect(teacherLectureCard([family], on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
    expect(teacherLectureCard([], { enabled: true, appUrl: 'http://localhost:4173' })).toEqual({ state: 'none', href: 'http://localhost:4173/present' });
  });

  it('counts only canComposeIn classes: a school admin without a teacher or owner role in any class gets the no-space path', () => {
    const childClass = item('sp_child', 'class', 'admin');
    expect(teacherLectureCard([school, childClass], on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
    expect(teacherLectureCard([school, childClass, classA], on)).toEqual({ state: 'one', href: '/teach/space/lecture?id=sp_a' });
    expect(teacherLectureCard([item('sp_st', 'class', 'student')], on)).toMatchObject({ state: 'none' });
  });

  it('an archived class is not offered (its own page keeps the button)', () => {
    expect(teacherLectureCard([archived], on)).toMatchObject({ state: 'none' });
    expect(teacherLectureCard([archived, classA], on)).toEqual({ state: 'one', href: '/teach/space/lecture?id=sp_a' });
  });

  it('loading while the list has not answered; the no-space path when it failed', () => {
    expect(teacherLectureCard(null, on)).toEqual({ state: 'loading' });
    expect(teacherLectureCard('failed', on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
  });

  it('nothing is drawn while lectureModeEnabled() is off', () => {
    const off = { ...on, enabled: false };
    for (const items of [[classA], [classA, classB], [], null, 'failed' as const]) expect(teacherLectureCard(items, off)).toBeNull();
  });
});

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 5.3, row OA-4b: the chooser's School row (`/teach?focus=school`).
describe('the School focus (row OA-4b)', () => {
  it('wantsSchoolFocus: exactly focus=school', () => {
    expect(wantsSchoolFocus(new URLSearchParams('focus=school'))).toBe(true);
    expect(wantsSchoolFocus(new URLSearchParams('lang=ko&focus=school'))).toBe(true);
    for (const query of ['', 'focus=School', 'focus=sp_1', 'focus=', 'school=1']) expect(wantsSchoolFocus(new URLSearchParams(query)), query).toBe(false);
  });

  it('withSchoolFocus: only the teacher home takes it', () => {
    expect(withSchoolFocus('/teach/home', true)).toBe('/teach/home?focus=school');
    expect(withSchoolFocus('/teach/home', false)).toBe('/teach/home');
    expect(withSchoolFocus('/start?persona=teacher', true)).toBe('/start?persona=teacher');
    expect(withSchoolFocus('/parent', true)).toBe('/parent');
  });

  it('withoutSchoolFocus: removes focus and keeps everything else; null when there is none', () => {
    expect(withoutSchoolFocus('?focus=school', '/teach/home')).toBe('/teach/home');
    expect(withoutSchoolFocus('?lang=ko&focus=school&x=1', '/teach/home', '#top')).toBe('/teach/home?lang=ko&x=1#top');
    expect(withoutSchoolFocus('?lang=ko', '/teach/home')).toBeNull();
    expect(withoutSchoolFocus('', '/teach/home')).toBeNull();
  });
});
