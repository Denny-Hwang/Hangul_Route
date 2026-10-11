import { describe, expect, it } from 'vitest';
import { initialPinMode, pinCreatedWhere, showForgotPin } from '../pin-flow';

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
