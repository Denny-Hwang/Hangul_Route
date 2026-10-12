import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '../api';
import { ROUTES, groupSpaces, isKnownSpaceKind, landingAfterCreate, landingAfterSignIn, loadErrorKey, prefillName, roleCards, spaceErrorText, spaceIdFrom, statusLine } from '../routing';

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
    // The plan on screen travels by id (an id is not a name, so it may sit in the URL).
    expect(ROUTES.spaceLecture('space:c', 'plan', 'plan:7 a')).toBe('/teach/space/lecture?id=space%3Ac&from=plan&plan=plan%3A7%20a');
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
    expect(roleCards().map((r) => r.kind)).toEqual(['family', 'class', 'school']);
    expect(roleCards()[0]).toEqual({ kind: 'family', title: 'Parent / caregiver', line: 'Home — my kids' });
  });

  it('reads role cards, and prefilled names from the dictionary in every locale (F-I18N-001 PR 10a)', () => {
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
    }
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
    expect(statusLine(item('c', 'class', 't', { counts: { learners: 2, accounts: 1, classes: 0 } }), PSEUDO)).toMatch(bracketed);
  });
});

describe('page load errors (settings, school admin, F-I18N-001 PR 10c)', () => {
  it('words forbidden on its own and every other error as cantReach', () => {
    expect(loadErrorKey('forbidden')).toBe('forbidden');
    for (const error of ['network', 'notFound', 'server', 'unauthorized', '']) expect(loadErrorKey(error)).toBe('cantReach');
  });

  it('knows the three space kinds and nothing else', () => {
    for (const kind of ['family', 'class', 'school']) expect(isKnownSpaceKind(kind)).toBe(true);
    for (const kind of ['district', 'Family', '', null, undefined, 3]) expect(isKnownSpaceKind(kind)).toBe(false);
  });
});


describe("one learner's Learning Route page (Learning Route amendment section 6.1, LR-7)", () => {
  it('sends a family to /parent/space/route and a class, or no kind, to /teach/space/route', () => {
    expect(ROUTES.learnerRoute('space:f', 'learner:1', 'family')).toBe('/parent/space/route?id=space%3Af&learner=learner%3A1');
    expect(ROUTES.learnerRoute('space:c', 'learner:1', 'class')).toBe('/teach/space/route?id=space%3Ac&learner=learner%3A1');
    // Omitted renders every kind (F-APP-001's pre-A-5b rule).
    expect(ROUTES.learnerRoute('space:c', 'learner:1')).toBe('/teach/space/route?id=space%3Ac&learner=learner%3A1');
  });

  it('never yields a /teach path for a family space', () => {
    for (const [space, learner] of [['space:f', 'l'], ['fam ily', 'a&b=c'], ['', '']] as const) {
      const path = ROUTES.learnerRoute(space, learner, 'family');
      expect(path.startsWith('/parent/space/route?')).toBe(true);
      expect(path).not.toContain('/teach');
    }
  });

  it('encodes both ids, so an id can never add or change a query parameter', () => {
    const path = ROUTES.learnerRoute('space:a&learner=x', 'learner:1#top?id=y', 'class');
    const url = new URL(path, 'https://app.example');
    expect(url.pathname).toBe('/teach/space/route');
    expect([...url.searchParams.keys()]).toEqual(['id', 'learner']);
    expect(url.searchParams.get('id')).toBe('space:a&learner=x');
    expect(url.searchParams.get('learner')).toBe('learner:1#top?id=y');
    expect(url.hash).toBe('');
    expect(spaceIdFrom(url.searchParams)).toBe('space:a&learner=x');
  });

  it('takes ids only: no name parameter exists, so a learner name can never reach the URL', () => {
    // Three parameters at most (space id, learner id, optional kind), and the kind is a space kind, never free text.
    expect(ROUTES.learnerRoute.length).toBeLessThanOrEqual(3);
    for (const kind of ['family', 'class', undefined] as const) {
      const url = new URL(ROUTES.learnerRoute('space:x', 'learner:y', kind), 'https://app.example');
      expect([...url.searchParams.keys()]).toEqual(['id', 'learner']);
      for (const name of ['name', 'displayName', 'learnerName', 'n']) expect(url.searchParams.has(name)).toBe(false);
    }
  });
});
