import { describe, expect, it } from 'vitest';
import { VISION_FILTERS, visionFilterId } from '../vision';

describe('colour-vision filters for the preview strip (F-VOC-002 §3.10)', () => {
  it('has the three simulations, in the order the strip shows them', () => {
    expect(VISION_FILTERS.map((v) => v.vision)).toEqual(['protanopia', 'deuteranopia', 'tritanopia']);
  });

  it('writes each Machado (2009) matrix as a 4 x 5 feColorMatrix that keeps alpha', () => {
    for (const v of VISION_FILTERS) {
      const values = v.values.split(' ').map(Number);
      expect(values).toHaveLength(20);
      expect(values.slice(15)).toEqual([0, 0, 0, 1, 0]);
      for (const row of [0, 1, 2]) expect(values[row * 5 + 3]).toBe(0);
    }
    expect(VISION_FILTERS[0]!.values.startsWith('0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0')).toBe(true);
  });

  it('keeps each row summing to about 1, so white stays white', () => {
    for (const v of VISION_FILTERS) {
      const n = v.values.split(' ').map(Number);
      for (const row of [0, 1, 2]) expect(n[row * 5]! + n[row * 5 + 1]! + n[row * 5 + 2]!).toBeCloseTo(1, 2);
    }
  });

  it('names a filter id per vision', () => {
    expect(visionFilterId('tritanopia')).toBe('word-art-tritanopia');
  });
});
