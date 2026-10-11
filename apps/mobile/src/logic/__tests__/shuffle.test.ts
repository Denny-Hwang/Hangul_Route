import { afterEach, describe, expect, it, vi } from 'vitest';
import { shuffle } from '../shuffle';

/** The generator `round-builder.ts` carried inline before the move (F-VOC-004 §3.3), kept here as the reference. */
function reference<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

describe('shuffle (logic/shuffle.ts, the seeded LCG moved out of round-builder unchanged)', () => {
  afterEach(() => vi.useRealTimers());

  it('matches the pre-move generator for every seed and length tried', () => {
    for (const length of [0, 1, 2, 3, 4, 7, 12, 40]) {
      const items = Array.from({ length }, (_, i) => i);
      for (const seed of [0, 1, 7, 42, 1234, 99991, 233279, 1760000000000]) {
        expect(shuffle(items, seed)).toEqual(reference(items, seed));
      }
    }
  });

  it('pins a few exact orders so a change to the constants is caught', () => {
    expect(shuffle(['a', 'b', 'c', 'd'], 1)).toEqual(['c', 'a', 'd', 'b']);
    expect(shuffle([1, 2, 3, 4, 5], 7)).toEqual([2, 4, 1, 5, 3]);
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], 1234)).toEqual([8, 3, 5, 6, 1, 7, 2, 4]);
  });

  it('returns a permutation and never mutates its input', () => {
    const input = Object.freeze([3, 1, 4, 1, 5, 9, 2, 6]);
    const out = shuffle(input, 5);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual([3, 1, 4, 1, 5, 9, 2, 6]);
  });

  it('is deterministic for a seed and seeds from Date.now() when none is given', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(items, 77)).toEqual(shuffle(items, 77));
    vi.useFakeTimers();
    vi.setSystemTime(123456);
    expect(shuffle(items)).toEqual(reference(items, 123456));
  });
});
