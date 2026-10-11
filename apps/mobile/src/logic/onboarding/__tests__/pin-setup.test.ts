import { describe, expect, it } from 'vitest';
import { PIN_SETUP_START, pinSetupChange, pinSetupRedo } from '../pin-setup';

describe('pin setup (create, then type it again) — F-LEARN-001 §3.4', () => {
  it('starts on "create" with nothing entered', () => {
    expect(PIN_SETUP_START).toEqual({ stage: 'create', entry: '', first: '', pin: null, mismatch: false });
  });

  it('shows the digits typed so far without leaving "create"', () => {
    const s = pinSetupChange(PIN_SETUP_START, '12');
    expect(s).toMatchObject({ stage: 'create', entry: '12', pin: null });
  });

  it('moves to "confirm" on the 4th digit and clears the entry', () => {
    const s = pinSetupChange(PIN_SETUP_START, '1234');
    expect(s).toEqual({ stage: 'confirm', entry: '', first: '1234', pin: null, mismatch: false });
  });

  it('confirms when the second entry matches', () => {
    const confirm = pinSetupChange(PIN_SETUP_START, '1234');
    const half = pinSetupChange(confirm, '12');
    expect(half).toMatchObject({ stage: 'confirm', entry: '12', pin: null });
    const done = pinSetupChange(half, '1234');
    expect(done).toEqual({ stage: 'set', entry: '', first: '1234', pin: '1234', mismatch: false });
  });

  it('clears both entries and flags a mismatch when the second entry differs', () => {
    const confirm = pinSetupChange(PIN_SETUP_START, '1234');
    const s = pinSetupChange(confirm, '4321');
    expect(s).toEqual({ stage: 'create', entry: '', first: '', pin: null, mismatch: true });
  });

  it('drops the mismatch line as soon as the next digit is typed', () => {
    const confirm = pinSetupChange(PIN_SETUP_START, '1234');
    const mismatch = pinSetupChange(confirm, '4321');
    expect(pinSetupChange(mismatch, '9')).toMatchObject({ stage: 'create', entry: '9', mismatch: false });
  });

  it('ignores typing once the PIN is set', () => {
    const set = pinSetupChange(pinSetupChange(PIN_SETUP_START, '1234'), '1234');
    expect(pinSetupChange(set, '5')).toBe(set);
  });

  it('redo goes back to a clean "create"', () => {
    const set = pinSetupChange(pinSetupChange(PIN_SETUP_START, '1234'), '1234');
    expect(pinSetupRedo()).toEqual(PIN_SETUP_START);
    expect(set.pin).toBe('1234');
  });
});
