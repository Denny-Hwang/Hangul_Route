import { PIN_RESET_TICKET_MS, isGrownUpPath, safeNextPath, type DeviceGateMarker } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { PIN_RESET_SETUP_PARAMS, PIN_RESET_SIGN_IN_PATH, pinResetOutcome, pinResetTicketOf, signInResetShown } from '../pin-reset-ticket';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 steps 1 and 5 (row OA-6; CS-9; section 20): the sign-in option's
 * rule and the ticket's age and epoch.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const PIN: DeviceGateMarker = { v: 1, gate: 'pin', pinEpoch: EPOCH };

describe('signInResetShown: web, online, switch on', () => {
  it('shows only when all three hold', () => {
    expect(signInResetShown({ os: 'web', online: true, flag: true })).toBe(true);
    expect(signInResetShown({ os: 'web', online: false, flag: true })).toBe(false);
    expect(signInResetShown({ os: 'web', online: true, flag: false })).toBe(false);
    for (const os of ['ios', 'android', '']) expect(signInResetShown({ os, online: true, flag: true }), os).toBe(false);
  });
});

describe('the sign-in address (step 1)', () => {
  it('is /signin with a fixed next, the reset page: a grown-up path, no id, no PII', () => {
    expect(PIN_RESET_SIGN_IN_PATH).toBe('/signin?next=/account/pin-reset');
    const next = new URLSearchParams(PIN_RESET_SIGN_IN_PATH.split('?')[1]).get('next');
    expect(safeNextPath(next)).toBe('/account/pin-reset');
    expect(isGrownUpPath(PIN_RESET_SIGN_IN_PATH)).toBe(true);
  });
});

describe('pinResetTicketOf', () => {
  it('reads a ticket, and only a ticket', () => {
    expect(pinResetTicketOf(JSON.stringify({ v: 1, at: NOW, epoch: EPOCH }))).toEqual({ v: 1, at: NOW, epoch: EPOCH });
    for (const raw of [null, '', 'nope', '{', 'null', '[]', JSON.stringify({ v: 2, at: NOW, epoch: EPOCH }), JSON.stringify({ v: 1, at: NOW, epoch: 0 }), JSON.stringify({ v: 1, at: 'x', epoch: EPOCH })]) {
      expect(pinResetTicketOf(raw), String(raw)).toBeNull();
    }
  });
});

describe('pinResetOutcome: age in [0, 2 min) and the current pin epoch (CS-9)', () => {
  const ticket = (age: number, epoch = EPOCH) => ({ v: 1 as const, at: NOW - age, epoch });

  it('accepts a ticket under 2 minutes old for the current epoch', () => {
    expect(PIN_RESET_TICKET_MS).toBe(120_000);
    expect(pinResetOutcome({ ticket: ticket(0), now: NOW, marker: PIN })).toBe('setup');
    expect(pinResetOutcome({ ticket: ticket(PIN_RESET_TICKET_MS - 1), now: NOW, marker: PIN })).toBe('setup');
  });

  it('refuses 2 minutes or older and a clock that ran backwards', () => {
    expect(pinResetOutcome({ ticket: ticket(PIN_RESET_TICKET_MS), now: NOW, marker: PIN })).toBe('expired');
    expect(pinResetOutcome({ ticket: ticket(-1), now: NOW, marker: PIN })).toBe('expired');
  });

  it('refuses another epoch (the PIN changed since) and a device that is not pin', () => {
    expect(pinResetOutcome({ ticket: ticket(0, EPOCH + 1), now: NOW, marker: PIN })).toBe('expired');
    for (const marker of [null, { v: 1, gate: 'nopin' } as const, { v: 1, gate: 'none' } as const]) {
      expect(pinResetOutcome({ ticket: ticket(0), now: NOW, marker }), JSON.stringify(marker)).toBe('expired');
    }
  });

  it('refuses no ticket (absent, junk or already read)', () => {
    expect(pinResetOutcome({ ticket: null, now: NOW, marker: PIN })).toBe('expired');
  });
});

describe('the new-PIN screen it opens', () => {
  it('is setup, via sign_in, then the Grown-up area', () => {
    expect(PIN_RESET_SETUP_PARAMS).toEqual({ next: 'ParentDashboard', mode: 'setup', via: 'sign_in' });
  });
});
