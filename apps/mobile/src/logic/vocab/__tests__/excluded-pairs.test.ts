import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import { VOCAB_EXCLUDED_PAIRS, excludedPair } from '../excluded-pairs';

describe('VOCAB_EXCLUDED_PAIRS (F-VOC-004 §3.3 rule 1, overlapping words)', () => {
  it('lists the ball against each ball sport, fire against light, and the overlapping pictures of the art batches', () => {
    expect(VOCAB_EXCLUDED_PAIRS.map((pair) => [...pair])).toEqual([
      ['vocab:gong-ball', 'vocab:chukgu'],
      ['vocab:gong-ball', 'vocab:yagu'],
      ['vocab:gong-ball', 'vocab:nonggu'],
      ['vocab:gong-ball', 'vocab:baegu'],
      ['vocab:bul', 'vocab:bit'],
      ['vocab:ip', 'vocab:i-tooth'],
      ['vocab:son', 'vocab:pal-arm'],
      ['vocab:dari-leg', 'vocab:bal'],
    ]);
  });

  it('names only items of the catalogue, and never one word twice in a pair', () => {
    const ids = new Set(VOCAB_ITEMS.map((i) => i.id));
    for (const [a, b] of VOCAB_EXCLUDED_PAIRS) {
      expect(ids, a).toContain(a);
      expect(ids, b).toContain(b);
      expect(a).not.toBe(b);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(VOCAB_EXCLUDED_PAIRS)).toBe(true);
  });

  it('matches a pair in either order and nothing else', () => {
    expect(excludedPair('vocab:gong-ball', 'vocab:chukgu')).toBe(true);
    expect(excludedPair('vocab:chukgu', 'vocab:gong-ball')).toBe(true);
    expect(excludedPair('vocab:bit', 'vocab:bul')).toBe(true);
    expect(excludedPair('vocab:i-tooth', 'vocab:ip')).toBe(true);
    expect(excludedPair('vocab:pal-arm', 'vocab:son')).toBe(true);
    expect(excludedPair('vocab:bal', 'vocab:dari-leg')).toBe(true);
    expect(excludedPair('vocab:son', 'vocab:bal')).toBe(false);
    expect(excludedPair('vocab:chukgu', 'vocab:yagu')).toBe(false);
    expect(excludedPair('vocab:gong-ball', 'vocab:gong-ball')).toBe(false);
  });
});
