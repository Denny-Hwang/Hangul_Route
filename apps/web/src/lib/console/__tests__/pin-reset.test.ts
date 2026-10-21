import { GROWN_UP_FRESH_PIN_MS, PIN_RESET_TICKET_KEY, PinResetTicketSchema, type GrownUpUnlock, type PinOwner } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { pinResetSignInEnabled } from '../config';
import type { DeviceGateRead } from '../grown-up-lock';
import { isSecretProvingSignIn, planAfterSignIn } from '../signin-flow';
import { decidePinReset, freshResetSignIn, pinResetTarget, pinResetTicket, writePinResetTicket } from '../pin-reset';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-6 (sections 7.4, 7.5 and 8.5 steps 3 and 4; CS-9, CS-10, CS-17;
 * section 20): the decision of `/account/pin-reset`, in the order of section 8.5, and its ticket.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const OWNER = '0123456789abcdef';
const OTHER = 'fedcba9876543210';
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
const PIN_ZERO: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 0 }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const NONE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
const ABSENT: DeviceGateRead = { readable: true, marker: null, hasProfiles: true };
const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };
const UNAVAILABLE: DeviceGateRead = { readable: false, reason: 'unavailable' };
const OWNED: PinOwner = { v: 1, owner: OWNER, epoch: EPOCH };

const signin = (age: number): GrownUpUnlock => ({ v: 1, at: NOW - age, seen: NOW - age, src: 'signin' });
const pinUnlock = (age: number): GrownUpUnlock => ({ v: 1, at: NOW - age, seen: NOW - age, src: 'pin', pinEpoch: EPOCH });

const base = { flag: true, signInFresh: true, device: PIN, stored: OWNED, owner: OWNER };

describe('freshResetSignIn: a signin unlock under 2 minutes old, no passkey around it', () => {
  it('counts a signin unlock in [0, 2 min)', () => {
    expect(freshResetSignIn({ unlock: signin(0), now: NOW, passkeyUsed: false })).toBe(true);
    expect(freshResetSignIn({ unlock: signin(GROWN_UP_FRESH_PIN_MS - 1), now: NOW, passkeyUsed: false })).toBe(true);
  });

  it('refuses 2 minutes or older, a clock that ran backwards, no unlock and a PIN unlock', () => {
    expect(freshResetSignIn({ unlock: signin(GROWN_UP_FRESH_PIN_MS), now: NOW, passkeyUsed: false })).toBe(false);
    expect(freshResetSignIn({ unlock: signin(-1), now: NOW, passkeyUsed: false })).toBe(false);
    expect(freshResetSignIn({ unlock: null, now: NOW, passkeyUsed: false })).toBe(false);
    // The PIN is the thing that was forgotten: a PIN hand-off never stands in for the sign-in.
    expect(freshResetSignIn({ unlock: pinUnlock(0), now: NOW, passkeyUsed: false })).toBe(false);
  });

  it('a passkey used around the sign-in never counts, however fresh (CS-17)', () => {
    expect(freshResetSignIn({ unlock: signin(0), now: NOW, passkeyUsed: true })).toBe(false);
  });
});

describe('decidePinReset: the checks of section 8.5 step 3, in order', () => {
  it('a fresh sign-in, a pin marker and this account as the owner of this epoch: go', () => {
    expect(decidePinReset(base)).toEqual({ kind: 'go', epoch: EPOCH });
  });

  it('the switch off answers unavailable before anything else', () => {
    expect(decidePinReset({ ...base, flag: false })).toEqual({ kind: 'refused', line: 'unavailable' });
    expect(decidePinReset({ ...base, flag: false, signInFresh: false, device: FAILED })).toEqual({ kind: 'refused', line: 'unavailable' });
  });

  it('no fresh sign-in asks for a reverification first, whatever the rest says', () => {
    expect(decidePinReset({ ...base, signInFresh: false })).toEqual({ kind: 'reverify' });
    expect(decidePinReset({ ...base, signInFresh: false, device: NOPIN, stored: null })).toEqual({ kind: 'reverify' });
  });

  it('a device that cannot be read answers unavailable', () => {
    expect(decidePinReset({ ...base, device: FAILED })).toEqual({ kind: 'refused', line: 'unavailable' });
    expect(decidePinReset({ ...base, device: UNAVAILABLE })).toEqual({ kind: 'refused', line: 'unavailable' });
  });

  it('a marker that is not pin answers noPin', () => {
    for (const device of [NOPIN, NONE, ABSENT]) expect(decidePinReset({ ...base, device })).toEqual({ kind: 'refused', line: 'noPin' });
  });

  it('a PIN set before A-6 (epoch 0) has no owner: firstSignIn', () => {
    expect(decidePinReset({ ...base, device: PIN_ZERO, stored: { v: 1, owner: OWNER, epoch: EPOCH } })).toEqual({ kind: 'refused', line: 'firstSignIn' });
  });

  it('no record, or a record for another epoch, answers firstSignIn', () => {
    expect(decidePinReset({ ...base, stored: null })).toEqual({ kind: 'refused', line: 'firstSignIn' });
    expect(decidePinReset({ ...base, stored: { v: 1, owner: OWNER, epoch: EPOCH - 1 } })).toEqual({ kind: 'refused', line: 'firstSignIn' });
    // Another account's record for an old epoch is still "no record for this PIN".
    expect(decidePinReset({ ...base, stored: { v: 1, owner: OTHER, epoch: EPOCH - 1 } })).toEqual({ kind: 'refused', line: 'firstSignIn' });
  });

  it('another account answers notOwner', () => {
    expect(decidePinReset({ ...base, owner: OTHER })).toEqual({ kind: 'refused', line: 'notOwner' });
  });

  it('no fingerprint (no Web Crypto) answers unavailable', () => {
    expect(decidePinReset({ ...base, owner: null })).toEqual({ kind: 'refused', line: 'unavailable' });
  });
});

