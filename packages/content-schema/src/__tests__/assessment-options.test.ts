import { describe, expect, it } from 'vitest';
import { placeCorrect } from '../assessment/options';
import { createRng, hashSeed } from '../assessment/rng';
import type { AssessmentOption } from '../assessment/question';

const opts = (n: number, correctAt = 0): AssessmentOption[] =>
  Array.from({ length: n }, (_, i) => ({ id: `o${i}`, ko: `가${i}`, isCorrect: i === correctAt }));

const indexOfCorrect = (list: readonly AssessmentOption[]): number => list.findIndex((o) => o.isCorrect);

describe('placeCorrect', () => {
  it('returns a permutation of the options and leaves the input untouched', () => {
    const input = opts(4);
    const snapshot = JSON.parse(JSON.stringify(input)) as AssessmentOption[];
    const out = placeCorrect(input, createRng(1));
    expect(input).toEqual(snapshot);
    expect(out).toHaveLength(4);
    expect(out.map((o) => o.id).sort()).toEqual(['o0', 'o1', 'o2', 'o3']);
  });

  it('is deterministic for a seed', () => {
    const a = placeCorrect(opts(4), createRng(hashSeed(['x'])));
    const b = placeCorrect(opts(4), createRng(hashSeed(['x'])));
    expect(a).toEqual(b);
  });

  it.each([2, 3, 4])('puts the correct option first in at most 35 percent of 200 seeds (%i options)', (n) => {
    for (const base of [0, 1000, 77777]) {
      let first = 0;
      for (let s = 0; s < 200; s += 1) {
        const out = placeCorrect(opts(n, s % n), createRng(base + s));
        if (indexOfCorrect(out) === 0) first += 1;
      }
      expect(first / 200).toBeLessThanOrEqual(0.35);
    }
  });

  it('uses every slot, so the answer is not a pattern (4 options)', () => {
    const seen = new Set<number>();
    for (let s = 0; s < 200; s += 1) seen.add(indexOfCorrect(placeCorrect(opts(4), createRng(s))));
    expect(seen.size).toBe(4);
  });

  it('can leave the correct option first when avoidFirst is false', () => {
    let first = 0;
    for (let s = 0; s < 400; s += 1) {
      if (indexOfCorrect(placeCorrect(opts(4), createRng(s), false)) === 0) first += 1;
    }
    expect(first / 400).toBeGreaterThan(0.15);
  });

  it('never repeats the same index three times in a row within a run', () => {
    for (let run = 0; run < 100; run += 1) {
      const rng = createRng(hashSeed(['run', String(run)]));
      const history: number[] = [];
      for (let q = 0; q < 24; q += 1) {
        const out = placeCorrect(opts(4), rng, true, history);
        history.push(indexOfCorrect(out));
      }
      for (let i = 2; i < history.length; i += 1) {
        expect(history[i] === history[i - 1] && history[i] === history[i - 2]).toBe(false);
      }
    }
  });

  it('keeps the guard with two options when avoidFirst is false', () => {
    const rng = createRng(5);
    const history: number[] = [];
    for (let q = 0; q < 60; q += 1) {
      history.push(indexOfCorrect(placeCorrect(opts(2), rng, false, history)));
    }
    for (let i = 2; i < history.length; i += 1) {
      expect(history[i] === history[i - 1] && history[i] === history[i - 2]).toBe(false);
    }
  });

  it('still honours the guard when the only other slot is the first one', () => {
    const out = placeCorrect(opts(2), createRng(3), true, [1, 1]);
    expect(indexOfCorrect(out)).toBe(0);
  });

  it('ignores a history shorter than two or with different recent indexes', () => {
    expect(() => placeCorrect(opts(4), createRng(3), true, [])).not.toThrow();
    expect(() => placeCorrect(opts(4), createRng(3), true, [2])).not.toThrow();
    const out = placeCorrect(opts(4), createRng(3), true, [1, 2, 1]);
    expect(out).toHaveLength(4);
  });

  it('throws unless exactly one option is correct', () => {
    expect(() => placeCorrect(opts(3).map((o) => ({ ...o, isCorrect: false })), createRng(1))).toThrow(/exactly one/);
    expect(() => placeCorrect(opts(3).map((o) => ({ ...o, isCorrect: true })), createRng(1))).toThrow(/exactly one/);
  });

  it('handles a single option', () => {
    const one = opts(1);
    expect(placeCorrect(one, createRng(1))).toEqual(one);
  });
});

describe('placeCorrect with nowhere to move', () => {
  it('keeps a single option in place even when the guard would bar its slot', () => {
    const one = opts(1);
    expect(placeCorrect(one, createRng(1), false, [0, 0])).toEqual(one);
  });
});
