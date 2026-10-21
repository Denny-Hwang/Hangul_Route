import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { ADULT_NAV, currentNavItem, navFlags, navItemsFor, ownFamilySpaces, revealScrollLeft, samePageFragment, soloFamilyLearnerSpace, type NavContext } from '../shell-nav';

/** F-APP-001 A-5a, section 3.8: the adult navigation registry, its predicates and its targets. */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], learners = 1, over: { archivedAt?: string; createdAt?: string } = {}): SpaceListItem {
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
    counts: { learners, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const ALL_ON = { reports: true, notes: true, browse: true, lecture: true };
const ALL_OFF = { reports: false, notes: false, browse: false, lecture: false };
/** Every sibling flag on except Lecture mode, whose launch default stays off until LV-7 (AMENDMENTS-LECTURE-V2 LV-D1). */
const DEFAULTS = { ...ALL_ON, lecture: false };

function ctx(over: Partial<NavContext>): NavContext {
  return { persona: 'parent', spaces: [], soloLearner: null, flags: ALL_OFF, ...over };
}

const ids = (c: NavContext): string[] => navItemsFor(c).map((entry) => entry.id);

describe('ADULT_NAV', () => {
  it('registers every item of section 3.8, in order, each with its persona and label key', () => {
    expect(ADULT_NAV.map((entry) => [entry.id, entry.persona, entry.labelKey])).toEqual([
      ['home', 'parent', 'home'],
      ['reports', 'parent', 'reports'],
      ['notes', 'parent', 'notes'],
      ['classes', 'teacher', 'classes'],
      ['classReports', 'teacher', 'classReports'],
      ['teacherNotes', 'teacher', 'notes'],
      ['lessons', 'both', 'lessons'],
      ['lecture', 'both', 'lecture'],
      ['billing', 'both', 'billing'],
    ]);
  });
});

describe('navFlags', () => {
  it('reads the sibling predicates: Reports (F-REPORT-001 RP-11), Lessons (F-BROWSE-001 BR-14) and Notes (F-FEEDBACK-001 FB-14) on by default, Lecture mode off until LV-7', () => {
    expect(navFlags('en', {}, 'https://app.hangulroute.com')).toEqual(DEFAULTS);
    expect(navFlags('en', { NEXT_PUBLIC_REPORTS_ENABLED: 'false', NEXT_PUBLIC_NOTES_ENABLED: 'false', NEXT_PUBLIC_BROWSE: 'false' }, 'https://app.hangulroute.com')).toEqual(ALL_OFF);
    expect(
      navFlags('en', { NEXT_PUBLIC_REPORTS_ENABLED: 'true', NEXT_PUBLIC_NOTES_ENABLED: '1', NEXT_PUBLIC_BROWSE: 'enabled', NEXT_PUBLIC_LECTURE_MODE: 'enabled' }, 'https://app.hangulroute.com'),
    ).toEqual(ALL_ON);
  });

  it('shows Lecture mode with lectureModeEnabled() (AMENDMENTS-LECTURE-V2 E3, LV-D1): the existing switch, not a new one', () => {
    expect(navFlags('en', { NEXT_PUBLIC_LECTURE_MODE: 'enabled' }).lecture).toBe(true);
    expect(navFlags('en', {}).lecture).toBe(false);
    expect(navFlags('en', { NEXT_PUBLIC_LECTURE_MODE: 'disabled' }).lecture).toBe(false);
  });

  it('shows Lessons only with browseEnabled() on the app origin (F-BROWSE-001 section 4.3, BR-0b)', () => {
    const on = { NEXT_PUBLIC_BROWSE: 'enabled' };
    expect(navFlags('en', on, 'https://hangulroute.com').browse).toBe(false);
    expect(navFlags('en', on, 'http://localhost:4173').browse).toBe(false);
    expect(navFlags('en', { ...on, NEXT_PUBLIC_APP_URL: 'http://localhost:4173' }, 'http://localhost:4173').browse).toBe(true);
    expect(navFlags('en', { NEXT_PUBLIC_BROWSE: 'true' }, 'https://app.hangulroute.com').browse).toBe(true);
    expect(navFlags('en', { NEXT_PUBLIC_BROWSE: 'false' }, 'https://app.hangulroute.com').browse).toBe(false);
    expect(navFlags('en', { NEXT_PUBLIC_BROWSE: '0' }, 'https://app.hangulroute.com').browse).toBe(false);
  });

  it('shows Reports in ko and es too, whose report words are signed, and keeps the switch-off', () => {
    expect(navFlags('ko', { NEXT_PUBLIC_REPORTS_ENABLED: 'true' }).reports).toBe(true);
    expect(navFlags('es', { NEXT_PUBLIC_REPORTS_ENABLED: 'true' }).reports).toBe(true);
    expect(navFlags('ko', { NEXT_PUBLIC_REPORTS_ENABLED: 'false' }).reports).toBe(false);
  });
});

describe('navItemsFor', () => {
  it('Family with every flag on: Home, Reports, Notes, Lessons, Lecture mode, Billing', () => {
    expect(ids(ctx({ persona: 'parent', flags: ALL_ON }))).toEqual(['home', 'reports', 'notes', 'lessons', 'lecture', 'billing']);
  });

  it('Teacher with every flag on: Classes, Class reports, Notes, Lessons, Lecture mode, Billing', () => {
    expect(ids(ctx({ persona: 'teacher', flags: ALL_ON }))).toEqual(['classes', 'classReports', 'teacherNotes', 'lessons', 'lecture', 'billing']);
  });

  it('with the launch defaults (Lecture mode off until LV-7): no Lecture mode item for either persona, never a disabled one', () => {
    expect(ids(ctx({ persona: 'parent', flags: DEFAULTS }))).toEqual(['home', 'reports', 'notes', 'lessons', 'billing']);
    expect(ids(ctx({ persona: 'teacher', flags: DEFAULTS }))).toEqual(['classes', 'classReports', 'teacherNotes', 'lessons', 'billing']);
  });

  it('with the flags off (today): Home and Billing, or Classes and Billing; an item whose page is not built is not drawn', () => {
    expect(ids(ctx({ persona: 'parent' }))).toEqual(['home', 'billing']);
    expect(ids(ctx({ persona: 'teacher' }))).toEqual(['classes', 'billing']);
  });

  it('each predicate shows only its own item', () => {
    expect(ids(ctx({ flags: { ...ALL_OFF, reports: true } }))).toEqual(['home', 'reports', 'billing']);
    expect(ids(ctx({ persona: 'teacher', flags: { ...ALL_OFF, reports: true } }))).toEqual(['classes', 'classReports', 'billing']);
    expect(ids(ctx({ persona: 'teacher', flags: { ...ALL_OFF, notes: true, browse: true } }))).not.toContain('classReports');
    expect(ids(ctx({ flags: { ...ALL_OFF, notes: true } }))).toEqual(['home', 'notes', 'billing']);
    expect(ids(ctx({ persona: 'teacher', flags: { ...ALL_OFF, notes: true } }))).toEqual(['classes', 'teacherNotes', 'billing']);
    expect(ids(ctx({ flags: { ...ALL_OFF, browse: true } }))).toEqual(['home', 'lessons', 'billing']);
    expect(ids(ctx({ flags: { ...ALL_OFF, lecture: true } }))).toEqual(['home', 'lecture', 'billing']);
    expect(ids(ctx({ persona: 'teacher', flags: { ...ALL_OFF, lecture: true } }))).toEqual(['classes', 'lecture', 'billing']);
  });

  it('targets: Home the family home, Classes the teacher home, Billing the billing page, Lessons All lessons at /browse (a learner root)', () => {
    const family = navItemsFor(ctx({ persona: 'parent', flags: ALL_ON }));
    expect(family.find((entry) => entry.id === 'home')?.target).toEqual({ href: '/parent' });
    expect(family.find((entry) => entry.id === 'lessons')?.target).toEqual({ href: '/browse', document: true });
    expect(family.find((entry) => entry.id === 'billing')?.target).toEqual({ href: '/account/billing' });
    const teacher = navItemsFor(ctx({ persona: 'teacher' }));
    expect(teacher.find((entry) => entry.id === 'classes')?.target).toEqual({ href: '/teach/home' });
  });

  it('Reports opens the one learner report for one family with one learner, else the parent chooser /parent/learner (RP-7c)', () => {
    const one = navItemsFor(ctx({ flags: ALL_ON, spaces: [item('sp_f', 'family', 'owner', 1)], soloLearner: { spaceId: 'sp_f', learnerId: 'lrn_1' } }));
    expect(one.find((entry) => entry.id === 'reports')?.target).toEqual({ href: '/parent/learner?id=sp_f&learner=lrn_1&period=week&from=nav' });
    const many = navItemsFor(ctx({ flags: ALL_ON, spaces: [item('sp_f', 'family', 'owner', 2)] }));
    expect(many.find((entry) => entry.id === 'reports')?.target).toEqual({ href: '/parent/learner' });
  });

  it('Class reports opens the class chooser, which opens the one class directly (RP-7c, RP-8)', () => {
    const teacher = navItemsFor(ctx({ persona: 'teacher', flags: ALL_ON, spaces: [item('sp_c', 'class', 'teacher', 5)] }));
    expect(teacher.find((entry) => entry.id === 'classReports')?.target).toEqual({ href: '/teach/space/report' });
  });

  it('Notes opens the notes hub of the persona (FB-11b), which goes straight on with one space and lists several', () => {
    const one = navItemsFor(ctx({ flags: ALL_ON, spaces: [item('sp_f', 'family', 'caregiver'), item('sp_c', 'class', 'teacher')] }));
    expect(one.find((entry) => entry.id === 'notes')?.target).toEqual({ href: '/parent/notes' });
    const teacher = navItemsFor(ctx({ persona: 'teacher', flags: ALL_ON, spaces: [item('sp_c', 'class', 'teacher')] }));
    expect(teacher.find((entry) => entry.id === 'teacherNotes')?.target).toEqual({ href: '/teach/notes' });
  });
});

describe('the Lecture mode item (AMENDMENTS-LECTURE-V2 E3, LV-5)', () => {
  const lectureTarget = (c: NavContext): string | undefined => navItemsFor(c).find((entry) => entry.id === 'lecture')?.target.href;
  const on = { ...ALL_OFF, lecture: true };

  it('one composable space: that space\'s lecture setup page, under the prefix of its kind', () => {
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [item('sp_c', 'class', 'teacher')] }))).toBe('/teach/space/lecture?id=sp_c');
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [item('sp_c', 'class', 'owner')] }))).toBe('/teach/space/lecture?id=sp_c');
    expect(lectureTarget(ctx({ persona: 'parent', flags: on, spaces: [item('sp_f', 'family', 'caregiver')] }))).toBe('/parent/space/lecture?id=sp_f');
    expect(lectureTarget(ctx({ persona: 'parent', flags: on, spaces: [item('sp_f', 'family', 'owner')] }))).toBe('/parent/space/lecture?id=sp_f');
  });

  it('several composable spaces: the persona home at its card, which offers the choice', () => {
    const classes = [item('sp_a', 'class', 'teacher'), item('sp_b', 'class', 'owner')];
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: classes }))).toBe('/teach/home#lecture-mode');
    const families = [item('sp_f', 'family', 'owner'), item('sp_g', 'family', 'caregiver')];
    expect(lectureTarget(ctx({ persona: 'parent', flags: on, spaces: families }))).toBe('/parent#lecture-mode');
  });

  it('no composable space: the persona home at its card, whose Start opens the presenter with no space', () => {
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [] }))).toBe('/teach/home#lecture-mode');
    expect(lectureTarget(ctx({ persona: 'parent', flags: on, spaces: [] }))).toBe('/parent#lecture-mode');
  });

  it('counts only canComposeIn spaces of the persona: a school admin without a teacher or owner role in any class gets the no-space path', () => {
    const admin = [item('sp_s', 'school', 'admin'), item('sp_child', 'class', 'admin'), item('sp_s2', 'school', 'owner')];
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: admin }))).toBe('/teach/home#lecture-mode');
    // A student seat in a family and a class of the other persona never count.
    expect(lectureTarget(ctx({ persona: 'parent', flags: on, spaces: [item('sp_f', 'family', 'student'), item('sp_c', 'class', 'teacher')] }))).toBe('/parent#lecture-mode');
    // The one class beside the admin seats is the one target.
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [...admin, item('sp_c', 'class', 'teacher'), item('sp_f', 'family', 'owner')] }))).toBe('/teach/space/lecture?id=sp_c');
  });

  it('an archived space is not offered: its own page keeps the button, the entry points teach in live spaces', () => {
    const archived = item('sp_old', 'class', 'owner', 1, { archivedAt: '2026-09-01T00:00:00Z' });
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [archived] }))).toBe('/teach/home#lecture-mode');
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [archived, item('sp_c', 'class', 'teacher')] }))).toBe('/teach/space/lecture?id=sp_c');
  });

  it('puts ids only in the link, never a space name', () => {
    const named = { ...item('sp_c', 'class', 'teacher'), space: { ...item('sp_c', 'class', 'teacher').space, name: 'Mina and Jun' } };
    expect(lectureTarget(ctx({ persona: 'teacher', flags: on, spaces: [named] }))).not.toMatch(/Mina|Jun/);
  });

  it('is not drawn while lectureModeEnabled() is off, whatever the spaces', () => {
    expect(lectureTarget(ctx({ persona: 'teacher', flags: DEFAULTS, spaces: [item('sp_c', 'class', 'teacher')] }))).toBeUndefined();
    expect(lectureTarget(ctx({ persona: 'parent', flags: DEFAULTS, spaces: [item('sp_f', 'family', 'owner')] }))).toBeUndefined();
  });
});

