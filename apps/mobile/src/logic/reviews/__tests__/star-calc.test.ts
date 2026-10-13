import { describe, expect, it } from 'vitest';
import { reviewStars } from '../star-calc';

describe('reviewStars (F-RVW-001 §3.1)', () => {
  it('gives 3 stars at 80 % or more, 2 from 50 %, else 1', () => {
    expect(reviewStars(35, 35)).toBe(3);
    expect(reviewStars(28, 35)).toBe(3);
    expect(reviewStars(27, 35)).toBe(2);
    expect(reviewStars(18, 35)).toBe(2);
    expect(reviewStars(17, 35)).toBe(1);
  });

  it('never gives 0 stars: 0 of N and an empty attempt are 1 star', () => {
    expect(reviewStars(0, 35)).toBe(1);
    expect(reviewStars(0, 0)).toBe(1);
  });
});
