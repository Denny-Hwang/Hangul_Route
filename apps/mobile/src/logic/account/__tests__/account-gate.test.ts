import { describe, expect, it } from 'vitest';
import { ACCOUNT_ROUTE_NAMES, enteredFromOutside, gateStep, lockCauseOf, type GateDecisionInput } from '../account-gate';

/**
 * F-AUTH-004 sections 7.2 and 7.3 (row NS-4; CS-N2, CS-N3, CS-N11, CS-N14): what AccountGate does at one decision
 * moment, over every row of the table and what one screen mount adds (the screen's own result, freshness held until
 * the first open, one typed PIN asked, Sign in again after the typed PIN).
 */

const base: GateDecisionInput = {
  screen: 'home',
  gate: { state: 'pin', epoch: 7 },
  clerk: 'ready',
  signedIn: true,
  signedInThisVisit: false,
  trust: { v: 1, epoch: 7 },
  retrustPending: false,
  fresh: true,
  enteredFromOutside: true,
  opened: false,
  askedPin: false,
  again: false,
  sessionLapsed: false,
  sessionExpired: false,
};
const step = (over: Partial<GateDecisionInput> = {}) => gateStep({ ...base, ...over });

describe('before Clerk: the gate state decides first (no account call)', () => {
  it('unknown locks with Try again whatever Clerk says (CS-N14)', () => {
    for (const clerk of ['off', 'loading', 'ready'] as const) expect(step({ gate: { state: 'unknown' }, clerk })).toEqual({ kind: 'locked', cause: 'unknown', action: 'try_again' });
  });

  it('nopin goes to PIN setup whatever Clerk says (ND-7)', () => {
    for (const clerk of ['off', 'loading', 'ready'] as const) expect(step({ gate: { state: 'nopin' }, clerk })).toEqual({ kind: 'setup' });
  });

  it('no Clerk for this visit: nothing can be checked (the unknown lock); Clerk loading: wait', () => {
    expect(step({ clerk: 'off' })).toEqual({ kind: 'locked', cause: 'unknown', action: 'try_again' });
    expect(step({ clerk: 'loading' })).toEqual({ kind: 'wait' });
    expect(step({ gate: { state: 'open' }, clerk: 'off' })).toEqual({ kind: 'locked', cause: 'unknown', action: 'try_again' });
  });
});

