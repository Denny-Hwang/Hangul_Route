import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, sampleSeeded, shuffleSeeded } from '../assessment/rng';

describe('hashSeed', () => {
  it('is stable for the same parts', () => {
    expect(hashSeed(['run', 'a', '1'])).toBe(hashSeed(['run', 'a', '1']));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed(['anything', '한글']);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('changes when a part changes or the order changes', () => {
    expect(hashSeed(['a', 'b'])).not.toBe(hashSeed(['a', 'c']));
    expect(hashSeed(['a', 'b'])).not.toBe(hashSeed(['b', 'a']));
  });

  it('does not confuse where the parts are split', () => {
    expect(hashSeed(['ab', 'c'])).not.toBe(hashSeed(['a', 'bc']));
    expect(hashSeed(['a', ''])).not.toBe(hashSeed(['a']));
  });

  it('accepts an empty list', () => {
    expect(hashSeed([])).toBe(hashSeed([]));
  });
});

describe('createRng (mulberry32)', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is uniform enough: ten buckets stay within 20 percent of the mean', () => {
    const rng = createRng(hashSeed(['uniform']));
    const buckets = new Array<number>(10).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(rng() * 10);
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 10 * 0.8);
      expect(count).toBeLessThan(n / 10 * 1.2);
    }
  });

  it('accepts a negative or fractional seed without breaking the range', () => {
    const v = createRng(-5.7)();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe('shuffleSeeded', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];

  it('is a permutation and leaves the input untouched', () => {
    const copy = [...items];
    const out = shuffleSeeded(items, createRng(3));
    expect(items).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
    expect(out).not.toBe(items);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(shuffleSeeded(items, createRng(9))).toEqual(shuffleSeeded(items, createRng(9)));
    const orders = new Set<string>();
    for (let s = 0; s < 20; s += 1) orders.add(shuffleSeeded(items, createRng(s)).join(','));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffleSeeded([], createRng(1))).toEqual([]);
    expect(shuffleSeeded(['x'], createRng(1))).toEqual(['x']);
  });

  it('puts every item in every position over many seeds', () => {
    const seen = new Set<number>();
    for (let s = 0; s < 200; s += 1) seen.add(shuffleSeeded([0, 1, 2, 3], createRng(s)).indexOf(0));
    expect(seen.size).toBe(4);
  });
});

describe('sampleSeeded', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('returns n distinct items from the list', () => {
    const out = sampleSeeded(items, 3, createRng(5));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect(items).toContain(v);
  });

  it('is deterministic for a seed', () => {
    expect(sampleSeeded(items, 4, createRng(11))).toEqual(sampleSeeded(items, 4, createRng(11)));
  });

  it('returns everything when n is at least the length, and nothing for n <= 0', () => {
    expect([...sampleSeeded(items, 99, createRng(1))].sort()).toEqual(items);
    expect(sampleSeeded(items, 0, createRng(1))).toEqual([]);
    expect(sampleSeeded(items, -2, createRng(1))).toEqual([]);
  });

  it('does not change the input', () => {
    const copy = [...items];
    sampleSeeded(items, 2, createRng(1));
    expect(items).toEqual(copy);
  });
});
