import { describe, expect, it } from 'vitest';
import { claimErrorMessage, cleanDigits, cleanWord, joinRescueCode, splitRescueCode } from '../rescue-code';

describe('rescue code helpers (F-RESTORE-001)', () => {
  it('splits and joins normalized codes', () => {
    expect(splitRescueCode('tiger moon 4821')).toEqual({ first: 'TIGER', second: 'MOON', digits: '4821' });
    expect(splitRescueCode('bad')).toBeNull();
    expect(joinRescueCode({ first: 'tiger', second: 'moon', digits: '4821' })).toBe('TIGER-MOON-4821');
    expect(joinRescueCode({ first: 'tiger', second: '', digits: '4821' })).toBeNull();
  });
  it('cleans field input', () => {
    expect(cleanWord('ti-ger 9')).toBe('TIGER');
    expect(cleanWord('abcdefghijklmno')).toBe('ABCDEFGHIJ');
    expect(cleanDigits('4a8b2c1d9')).toBe('4821');
  });
  it('has calm copy for every error', () => {
    for (const c of ['code_not_found', 'too_many_attempts', 'network', 'invalid', 'unknown'] as const) {
      expect(claimErrorMessage(c).length).toBeGreaterThan(10);
    }
    expect(claimErrorMessage('code_not_found')).not.toMatch(/wrong|fail/i);
  });
});
