import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { KIND_LABEL, ROUTES, groupSpaces, landingAfterCreate, landingAfterSignIn, memberNoun, prefillName, roleCards, spaceIdFrom, statusLine } from '../routing';

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
    expect(landingAfterCreate('class', 'space:c', false)).toBe('/teach/space?id=space%3Ac');
    expect(ROUTES.spacePlan('space:c')).toBe('/teach/space/plan?id=space%3Ac');
    expect(ROUTES.spaceRelink('space:c')).toBe('/teach/space/relink?id=space%3Ac');
    expect(ROUTES.spaceSettings('space:c')).toBe('/teach/space/settings?id=space%3Ac');
    expect(spaceIdFrom(new URLSearchParams('id=space%3Ac'))).toBe('space:c');
    expect(spaceIdFrom(new URLSearchParams('id=+'))).toBe('');
    expect(spaceIdFrom(new URLSearchParams(''))).toBe('');
    expect(spaceIdFrom(null)).toBe('');
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
    expect(roleCards().map((r) => r.kind)).toEqual(['family', 'class', 'school']);
    expect(roleCards()[0]).toEqual({ kind: 'family', title: 'Parent / caregiver', line: 'Home — my kids' });
    expect(memberNoun('class')).toBe('students');
    expect(memberNoun('family')).toBe('learners');
    expect(memberNoun('school')).toBe('members');
  });

  it('reads role cards, prefilled names and member nouns from the dictionary in every locale (F-I18N-001 PR 10a)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const c = getMessages(locale).console;
      expect(roleCards(locale)).toEqual([
        { kind: 'family', ...c.start.roles.family },
        { kind: 'class', ...c.start.roles.class },
        { kind: 'school', ...c.start.roles.school },
      ]);
      expect(prefillName('family', ' Kim ', locale)).toBe(c.start.prefill.family('Kim'));
      expect(prefillName('family', ' ', locale)).toBe(c.start.prefill.familyDefault);
      expect(prefillName('class', 'Kim', locale)).toBe(c.start.prefill.class);
      expect(prefillName('school', 'Seoul', locale)).toBe(c.start.prefill.school('Seoul'));
      expect(prefillName('school', '', locale)).toBe(c.start.prefill.schoolDefault);
      for (const kind of ['family', 'class', 'school'] as const) expect(memberNoun(kind, locale)).toBe(c.kind.members[kind]);
    }
    expect(KIND_LABEL).toEqual(getMessages('en').console.kind.label);
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
    expect(statusLine(item('one-fam', 'family', 't', { counts: { learners: 1, accounts: 1, classes: 0 } }))).toBe('1 learner');
    expect(statusLine(item('one-sch', 'school', 't', { counts: { learners: 0, accounts: 1, classes: 1 } }))).toBe('1 class');
    expect(statusLine(item('empty', 'class', 't'))).toBe('0 students');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const counts = getMessages(locale).console.spaceCounts;
      expect(statusLine(groups.class[0] as SpaceListItem, locale)).toBe(counts.students(12));
      expect(statusLine(groups.family[0] as SpaceListItem, locale)).toBe(counts.learners(2));
      expect(statusLine(groups.school[0] as SpaceListItem, locale)).toBe(counts.classes(4));
    }
  });
});
