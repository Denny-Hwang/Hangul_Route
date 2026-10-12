import { COLOR_SWATCHES } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import { VOCAB_EXCLUDED_PAIRS, excludedPair } from '../excluded-pairs';

describe('VOCAB_EXCLUDED_PAIRS (F-VOC-004 §3.3 rule 1, overlapping words)', () => {
  it('lists the ball against each ball sport, fire against light, and the overlapping pictures of the art batches', () => {
    expect(VOCAB_EXCLUDED_PAIRS.map((pair) => [...pair])).toEqual([
      ['vocab:gureum', 'vocab:bi-rain'],
      ['vocab:gureum', 'vocab:haneul'],
      ['vocab:chilpan', 'vocab:seonsaengnim'],
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
      ['vocab:ip', 'vocab:i-tooth'],
      ['vocab:son', 'vocab:pal-arm'],
      ['vocab:dari-leg', 'vocab:bal'],
      ['vocab:ppalgansaek', 'vocab:sagwa-apple'],
      ['vocab:noransaek', 'vocab:banana'],
      ['vocab:paransaek', 'vocab:mul'],
      ['vocab:haneulsaek', 'vocab:gureum'],
      ['vocab:haneulsaek', 'vocab:haneul'],
      ['vocab:galsaek', 'vocab:gom'],
      ['vocab:hoesaek', 'vocab:kokkiri'],
      ['vocab:hayansaek', 'vocab:uyu'],
      ['vocab:bunhongsaek', 'vocab:kkot'],
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
    expect(excludedPair('vocab:bi-rain', 'vocab:gureum')).toBe(true);
    expect(excludedPair('vocab:seonsaengnim', 'vocab:chilpan')).toBe(true);
    expect(excludedPair('vocab:chukgu', 'vocab:gong-ball')).toBe(true);
    expect(excludedPair('vocab:taeksi', 'vocab:jadongcha')).toBe(true);
    expect(excludedPair('vocab:gonghang', 'vocab:bihaenggi')).toBe(true);
    expect(excludedPair('vocab:bit', 'vocab:bul')).toBe(true);
    expect(excludedPair('vocab:i-tooth', 'vocab:ip')).toBe(true);
    expect(excludedPair('vocab:pal-arm', 'vocab:son')).toBe(true);
    expect(excludedPair('vocab:bal', 'vocab:dari-leg')).toBe(true);
    expect(excludedPair('vocab:son', 'vocab:bal')).toBe(false);
    expect(excludedPair('vocab:chukgu', 'vocab:yagu')).toBe(false);
    expect(excludedPair('vocab:gong-ball', 'vocab:gong-ball')).toBe(false);
  });
});

describe('VOCAB_EXCLUDED_PAIRS: colour swatch stickers (F-VOC-002 §3.6.1)', () => {
  it('keeps every colour word apart from each word drawn with its sticker glyph', () => {
    let checked = 0;
    for (const [colorKey, { object }] of Object.entries(COLOR_SWATCHES)) {
      const colour = VOCAB_ITEMS.find((i) => i.visual === `word:${colorKey}`);
      expect(colour, colorKey).toBeDefined();
      for (const word of VOCAB_ITEMS.filter((i) => i.visual === `word:${object}`)) {
        expect(excludedPair(colour?.id as string, word.id), `${colour?.id} / ${word.id}`).toBe(true);
        checked += 1;
      }
    }
    // apple, banana, water, cloud, bear, elephant, milk, flower; tangerine, leaf, grapes and crow are props, not words
    expect(checked).toBe(8);
  });

  it('keeps sky blue apart from the sky, which draws two clouds', () => {
    expect(excludedPair('vocab:haneul', 'vocab:haneulsaek')).toBe(true);
    expect(excludedPair('vocab:kkot', 'vocab:bunhongsaek')).toBe(true);
    expect(excludedPair('vocab:sagwa-apple', 'vocab:juhwangsaek')).toBe(false);
  });
});
