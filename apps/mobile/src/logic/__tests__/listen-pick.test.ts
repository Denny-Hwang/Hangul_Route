import type { ListenPickRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { MinigameScope } from '../minigame-config';
import { distractorsFor, roundCount, shuffleOptions, validRounds } from '../listen-pick';

const text = (ko: string, romanization: string) => ({ ko, romanization, en: ko });

function round(id: string, ids: string[], answerId: string): ListenPickRound {
  return {
    id,
    prompt: text('가', 'ga'),
    options: ids.map((i) => ({ id: i, text: text(i, i) })),
    answerId,
  };
}

const four = round('r', ['a', 'b', 'c', 'd'], 'a');

describe('shuffleOptions (F-QUEST-002 §3.10)', () => {
  it('is deterministic for a seed and does not touch its input', () => {
    const before = JSON.stringify(four);
    expect(shuffleOptions(four, 7)).toEqual(shuffleOptions(four, 7));
    expect(JSON.stringify(four)).toBe(before);
  });

  it('keeps the same options, the same answer and everything else', () => {
    for (let seed = 0; seed < 50; seed++) {
      const out = shuffleOptions(four, seed);
      expect(out.options.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(out.answerId).toBe('a');
      expect(out.id).toBe('r');
      expect(out.prompt).toEqual(four.prompt);
    }
  });

  it('puts the answer in every position over many seeds, and first at most 40% of the time', () => {
    const at = [0, 0, 0, 0];
    for (let seed = 0; seed < 200; seed++) {
      at[shuffleOptions(four, seed).options.findIndex((o) => o.id === 'a')]!++;
    }
    for (const count of at) expect(count).toBeGreaterThan(0);
    expect(at[0]! / 200).toBeLessThanOrEqual(0.4);
  });

  it('gives different orders for different seeds', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) orders.add(shuffleOptions(four, seed).options.map((o) => o.id).join());
    expect(orders.size).toBeGreaterThan(5);
  });

  it('copes with a two-option round', () => {
    const two = round('t', ['x', 'y'], 'y');
    const seen = new Set(Array.from({ length: 20 }, (_, s) => shuffleOptions(two, s).options[0]!.id));
    expect(seen).toEqual(new Set(['x', 'y']));
  });
});

describe('validRounds / roundCount', () => {
  const bad = round('bad', ['a', 'b'], 'zzz');
  const scope = (rounds: ListenPickRound[] | undefined): MinigameScope => ({
    kind: 'listen-pick',
    ...(rounds ? { listenPick: { rounds } } : {}),
  });

  it('keeps rounds whose answer is one of their options', () => {
    const good = round('g', ['a', 'b'], 'b');
    expect(validRounds(scope([good, bad, four])).map((r) => r.id)).toEqual(['g', 'r']);
    expect(roundCount(scope([good, bad, four]))).toBe(2);
  });

  it('skips a round with fewer than two options', () => {
    expect(roundCount(scope([round('one', ['a'], 'a')]))).toBe(0);
  });

  it('counts zero for a scope without rounds', () => {
    expect(validRounds(scope(undefined))).toEqual([]);
    expect(roundCount(scope([]))).toBe(0);
  });
});

describe('distractorsFor (syllable options that differ only in the final)', () => {
  it('lists the open syllable first, then the taught finals in order', () => {
    expect(distractorsFor('달', 2)).toEqual(['다', '단']);
    expect(distractorsFor('송', 2)).toEqual(['소', '손']);
    expect(distractorsFor('달', 6)).toEqual(['다', '단', '당', '닥', '담', '답']);
  });

  it('uses the finals the caller allows, in the caller order', () => {
    expect(distractorsFor('곰', 3, ['ㅇ', 'ㄹ'])).toEqual(['고', '공', '골']);
  });

  it('never returns the target and drops the open syllable for a target that has none', () => {
    expect(distractorsFor('다', 2)).toEqual(['단', '달']);
    expect(distractorsFor('달', 5)).not.toContain('달');
  });

  it('returns fewer when there are not enough finals to choose from', () => {
    expect(distractorsFor('달', 9, ['ㄴ'])).toEqual(['다', '단']);
  });

  it('returns nothing for count 0', () => {
    expect(distractorsFor('달', 0)).toEqual([]);
  });

  it('rejects anything that is not one Hangul syllable', () => {
    expect(() => distractorsFor('ㄱ', 1)).toThrow(/one Hangul syllable/);
    expect(() => distractorsFor('달달', 1)).toThrow(/one Hangul syllable/);
    expect(() => distractorsFor('a', 1)).toThrow(/one Hangul syllable/);
  });

  it('rejects a final that cannot be composed onto the syllable', () => {
    expect(() => distractorsFor('달', 2, ['ㅏ'])).toThrow(/not a final/);
  });
});
