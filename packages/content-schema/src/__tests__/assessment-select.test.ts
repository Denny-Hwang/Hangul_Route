import { describe, expect, it } from 'vitest';
import { createRng } from '../assessment/rng';
import { selectSpread } from '../assessment/select';

interface Cand {
  id: string;
  group: string;
  ok?: boolean;
}

const cands: Cand[] = [
  { id: 'a1', group: 'a' },
  { id: 'a2', group: 'a' },
  { id: 'a3', group: 'a' },
  { id: 'b1', group: 'b' },
  { id: 'b2', group: 'b' },
  { id: 'c1', group: 'c' },
];

const run = (over: Partial<Parameters<typeof selectSpread<Cand>>[0]> = {}, seed = 1): Cand[] =>
  selectSpread<Cand>({
    candidates: cands,
    count: 3,
    rng: createRng(seed),
    spreadBy: (c) => c.group,
    ...over,
  });

describe('selectSpread', () => {
  it('returns count distinct candidates', () => {
    const out = run({ count: 4 });
    expect(out).toHaveLength(4);
    expect(new Set(out.map((c) => c.id)).size).toBe(4);
  });

  it('spreads over distinct spreadBy values before repeating one', () => {
    for (let s = 0; s < 50; s += 1) {
      const three = run({ count: 3 }, s);
      expect(new Set(three.map((c) => c.group)).size).toBe(3);
      const five = run({ count: 5 }, s);
      const counts: Record<string, number> = {};
      for (const c of five) counts[c.group] = (counts[c.group] ?? 0) + 1;
      expect(counts['c']).toBe(1);
      expect(counts['a']).toBe(2);
      expect(counts['b']).toBe(2);
    }
  });

  it('applies the filter first', () => {
    const out = run({ count: 3, filter: (c) => c.group !== 'a' });
    expect(out.map((c) => c.id).sort()).toEqual(['b1', 'b2', 'c1']);
  });

  it('skips excluded ids (array or set)', () => {
    const viaArray = run({ count: 6, exclude: ['a1', 'b1'] });
    expect(viaArray.map((c) => c.id).sort()).toEqual(['a2', 'a3', 'b2', 'c1']);
    const viaSet = run({ count: 6, exclude: new Set(['c1']) });
    expect(viaSet.map((c) => c.id)).not.toContain('c1');
  });

  it('returns what it has when fewer than count remain', () => {
    expect(run({ count: 10 })).toHaveLength(6);
    expect(run({ count: 3, filter: () => false })).toEqual([]);
  });

  it('returns nothing for a count of zero or less and truncates a fractional count', () => {
    expect(run({ count: 0 })).toEqual([]);
    expect(run({ count: -3 })).toEqual([]);
    expect(run({ count: 2.9 })).toHaveLength(2);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(run({}, 12)).toEqual(run({}, 12));
    const picks = new Set<string>();
    for (let s = 0; s < 30; s += 1) picks.add(run({}, s).map((c) => c.id).join(','));
    expect(picks.size).toBeGreaterThan(5);
  });

  it('does not change the candidate list', () => {
    const copy = cands.map((c) => ({ ...c }));
    run({ count: 6 });
    expect(cands).toEqual(copy);
  });

  it('works with a single group (everything is a repeat)', () => {
    const out = run({ count: 2, spreadBy: () => 'same' });
    expect(out).toHaveLength(2);
  });
});
