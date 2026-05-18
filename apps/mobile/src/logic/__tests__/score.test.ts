import { describe, expect, it } from 'vitest';
import { accuracy, starsForAccuracy } from '../score';

describe('starsForAccuracy', () => {
  it('returns 3 stars on perfect run (F-001 §3.1)', () => {
    expect(starsForAccuracy(5, 5)).toBe(3);
  });

  it('returns 2 stars at 60-94% accuracy', () => {
    expect(starsForAccuracy(3, 5)).toBe(2);
    expect(starsForAccuracy(4, 5)).toBe(2);
  });

  it('returns 1 star at 20-59% accuracy', () => {
    expect(starsForAccuracy(1, 5)).toBe(1);
    expect(starsForAccuracy(2, 5)).toBe(1);
  });

  it('returns 0 stars on 0/5', () => {
    expect(starsForAccuracy(0, 5)).toBe(0);
  });

  it('handles zero total gracefully', () => {
    expect(starsForAccuracy(0, 0)).toBe(0);
  });
});

describe('accuracy', () => {
  it('returns the ratio', () => {
    expect(accuracy(3, 5)).toBeCloseTo(0.6);
  });

  it('zero total = 0', () => {
    expect(accuracy(0, 0)).toBe(0);
  });
});