describe('samePageFragment', () => {
  it('names the fragment of a target on the page already open, whatever its trailing slash or .html', () => {
    expect(samePageFragment('/parent#lecture-mode', '/parent')).toBe('lecture-mode');
    expect(samePageFragment('/parent#lecture-mode', '/parent/')).toBe('lecture-mode');
    expect(samePageFragment('/parent#lecture-mode', '/parent.html')).toBe('lecture-mode');
    expect(samePageFragment('/teach/home#lecture-mode', '/teach/home')).toBe('lecture-mode');
  });

  it('is null for another page, for a target with no fragment and for an empty one', () => {
    expect(samePageFragment('/parent#lecture-mode', '/teach/home')).toBeNull();
    expect(samePageFragment('/parent#lecture-mode', '/parent/space')).toBeNull();
    expect(samePageFragment('/teach/space/lecture?id=sp_c', '/teach/space/lecture')).toBeNull();
    expect(samePageFragment('/parent#', '/parent')).toBeNull();
  });
});

describe('revealScrollLeft (the tab row shows its current item, inline nearest)', () => {
  it('leaves the row alone when the item already shows whole', () => {
    expect(revealScrollLeft({ scrollLeft: 0, width: 300 }, { left: 0, width: 80 })).toBeNull();
    expect(revealScrollLeft({ scrollLeft: 100, width: 300 }, { left: 320, width: 80 })).toBeNull();
  });

  it('moves the least: an item past the end lines up with the end, one before the start with the start', () => {
    // The family row at 375: Lecture mode and Billing start past the end.
    expect(revealScrollLeft({ scrollLeft: 0, width: 343 }, { left: 330, width: 110 })).toBe(97);
    expect(revealScrollLeft({ scrollLeft: 200, width: 300 }, { left: 120, width: 80 })).toBe(120);
  });

  it('an item wider than the row starts at its start edge', () => {
    expect(revealScrollLeft({ scrollLeft: 0, width: 100 }, { left: 150, width: 140 })).toBe(150);
  });
});

