import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { KIND_GROUP, KIND_LABEL, ROLE_CARDS, ROUTES, groupSpaces, landingAfterCreate, landingAfterSignIn, memberNoun, prefillName, statusLine } from '../routing';

const item = (id: string, kind: SpaceListItem['space']['kind'], createdAt: string, over: Partial<SpaceListItem> = {}, archivedAt: string | null = null): SpaceListItem => ({
  space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt },
  role: 'owner',
  counts: { learners: 0, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
  ...over,
});

describe('console routing (F-CONSOLE-001)', () => {
  it('routes after sign-in and after creating a space', () => {
    expect(landingAfterSignIn(0)).toBe(ROUTES.start);
    expect(landingAfterSignIn(2)).toBe(ROUTES.home);
    expect(landingAfterCreate('class', 'space:c', false)).toBe('/teach/space/space%3Ac');
    expect(landingAfterCreate('family', 'space:f', false)).toBe(ROUTES.home);
    expect(landingAfterCreate('school', 'space:s', true)).toBe(ROUTES.home);
  });

  it('prefills names and labels kinds', () => {
    expect(prefillName('family', ' Kim ')).toBe('Kim family');
    expect(prefillName('family', '')).toBe('Our family');
    expect(prefillName('class', 'Kim')).toBe('Class A');
    expect(prefillName('school', 'Seoul Hangul')).toBe('Seoul Hangul school');
    expect(prefillName('school', '')).toBe('Our school');
    expect(KIND_LABEL.class).toBe('Class');
    expect(KIND_GROUP.class).toBe('Classes');
    expect(ROLE_CARDS.map((r) => r.kind)).toEqual(['family', 'class', 'school']);
    expect(memberNoun('class')).toBe('students');
    expect(memberNoun('family')).toBe('learners');
    expect(memberNoun('school')).toBe('members');
  });

  it('groups by kind, newest first, archived last, with count-only status lines', () => {
    const groups = groupSpaces([
      item('old-class', 'class', '2026-01-01', { counts: { learners: 1, accounts: 1, classes: 0 } }),
      item('archived-class', 'class', '2026-05-01', {}, '2026-06-01'),
      item('new-class', 'class', '2026-09-01', { counts: { learners: 12, accounts: 1, classes: 0 } }),
      item('fam', 'family', '2026-03-01', { counts: { learners: 2, accounts: 2, classes: 0 } }),
      item('sch', 'school', '2026-02-01', { counts: { learners: 0, accounts: 5, classes: 4 } }),
    ]);
    expect(groups.class.map((i) => i.space.id)).toEqual(['new-class', 'old-class', 'archived-class']);
    expect(groups.family.map((i) => i.space.id)).toEqual(['fam']);
    expect(statusLine(groups.class[0] as SpaceListItem)).toBe('12 students');
    expect(statusLine(groups.class[1] as SpaceListItem)).toBe('1 student');
    expect(statusLine(groups.family[0] as SpaceListItem)).toBe('2 learners');
    expect(statusLine(groups.school[0] as SpaceListItem)).toBe('4 classes');
  });
});
