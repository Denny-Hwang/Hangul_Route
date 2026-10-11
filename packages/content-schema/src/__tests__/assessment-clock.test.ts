import { describe, expect, it } from 'vitest';
import { deadline, isExpired, isIdle } from '../assessment/clock';

describe('deadline', () => {
  it('adds the limit to the start', () => {
    expect(deadline(1_000, 360_000)).toBe(361_000);
  });

  it('is null (never) when the limit is null', () => {
    expect(deadline(1_000, null)).toBeNull();
  });
});

describe('isExpired', () => {
  it('is false before the deadline and true at and after it', () => {
    expect(isExpired(999, 1_000)).toBe(false);
    expect(isExpired(1_000, 1_000)).toBe(true);
    expect(isExpired(1_001, 1_000)).toBe(true);
  });

  it('never expires with a null deadline', () => {
    expect(isExpired(Number.MAX_SAFE_INTEGER, null)).toBe(false);
  });

  it('composes with deadline', () => {
    const d = deadline(0, 5_000);
    expect(isExpired(4_999, d)).toBe(false);
    expect(isExpired(5_000, d)).toBe(true);
    expect(isExpired(10, deadline(0, null))).toBe(false);
  });
});

describe('isIdle', () => {
  it('is false until the idle time has passed since the last touch, then true', () => {
    expect(isIdle(44_999, 0, 45_000)).toBe(false);
    expect(isIdle(45_000, 0, 45_000)).toBe(true);
    expect(isIdle(50_000, 10_000, 45_000)).toBe(false);
    expect(isIdle(60_000, 10_000, 45_000)).toBe(true);
  });

  it('never idles with a null idle time', () => {
    expect(isIdle(Number.MAX_SAFE_INTEGER, 0, null)).toBe(false);
  });
});

describe('package export', () => {
  it('exports the shared engine from the package index', async () => {
    const api = await import('../index');
    for (const name of [
      'ASSESSMENT_FORMATS', 'AssessmentQuestionSchema', 'hashSeed', 'createRng', 'shuffleSeeded', 'sampleSeeded',
      'placeCorrect', 'selectSpread', 'startSession', 'answer', 'skip', 'expire', 'tally', 'deadline', 'isExpired', 'isIdle',
    ]) {
      expect(api).toHaveProperty(name);
    }
  });
});
