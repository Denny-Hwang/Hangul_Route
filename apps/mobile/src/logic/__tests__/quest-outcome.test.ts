import { describe, expect, it } from 'vitest';
import { questOutcome } from '../quest-outcome';

describe('questOutcome', () => {
  it('a fully skipped quest is 0/0, 0 stars, not played', () => {
    expect(questOutcome(0, 0)).toEqual({ stars: 0, correct: 0, total: 0, played: false });
  });
  it('a perfect run is 3 stars', () => {
    expect(questOutcome(5, 5)).toEqual({ stars: 3, correct: 5, total: 5, played: true });
  });
  it('a partial run maps through starsForAccuracy', () => {
    expect(questOutcome(3, 5).stars).toBe(2);
    expect(questOutcome(1, 5).stars).toBe(1);
  });
  it('clamps impossible counters instead of inventing rounds', () => {
    expect(questOutcome(7, 5)).toEqual({ stars: 3, correct: 5, total: 5, played: true });
    expect(questOutcome(-1, 3)).toEqual({ stars: 0, correct: 0, total: 3, played: true });
  });
});