describe('CS-10: a child’s own account signed in before a grown-up’s PIN unlock never resets the PIN', () => {
  it('the child is never the owner: no record, or the grown-up’s record, refuses the child', () => {
    // The child signed in with their own email code; the grown-up then opened a grown-up page with the PIN. The lock's
    // PIN path only refreshes an existing record for the same account (OA-3), so the child got no record.
    expect(decidePinReset({ ...base, stored: null, owner: OTHER })).toEqual({ kind: 'refused', line: 'firstSignIn' });
    expect(decidePinReset({ ...base, stored: OWNED, owner: OTHER })).toEqual({ kind: 'refused', line: 'notOwner' });
  });
});

describe('CS-17 and OQ-21: on the reset leg a passkey never counts, on any browser', () => {
  const reset = '/account/pin-reset';
  for (const device of [PIN, NOPIN, NONE, ABSENT, FAILED, UNAVAILABLE]) {
    it(`a passkey sign-in writes no unlock on the reset leg (${device.readable ? (device.marker?.gate ?? 'absent') : device.reason})`, () => {
      expect(isSecretProvingSignIn({ factor: 'passkey', device, resetLeg: true })).toBe(false);
      const record = { v: 1 as const, kind: 'proof' as const, sessionId: 's1', secret: true as const, factor: 'passkey', at: NOW };
      expect(planAfterSignIn({ record, sessionId: 's1', device, now: NOW, next: reset })).toBe('none');
    });
  }

  it('the reset leg takes a password, an email or phone code and the Clerk password-reset codes', () => {
    for (const factor of ['password', 'email_code', 'phone_code', 'reset_password_email_code', 'reset_password_phone_code']) {
      expect(isSecretProvingSignIn({ factor, device: PIN, resetLeg: true }), factor).toBe(true);
    }
    for (const factor of ['passkey', 'oauth_google', 'email_link', 'ticket', null]) {
      expect(isSecretProvingSignIn({ factor, device: PIN, resetLeg: true }), String(factor)).toBe(false);
    }
  });
});

describe('the ticket (section 8.5 step 4)', () => {
  it('is { v: 1, at, epoch } and parses with PinResetTicketSchema: no id of any kind', () => {
    const ticket = pinResetTicket(NOW, EPOCH);
    expect(ticket).toEqual({ v: 1, at: NOW, epoch: EPOCH });
    expect(Object.keys(ticket ?? {}).sort()).toEqual(['at', 'epoch', 'v']);
    expect(PinResetTicketSchema.safeParse(ticket).success).toBe(true);
  });

  it('refuses an epoch that is not a real one', () => {
    expect(pinResetTicket(NOW, 0)).toBeNull();
    expect(pinResetTicket(NOW, Number.NaN)).toBeNull();
  });

  it('is written under hr:shell:pinReset; a refusing storage reports false', () => {
    const items = new Map<string, string>();
    const storage = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) };
    expect(writePinResetTicket({ v: 1, at: NOW, epoch: EPOCH }, storage)).toBe(true);
    expect(JSON.parse(items.get(PIN_RESET_TICKET_KEY) ?? 'null')).toEqual({ v: 1, at: NOW, epoch: EPOCH });
    const refusing = { ...storage, setItem: () => { throw new Error('quota'); } };
    expect(writePinResetTicket({ v: 1, at: NOW, epoch: EPOCH }, refusing)).toBe(false);
    expect(writePinResetTicket({ v: 1, at: NOW, epoch: EPOCH }, null)).toBe(false);
  });

  it('the target is the learner app’s gate=pin-reset with the language and nothing else (no PII in the URL)', () => {
    expect(pinResetTarget('en')).toBe('/?gate=pin-reset&lang=en');
    expect(pinResetTarget('ko')).toBe('/?gate=pin-reset&lang=ko');
  });
});

describe('NEXT_PUBLIC_PIN_RESET_SIGNIN (section 16): off when OA-6 lands', () => {
  it('is off when unset or unknown', () => {
    expect(pinResetSignInEnabled({})).toBe(false);
    for (const raw of ['', 'maybe', 'yes']) expect(pinResetSignInEnabled({ NEXT_PUBLIC_PIN_RESET_SIGNIN: raw }), raw).toBe(false);
  });

  it('turns on with true, 1, on or enabled, and off with false, 0, off or disabled (case and spaces ignored)', () => {
    for (const on of ['true', '1', 'on', 'enabled', ' TRUE ', 'Enabled']) expect(pinResetSignInEnabled({ NEXT_PUBLIC_PIN_RESET_SIGNIN: on }), on).toBe(true);
    for (const off of ['false', '0', 'off', 'disabled', ' OFF ']) expect(pinResetSignInEnabled({ NEXT_PUBLIC_PIN_RESET_SIGNIN: off }), off).toBe(false);
  });
});
