import { describe, expect, it } from 'vitest';
import { myRouteAccess } from '../access';

const profiles = [{ id: 'p-sam' }, { id: 'p-alex' }];

describe('myRouteAccess (F-ROUTE-001 section 3.1: the gate check)', () => {
  it('no profileId: the active profile, as the learner', () => {
    expect(myRouteAccess({ requestedId: undefined, activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('the active profile named explicitly is the learner too, gate or no gate', () => {
    expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('another profile with the grown-up gate open: read-only', () => {
    expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: true })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
  });

  it('another profile with the gate closed: the PIN screen, never the page', () => {
    expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: false })).toEqual({ kind: 'gate', profileId: 'p-alex' });
  });

  it('a profile this device does not hold shows the active learner, never a blank or a guess', () => {
    expect(myRouteAccess({ requestedId: 'p-gone', activeId: 'p-sam', profiles, gateOpen: true })).toEqual({ kind: 'self', profileId: 'p-sam' });
  });

  it('no active profile: nothing to show', () => {
    expect(myRouteAccess({ requestedId: undefined, activeId: null, profiles: [], gateOpen: true })).toEqual({ kind: 'none' });
    expect(myRouteAccess({ requestedId: 'p-alex', activeId: null, profiles, gateOpen: false })).toEqual({ kind: 'gate', profileId: 'p-alex' });
    expect(myRouteAccess({ requestedId: 'p-alex', activeId: null, profiles, gateOpen: true })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
  });

  describe('the grown-up entry from the parent dashboard (amendment section 5.1, R-9b)', () => {
    it('the active profile opens read-only while the gate is open, never as the learner', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: true, grownup: true })).toEqual({ kind: 'readOnly', profileId: 'p-sam' });
    });

    it('the active profile with the gate closed: the PIN screen', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: false, grownup: true })).toEqual({ kind: 'gate', profileId: 'p-sam' });
    });

    it('another profile: read-only with the gate open, the PIN screen without it', () => {
      expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: true, grownup: true })).toEqual({ kind: 'readOnly', profileId: 'p-alex' });
      expect(myRouteAccess({ requestedId: 'p-alex', activeId: 'p-sam', profiles, gateOpen: false, grownup: true })).toEqual({ kind: 'gate', profileId: 'p-alex' });
    });

    it('a profile this device does not hold, or none named: nothing, never the active learner', () => {
      expect(myRouteAccess({ requestedId: 'p-gone', activeId: 'p-sam', profiles, gateOpen: true, grownup: true })).toEqual({ kind: 'none' });
      expect(myRouteAccess({ requestedId: undefined, activeId: 'p-sam', profiles, gateOpen: true, grownup: true })).toEqual({ kind: 'none' });
    });

    it('grownup false keeps the learner entries unchanged', () => {
      expect(myRouteAccess({ requestedId: 'p-sam', activeId: 'p-sam', profiles, gateOpen: true, grownup: false })).toEqual({ kind: 'self', profileId: 'p-sam' });
    });
  });
});
