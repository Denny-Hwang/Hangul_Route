import { describe, expect, it } from 'vitest';
import { resultsCheerMessage, resultsHeadline } from '../results-copy';

const tiers = [
  { stars: 0, played: true },
  { stars: 1, played: true },
  { stars: 2, played: true },
  { stars: 3, played: true },
  { stars: 0, played: false },
] as const;

describe('results copy (wireframe results/celebrate)', () => {
  it('0 stars reads "Let\'s" with a real apostrophe, not the HTML entity', () => {
    expect(resultsCheerMessage(0, true)).toBe("Brave try! Let's do it together.");
  });

  it.each(tiers)('stars=$stars played=$played: plain text, no HTML entities', ({ stars, played }) => {
    for (const line of [resultsHeadline(stars, played), resultsCheerMessage(stars, played)]) {
      expect(line).not.toMatch(/&[a-z]+;|&#\d+;/i);
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it.each(tiers)('stars=$stars played=$played: never a number, ratio or percent (F-RVW-001 §3.1)', ({ stars, played }) => {
    expect(resultsCheerMessage(stars, played)).not.toMatch(/\d|%/);
  });

  it('each tier has its own headline and line', () => {
    expect(resultsHeadline(3, true)).toBe('Wonderful!');
    expect(resultsHeadline(2, true)).toBe('Great!');
    expect(resultsHeadline(1, true)).toBe('You tried!');
    expect(resultsHeadline(0, true)).toBe('You tried!');
    expect(resultsHeadline(3, false)).toBe('All done!');
    expect(resultsCheerMessage(3, true)).toBe('Perfect! You got every one!');
    expect(resultsCheerMessage(2, true)).toBe('Nice work! Try one more for three stars.');
    expect(resultsCheerMessage(1, true)).toBe('Good start. Want to play it again?');
    expect(resultsCheerMessage(0, false)).toBe('Play the games next time to earn stars and a card!');
  });
});
