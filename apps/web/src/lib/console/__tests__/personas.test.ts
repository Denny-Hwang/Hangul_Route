import { describe, expect, it } from 'vitest';
import type { SpaceListItem } from '../api';
import {
  FAMILY_HOME_LIVE,
  activePersona,
  fallbackPersona,
  heldPersonas,
  homeToRecord,
  pageArea,
  personaHome,
  personaOfKind,
  showPersonaSwitch,
} from '../personas';

/** F-APP-001 A-5a, sections 3.5 and 3.8: personas from memberships, the active persona of a page, the last persona. */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], learners = 1): SpaceListItem {
  return {
    space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

const family = item('sp_f', 'family', 'owner');
const klass = item('sp_c', 'class', 'teacher');
const school = item('sp_s', 'school', 'admin');

describe('personaOfKind', () => {
  it('maps a family to Family and a class or a school to Teacher (section 3.8)', () => {
    expect(personaOfKind('family')).toBe('parent');
    expect(personaOfKind('class')).toBe('teacher');
    expect(personaOfKind('school')).toBe('teacher');
  });
});

describe('heldPersonas', () => {
  it('reads personas from the spaces list, Family first, unknown kinds and student roles ignored', () => {
    expect(heldPersonas([klass, family])).toEqual(['parent', 'teacher']);
    expect(heldPersonas([school])).toEqual(['teacher']);
    expect(heldPersonas([item('sp_x', 'family', 'student')])).toEqual([]);
    expect(heldPersonas([{ ...family, space: { ...family.space, kind: 'galaxy' as never } }])).toEqual([]);
    expect(heldPersonas(null)).toEqual([]);
  });
});

describe('personaHome', () => {
  it('sends Family to /parent and Teacher to /teach/home once the family home is live (A-5b)', () => {
    expect(personaHome('parent', true)).toBe('/parent');
    expect(personaHome('teacher', true)).toBe('/teach/home');
  });

  it('keeps Family on the console home while /parent is still the demo, so no real account lands on mock data', () => {
    expect(personaHome('parent', false)).toBe('/teach/home');
    expect(personaHome('teacher', false)).toBe('/teach/home');
    expect(personaHome('parent')).toBe(FAMILY_HOME_LIVE ? '/parent' : '/teach/home');
  });
});

describe('pageArea', () => {
  it('names the persona homes, with or without a trailing slash or .html', () => {
    expect(pageArea('/parent', '')).toEqual({ kind: 'home', persona: 'parent' });
    expect(pageArea('/parent/', '')).toEqual({ kind: 'home', persona: 'parent' });
    expect(pageArea('/parent.html', '')).toEqual({ kind: 'home', persona: 'parent' });
    expect(pageArea('/teach/home', '')).toEqual({ kind: 'home', persona: 'teacher' });
    expect(pageArea('/teach/home/', '?x=1')).toEqual({ kind: 'home', persona: 'teacher' });
  });

  it('reads the space id of every space page under both prefixes', () => {
    expect(pageArea('/teach/space', '?id=sp_c')).toEqual({ kind: 'space', spaceId: 'sp_c' });
    expect(pageArea('/teach/space/plan', 'id=sp_c&plan=p1')).toEqual({ kind: 'space', spaceId: 'sp_c' });
    expect(pageArea('/parent/space/notes/', '?id=sp_f')).toEqual({ kind: 'space', spaceId: 'sp_f' });
    expect(pageArea('/teach/space.html', '?id=%20sp_c%20')).toEqual({ kind: 'space', spaceId: 'sp_c' });
    expect(pageArea('/teach/space', '')).toEqual({ kind: 'space', spaceId: '' });
  });

  it('treats everything else as a page of no persona (billing, start, unknown)', () => {
    expect(pageArea('/account/billing', '')).toEqual({ kind: 'other' });
    expect(pageArea('/teach/billing', '')).toEqual({ kind: 'other' });
    expect(pageArea('/start', '')).toEqual({ kind: 'other' });
    expect(pageArea('/teach/spacex', '?id=a')).toEqual({ kind: 'other' });
    expect(pageArea('/parentx', '')).toEqual({ kind: 'other' });
  });
});

describe('fallbackPersona', () => {
  it('is the last persona when the account holds it, else the first held, else Family (OD-11)', () => {
    expect(fallbackPersona('teacher', ['parent', 'teacher'])).toBe('teacher');
    expect(fallbackPersona('parent', ['teacher'])).toBe('teacher');
    expect(fallbackPersona(null, ['teacher'])).toBe('teacher');
    expect(fallbackPersona(null, [])).toBe('parent');
  });

  it('while the spaces are unknown, is the last persona as remembered (Family when none, design pass D16)', () => {
    expect(fallbackPersona('teacher', null)).toBe('teacher');
    expect(fallbackPersona(null, null)).toBe('parent');
  });
});

describe('activePersona', () => {
  const both = [family, klass];

  it('on a home is the page persona when held (live family home)', () => {
    expect(activePersona({ area: { kind: 'home', persona: 'teacher' }, spaces: both, last: 'parent', live: true })).toEqual({ persona: 'teacher', resolved: true });
    expect(activePersona({ area: { kind: 'home', persona: 'parent' }, spaces: both, last: 'teacher', live: true })).toEqual({ persona: 'parent', resolved: true });
  });

  it('on a home the account does not hold, keeps the nav of what it holds (no-class / no-family states)', () => {
    expect(activePersona({ area: { kind: 'home', persona: 'teacher' }, spaces: [family], last: null, live: true })).toEqual({ persona: 'parent', resolved: true });
    expect(activePersona({ area: { kind: 'home', persona: 'parent' }, spaces: [klass], last: null, live: true })).toEqual({ persona: 'teacher', resolved: true });
    expect(activePersona({ area: { kind: 'home', persona: 'teacher' }, spaces: [], last: null, live: true })).toEqual({ persona: 'teacher', resolved: true });
  });

  it('on a space page comes from the kind of the page space, not from the path', () => {
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_f' }, spaces: both, last: 'teacher', live: true })).toEqual({ persona: 'parent', resolved: true });
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_c' }, spaces: both, last: 'parent', live: true })).toEqual({ persona: 'teacher', resolved: true });
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_s' }, spaces: [school], last: null, live: true })).toEqual({ persona: 'teacher', resolved: true });
  });

  it('while the lookup is pending, or the space is not listed, uses the last persona and stays unresolved', () => {
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_c' }, spaces: null, last: 'teacher', live: true })).toEqual({ persona: 'teacher', resolved: false });
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_c' }, spaces: null, last: null, live: true })).toEqual({ persona: 'parent', resolved: false });
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_zz' }, spaces: both, last: 'teacher', live: true })).toEqual({ persona: 'teacher', resolved: false });
    expect(activePersona({ area: { kind: 'space', spaceId: 'sp_f' }, spaces: [{ ...family, space: { ...family.space, kind: 'galaxy' as never } }], last: null, live: true })).toEqual({
      persona: 'parent',
      resolved: false,
    });
  });

  it('on any other page is the last held persona, else the first held (billing highlights in that row)', () => {
    expect(activePersona({ area: { kind: 'other' }, spaces: both, last: 'teacher', live: true })).toEqual({ persona: 'teacher', resolved: true });
    expect(activePersona({ area: { kind: 'other' }, spaces: [klass], last: 'parent', live: true })).toEqual({ persona: 'teacher', resolved: true });
    expect(activePersona({ area: { kind: 'other' }, spaces: null, last: null, live: true })).toEqual({ persona: 'parent', resolved: false });
  });

  it('while /parent is still the demo, the console home is the home of a Family-only account too', () => {
    expect(activePersona({ area: { kind: 'home', persona: 'teacher' }, spaces: [family], last: null, live: false })).toEqual({ persona: 'parent', resolved: true });
    expect(activePersona({ area: { kind: 'home', persona: 'teacher' }, spaces: both, last: 'parent', live: false })).toEqual({ persona: 'teacher', resolved: true });
  });
});

describe('showPersonaSwitch', () => {
  it('shows the switch only to an account that holds both personas, once each has its own home', () => {
    expect(showPersonaSwitch(['parent', 'teacher'], true)).toBe(true);
    expect(showPersonaSwitch(['teacher'], true)).toBe(false);
    expect(showPersonaSwitch(['parent'], true)).toBe(false);
    expect(showPersonaSwitch(['parent', 'teacher'], false)).toBe(false);
  });
});

describe('homeToRecord', () => {
  it('records the persona of a home that renders with that persona held (section 3.5)', () => {
    expect(homeToRecord({ kind: 'home', persona: 'teacher' }, { persona: 'teacher', resolved: true }, ['teacher'])).toBe('teacher');
    expect(homeToRecord({ kind: 'home', persona: 'parent' }, { persona: 'parent', resolved: true }, ['parent', 'teacher'], true)).toBe('parent');
  });

  it('while /parent is still the demo, the console home records Family for a Family-only account; once live it does not', () => {
    expect(homeToRecord({ kind: 'home', persona: 'teacher' }, { persona: 'parent', resolved: true }, ['parent'], false)).toBe('parent');
    expect(homeToRecord({ kind: 'home', persona: 'teacher' }, { persona: 'parent', resolved: true }, ['parent'], true)).toBeNull();
  });

  it('records nothing on a home the account does not hold, on space pages, other pages, or before the spaces load', () => {
    expect(homeToRecord({ kind: 'home', persona: 'teacher' }, { persona: 'teacher', resolved: true }, [])).toBeNull();
    expect(homeToRecord({ kind: 'space', spaceId: 'sp_c' }, { persona: 'teacher', resolved: true }, ['teacher'])).toBeNull();
    expect(homeToRecord({ kind: 'other' }, { persona: 'teacher', resolved: true }, ['teacher'])).toBeNull();
    expect(homeToRecord({ kind: 'home', persona: 'teacher' }, { persona: 'teacher', resolved: false }, ['teacher'])).toBeNull();
  });
});
