import { describe, expect, it } from 'vitest';
import { mockFamily } from '../mock-family';

describe('mockFamily', () => {
  it('returns at least one profile and totals', () => {
    const f = mockFamily();
    expect(f.profiles.length).toBeGreaterThan(0);
    expect(f.totals.cards).toBeGreaterThan(0);
  });

  it('week minutes equals sum of per-day minutes', () => {
    const f = mockFamily();
    const expected = f.profiles.reduce(
      (acc, p) => acc + p.weekly.reduce((a, b) => a + b.minutes, 0),
      0,
    );
    expect(f.totals.weekMinutes).toBe(expected);
  });
});
