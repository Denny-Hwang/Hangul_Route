import { GROWN_UP_FRESH_PIN_MS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { accountLock, freshProof, trustOf, type AccountLockInput } from '../account-lock';

/**
 * F-AUTH-004 sections 7.2 and 7.3 (row NS-2; CS-N2, CS-N3, CS-N11): the `account-lock` table, every row, the re-trust
 * rule and freshness.
 */

const EPOCH = 1_762_000_000_000;
const PIN = { state: 'pin', epoch: EPOCH } as const;

const base: AccountLockInput = { gate: PIN, signedIn: true, trust: { v: 1, epoch: EPOCH }, retrustPending: false, fresh: true, fromOutside: true };
const lock = (over: Partial<AccountLockInput>) => accountLock({ ...base, ...over });

describe('section 7.2: the table', () => {
  it('unknown: locked, Try again and Back, whatever else holds', () => {
    for (const signedIn of [true, false]) {
      expect(lock({ gate: { state: 'unknown' }, signedIn })).toEqual({ kind: 'locked', cause: 'unknown', action: 'try_again' });
    }
  });

  it('nopin: the Grown-up area destination (PIN setup), never an account screen', () => {
    for (const signedIn of [true, false]) expect(lock({ gate: { state: 'nopin' }, signedIn })).toEqual({ kind: 'needs_pin', cause: 'needs_pin' });
  });

  it('open: the sign-in screen, or the home with this run’s session; no PIN to ask', () => {
    expect(lock({ gate: { state: 'open' }, signedIn: false, fresh: false })).toEqual({ kind: 'sign_in' });
    expect(lock({ gate: { state: 'open' }, signedIn: true, fresh: false, trust: null })).toEqual({ kind: 'home' });
  });

  it('pin with epoch 0: locked, Back (never trusted)', () => {
    for (const signedIn of [true, false]) {
      expect(lock({ gate: { state: 'pin', epoch: 0 }, signedIn, trust: { v: 1, epoch: 5 } })).toEqual({ kind: 'locked', cause: 'epoch_zero', action: 'back' });
    }
  });

  it('pin, signed out: the sign-in screen', () => {
    expect(lock({ signedIn: false, trust: null })).toEqual({ kind: 'sign_in' });
    expect(lock({ signedIn: false })).toEqual({ kind: 'sign_in' });
  });

  it('pin, signed in, no trust: locked, Sign in again', () => {
    expect(lock({ trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
  });

  it('pin, signed in, trust for another epoch: locked, Sign in again (CS-N3)', () => {
    expect(lock({ trust: { v: 1, epoch: EPOCH - 1 } })).toEqual({ kind: 'locked', cause: 'pin_changed', action: 'sign_in_again' });
  });

  it('pin, signed in, trust for this epoch: the home', () => {
    expect(lock({})).toEqual({ kind: 'home' });
  });
});

describe('section 7.3: re-trust after a PIN change', () => {
  it('an email code alone after a change leaves the password line', () => {
    expect(lock({ trust: { v: 1, epoch: EPOCH - 1 }, retrustPending: true })).toEqual({ kind: 'locked', cause: 'retrust_password', action: 'sign_in_again' });
    expect(lock({ trust: null, retrustPending: true })).toEqual({ kind: 'locked', cause: 'retrust_password', action: 'sign_in_again' });
  });

  it('a pending re-trust never blocks a trust that matches', () => {
    expect(lock({ retrustPending: true })).toEqual({ kind: 'home' });
  });
});

describe('ND-5: freshness on a `pin` device', () => {
  it('entered from outside without a fresh proof: the PIN in verify mode, before the home or the sign-in screen', () => {
    expect(lock({ fresh: false })).toEqual({ kind: 'verify_pin' });
    expect(lock({ fresh: false, signedIn: false })).toEqual({ kind: 'verify_pin' });
  });

  it('moving between account screens keeps the session (no proof asked)', () => {
    expect(lock({ fresh: false, fromOutside: false })).toEqual({ kind: 'home' });
  });

  it('a lock line shows without a PIN (it opens nothing)', () => {
    expect(lock({ fresh: false, trust: null })).toEqual({ kind: 'locked', cause: 'no_trust', action: 'sign_in_again' });
    expect(lock({ fresh: false, gate: { state: 'pin', epoch: 0 } })).toEqual({ kind: 'locked', cause: 'epoch_zero', action: 'back' });
  });
});

describe('freshProof: a typed PIN or a native sign-in within 2 minutes', () => {
  const now = 10_000_000;
  it('either proof younger than GROWN_UP_FRESH_PIN_MS counts', () => {
    expect(freshProof(now, now - GROWN_UP_FRESH_PIN_MS + 1, null)).toBe(true);
    expect(freshProof(now, null, now - 1000)).toBe(true);
    expect(freshProof(now, now, null)).toBe(true);
  });

  it('2 minutes or older, none, or a time in the future (clock went back) proves nothing', () => {
    expect(freshProof(now, now - GROWN_UP_FRESH_PIN_MS, null)).toBe(false);
    expect(freshProof(now, null, null)).toBe(false);
    expect(freshProof(now, now + 1, now + 5)).toBe(false);
    expect(freshProof(now, Number.NaN, null)).toBe(false);
  });
});

describe('trustOf: a failed or unparsable read is no trust (CS-N3)', () => {
  it('reads a version 1 record with a positive whole epoch', () => {
    expect(trustOf({ v: 1, epoch: EPOCH })).toEqual({ v: 1, epoch: EPOCH });
    expect(trustOf({ v: 1, epoch: EPOCH, accountId: 'user_1' })).toEqual({ v: 1, epoch: EPOCH });
  });

  it('epoch 0, a fraction, another version or anything else is no trust', () => {
    for (const raw of [null, undefined, 'x', {}, { v: 1, epoch: 0 }, { v: 1, epoch: -1 }, { v: 1, epoch: 1.5 }, { v: 2, epoch: EPOCH }, { v: 1, epoch: String(EPOCH) }]) {
      expect(trustOf(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});
