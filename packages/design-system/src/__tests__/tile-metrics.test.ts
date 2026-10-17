import { describe, expect, it } from 'vitest';
import { tileMetrics } from '../components/Tile/metrics';
import { typeScale } from '../text-size';
import { touchTarget, typography } from '../tokens';

/** F-LAYOUT-001 LD4: a tile scales with the window, never below its size step; its glyph grows with it. */
describe('tileMetrics', () => {
  it('is the size step and its type size without a dimension (unchanged phone tiles)', () => {
    expect(tileMetrics('sm')).toEqual({ dim: touchTarget.min, glyph: typography.size.title });
    expect(tileMetrics('md')).toEqual({ dim: touchTarget.child, glyph: typography.size.display });
    expect(tileMetrics('lg')).toEqual({ dim: touchTarget.hero, glyph: typography.size.hero });
  });

  it('takes the scaled side and grows the glyph in proportion', () => {
    expect(tileMetrics('lg', 134)).toEqual({ dim: 134, glyph: Math.round((typography.size.hero * 134) / touchTarget.hero) });
    expect(tileMetrics('md', 112)).toEqual({ dim: 112, glyph: Math.round((typography.size.display * 112) / touchTarget.child) });
  });

  it('never goes below the size step, so the touch target never shrinks', () => {
    expect(tileMetrics('lg', 40)).toEqual({ dim: touchTarget.hero, glyph: typography.size.hero });
  });

  it('falls back to the size step for a non-finite dimension', () => {
    expect(tileMetrics('md', Number.NaN)).toEqual({ dim: touchTarget.child, glyph: typography.size.display });
    expect(tileMetrics('md', Number.POSITIVE_INFINITY)).toEqual({ dim: touchTarget.child, glyph: typography.size.display });
  });
});

describe('tileMetrics at the chosen text size (owner items 6 and 7)', () => {
  it('the glyph starts from the scaled large type; the side stays the step (a minimum)', () => {
    const largest = typeScale(1.5).size;
    expect(tileMetrics('sm', undefined, largest)).toEqual({ dim: touchTarget.min, glyph: 35 });
    expect(tileMetrics('md', undefined, largest)).toEqual({ dim: touchTarget.child, glyph: 45 });
    expect(tileMetrics('lg', undefined, largest)).toEqual({ dim: touchTarget.hero, glyph: 60 });
    // With a media-scaled side the scaled glyph grows in proportion too.
    expect(tileMetrics('md', touchTarget.child * 1.2, largest).glyph).toBe(Math.round((45 * touchTarget.child * 1.2) / touchTarget.child));
    expect(tileMetrics('md', undefined, typeScale(1).size)).toEqual(tileMetrics('md'));
  });
});