describe('the table of 7.2 for a home', () => {
  it('pin, signed in, trust equal, fresh: open', () => {
    expect(step()).toEqual({ kind: 'open' });
  });

  it('pin, epoch 0: locked with Back, never trusted', () => {
    expect(step({ gate: { state: 'pin', epoch: 0 }, trust: { v: 1, epoch: 0 } as never })).toEqual({ kind: 'locked', cause: 'epoch_zero', action: 'back' });
  });

  it('pin, signed in, no trust / another epoch / re-trust pending: locked with Sign in again', () => {
    expect(step({ trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
    expect(step({ trust: { v: 1, epoch: 3 } })).toEqual({ kind: 'locked', cause: 'pin_changed', action: 'sign_in_again' });
    expect(step({ trust: { v: 1, epoch: 3 }, retrustPending: true })).toEqual({ kind: 'locked', cause: 'retrust_password', action: 'sign_in_again' });
  });

  it('pin, not signed in: the sign-in in the home’s place', () => {
    expect(step({ signedIn: false })).toEqual({ kind: 'to_sign_in' });
  });

  it('open: the sign-in unless signed in during this visit (ND-9)', () => {
    expect(step({ gate: { state: 'open' }, trust: null })).toEqual({ kind: 'to_sign_in' });
    expect(step({ gate: { state: 'open' }, trust: null, signedInThisVisit: true, fresh: false })).toEqual({ kind: 'open' });
  });
});

describe('the sign-in screen', () => {
  it('opens on sign_in; at its mount a session already past the gate sends it to the home', () => {
    expect(step({ screen: 'sign_in', signedIn: false })).toEqual({ kind: 'open' });
    expect(step({ screen: 'sign_in' })).toEqual({ kind: 'to_home' });
  });

  it('once open it stays open on home (its completion moves on), and locks on a lock', () => {
    expect(step({ screen: 'sign_in', opened: true })).toEqual({ kind: 'open' });
    expect(step({ screen: 'sign_in', opened: true, trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
  });
});

describe('ND-5, CS-N11: freshness', () => {
  it('from outside without a fresh proof: ask the typed PIN once; still without one: leave', () => {
    expect(step({ fresh: false })).toEqual({ kind: 'ask_pin' });
    expect(step({ fresh: false, askedPin: true })).toEqual({ kind: 'leave' });
    expect(step({ screen: 'sign_in', signedIn: false, fresh: false })).toEqual({ kind: 'ask_pin' });
  });

  it('from inside the account routes, or once open in this mount: no PIN asked', () => {
    expect(step({ fresh: false, enteredFromOutside: false })).toEqual({ kind: 'open' });
    expect(step({ fresh: false, opened: true })).toEqual({ kind: 'open' });
  });

  it('a lock is shown without a fresh proof (it shows nothing of the account)', () => {
    expect(step({ fresh: false, trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
  });
});

describe('Sign in again (`again`)', () => {
  it('fresh: sign out then sign in; not fresh: the typed PIN; asked and still not fresh: the lock as it was', () => {
    expect(step({ trust: null, again: true })).toEqual({ kind: 'sign_out_then_sign_in' });
    expect(step({ trust: null, again: true, fresh: false })).toEqual({ kind: 'ask_pin' });
    expect(step({ trust: null, again: true, fresh: false, askedPin: true })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
  });

  it('only on a lock whose action is Sign in again', () => {
    expect(step({ gate: { state: 'pin', epoch: 0 }, again: true })).toEqual({ kind: 'locked', cause: 'epoch_zero', action: 'back' });
    expect(step({ again: true })).toEqual({ kind: 'open' });
    expect(step({ screen: 'sign_in', signedIn: false, again: true })).toEqual({ kind: 'open' });
  });
});

describe('the 15-minute session (OA-D5, row NS-4 review)', () => {
  it('an open screen whose session lapsed closes it, whatever else holds', () => {
    expect(step({ opened: true, sessionLapsed: true })).toEqual({ kind: 'close' });
    expect(step({ opened: true, sessionLapsed: true, gate: { state: 'unknown' } })).toEqual({ kind: 'close' });
    expect(step({ opened: true, sessionLapsed: true, gate: { state: 'open' }, signedInThisVisit: true })).toEqual({ kind: 'close' });
  });

  it('before the first open of a screen entered from outside it is not read (the entry’s own proof decides)', () => {
    expect(step({ sessionLapsed: true })).toEqual({ kind: 'open' });
    expect(step({ sessionLapsed: true, fresh: false })).toEqual({ kind: 'ask_pin' });
  });

  it('row NS-7 (CS-N2, CS-N14): nothing opens on an expired session, whatever the device or the entry: it closes first', () => {
    for (const gate of [{ state: 'pin' as const, epoch: 7 }, { state: 'open' as const }]) {
      for (const enteredFromOutside of [true, false]) {
        expect(step({ gate, enteredFromOutside, sessionLapsed: true, sessionExpired: true, signedInThisVisit: true })).toEqual({ kind: 'close' });
      }
    }
    expect(step({ screen: 'sign_in', signedIn: false, sessionLapsed: true, sessionExpired: true })).toEqual({ kind: 'close' });
  });

  it('row NS-7 (CS-N2): a page opened from inside the account routes with no session on pin leaves (no close loop)', () => {
    const inside = { enteredFromOutside: false, fresh: false, sessionLapsed: true };
    expect(step(inside)).toEqual({ kind: 'leave' });
    expect(step({ ...inside, trust: null })).toEqual({ kind: 'leave' });
    // Inside the session it opens without a new PIN (OA-D5b).
    expect(step({ ...inside, sessionLapsed: false })).toEqual({ kind: 'open' });
    // A device with no PIN starts over as a new visit (the sign-in); unknown and nopin decide as always.
    expect(step({ ...inside, gate: { state: 'open' } })).toEqual({ kind: 'to_sign_in' });
    expect(step({ ...inside, gate: { state: 'unknown' } })).toEqual({ kind: 'locked', cause: 'unknown', action: 'try_again' });
    expect(step({ ...inside, gate: { state: 'nopin' } })).toEqual({ kind: 'setup' });
  });
});

describe('auth.native.lock’s cause (section 15)', () => {
  it('a locked step or PIN setup; nothing else', () => {
    expect(lockCauseOf({ kind: 'locked', cause: 'pin_changed', action: 'sign_in_again' })).toBe('pin_changed');
    expect(lockCauseOf({ kind: 'setup' })).toBe('needs_pin');
    for (const kind of ['wait', 'open', 'to_sign_in', 'to_home', 'ask_pin', 'leave', 'sign_out_then_sign_in', 'close'] as const) expect(lockCauseOf({ kind })).toBeNull();
  });
});

describe('where an account screen was entered from', () => {
  it('the route under it is not an account route, or there is none: outside', () => {
    expect(enteredFromOutside([{ key: 'd', name: 'ParentDashboard' }, { key: 'me', name: 'AccountHome' }], 'me')).toBe(true);
    expect(enteredFromOutside([{ key: 'me', name: 'SignIn' }], 'me')).toBe(true);
    expect(enteredFromOutside([{ key: 's', name: 'SignIn' }, { key: 'me', name: 'AccountHome' }], 'me')).toBe(false);
    expect(enteredFromOutside([{ key: 'h', name: 'AccountHome' }, { key: 'me', name: 'SignIn' }], 'me')).toBe(false);
    // Row NS-5: a report opened from a home moves inside the account routes (the 15-minute session, OA-D5b).
    expect(enteredFromOutside([{ key: 'd', name: 'ParentDashboard' }, { key: 'h', name: 'AccountHome' }, { key: 'me', name: 'AccountLearnerReport' }], 'me')).toBe(false);
    expect(enteredFromOutside([{ key: 'r', name: 'AccountLearnerReport' }, { key: 'me', name: 'SignIn' }], 'me')).toBe(false);
    expect(enteredFromOutside([{ key: 'me', name: 'AccountLearnerReport' }], 'me')).toBe(true);
    expect([...ACCOUNT_ROUTE_NAMES]).toEqual(['SignIn', 'AccountHome', 'AccountLearnerReport', 'AccountSpace', 'AccountSchool', 'AccountClassReport']);
    // Row NS-6: moving from a home to a class page, a school page or a class report stays inside the account routes.
    expect(enteredFromOutside([{ key: 'h', name: 'AccountHome' }, { key: 's', name: 'AccountSchool' }, { key: 'c', name: 'AccountSpace' }, { key: 'me', name: 'AccountClassReport' }], 'me')).toBe(false);
    expect(enteredFromOutside([{ key: 'h', name: 'AccountHome' }, { key: 'me', name: 'AccountSchool' }], 'me')).toBe(false);
  });

  it('a screen not in the state counts as outside (fail closed)', () => {
    expect(enteredFromOutside([{ key: 'h', name: 'AccountHome' }], 'me')).toBe(true);
    expect(ACCOUNT_ROUTE_NAMES.has('ParentDashboard')).toBe(false);
  });
});
