import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { START_CLASS, START_FAMILY, classRowLinks, teacherHomeView } from '../teacher-home';

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

describe('teacherHomeView, family home live (A-5b on)', () => {
  it('lists classes (most recent first, archived last) and schools, and drops the Family group', () => {
    const view = teacherHomeView([family, classA, archived, classB, school], true);
    expect(view.state).toBe('list');
    expect(ids(view.classRows)).toEqual(['sp_b', 'sp_a', 'sp_old']);
    expect(ids(view.schoolRows)).toEqual(['sp_s']);
    expect(view.familyRows).toEqual([]);
    expect(view.newClassPrimary).toBe(false);
  });

  it('cross-links: set up a family without the Family persona; switch to Family with it', () => {
    expect(teacherHomeView([classA], true).cross).toBe('addFamily');
    expect(teacherHomeView([classA, family], true).cross).toBe('toFamily');
  });

  it('no class yet: a Family-only account gets the no-class state with Go to Family', () => {
    const view = teacherHomeView([family], true);
    expect(view).toMatchObject({ state: 'noClass', goFamily: true, cross: null, classRows: [], schoolRows: [] });
  });

  it('no space at all: the no-class state, no Go to Family, the cross-link to set up a family', () => {
    expect(teacherHomeView([], true)).toMatchObject({ state: 'noClass', goFamily: false, cross: 'addFamily' });
  });

  it('teacher persona only through archived spaces: the archived rows, + New class as the primary action', () => {
    const view = teacherHomeView([archived], true);
    expect(view.state).toBe('list');
    expect(ids(view.classRows)).toEqual(['sp_old']);
    expect(view.newClassPrimary).toBe(true);
  });
});

describe('teacherHomeView while /parent is still the demo', () => {
  it('keeps the Family group, so a family account still reaches its spaces, and shows no switch link', () => {
    const view = teacherHomeView([family, classA]);
    expect(ids(view.familyRows)).toEqual(['sp_f']);
    expect(view.cross).toBeNull();
    const familyOnly = teacherHomeView([family], false);
    expect(familyOnly.state).toBe('list');
    expect(ids(familyOnly.familyRows)).toEqual(['sp_f']);
  });

  it('still offers to set up a family to an account without one', () => {
    expect(teacherHomeView([classA], false).cross).toBe('addFamily');
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
