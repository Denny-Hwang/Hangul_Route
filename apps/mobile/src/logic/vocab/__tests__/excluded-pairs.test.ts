import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import { VOCAB_EXCLUDED_PAIRS, excludedPair } from '../excluded-pairs';

describe('VOCAB_EXCLUDED_PAIRS (F-VOC-004 §3.3 rule 1, overlapping words)', () => {
  it('lists the ball against each ball sport, and fire against light', () => {
    expect(VOCAB_EXCLUDED_PAIRS.map((pair) => [...pair])).toEqual([
      ['vocab:gong-ball', 'vocab:chukgu'],
      ['vocab:gong-ball', 'vocab:yagu'],
      ['vocab:gong-ball', 'vocab:nonggu'],
      ['vocab:gong-ball', 'vocab:baegu'],
      ['vocab:jadongcha', 'vocab:taeksi'],
      ['vocab:gicha', 'vocab:jihacheol'],
      ['vocab:bihaenggi', 'vocab:gonghang'],
      ['vocab:geurimja', 'vocab:gong-ball'],
      ['vocab:geurimja', 'vocab:hae-sun'],
      ['vocab:byeol', 'vocab:uju'],
      ['vocab:gureum', 'vocab:mujigae'],
      ['vocab:tteok', 'vocab:tteokbokki'],
      ['vocab:bul', 'vocab:bit'],
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
    expect(excludedPair('vocab:taeksi', 'vocab:jadongcha')).toBe(true);
    expect(excludedPair('vocab:gonghang', 'vocab:bihaenggi')).toBe(true);
    expect(excludedPair('vocab:bit', 'vocab:bul')).toBe(true);
    expect(excludedPair('vocab:chukgu', 'vocab:yagu')).toBe(false);
    expect(excludedPair('vocab:gong-ball', 'vocab:gong-ball')).toBe(false);
  });
});
