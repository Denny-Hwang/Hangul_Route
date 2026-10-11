import { describe, expect, it } from 'vitest';
import { findJamo, jamoAll } from '../../../content/jamo';
import { decompose, symbolKey, symbolsOf } from '../hangul';

describe('decompose', () => {
  it('splits a CV block into initial and medial with no final', () => {
    expect(decompose('가')).toEqual({ initial: 'ㄱ', medial: 'ㅏ', final: null });
    expect(decompose('너')).toEqual({ initial: 'ㄴ', medial: 'ㅓ', final: null });
  });

  it('splits a CVC block into initial, medial and final', () => {
    expect(decompose('물')).toEqual({ initial: 'ㅁ', medial: 'ㅜ', final: 'ㄹ' });
    expect(decompose('밥')).toEqual({ initial: 'ㅂ', medial: 'ㅏ', final: 'ㅂ' });
    expect(decompose('송')).toEqual({ initial: 'ㅅ', medial: 'ㅗ', final: 'ㅇ' });
  });

  it('keeps the silent initial ㅇ as an initial', () => {
    expect(decompose('아')).toEqual({ initial: 'ㅇ', medial: 'ㅏ', final: null });
    expect(decompose('안')).toEqual({ initial: 'ㅇ', medial: 'ㅏ', final: 'ㄴ' });
  });

  it('reports finals outside the six taught ones as they are', () => {
    expect(decompose('낮')).toEqual({ initial: 'ㄴ', medial: 'ㅏ', final: 'ㅈ' });
    expect(decompose('닭')).toEqual({ initial: 'ㄷ', medial: 'ㅏ', final: 'ㄺ' });
  });

  it('covers the first and last syllable of the Unicode block', () => {
    expect(decompose('가')?.initial).toBe('ㄱ');
    expect(decompose('힣')).toEqual({ initial: 'ㅎ', medial: 'ㅣ', final: 'ㅎ' });
  });

  it('returns null for anything that is not one precomposed syllable', () => {
    expect(decompose('ㄱ')).toBeNull();
    expect(decompose('a')).toBeNull();
    expect(decompose(' ')).toBeNull();
    expect(decompose('')).toBeNull();
    expect(decompose('가나')).toBeNull();
  });
});

describe('symbolsOf', () => {
  it('maps a word to jamo ids in reading order', () => {
    expect(symbolsOf('나')).toEqual(['jamo:nieun', 'jamo:a']);
    expect(symbolsOf('나무')).toEqual(['jamo:nieun', 'jamo:a', 'jamo:mieum', 'jamo:u']);
  });

  it('maps the initial ㅇ to jamo:ieung', () => {
    expect(symbolsOf('오')).toEqual(['jamo:ieung', 'jamo:o']);
    expect(symbolsOf('아이')).toEqual(['jamo:ieung', 'jamo:a', 'jamo:ieung', 'jamo:i']);
  });

  it('maps a taught final to its batchim id, not the initial id', () => {
    expect(symbolsOf('물')).toEqual(['jamo:mieum', 'jamo:u', 'jamo:rieul-batchim']);
    expect(symbolsOf('송')).toEqual(['jamo:siot', 'jamo:o', 'jamo:ieung-batchim']);
    expect(symbolsOf('한국')).toEqual([
      'jamo:hieut',
      'jamo:a',
      'jamo:nieun-batchim',
      'jamo:giyeok',
      'jamo:u',
      'jamo:giyeok-batchim',
    ]);
  });

  it('keeps a repeated symbol each time it is read', () => {
    expect(symbolsOf('밥')).toEqual(['jamo:bieup', 'jamo:a', 'jamo:bieup-batchim']);
  });

  it('only returns ids that exist in the jamo content', () => {
    for (const id of symbolsOf('한글호야안녕사랑곰봄집') ?? []) {
      expect(findJamo(id), id).toBeDefined();
    }
  });

  it('returns null when any part is outside the 30 symbols', () => {
    expect(symbolsOf('까')).toBeNull(); // tense initial
    expect(symbolsOf('개')).toBeNull(); // compound vowel
    expect(symbolsOf('낮')).toBeNull(); // final ㅈ is not taught
    expect(symbolsOf('나 무')).toBeNull(); // space
    expect(symbolsOf('na')).toBeNull();
    expect(symbolsOf('')).toBeNull();
  });
});

describe('symbolKey', () => {
  it('is the character for consonants and vowels', () => {
    expect(symbolKey(findJamo('jamo:giyeok')!)).toBe('ㄱ');
    expect(symbolKey(findJamo('jamo:eu')!)).toBe('ㅡ');
  });

  it('marks a batchim as final so it differs from the initial consonant', () => {
    expect(symbolKey(findJamo('jamo:giyeok-batchim')!)).toBe('ㄱ/final');
    expect(symbolKey(findJamo('jamo:giyeok')!)).not.toBe(symbolKey(findJamo('jamo:giyeok-batchim')!));
  });

  it('is unique across the 30 symbols', () => {
    const keys = jamoAll.map(symbolKey);
    expect(new Set(keys).size).toBe(30);
  });
});