describe('ownFamilySpaces and soloFamilyLearnerSpace', () => {
  it('counts only family spaces held as owner or caregiver', () => {
    expect(ownFamilySpaces([item('a', 'family', 'owner'), item('b', 'family', 'caregiver'), item('c', 'family', 'student'), item('d', 'class', 'owner')]).map((s) => s.space.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('names the family to read a roster from only when there is exactly one family with exactly one learner', () => {
    expect(soloFamilyLearnerSpace([item('a', 'family', 'owner', 1), item('c', 'class', 'teacher', 5)])).toBe('a');
    expect(soloFamilyLearnerSpace([item('a', 'family', 'owner', 2)])).toBeNull();
    expect(soloFamilyLearnerSpace([item('a', 'family', 'owner', 0)])).toBeNull();
    expect(soloFamilyLearnerSpace([item('a', 'family', 'owner', 1), item('b', 'family', 'owner', 1)])).toBeNull();
    expect(soloFamilyLearnerSpace([])).toBeNull();
  });
});

describe('currentNavItem', () => {
  it('highlights the persona home item on its home and on the space pages of that persona', () => {
    expect(currentNavItem('/parent', 'parent', true)).toBe('home');
    expect(currentNavItem('/teach/home', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/teach/space', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/teach/space/plan', 'parent', true)).toBe('home');
    expect(currentNavItem('/parent/space/settings', 'parent', true)).toBe('home');
  });

  it('highlights Reports on report pages, Notes on notes pages and Billing on the billing pages', () => {
    expect(currentNavItem('/teach/space/learner', 'parent', true)).toBe('reports');
    expect(currentNavItem('/parent/space/report', 'parent', true)).toBe('reports');
    expect(currentNavItem('/parent/learner', 'parent', true)).toBe('reports');
    expect(currentNavItem('/parent/learner.html', 'parent', true)).toBe('reports');
    expect(currentNavItem('/parent/space/notes', 'parent', true)).toBe('notes');
    expect(currentNavItem('/teach/billing', 'teacher', true)).toBe('billing');
    expect(currentNavItem('/account/billing', 'parent', true)).toBe('billing');
    expect(currentNavItem('/account/billing/receipts', 'parent', true)).toBe('billing');
  });

  it('Class reports on the class report and its chooser; a learner report keeps Classes; the class notes page and the teacher hub highlight the Teacher Notes item (RP-7c, FB-11b)', () => {
    expect(currentNavItem('/teach/space/report', 'teacher', true)).toBe('classReports');
    expect(currentNavItem('/teach/space/report.html', 'teacher', true)).toBe('classReports');
    expect(currentNavItem('/teach/space/learner', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/teach/space/notes', 'teacher', true)).toBe('teacherNotes');
    expect(currentNavItem('/teach/notes', 'teacher', true)).toBe('teacherNotes');
  });

  it('the parent notes hub highlights Notes', () => {
    expect(currentNavItem('/parent/notes', 'parent', true)).toBe('notes');
    expect(currentNavItem('/parent/notes.html', 'parent', true)).toBe('notes');
  });

  it('on a home the account does not hold, highlights no item: the home item of the other persona links elsewhere', () => {
    // /parent for a teacher-only account (the "not set up yet" family state): Classes links to /teach/home.
    expect(currentNavItem('/parent', 'teacher', true)).toBeNull();
    // /teach/home for a family-only account: Home links to /parent.
    expect(currentNavItem('/teach/home', 'parent', true)).toBeNull();
    expect(currentNavItem('/parent', 'parent', true)).toBe('home');
    expect(currentNavItem('/teach/home', 'teacher', true)).toBe('classes');
  });

  it('highlights Lecture mode on the lecture setup page of either kind, like Billing even before the persona resolves (E3)', () => {
    expect(currentNavItem('/teach/space/lecture', 'teacher', true, true)).toBe('lecture');
    expect(currentNavItem('/parent/space/lecture', 'parent', true, true)).toBe('lecture');
    expect(currentNavItem('/parent/space/lecture.html', 'parent', true, true)).toBe('lecture');
    expect(currentNavItem('/teach/space/lecture', 'parent', false, true)).toBe('lecture');
    // The space page itself and its other pages keep the persona's home item.
    expect(currentNavItem('/teach/space', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/parent/space/plan', 'parent', true)).toBe('home');
  });

  it('with lectureModeEnabled() off (no Lecture mode item drawn), a lecture page reached by URL keeps the persona home item current', () => {
    expect(currentNavItem('/teach/space/lecture', 'teacher', true, false)).toBe('classes');
    expect(currentNavItem('/parent/space/lecture', 'parent', true, false)).toBe('home');
    expect(currentNavItem('/teach/space/lecture', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/teach/space/lecture', 'teacher', false, false)).toBeNull();
  });

  it('highlights nothing while the persona is a guess, or on a page of no persona', () => {
    expect(currentNavItem('/teach/space', 'teacher', false)).toBeNull();
    expect(currentNavItem('/start', 'teacher', true)).toBeNull();
    expect(currentNavItem('/teach/billing', 'teacher', false)).toBe('billing');
  });
});
