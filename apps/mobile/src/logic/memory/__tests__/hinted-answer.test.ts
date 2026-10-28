import { describe, expect, it } from 'vitest';
import { hintedForMemory } from '../hinted-answer';

/**
 * What a quest step hands the memory store as a hinted answer (F-CURR-002 section 4.3). The merged CM-31, CM-34 and
 * CM-35 games all pass `hinted`, with two meanings: Type Hangul's hint (Dictation's Show how it sounds, a one-letter
 * slip) is a hinted right answer whatever it scored; Story Order's and Role Play's Show meanings is help shown, so a
 * wrong answer with it is still a plain miss.
 */
describe('hintedForMemory', () => {
  it('Type Hangul: a hinted answer is hinted, right or wrong', () => {
    expect(hintedForMemory('type-hangul', true, true)).toBe(true);
    expect(hintedForMemory('type-hangul', false, true)).toBe(true);
  });

  it('Story Order and Role Play: hinted only with a right answer', () => {
    for (const kind of ['story-order', 'role-play'] as const) {
      expect(hintedForMemory(kind, true, true), kind).toBe(true);
      expect(hintedForMemory(kind, false, true), kind).toBe(false);
    }
  });

  it('no hint, no hinted answer', () => {
    expect(hintedForMemory('type-hangul', false, undefined)).toBe(false);
    expect(hintedForMemory('role-play', true, false)).toBe(false);
  });
});
