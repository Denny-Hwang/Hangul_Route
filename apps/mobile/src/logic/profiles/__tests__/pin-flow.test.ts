import { describe, expect, it } from 'vitest';
import { CANCEL_RESET, GROWN_UP_AREA, forCancelReset, forGrownUpArea, grownUpAreaNoPin, initialPinMode, pinCreatedWhere, showForgotPin, verifiedGoesToSetup } from '../pin-flow';

describe('initialPinMode: which step the PIN screen opens on', () => {
  it('verifies when a PIN is stored', () => {
    expect(initialPinMode({}, 'hash')).toBe('verify');
  });

  it('creates when no PIN is stored (legacy device, first grown-up action)', () => {
    expect(initialPinMode({}, null)).toBe('setup-1');
  });

  it('mode "setup" opens creation even though a PIN is stored (Forgot PIN, or a deliberate change)', () => {
    expect(initialPinMode({ mode: 'setup' }, 'hash')).toBe('setup-1');
    expect(initialPinMode({ mode: 'setup' }, null)).toBe('setup-1');
  });
});

describe('showForgotPin: only where a PIN is being checked', () => {
  it('shows in verify and hides in both setup steps', () => {
    expect(showForgotPin('verify')).toBe(true);
    expect(showForgotPin('setup-1')).toBe(false);
    expect(showForgotPin('setup-2')).toBe(false);
  });
});

describe('pinCreatedWhere: the pin.created "where" (F-LEARN-001 §3.8)', () => {
  it('a PIN set after Forgot PIN is "reset", whichever path led there', () => {
    expect(pinCreatedWhere({ mode: 'setup', via: 'rescue_code' })).toBe('reset');
    expect(pinCreatedWhere({ mode: 'setup', via: 'wait' })).toBe('reset');
  });

  it('a deliberate setup without a reset is "optional"', () => {
    expect(pinCreatedWhere({ mode: 'setup' })).toBe('optional');
  });

  it('the first grown-up action on a device with no PIN is "gate"', () => {
    expect(pinCreatedWhere({})).toBe('gate');
  });
});

/**
 * F-APP-001 section 3.9 (A-6): the PIN screen reached from a grown-up entry (destination
 * `GrownUpArea`) never creates or resets a PIN, so a child cannot make a PIN that opens the
 * grown-up area: verify only, no Forgot PIN, and with no PIN stored a line that sends the
 * grown-up to sign in instead.
 */
describe('destination GrownUpArea (F-APP-001 section 3.9)', () => {
  it('is the GrownUpArea destination name', () => {
    expect(GROWN_UP_AREA).toBe('GrownUpArea');
    expect(forGrownUpArea({ next: GROWN_UP_AREA })).toBe(true);
    expect(forGrownUpArea({ next: 'ParentDashboard' })).toBe(false);
    expect(forGrownUpArea({})).toBe(false);
  });

  it('always opens in verify, never in a setup step, even with mode "setup" or no PIN stored', () => {
    expect(initialPinMode({ next: GROWN_UP_AREA }, 'hash')).toBe('verify');
    expect(initialPinMode({ next: GROWN_UP_AREA }, null)).toBe('verify');
    expect(initialPinMode({ next: GROWN_UP_AREA, mode: 'setup' }, 'hash')).toBe('verify');
    expect(initialPinMode({ next: GROWN_UP_AREA, mode: 'setup', via: 'wait' }, null)).toBe('verify');
  });

  it('hides Forgot PIN (no reset from a grown-up entry)', () => {
    expect(showForgotPin('verify', { next: GROWN_UP_AREA })).toBe(false);
    expect(showForgotPin('verify', { next: 'ParentDashboard' })).toBe(true);
    expect(showForgotPin('verify', {})).toBe(true);
  });

  it('with no PIN stored it shows the no-PIN line instead of the pad', () => {
    expect(grownUpAreaNoPin({ next: GROWN_UP_AREA }, null)).toBe(true);
    expect(grownUpAreaNoPin({ next: GROWN_UP_AREA }, 'hash')).toBe(false);
  });

  it('every other destination keeps its behaviour', () => {
    expect(grownUpAreaNoPin({ next: 'ParentDashboard' }, null)).toBe(false);
    expect(grownUpAreaNoPin({}, null)).toBe(false);
    expect(initialPinMode({ next: 'ParentDashboard' }, null)).toBe('setup-1');
    expect(initialPinMode({ next: 'Paywall' }, 'hash')).toBe('verify');
  });
});

describe("[OA] mode 'change': the current PIN first, then a new one (OA-D21)", () => {
  it('verifies first when a PIN is stored, creates at once when none is, and never on the grown-up area', () => {
    expect(initialPinMode({ next: 'ParentDashboard', mode: 'change' }, 'h:1')).toBe('verify');
    expect(initialPinMode({ next: 'ParentDashboard', mode: 'change' }, null)).toBe('setup-1');
    expect(verifiedGoesToSetup({ next: 'ParentDashboard', mode: 'change' })).toBe(true);
    expect(verifiedGoesToSetup({ next: 'ParentDashboard', mode: 'setup' })).toBe(false);
    expect(verifiedGoesToSetup({ next: 'ParentDashboard' })).toBe(false);
    expect(verifiedGoesToSetup({ next: GROWN_UP_AREA, mode: 'change' })).toBe(false);
    expect(pinCreatedWhere({ next: 'ParentDashboard', mode: 'change' })).toBe('optional');
  });
});

describe('[OA] destination CancelReset (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D21, CS-4)', () => {
  it('always verifies: it never creates or resets a PIN, whatever mode or via says', () => {
    expect(CANCEL_RESET).toBe('CancelReset');
    expect(forCancelReset({ next: CANCEL_RESET })).toBe(true);
    expect(forCancelReset({ next: GROWN_UP_AREA })).toBe(false);
    expect(initialPinMode({ next: CANCEL_RESET }, 'hash')).toBe('verify');
    expect(initialPinMode({ next: CANCEL_RESET }, null)).toBe('verify');
    expect(initialPinMode({ next: CANCEL_RESET, mode: 'setup', via: 'wait' }, 'hash')).toBe('verify');
    expect(initialPinMode({ next: CANCEL_RESET, mode: 'change' }, null)).toBe('verify');
    expect(verifiedGoesToSetup({ next: CANCEL_RESET, mode: 'change' })).toBe(false);
  });

  it('offers no Forgot PIN? (a reset is already waiting) and is not the grown-up area', () => {
    expect(showForgotPin('verify', { next: CANCEL_RESET })).toBe(false);
    expect(forGrownUpArea({ next: CANCEL_RESET })).toBe(false);
    expect(grownUpAreaNoPin({ next: CANCEL_RESET }, null)).toBe(false);
  });
});
