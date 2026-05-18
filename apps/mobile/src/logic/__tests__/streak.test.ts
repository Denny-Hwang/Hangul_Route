import { describe, expect, it } from 'vitest';
import { computeStreak } from '../streak';

const day = (iso: string): string => `${iso}T12:00:00.000Z`;

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([], new Date('2026-05-18T08:00:00Z'))).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    expect(computeStreak([day('2026-05-18')], new Date('2026-05-18T22:00:00Z'))).toBe(1);
  });

  it('counts consecutive days', () => {
    const dates = ['2026-05-16', '2026-05-17', '2026-05-18'].map(day);
    expect(computeStreak(dates, new Date('2026-05-18T22:00:00Z'))).toBe(3);
  });

  it('breaks at a missed day in the middle', () => {
    const dates = ['2026-05-14', '2026-05-17', '2026-05-18'].map(day);
    expect(computeStreak(dates, new Date('2026-05-18T22:00:00Z'))).toBe(2);
  });

  it('does not break the streak just because today is missing', () => {
    // Yesterday + day-before but not today
    const dates = ['2026-05-16', '2026-05-17'].map(day);
    expect(computeStreak(dates, new Date('2026-05-18T22:00:00Z'))).toBe(2);
  });
});
