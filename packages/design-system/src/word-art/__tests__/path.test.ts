import { describe, expect, it } from 'vitest';
import { formatNumber, isWordArtPath, parsePath } from '../path';

/**
 * F-VOC-002 §3.1 path grammar: absolute `M L H V C Q A Z` only, numbers with
 * at most one decimal, one argument group per command, starting with `M`.
 */

describe('parsePath', () => {
  it('reads every allowed command with its arguments', () => {
    expect(parsePath('M 1 2 L 3 4 H 5 V 6 C 1 2 3 4 5 6 Q 1 2 3 4 A 5 5 0 1 0 7 8 Z')).toEqual([
      { c: 'M', a: [1, 2] },
      { c: 'L', a: [3, 4] },
      { c: 'H', a: [5] },
      { c: 'V', a: [6] },
      { c: 'C', a: [1, 2, 3, 4, 5, 6] },
      { c: 'Q', a: [1, 2, 3, 4] },
      { c: 'A', a: [5, 5, 0, 1, 0, 7, 8] },
      { c: 'Z', a: [] },
    ]);
  });

  it('accepts commas, tight spacing, negatives and one decimal', () => {
    expect(parsePath('M-1.5,2L3.5 -4Z')).toEqual([
      { c: 'M', a: [-1.5, 2] },
      { c: 'L', a: [3.5, -4] },
      { c: 'Z', a: [] },
    ]);
  });

  it.each([
    ['empty', ''],
    ['does not start with M', 'L 1 2'],
    ['relative command', 'M 1 2 l 3 4'],
    ['smooth cubic S', 'M 1 2 S 1 2 3 4'],
    ['smooth quadratic T', 'M 1 2 T 3 4'],
    ['two decimals', 'M 1.25 2'],
    ['leading dot', 'M .5 2'],
    ['too few arguments', 'M 1 2 L 3'],
    ['too few arguments before the next command', 'M 1 2 L 3 Z'],
    ['implicit repeat', 'M 1 2 L 3 4 5 6'],
    ['arc flag not 0 or 1', 'M 1 2 A 5 5 0 2 0 7 8'],
    ['negative arc radius', 'M 1 2 A -5 5 0 1 0 7 8'],
    ['stray character', 'M 1 2 L 3 4 #'],
    ['exponent', 'M 1e2 2'],
    ['argument after Z', 'M 1 2 Z 3'],
  ])('rejects %s', (_name, d) => {
    expect(parsePath(d)).toBeNull();
    expect(isWordArtPath(d)).toBe(false);
  });

  it('isWordArtPath is true for a valid path', () => {
    expect(isWordArtPath('M 0 0 L 10 10')).toBe(true);
  });
});

describe('formatNumber', () => {
  it('rounds to one decimal and never prints -0', () => {
    expect(formatNumber(12.345)).toBe('12.3');
    expect(formatNumber(12.36)).toBe('12.4');
    expect(formatNumber(4)).toBe('4');
    expect(formatNumber(-0.04)).toBe('0');
    expect(formatNumber(-3.25)).toBe('-3.2');
  });
});
