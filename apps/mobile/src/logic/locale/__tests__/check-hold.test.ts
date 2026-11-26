import { describe, expect, it } from 'vitest';
import { RUNGS } from '../../memory/spacing';
import { holdsRomanization, hostSurface, type HoldSurface } from '../check-hold';

/**
 * AMENDMENTS-STAGE1-DECODING-CHECK section 3.1 (row DC-1a): one rule for what a Check holds back until the question is
 * answered. Check surfaces hold every round; the Daily Review holds at the read and produce rungs only; `practice`
 * (and a call that names no surface) never holds.
 */
describe('holdsRomanization', () => {
  const CHECKS: readonly HoldSurface[] = ['quest-check', 'hangul-check', 'stage-check', 'cell-check'];

  it('a Check surface holds every round, whatever the rung', () => {
    for (const surface of CHECKS) {
      expect(holdsRomanization(surface)).toBe(true);
      for (const rung of RUNGS) expect(holdsRomanization(surface, rung)).toBe(true);
    }
  });

  it('the Daily Review holds at the read and produce rungs only; its recognize rung is practice', () => {
    expect(holdsRomanization('daily-review', 'read')).toBe(true);
    expect(holdsRomanization('daily-review', 'produce')).toBe(true);
    expect(holdsRomanization('daily-review', 'recognize')).toBe(false);
    // A round with no rung (a surface that passes none) is not held: the rule is per rung.
    expect(holdsRomanization('daily-review')).toBe(false);
  });

  it('practice never holds, at any rung', () => {
    expect(holdsRomanization('practice')).toBe(false);
    for (const rung of RUNGS) expect(holdsRomanization('practice', rung)).toBe(false);
  });
});

describe('hostSurface', () => {
  it('names the surface of a Listen & Pick host: the quest Check and the Hangul Check are Checks, every other host is practice', () => {
    expect(hostSurface('check')).toBe('quest-check');
    expect(hostSurface('review')).toBe('hangul-check');
    for (const mode of ['quest', 'vocab', 'preview'] as const) expect(hostSurface(mode)).toBe('practice');
  });
});
