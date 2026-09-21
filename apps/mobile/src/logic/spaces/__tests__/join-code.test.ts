import { describe, expect, it } from 'vitest';
import { cleanJoinCode, isCodeError, isCompleteJoinCode, joinErrorMessage, type JoinErrorCode } from '../join-code';

describe('join code helpers (F-SPACE-001 §3.5)', () => {
  it('cleans keystrokes to the alphabet, upper case, six characters', () => {
    expect(cleanJoinCode('k7m-2x 9')).toBe('K7M2X9');
    expect(cleanJoinCode('k7m2xo1i0')).toBe('K7M2X'); // O, 1, I, 0 are never accepted
    expect(cleanJoinCode('abcdefghjk')).toBe('ABCDEF');
    expect(isCompleteJoinCode('K7M2X9')).toBe(true);
    expect(isCompleteJoinCode('K7M2X')).toBe(false);
  });

  it('has calm copy for every error and tells code errors apart', () => {
    const codes: JoinErrorCode[] = ['code_not_found', 'code_expired', 'cap_learner', 'cap_class', 'not_joinable', 'too_many_attempts', 'network', 'invalid', 'unknown', 'off'];
    for (const c of codes) {
      expect(joinErrorMessage(c).length).toBeGreaterThan(10);
      expect(joinErrorMessage(c)).not.toMatch(/wrong code|failed|error/i);
    }
    expect(isCodeError('code_expired')).toBe(true);
    expect(isCodeError('cap_learner')).toBe(false);
  });
});
