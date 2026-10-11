import { describe, expect, it } from 'vitest';
import { derangeSeeded, hashSeed, isSameOrder, mulberry32, shuffleSeeded } from '../seeded-order';

describe('hashSeed (FNV-1a 32-bit)', () => {
  it('matches the published FNV-1a test vectors', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
  });

  it('is deterministic and stays an unsigned 32-bit integer', () => {
    const h = hashSeed('story:seollal-new-year|c1');
    expect(hashSeed('story:seollal-new-year|c1')).toBe(h);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(hashSeed('story:seollal-new-year|c2')).not.toBe(h);
  });
});

describe('mulberry32', () => {
  it('yields the same stream for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('stays in [0, 1) and differs across seeds', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('shuffleSeeded (Fisher-Yates)', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('is deterministic for a seed', () => {
    expect(shuffleSeeded(items, 99)).toEqual(shuffleSeeded(items, 99));
  });

  it('is always a permutation of the input', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect([...shuffleSeeded(items, seed)].sort()).toEqual(items);
    }
  });

  it('never mutates the input', () => {
    const copy = [...items];
    const out = shuffleSeeded(items, 5);
    expect(items).toEqual(copy);
    expect(out).not.toBe(items);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffleSeeded([], 1)).toEqual([]);
    expect(shuffleSeeded(['x'], 1)).toEqual(['x']);
  });

  it('spreads every item across every position over many seeds', () => {
    const counts = items.map(() => items.map(() => 0));
    const seeds = 2000;
    for (let seed = 0; seed < seeds; seed += 1) {
      shuffleSeeded(items, hashSeed(`s${seed}`)).forEach((item, pos) => {
        counts[items.indexOf(item)]![pos]! += 1;
      });
    }
    const expected = seeds / items.length;
    for (const row of counts) {
      for (const c of row) {
        expect(c).toBeGreaterThan(expected * 0.7);
        expect(c).toBeLessThan(expected * 1.3);
      }
    }
  });
});

describe('derangeSeeded (Sattolo)', () => {
  it('moves every item for n = 2..8 across 200 seeds', () => {
    for (let n = 2; n <= 8; n += 1) {
      const list = Array.from({ length: n }, (_, i) => i);
      for (let seed = 0; seed < 200; seed += 1) {
        const out = derangeSeeded(list, seed);
        expect([...out].sort((x, y) => x - y)).toEqual(list);
        out.forEach((v, i) => expect(v).not.toBe(i));
        expect(isSameOrder(out, list)).toBe(false);
      }
    }
  });

  it('is deterministic and never mutates the input', () => {
    const list = ['a', 'b', 'c', 'd'];
    const copy = [...list];
    expect(derangeSeeded(list, 3)).toEqual(derangeSeeded(list, 3));
    expect(list).toEqual(copy);
  });

  it('returns a copy for n < 2 (nothing can move)', () => {
    expect(derangeSeeded([], 1)).toEqual([]);
    const one = ['x'];
    const out = derangeSeeded(one, 1);
    expect(out).toEqual(['x']);
    expect(out).not.toBe(one);
  });

  it('swaps a pair', () => {
    expect(derangeSeeded(['a', 'b'], 11)).toEqual(['b', 'a']);
  });
});

describe('isSameOrder', () => {
  it('compares length and element identity in order', () => {
    expect(isSameOrder([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isSameOrder([1, 2, 3], [1, 3, 2])).toBe(false);
    expect(isSameOrder([1, 2], [1, 2, 3])).toBe(false);
    expect(isSameOrder([], [])).toBe(true);
  });
});
