import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '../api';
import { KIND_LABEL, ROUTES, groupSpaces, landingAfterCreate, landingAfterSignIn, memberNoun, prefillName, roleCards, spaceErrorText, spaceIdFrom, statusLine } from '../routing';

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
    expect(ROUTES.spacePlan('space:c', 'plan:r1')).toBe('/teach/space/plan?id=space%3Ac&plan=plan%3Ar1');
    expect(ROUTES.spaceCurriculum('space:c')).toBe('/teach/space/curriculum?id=space%3Ac');
    expect(ROUTES.spaceRelink('space:c')).toBe('/teach/space/relink?id=space%3Ac');
    expect(ROUTES.spaceSettings('space:c')).toBe('/teach/space/settings?id=space%3Ac');
    expect(ROUTES.spaceLecture('space:c')).toBe('/teach/space/lecture?id=space%3Ac');
    expect(ROUTES.spaceLecture('space:c', 'revisit')).toBe('/teach/space/lecture?id=space%3Ac&from=revisit');
    expect(ROUTES.spaceLecture('space:c', 'plan')).toBe('/teach/space/lecture?id=space%3Ac&from=plan');
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

describe('console routing words follow the locale they are given (F-I18N-001 PR 10a)', () => {
  // es and ko have no console keys yet, so they equal English; the pseudo-locale is the one
  // locale whose words differ, so a helper that ignored `locale` would fail here.
  const PSEUDO = 'en-XA' as UiLocale;
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('words the space errors, in English and in every locale', () => {
    expect(spaceErrorText('forbidden')).toBe("This space isn't yours to view.");
    expect(spaceErrorText('gone')).toBe('This space is gone.');
    expect(spaceErrorText('cantReach')).toBe("Can't reach the console right now.");
    expect(spaceErrorText('regenerateFailed')).toBe("Couldn't make a new code right now.");
    for (const locale of ['en', 'es', 'ko'] as const) {
      const c = getMessages(locale).console;
      expect(spaceErrorText('cantReach', locale)).toBe(c.cantReach);
      expect(spaceErrorText('gone', locale)).toBe(c.space.gone);
    }
  });

  it('reads the pseudo-locale when given it', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    for (const error of ['forbidden', 'gone', 'cantReach', 'regenerateFailed'] as const) expect(spaceErrorText(error, PSEUDO)).toMatch(bracketed);
    for (const card of roleCards(PSEUDO)) {
      expect(card.title).toMatch(bracketed);
      expect(card.line).toMatch(bracketed);
    }
    expect(prefillName('family', 'Kim', PSEUDO)).toMatch(bracketed);
    expect(prefillName('family', '', PSEUDO)).toMatch(bracketed);
    expect(prefillName('class', 'Kim', PSEUDO)).toMatch(bracketed);
    expect(prefillName('school', 'Seoul', PSEUDO)).toMatch(bracketed);
    expect(memberNoun('class', PSEUDO)).toMatch(bracketed);
    expect(statusLine(item('c', 'class', 't', { counts: { learners: 2, accounts: 1, classes: 0 } }), PSEUDO)).toMatch(bracketed);
  });
});
