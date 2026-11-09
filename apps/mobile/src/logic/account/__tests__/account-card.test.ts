import { describe, expect, it } from 'vitest';
import { accountCardView, cardUses, type AccountCardInput } from '../account-card';

/**
 * F-AUTH-004 sections 7.1, 7.2 and 6.6, design D7 (row NS-3; CS-N2, CS-N9, CS-N11): what the Grown-up area's account
 * card shows, and when its buttons ask the typed PIN first.
 */

const base: AccountCardInput = {
  gate: { state: 'pin', epoch: 7 },
  clerk: 'ready',
  online: true,
  signedIn: true,
  signedInThisVisit: false,
  trust: { v: 1, epoch: 7 },
  retrustPending: false,
  fresh: true,
};
const view = (over: Partial<AccountCardInput>) => accountCardView({ ...base, ...over });

describe('the account card (D7)', () => {
  it('draws nothing before the gate is read, on nopin, or before Clerk is decided', () => {
    expect(view({ gate: null })).toEqual({ kind: 'hidden' });
    expect(view({ gate: { state: 'nopin' } })).toEqual({ kind: 'hidden' });
    expect(view({ clerk: 'pending' })).toEqual({ kind: 'hidden' });
  });

  it('gate unknown, or no Clerk for this visit: cantCheck (no email)', () => {
    expect(view({ gate: { state: 'unknown' } })).toEqual({ kind: 'cant_check' });
    expect(view({ clerk: 'off' })).toEqual({ kind: 'cant_check' });
  });

  it('Clerk still loading: nothing online; offline, signed out (Sign in waits for the network)', () => {
    expect(view({ clerk: 'loading' })).toEqual({ kind: 'hidden' });
    expect(view({ clerk: 'loading', online: false })).toEqual({ kind: 'signed_out' });
  });

  it('signed out on pin and on open', () => {
    expect(view({ signedIn: false })).toEqual({ kind: 'signed_out' });
    expect(view({ gate: { state: 'open' }, signedIn: false })).toEqual({ kind: 'signed_out' });
  });

  it('signed in past the gate: the email only with a fresh proof (CS-N9)', () => {
    expect(view({})).toEqual({ kind: 'signed_in', email: true });
    expect(view({ fresh: false })).toEqual({ kind: 'signed_in', email: false });
  });

  it('an open device: only this visit’s sign-in counts (ND-9)', () => {
    expect(view({ gate: { state: 'open' }, signedInThisVisit: true, trust: null })).toEqual({ kind: 'signed_in', email: true });
    expect(view({ gate: { state: 'open' }, signedInThisVisit: false })).toEqual({ kind: 'signed_out' });
  });

  it('locked by the gate: each lock line, no email', () => {
    expect(view({ trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
    expect(view({ trust: { v: 1, epoch: 3 } })).toEqual({ kind: 'locked', cause: 'pin_changed', action: 'sign_in_again' });
    expect(view({ trust: null, retrustPending: true })).toEqual({ kind: 'locked', cause: 'retrust_password', action: 'sign_in_again' });
    expect(view({ gate: { state: 'pin', epoch: 0 } })).toEqual({ kind: 'locked', cause: 'epoch_zero', action: 'back' });
  });
});

describe('row NS-4, D7: the card’s use rows', () => {
  it('pin: the uses record in the order family, teacher, school; without one, this visit’s spaces', () => {
    expect(cardUses({ state: 'pin', epoch: 7 }, ['school', 'family'], ['teacher'])).toEqual(['family', 'school']);
    expect(cardUses({ state: 'pin', epoch: 7 }, null, ['teacher'])).toEqual(['teacher']);
    expect(cardUses({ state: 'pin', epoch: 7 }, [], ['teacher'])).toEqual([]);
  });

  it('open (no record is kept, ND-9): this visit’s spaces only; nothing known, or no space: no row', () => {
    expect(cardUses({ state: 'open' }, ['family'], ['teacher', 'family'])).toEqual(['family', 'teacher']);
    expect(cardUses({ state: 'open' }, ['family'], null)).toEqual([]);
    expect(cardUses(null, ['family'], null)).toEqual([]);
    expect(cardUses({ state: 'pin', epoch: 7 }, null, null)).toEqual([]);
  });
});
