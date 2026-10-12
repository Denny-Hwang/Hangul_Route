import { describe, expect, it } from 'vitest';
import { myRouteAccess, myRouteEntryOf, selfEntryTab } from '../access';

const profiles = [{ id: 'p-sam' }, { id: 'p-alex' }];

describe('myRouteAccess (F-ROUTE-001 section 3.1: the gate check)', () => {
  it('no profileId: the active profile, as the learner', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: undefined, activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('the active profile named explicitly is the learner too, gate or no gate', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('another profile with the grown-up gate open: read-only', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: true })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
  });

  it('another profile with the gate closed: the PIN screen, never the page', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'gate', profileId: 'p-alex' });
  });

  it('a profile this device does not hold shows the active learner, never a blank or a guess', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-gone', activeId: 'p-sam', profiles, gateOpen: true })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('no active profile: nothing to show', () => {
    expect(myRouteAccess({ entry: 'tab', requestedId: undefined, activeId: null, profiles: [], gateOpen: true })).toEqual({ kind: 'none' });
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-alex', activeId: null, profiles, gateOpen: false })).toEqual({ kind: 'gate', profileId: 'p-alex' });
    expect(myRouteAccess({ entry: 'tab', requestedId: 'p-alex', activeId: null, profiles, gateOpen: true })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
  });

  describe('the grown-up entry from the parent dashboard (amendment section 5.1, R-9b; LR-4: the only root-stack entry)', () => {
    it('the active profile opens read-only while the gate is open, never as the learner', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: true, entry: 'grownup' })).toEqual({ kind: 'readOnly', profileId: 'p-sam' });
    });

    it('the active profile with the gate closed: the PIN screen', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: false, entry: 'grownup' })).toEqual({ kind: 'gate', profileId: 'p-sam' });
    });

    it('another profile: read-only with the gate open, the PIN screen without it', () => {
      expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: true, entry: 'grownup' })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
      expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: false, entry: 'grownup' })).toEqual({ kind: 'gate', profileId: 'p-alex' });
    });

    it('a profile this device does not hold, or none named: nothing, never the active learner', () => {
      expect(myRouteAccess({ requestedId: 'p-gone', activeId: 'p-sam', profiles, gateOpen: true, entry: 'grownup' })).toEqual({ kind: 'none' });
      expect(myRouteAccess({ requestedId: undefined, activeId: 'p-sam', profiles, gateOpen: true, entry: 'grownup' })).toEqual({ kind: 'none' });
    });

    it('the tab entry keeps the learner entries unchanged', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: true, entry: 'tab' })).toEqual({ kind: 'self', profileId: 'p-sam' });
    });
  });

  describe('the entry kind of the root-stack screen (LR-4: params { profileId, viewer: \'grownup\' }, both required)', () => {
    it('a grown-up call with a profile id is the grown-up entry', () => {
      expect(myRouteEntryOf({ profileId: 'p-sam', viewer: 'grownup' })).toBe('grownup');
    });

    it('an old call (no params, no viewer, or no profile id) is read as the tab entry, so it resolves to the learner and moves to the tab', () => {
      expect(myRouteEntryOf(undefined)).toBe('tab');
      expect(myRouteEntryOf({ source: 'home' })).toBe('tab');
      expect(myRouteEntryOf({ viewer: 'grownup' })).toBe('tab');
      expect(myRouteEntryOf({ profileId: 'p-sam' })).toBe('tab');
      expect(myRouteAccess({ entry: myRouteEntryOf({ source: 'home' }), requestedId: undefined, activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
    });

    it('the root stack never shows the learner its own page: a self access goes to the Route tab, or Today while the tab is off', () => {
      expect(selfEntryTab(true)).toBe('Route');
      expect(selfEntryTab(false)).toBe('Home');
    });
  });
});
