import { existsSync } from 'node:fs';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as parentSpacePage from '@/app/(console)/parent/space/page';
import * as teachSpacePage from '@/app/(console)/teach/space/page';
import type { SpaceListItem } from '../api';
import { ROUTES, spacePath, groupSpaces, isKnownSpaceKind, landingAfterCreate, loadErrorKey, prefillName, presetKind, roleCards, spaceErrorText, spaceIdFrom, spaceKindOfPath, statusLine } from '../routing';

const item = (id: string, kind: SpaceListItem['space']['kind'], createdAt: string, over: Partial<SpaceListItem> = {}, archivedAt: string | null = null): SpaceListItem => ({
  space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt },
  role: 'owner',
  counts: { learners: 0, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
  ...over,
});

describe('console routing (F-CONSOLE-001)', () => {
  // F-APP-001 A-4b (section 3.7, OD-7): sign-in at /signin, the first space at /start; the router
  // after sign-in is lib/console/signin-flow.ts (routerDestination).
  it('names the app-host sign-in and first-space pages', () => {
    expect(ROUTES.signIn).toBe('/signin');
    expect(ROUTES.start).toBe('/start');
    expect(ROUTES.home).toBe('/teach/home');
  });

  it('a persona hint preselects the matching role card on /start (section 3.5)', () => {
    expect(presetKind('parent')).toBe('family');
    expect(presetKind('teacher')).toBe('class');
    expect(presetKind(null)).toBeNull();
  });

  it('routes after creating a space', () => {
    expect(landingAfterCreate('class', 'space:c', false)).toBe('/teach/space?id=space%3Ac');
    expect(ROUTES.spacePlan('space:c')).toBe('/teach/space/plan?id=space%3Ac');
    expect(ROUTES.spacePlan('space:c', 'plan:r1')).toBe('/teach/space/plan?id=space%3Ac&plan=plan%3Ar1');
    // F-REPORT-001 RP-10: the report's Add to a plan pre-adds one quest (ids only).
    expect(ROUTES.spacePlan('space:c', undefined, 'class', 'quest:stage1-life-q2')).toBe('/teach/space/plan?id=space%3Ac&add=quest%3Astage1-life-q2');
    expect(ROUTES.spacePlan('space:f', 'plan:1', 'family', 'quest:a b')).toBe('/parent/space/plan?id=space%3Af&plan=plan%3A1&add=quest%3Aa%20b');
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
    // F-APP-001 A-5b (section 3.7): a new family lands on its home, /parent.
    expect(landingAfterCreate('family', 'space:f', false)).toBe('/parent');
    expect(landingAfterCreate('family', 'space:f', true)).toBe('/parent');
    expect(landingAfterCreate('school', 'space:s', true)).toBe(ROUTES.home);
  });

  it('prefills names and labels kinds', () => {
    expect(prefillName('family', ' Kim ')).toBe('Kim family');
    expect(prefillName('family', '')).toBe('Our family');
    expect(prefillName('class', 'Kim')).toBe('Class A');
    expect(prefillName('school', 'Seoul Hangul')).toBe('Seoul Hangul school');
    expect(prefillName('school', '')).toBe('Our school');
    expect(roleCards().map((r) => r.kind)).toEqual(['family', 'class', 'school']);
    expect(roleCards()[0]).toEqual({ kind: 'family', title: 'Parent / caregiver', line: 'At home — the learners in my family' });
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


/** F-APP-001 A-5b (section 3.8): every space page under both prefixes; links use the prefix of the space kind. */
describe('spacePath and the kind of every space builder', () => {
  it('spacePath puts a family under /parent/space and every other kind, or none, under /teach/space', () => {
    expect(spacePath('', 'id=a', 'family')).toBe('/parent/space?id=a');
    expect(spacePath('plan', 'id=a', 'family')).toBe('/parent/space/plan?id=a');
    expect(spacePath('plan', 'id=a', 'class')).toBe('/teach/space/plan?id=a');
    expect(spacePath('settings', 'id=a', 'school')).toBe('/teach/space/settings?id=a');
    expect(spacePath('', 'id=a')).toBe('/teach/space?id=a');
    expect(spacePath('route', '')).toBe('/teach/space/route');
  });

  it('every builder takes the kind as its last, optional parameter; omitted keeps /teach/space (which renders every kind)', () => {
    const cases: Array<[string, string, string]> = [
      [ROUTES.space('space:f', 'family'), ROUTES.space('space:f'), '/parent/space?id=space%3Af'],
      [ROUTES.spacePlan('space:f', undefined, 'family'), ROUTES.spacePlan('space:f'), '/parent/space/plan?id=space%3Af'],
      [ROUTES.spaceCurriculum('space:f', 'family'), ROUTES.spaceCurriculum('space:f'), '/parent/space/curriculum?id=space%3Af'],
      [ROUTES.spaceRelink('space:f', 'family'), ROUTES.spaceRelink('space:f'), '/parent/space/relink?id=space%3Af'],
      [ROUTES.spaceSettings('space:f', 'family'), ROUTES.spaceSettings('space:f'), '/parent/space/settings?id=space%3Af'],
      [ROUTES.spaceLecture('space:f', undefined, undefined, 'family'), ROUTES.spaceLecture('space:f'), '/parent/space/lecture?id=space%3Af'],
      [ROUTES.learnerRoute('space:f', 'l:1', 'family'), ROUTES.learnerRoute('space:f', 'l:1'), '/parent/space/route?id=space%3Af&learner=l%3A1'],
      [ROUTES.classReport({ spaceId: 'space:f', kind: 'family' }), ROUTES.classReport({ spaceId: 'space:f' }), '/parent/space/report?id=space%3Af&period=week'],
    ];
    for (const [family, omitted, expected] of cases) {
      expect(family).toBe(expected);
      expect(omitted).toBe(expected.replace('/parent/space', '/teach/space'));
    }
    expect(ROUTES.spacePlan('space:f', 'plan:1', 'family')).toBe('/parent/space/plan?id=space%3Af&plan=plan%3A1');
    expect(ROUTES.spaceLecture('space:c', 'plan', 'plan:1', 'class')).toBe('/teach/space/lecture?id=space%3Ac&from=plan&plan=plan%3A1');
    expect(ROUTES.space('space:c', 'class')).toBe('/teach/space?id=space%3Ac');
    expect(ROUTES.space('space:s', 'school')).toBe('/teach/space?id=space%3As');
  });

  it('legacy family URLs under /teach/space still render: the same page component sits at both paths', () => {
    expect(parentSpacePage.default).toBe(teachSpacePage.default);
  });
});

describe("one learner's Learning Route page (Learning Route amendment section 6.1, LR-7, LR-8)", () => {
  it('sends a family to /parent/space/route (F-APP-001 A-5b) and a class, or no kind, to /teach/space/route', () => {
    expect(ROUTES.learnerRoute('space:f', 'learner:1', 'family')).toBe('/parent/space/route?id=space%3Af&learner=learner%3A1');
    expect(ROUTES.learnerRoute('space:c', 'learner:1', 'class')).toBe('/teach/space/route?id=space%3Ac&learner=learner%3A1');
    expect(ROUTES.learnerRoute('space:c', 'learner:1')).toBe('/teach/space/route?id=space%3Ac&learner=learner%3A1');
  });

  it('points only at a page this console has', () => {
    expect(existsSync(new URL('../../../app/(console)/teach/space/route/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../../../app/(console)/parent/space/route/page.tsx', import.meta.url))).toBe(true);
    expect(new URL(ROUTES.learnerRoute('s', 'l', 'family'), 'https://app.example').pathname).toBe('/parent/space/route');
    for (const kind of ['class', undefined] as const) {
      expect(new URL(ROUTES.learnerRoute('s', 'l', kind), 'https://app.example').pathname).toBe('/teach/space/route');
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

/** F-FEEDBACK-001 section 6.13 (FB-10): the notes page under the persona prefix, ids only in the URL. */
describe('ROUTES.spaceNotes', () => {
  it('puts a family under /parent and a class or school under /teach', () => {
    expect(ROUTES.spaceNotes('space:f', 'family')).toBe('/parent/space/notes?id=space%3Af');
    expect(ROUTES.spaceNotes('space:c', 'class')).toBe('/teach/space/notes?id=space%3Ac');
    expect(ROUTES.spaceNotes('space:s', 'school')).toBe('/teach/space/notes?id=space%3As');
  });

  it('adds the composer, the preselected learner, the prefilled quest and the family tab, in that order', () => {
    expect(ROUTES.spaceNotes('space:f', 'family', { compose: true, learner: 'profile:a1', quest: 'quest:stage1-letters-q1', tab: 'sent' })).toBe(
      '/parent/space/notes?id=space%3Af&compose=1&learner=profile%3Aa1&quest=quest%3Astage1-letters-q1&tab=sent',
    );
    expect(ROUTES.spaceNotes('space:c', 'class', { learner: 'profile:a1' })).toBe('/teach/space/notes?id=space%3Ac&learner=profile%3Aa1');
    expect(ROUTES.spaceNotes('space:f', 'family', { tab: 'received' })).toBe('/parent/space/notes?id=space%3Af&tab=received');
    expect(ROUTES.spaceNotes('space:c', 'class', { compose: false })).toBe('/teach/space/notes?id=space%3Ac');
  });
});

/** F-REPORT-001 section 3.1 (RP-7a1): the learner report and the class report, ids only in the URL. */
describe('ROUTES.learnerReport and ROUTES.classReport', () => {
  it('opens the learner report of a class under /teach/space/learner, week by default', () => {
    expect(ROUTES.learnerReport({ spaceId: 'space:c', learnerId: 'profile:1', kind: 'class' })).toBe('/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=week');
    expect(ROUTES.learnerReport({ spaceId: 'space:c', learnerId: 'profile:1', kind: 'class', period: 'month', at: '2026-09-01', from: 'roster' })).toBe(
      '/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=month&at=2026-09-01&from=roster',
    );
  });

  it('opens the learner report of a family under /parent/learner (RP-7c)', () => {
    // Section 3.1: /teach/space/learner?id=<family> still renders the same page, so no older link breaks.
    expect(ROUTES.learnerReport({ spaceId: 'space:f', learnerId: 'profile:2', kind: 'family', from: 'home' })).toBe('/parent/learner?id=space%3Af&learner=profile%3A2&period=week&from=home');
    expect(ROUTES.learnerReport({ spaceId: 'space:f', learnerId: 'profile:2', kind: 'family', period: 'month', at: '2026-09-01', from: 'nav' })).toBe(
      '/parent/learner?id=space%3Af&learner=profile%3A2&period=month&at=2026-09-01&from=nav',
    );
    // A school has no learner report of its own: anything that is not a family stays on the class path.
    expect(ROUTES.learnerReport({ spaceId: 'space:s', learnerId: 'profile:3', kind: 'school' })).toBe('/teach/space/learner?id=space%3As&learner=profile%3A3&period=week');
  });

  it('the two choosers: /parent/learner without a learner, /teach/space/report without a class (RP-7c, RP-8)', () => {
    expect(ROUTES.learnerReportChooser).toBe('/parent/learner');
    expect(ROUTES.classReportChooser).toBe('/teach/space/report');
  });

  it('drops an `at` that is not a day key and any `at` on All time (no stepper there)', () => {
    const base = { spaceId: 'space:c', learnerId: 'profile:1', kind: 'class' as const };
    expect(ROUTES.learnerReport({ ...base, at: 'Mina' })).toBe('/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=week');
    expect(ROUTES.learnerReport({ ...base, at: '2026-10-1' })).toBe('/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=week');
    expect(ROUTES.learnerReport({ ...base, at: null })).toBe('/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=week');
    expect(ROUTES.learnerReport({ ...base, period: 'all', at: '2026-10-01' })).toBe('/teach/space/learner?id=space%3Ac&learner=profile%3A1&period=all');
    expect(ROUTES.classReport({ spaceId: 'space:c', period: 'all', at: '2026-10-01' })).toBe('/teach/space/report?id=space%3Ac&period=all');
  });

  it('opens the class report under /teach/space/report', () => {
    expect(ROUTES.classReport({ spaceId: 'space:c' })).toBe('/teach/space/report?id=space%3Ac&period=week');
    expect(ROUTES.classReport({ spaceId: 'space:c', period: 'day', at: '2026-10-14' })).toBe('/teach/space/report?id=space%3Ac&period=day&at=2026-10-14');
  });

  it('encodes the ids, so an id can never add or change a query parameter', () => {
    const url = new URL(ROUTES.learnerReport({ spaceId: 'space:a&learner=x', learnerId: 'profile:1#top?id=y', kind: 'class', period: 'day' }), 'https://app.example');
    expect(url.pathname).toBe('/teach/space/learner');
    expect([...url.searchParams.keys()]).toEqual(['id', 'learner', 'period']);
    expect(url.searchParams.get('id')).toBe('space:a&learner=x');
    expect(url.searchParams.get('learner')).toBe('profile:1#top?id=y');
    expect(url.hash).toBe('');
    const cls = new URL(ROUTES.classReport({ spaceId: 'space:a&period=all' }), 'https://app.example');
    expect([...cls.searchParams.keys()]).toEqual(['id', 'period']);
    expect(cls.searchParams.get('period')).toBe('week');
  });

  it('takes ids and codes only: no name ever reaches the URL', () => {
    type LearnerOpts = Parameters<typeof ROUTES.learnerReport>[0];
    type ClassOpts = Parameters<typeof ROUTES.classReport>[0];
    const learnerKeys: Record<keyof LearnerOpts, true> = { spaceId: true, learnerId: true, kind: true, period: true, at: true, from: true };
    const classKeys: Record<keyof ClassOpts, true> = { spaceId: true, kind: true, period: true, at: true };
    expect(Object.keys(learnerKeys)).toHaveLength(6);
    expect(Object.keys(classKeys)).toHaveLength(4);
    const all = { spaceId: 'space:x', learnerId: 'profile:y', kind: 'class' as const, period: 'week' as const, at: '2026-10-08', from: 'nav' as const };
    for (const url of [new URL(ROUTES.learnerReport(all), 'https://app.example'), new URL(ROUTES.classReport(all), 'https://app.example')]) {
      for (const name of ['name', 'displayName', 'learnerName', 'n']) expect(url.searchParams.has(name)).toBe(false);
    }
  });
});

/** F-APP-001 A-5b and F-REPORT-001 RP-7c: the kind a page's own prefix tells before any data names it. */
describe('spaceKindOfPath', () => {
  it('a /parent/space page and the /parent/learner report belong to a family; /teach tells nothing', () => {
    expect(spaceKindOfPath('/parent/space')).toBe('family');
    expect(spaceKindOfPath('/parent/space/learner')).toBe('family');
    expect(spaceKindOfPath('/parent/learner')).toBe('family');
    expect(spaceKindOfPath('/parent/learner.html')).toBe('family');
    expect(spaceKindOfPath('/parent/learners')).toBeUndefined();
    expect(spaceKindOfPath('/parent')).toBeUndefined();
    expect(spaceKindOfPath('/teach/space/learner')).toBeUndefined();
  });
});
