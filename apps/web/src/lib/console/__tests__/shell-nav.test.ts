import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import { ADULT_NAV, currentNavItem, navFlags, navItemsFor, ownFamilySpaces, soloFamilyLearnerSpace, type NavContext } from '../shell-nav';

/** F-APP-001 A-5a, section 3.8: the adult navigation registry, its predicates and its targets. */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], learners = 1): SpaceListItem {
  return {
    space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const ALL_ON = { reports: true, notes: true, browse: true };
const ALL_OFF = { reports: false, notes: false, browse: false };

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
      ['lessons', 'both', 'lessons'],
      ['billing', 'both', 'billing'],
    ]);
  });
});

describe('navFlags', () => {
  it('reads the three sibling predicates, each off by default', () => {
    expect(navFlags('en', {}, 'https://app.hangulroute.com')).toEqual(ALL_OFF);
    expect(navFlags('en', { NEXT_PUBLIC_REPORTS_ENABLED: 'true', NEXT_PUBLIC_NOTES_ENABLED: '1', NEXT_PUBLIC_BROWSE: 'enabled' }, 'https://app.hangulroute.com')).toEqual(ALL_ON);
  });

  it('shows Lessons only with browseEnabled() on the app origin (F-BROWSE-001 section 4.3, BR-0b)', () => {
    const on = { NEXT_PUBLIC_BROWSE: 'enabled' };
    expect(navFlags('en', on, 'https://hangulroute.com').browse).toBe(false);
    expect(navFlags('en', on, 'http://localhost:4173').browse).toBe(false);
    expect(navFlags('en', { ...on, NEXT_PUBLIC_APP_URL: 'http://localhost:4173' }, 'http://localhost:4173').browse).toBe(true);
    expect(navFlags('en', { NEXT_PUBLIC_BROWSE: 'true' }, 'https://app.hangulroute.com').browse).toBe(false);
  });

  it('keeps Reports off in a console locale whose report words are not reviewed', () => {
    expect(navFlags('ko', { NEXT_PUBLIC_REPORTS_ENABLED: 'true' }).reports).toBe(false);
  });
});

describe('navItemsFor', () => {
  it('Family with every flag on: Home, Reports, Notes, Lessons, Billing', () => {
    expect(ids(ctx({ persona: 'parent', flags: ALL_ON }))).toEqual(['home', 'reports', 'notes', 'lessons', 'billing']);
  });

  it('Teacher with every flag on: Classes, Class reports, Lessons, Billing', () => {
    expect(ids(ctx({ persona: 'teacher', flags: ALL_ON }))).toEqual(['classes', 'classReports', 'lessons', 'billing']);
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
    expect(ids(ctx({ flags: { ...ALL_OFF, browse: true } }))).toEqual(['home', 'lessons', 'billing']);
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

  it('Notes opens the notes page of the one family space, else the family home', () => {
    const one = navItemsFor(ctx({ flags: ALL_ON, spaces: [item('sp_f', 'family', 'caregiver'), item('sp_c', 'class', 'teacher')] }));
    expect(one.find((entry) => entry.id === 'notes')?.target).toEqual({ href: '/parent/space/notes?id=sp_f' });
    const two = navItemsFor(ctx({ flags: ALL_ON, spaces: [item('sp_f', 'family', 'owner'), item('sp_g', 'family', 'owner')] }));
    expect(two.find((entry) => entry.id === 'notes')?.target).toEqual({ href: '/parent' });
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

  it('Class reports on the class report and its chooser; a learner report or class notes page keeps Classes (RP-7c)', () => {
    expect(currentNavItem('/teach/space/report', 'teacher', true)).toBe('classReports');
    expect(currentNavItem('/teach/space/report.html', 'teacher', true)).toBe('classReports');
    expect(currentNavItem('/teach/space/learner', 'teacher', true)).toBe('classes');
    expect(currentNavItem('/teach/space/notes', 'teacher', true)).toBe('classes');
  });

  it('on a home the account does not hold, highlights no item: the home item of the other persona links elsewhere', () => {
    // /parent for a teacher-only account (the "not set up yet" family state): Classes links to /teach/home.
    expect(currentNavItem('/parent', 'teacher', true)).toBeNull();
    // /teach/home for a family-only account: Home links to /parent.
    expect(currentNavItem('/teach/home', 'parent', true)).toBeNull();
    expect(currentNavItem('/parent', 'parent', true)).toBe('home');
    expect(currentNavItem('/teach/home', 'teacher', true)).toBe('classes');
  });

  it('highlights nothing while the persona is a guess, or on a page of no persona', () => {
    expect(currentNavItem('/teach/space', 'teacher', false)).toBeNull();
    expect(currentNavItem('/start', 'teacher', true)).toBeNull();
    expect(currentNavItem('/teach/billing', 'teacher', false)).toBe('billing');
  });
});
