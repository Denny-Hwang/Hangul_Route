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

  it('labels each demo card with its Korean word, not an emoji (CLAUDE.md: no emoji in rendered output)', () => {
    for (const card of mockFamily().profiles.flatMap((p) => p.recentCards)) {
      expect(card.ko, card.title).toMatch(/^[\uAC00-\uD7A3]+$/);
      expect(card.romanization, card.title).toMatch(/^[a-z]+$/);
      expect(card, card.title).not.toHaveProperty('emoji');
    }
  });
});
