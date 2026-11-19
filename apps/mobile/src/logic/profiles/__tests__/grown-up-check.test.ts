import { describe, expect, it } from 'vitest';
import {
  CHECK_INPUT_MAX,
  CHECK_MAX,
  CHECK_MIN,
  answerGrownUpCheck,
  checkAnswerMatches,
  cleanCheckInput,
  nextCheckNumber,
  openGrownUpCheck,
  resetNeedsGrownUpCheck,
} from '../grown-up-check';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 FN-1 (audit SEC-7): the check before a new PIN on the two offline reset ways
 * (wireframe onboarding/all-ages-onboarding.md box G2, mock design/screens/profiles/pin-reset-check.md).
 */
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

describe('which reset ways ask the check', () => {
  it('the Rescue Code and the 24-hour wait ask it; signing in does not', () => {
    expect(resetNeedsGrownUpCheck('rescue_code')).toBe(true);
    expect(resetNeedsGrownUpCheck('wait')).toBe(true);
    expect(resetNeedsGrownUpCheck('sign_in')).toBe(false);
  });
});

describe('nextCheckNumber', () => {
  it('maps the random draw onto 100 to 999', () => {
    expect(nextCheckNumber(fixed(0))).toBe(CHECK_MIN);
    expect(nextCheckNumber(fixed(0.999999))).toBe(CHECK_MAX);
    expect(nextCheckNumber(fixed(0.5))).toBe(550);
    // A source that returns 1 (outside Math.random's range) still stays inside.
    expect(nextCheckNumber(fixed(1))).toBe(CHECK_MAX);
    expect(nextCheckNumber(fixed(-1))).toBe(CHECK_MIN);
    expect(nextCheckNumber(fixed(Number.NaN))).toBe(CHECK_MIN);
  });

  it('never repeats the number just shown', () => {
    expect(nextCheckNumber(fixed(0), CHECK_MIN)).toBe(CHECK_MIN + 1);
    expect(nextCheckNumber(fixed(0.999999), CHECK_MAX)).toBe(CHECK_MIN);
    expect(nextCheckNumber(fixed(0.5), 300)).toBe(550);
  });

  it('uses Math.random by default and stays in range', () => {
    for (let i = 0; i < 200; i += 1) {
      const n = nextCheckNumber();
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(CHECK_MIN);
      expect(n).toBeLessThanOrEqual(CHECK_MAX);
    }
  });
});

describe('the answer', () => {
  it('keeps digits only (full-width digits too), at most CHECK_INPUT_MAX', () => {
    expect(cleanCheckInput(' 3 4-7 ')).toBe('347');
    expect(cleanCheckInput('３４７')).toBe('347');
    expect(cleanCheckInput('abc')).toBe('');
    expect(cleanCheckInput('123456')).toHaveLength(CHECK_INPUT_MAX);
  });

  it('matches the number exactly', () => {
    expect(checkAnswerMatches(347, '347')).toBe(true);
    expect(checkAnswerMatches(347, ' 347 ')).toBe(true);
    expect(checkAnswerMatches(347, '３４７')).toBe(true);
    expect(checkAnswerMatches(347, '0347')).toBe(false);
    expect(checkAnswerMatches(347, '348')).toBe(false);
    expect(checkAnswerMatches(347, '')).toBe(false);
  });
});

describe('open and answer', () => {
  it('opens with a number and no miss line, for the way that asked it', () => {
    expect(openGrownUpCheck('wait', fixed(0.5))).toEqual({ via: 'wait', value: 550, missed: false });
  });

  it('a right answer passes, naming the way, so setup opens with that via', () => {
    const check = openGrownUpCheck('rescue_code', fixed(0.5));
    expect(answerGrownUpCheck(check, '550', fixed(0))).toEqual({ passed: true, via: 'rescue_code' });
  });

  it('a miss changes nothing but the number: a new one, the calm line, no count and no lock', () => {
    const check = openGrownUpCheck('wait', fixed(0.5));
    const first = answerGrownUpCheck(check, '551', fixed(0.1));
    expect(first).toEqual({ passed: false, check: { via: 'wait', value: 190, missed: true } });
    // The same shape after many misses: nothing grows, nothing locks.
    let state = check;
    for (let i = 0; i < 50; i += 1) {
      const out = answerGrownUpCheck(state, '0', fixed(0.3));
      expect(out.passed).toBe(false);
      if (out.passed) return;
      expect(Object.keys(out.check).sort()).toEqual(['missed', 'value', 'via']);
      state = out.check;
    }
    expect(state.missed).toBe(true);
  });

  it('an empty answer is not a miss: nothing changes', () => {
    const check = openGrownUpCheck('wait', fixed(0.5));
    expect(answerGrownUpCheck(check, '  ', fixed(0.1))).toEqual({ passed: false, check });
  });
});
