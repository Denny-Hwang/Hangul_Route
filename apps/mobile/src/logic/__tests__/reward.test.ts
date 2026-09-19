import { describe, expect, it } from 'vitest';
import { CARD_UNLOCK_MIN_STARS, shouldUnlockCard } from '../reward';

describe('shouldUnlockCard (F-MOTION-003 §3.5)', () => {
  it('unlocks at 2 and 3 stars', () => {
    expect(shouldUnlockCard(2)).toBe(true);
    expect(shouldUnlockCard(3)).toBe(true);
  });
  it('never unlocks at 0 or 1 star', () => {
    expect(shouldUnlockCard(0)).toBe(false);
    expect(shouldUnlockCard(1)).toBe(false);
  });
  it('threshold constant matches the spec', () => {
    expect(CARD_UNLOCK_MIN_STARS).toBe(2);
  });
});
