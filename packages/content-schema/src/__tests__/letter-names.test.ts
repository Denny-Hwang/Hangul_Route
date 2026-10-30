import { describe, expect, it } from 'vitest';
import { CONSONANT_NAMES, NAMED_LETTERS, VOWEL_NAMES, spellBlock, spellByLetterNames } from '../hangul/letter-names';
import { composeSyllable } from '../romanization/hangul';

describe('spelling by letter names (F-CURR-002 section 4.5, the spelling round)', () => {
  it('spells the section 4.5 pair apart, though both sound [채기]', () => {
    expect(spellByLetterNames('책이')).toBe('치읓 애 기역, 이응 이');
    expect(spellByLetterNames('채기')).toBe('치읓 애, 기역 이');
    expect(spellByLetterNames('책이')).not.toBe(spellByLetterNames('채기'));
  });

  it('spells the homophones 낫 / 낮 / 낯 apart', () => {
    expect(['낫', '낮', '낯'].map(spellByLetterNames)).toEqual(['니은 아 시옷', '니은 아 지읒', '니은 아 치읓']);
  });

  it('names tense letters, two-letter finals and every vowel', () => {
    expect(spellBlock('쌀')).toBe('쌍시옷 아 리을');
    expect(spellBlock('닭')).toBe('디귿 아 리을 기역');
    expect(spellBlock('값')).toBe('기역 아 비읍 시옷');
    expect(spellBlock('의')).toBe('이응 의');
    expect(spellBlock('a')).toBe('a');
  });

  it('joins words with a period, keeps NFC and drops what is not a block', () => {
    expect(spellByLetterNames(' 사과  주세요 ')).toBe('시옷 아, 기역 와. 지읒 우, 시옷 에, 이응 요');
    expect(spellByLetterNames('사과!')).toBe('시옷 아, 기역 와');
    expect(spellByLetterNames('사')).toBe('시옷 아');
    expect(spellByLetterNames('!!')).toBe('');
  });

  it('names every first letter, final and vowel', () => {
    for (const initial of NAMED_LETTERS.initials) expect(CONSONANT_NAMES[initial], initial).toMatch(/^[가-힣]{2,3}$/);
    expect(VOWEL_NAMES).toHaveLength(21);
    for (const final of NAMED_LETTERS.finals) {
      const block = composeSyllable({ initial: 'ㅇ', medial: 0, final }) as string;
      expect(spellBlock(block).split(' ').length, final).toBeGreaterThanOrEqual(3);
    }
    VOWEL_NAMES.forEach((name, medial) => expect(composeSyllable({ initial: 'ㅇ', medial, final: '' })).toBe(name));
  });
});
