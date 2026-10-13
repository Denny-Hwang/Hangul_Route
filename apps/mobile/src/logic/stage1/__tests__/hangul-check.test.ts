import { ListenPickRoundSchema, decomposeSyllable } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import {
  HANGUL_CHECK_CHUNK,
  HANGUL_CHECK_WORDS,
  buildHangulCheck,
  isSymbolItem,
  symbolRound,
} from '../hangul-check';
import { confusablesOf } from '../confusables';

describe('buildHangulCheck: the 35 items of the Hangul Check (F-QUEST-002 §3.9)', () => {
  const check = buildHangulCheck({ seed: 7 });

  it('has 30 symbol items, one per symbol, and 5 word items', () => {
    expect(check.items).toHaveLength(35);
    const symbols = check.items.filter((i) => i.kind === 'symbol');
    expect(symbols).toHaveLength(30);
    expect(new Set(symbols.map((i) => i.id))).toEqual(new Set(jamoAll.map((j) => j.id)));
    expect(check.items.filter((i) => i.kind === 'word')).toHaveLength(5);
  });

  it('gives every item 4 options, no two alike, and the answer among them; every round parses', () => {
    for (const item of check.items) {
      expect(item.round.options, item.id).toHaveLength(4);
      expect(new Set(item.round.options.map((o) => o.id)).size, item.id).toBe(4);
      expect(item.round.options.some((o) => o.id === item.round.answerId), item.id).toBe(true);
      expect(ListenPickRoundSchema.safeParse(item.round).success, item.id).toBe(true);
      // The round carries the item id, so the review host credits the right item.
      expect(item.round.id).toBe(item.id);
    }
  });

  it('asks a consonant or vowel by its sound among the target and its first three confusables', () => {
    const g = check.items.find((i) => i.id === 'jamo:giyeok');
    expect(g?.round.answerId).toBe('jamo:giyeok');
    expect(new Set(g?.round.options.map((o) => o.id))).toEqual(new Set(['jamo:giyeok', ...confusablesOf('jamo:giyeok')]));
    expect(g?.round.prompt.ko).toBe('가');
  });

  it('asks a final by its syllable with options that differ only in the final (or have none)', () => {
    for (const item of check.items.filter((i) => i.id.endsWith('-batchim'))) {
      const answer = item.round.options.find((o) => o.id === item.round.answerId);
      const target = decomposeSyllable(answer?.text?.ko ?? '');
      expect(target?.initial, item.id).toBe('ㅇ');
      expect(target?.medial, item.id).toBe(0); // ㅏ
      expect(item.round.prompt.ko).toBe(answer?.text?.ko);
      const finals = item.round.options.map((o) => {
        const parts = decomposeSyllable(o.text?.ko ?? '');
        expect(parts?.initial).toBe('ㅇ');
        expect(parts?.medial).toBe(0);
        return parts?.final ?? '';
      });
      expect(new Set(finals).size).toBe(4);
    }
    const prompts = check.items.filter((i) => i.id.endsWith('-batchim')).map((i) => i.round.prompt.ko).sort();
    expect(prompts).toEqual(['악', '안', '알', '암', '압', '앙'].sort());
  });

  it('asks each word by its picture among four of the five theme pictures, one word per theme', () => {
    expect(HANGUL_CHECK_WORDS.map((w) => w.theme)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
    const pictures = new Set(HANGUL_CHECK_WORDS.map((w) => w.picture));
    for (const item of check.items.filter((i) => i.kind === 'word')) {
      const word = HANGUL_CHECK_WORDS.find((w) => w.id === item.id);
      expect(word, item.id).toBeDefined();
      expect(item.round.answerId).toBe(word?.picture);
      expect(item.round.prompt).toEqual(word?.text);
      for (const o of item.round.options) {
        expect(pictures.has(o.pictureRef as never)).toBe(true);
        expect(o.labelEn).toBeTruthy();
      }
    }
  });

  it('comes in 5 chunks of 7: 6 symbols, then 1 word, the words in theme order', () => {
    expect(HANGUL_CHECK_CHUNK).toBe(7);
    expect(check.chunks).toHaveLength(5);
    check.chunks.forEach((chunk, c) => {
      expect(chunk).toHaveLength(7);
      expect(chunk.slice(0, 6).every((i) => i.kind === 'symbol')).toBe(true);
      expect(chunk[6]?.id).toBe(HANGUL_CHECK_WORDS[c]?.id);
    });
    expect(check.chunks.flat()).toEqual(check.items);
  });

  it('is deterministic by seed, and another seed changes the order', () => {
    expect(buildHangulCheck({ seed: 7 })).toEqual(check);
    const other = buildHangulCheck({ seed: 8 });
    expect(other.items.map((i) => i.id)).not.toEqual(check.items.map((i) => i.id));
  });

  it('does not keep the answer first: at index 0 at most 40 % of the time over 200 seeds', () => {
    let first = 0;
    let all = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      for (const item of buildHangulCheck({ seed }).items) {
        all += 1;
        if (item.round.options[0]?.id === item.round.answerId) first += 1;
      }
    }
    expect(first / all).toBeLessThanOrEqual(0.4);
  });

  it('tells symbol items from word items by id', () => {
    expect(isSymbolItem('jamo:giyeok')).toBe(true);
    expect(isSymbolItem('jamo:ieung-batchim')).toBe(true);
    expect(isSymbolItem('word:hangeul')).toBe(false);
  });
});

describe('symbolRound: never a dead item', () => {
  it('throws for a symbol it does not know, and for a final with no distractor row', () => {
    expect(() => symbolRound('jamo:nope')).toThrow(/Unknown symbol/);
    const final = jamoAll.find((j) => j.id === 'jamo:giyeok-batchim')!;
    expect(() => symbolRound('jamo:odd-batchim', [{ ...final, id: 'jamo:odd-batchim' }])).toThrow(/No final syllables/);
    expect(() => symbolRound('jamo:giyeok-batchim', [{ ...final, spokenKo: undefined }])).toThrow(/No final syllables/);
  });
});
